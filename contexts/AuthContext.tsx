'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { User } from '../types';
import { readRecords } from '../services/api';
import { localStorageGet, localStorageSet, localStorageRemove, setCookie, deleteCookie } from '../utils/storage';

const AUTH_STORAGE_KEY = 'limperial_auth_user';
// Only active in development builds. Guard prevents accidental use in production.
const DEV_AUTO_LOGIN_EMAIL =
  process.env.NODE_ENV === 'development'
    ? (process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN ?? '')
    : '';

if (process.env.NODE_ENV !== 'development' && process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN) {
  console.warn('[Auth] NEXT_PUBLIC_DEV_AUTO_LOGIN is set in a non-development environment. It will be ignored.');
}

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  currentUser: User | null;
  users: User[] | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Stable singleton — created once per component lifetime, not on every render
  const supabase = useMemo(() => createClient(), []);

  const [users, setUsers] = useState<User[] | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Ref gives the auth-state-change listener access to the latest users list
  // without creating a new effect dependency that would cause re-runs
  const usersRef = useRef<User[] | null>(null);
  useEffect(() => { usersRef.current = users; }, [users]);

  // Tracks whether a deliberate logout is in progress.
  // Prevents the async SIGNED_OUT event from wiping state that was already
  // overwritten by a subsequent login (race condition: signOut fires late).
  const isLoggingOutRef = useRef(false);

  // Sync a Supabase email to our custom Users table record
  const syncUser = useCallback((email: string, allUsers: User[]) => {
    const user = allUsers.find(
      u => u.Email?.trim().toLowerCase() === email.trim().toLowerCase()
    );
    if (user && user.Status === 'Active') {
      setCurrentUser(user);
      localStorageSet(AUTH_STORAGE_KEY, user.UserID);
      setCookie('limperial_legacy_session', user.UserID, 7);
      return user;
    }
    return null;
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Safety net: unblock UI after 8s if something still hangs unexpectedly
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('[Auth] Bootstrap timed out — check Supabase connectivity.');
        setIsAuthLoading(false);
      }
    }, 8000);

    const bootstrapAuth = async () => {
      try {
        // Step 0: Restore from localStorage immediately — unblocks UI for returning users
        const savedUserId = localStorageGet(AUTH_STORAGE_KEY);
        if (savedUserId && isMounted) {
          // Optimistically restore — will be verified/overwritten after Users fetch
          const cachedUser = { UserID: savedUserId } as User;
          setCurrentUser(cachedUser);
          setIsAuthLoading(false);
        }

        // Step 1: Get the active session with a 5s timeout
        const { data: { session }, error: sessionError } = await Promise.race([
          supabase!.auth.getSession(),
          new Promise<{ data: { session: null }, error: Error }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null }, error: new Error('getSession timed out') }), 5000)
          )
        ]);
        if (sessionError) {
          console.error('[Auth] Session error:', sessionError);
          if (sessionError.message?.toLowerCase().includes('refresh token') ||
              sessionError.message?.toLowerCase().includes('timed out')) {
            localStorageRemove(AUTH_STORAGE_KEY);
            deleteCookie('limperial_legacy_session');
            await supabase!.auth.signOut({ scope: 'local' }).catch(() => {});
            if (isMounted) { setCurrentUser(null); setIsAuthLoading(false); }
            return;
          }
        }
        if (!isMounted) return;

        // Step 2: Fetch the Users table with a 8s timeout.
        // The onAuthStateChange listener reuses this data via usersRef.
        const fetchedUsers = await Promise.race([
          readRecords<User>('Users'),
          new Promise<User[]>((_, reject) =>
            setTimeout(() => reject(new Error('Users fetch timed out')), 8000)
          )
        ]).catch(err => {
          console.warn('[Auth] Failed to read Users table:', err);
          return [] as User[];
        });
        if (!isMounted) return;

        setUsers(fetchedUsers);

        if (session?.user?.email) {
          syncUser(session.user.email, fetchedUsers);
        } else if (DEV_AUTO_LOGIN_EMAIL) {
          syncUser(DEV_AUTO_LOGIN_EMAIL, fetchedUsers);
        } else if (savedUserId) {
          // Restore from localStorage for sessions that survive page refresh
          const user = fetchedUsers.find(u => u.UserID === savedUserId);
          if (user) setCurrentUser(user);
        }
      } catch (error) {
        console.error('[Auth] CRITICAL: Bootstrap failed:', error);
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    bootstrapAuth();

    // Listener handles subsequent sign-in / sign-out events AFTER initial bootstrap.
    // It reuses usersRef — no duplicate fetch needed.
    const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (event, session) => {
      // Stale refresh token — clear everything and force re-login
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('[Auth] Refresh token invalid — clearing session.');
        setCurrentUser(null);
        localStorageRemove(AUTH_STORAGE_KEY);
        deleteCookie('limperial_legacy_session');
        await supabase!.auth.signOut({ scope: 'local' });
        return;
      }

      if (session?.user?.email) {
        // Use already-fetched list; only fetch if somehow still null (edge case)
        const usersList = usersRef.current ?? await readRecords<User>('Users').catch(() => [] as User[]);
        if (!usersRef.current && isMounted) setUsers(usersList);
        syncUser(session.user.email, usersList);
      } else if (event === 'SIGNED_OUT') {
        // Only clear state if this is a deliberate logout.
        // If isLoggingOutRef is false, the SIGNED_OUT fired late from a previous
        // session's signOut call — a new login has already set fresh state, so
        // we must NOT wipe it.
        if (!isLoggingOutRef.current) return;
        isLoggingOutRef.current = false;
        setCurrentUser(null);
        localStorageRemove(AUTH_STORAGE_KEY);
        deleteCookie('limperial_legacy_session');
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
    // Intentionally only runs once on mount. syncUser and supabase are stable refs.
     
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error } = await supabase!.auth.signInWithPassword({ email, password });

      if (error) {
        // Supabase Auth is the single source of truth for passwords.
        // The legacy plain-text password fallback has been removed for security.
        // If a user can't log in, use "Forgot password" to reset via Supabase Auth.
        return { success: false, message: error.message };
      }

      // Verify the user exists and is Active in our Users table
      if (data?.user?.email) {
        const usersList = usersRef.current ?? await readRecords<User>('Users').catch(() => [] as User[]);
        if (!usersRef.current) setUsers(usersList);
        const matched = syncUser(data.user.email, usersList);
        if (!matched) {
          // Auth succeeded but user not found or not Active — sign out immediately
          await supabase!.auth.signOut();
          return { success: false, message: 'Your account is not active or not registered. Please contact your administrator.' };
        }
      }

      return { success: true, message: 'Login successful!' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [supabase, syncUser]);

  const loginWithGoogle = useCallback(async () => {
    await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, [supabase]);

  const logout = useCallback(async () => {
    // Signal that this SIGNED_OUT event is intentional so the listener
    // knows it is safe to clear auth state.
    isLoggingOutRef.current = true;

    // Clear local state and the middleware cookie immediately so any
    // redirects during the async signOut don't see a stale session.
    setCurrentUser(null);
    localStorageRemove(AUTH_STORAGE_KEY);
    deleteCookie('limperial_legacy_session');

    // scope: 'local' clears only THIS tab's tokens without invalidating
    // other active sessions on other devices.
    await supabase!.auth.signOut({ scope: 'local' });
  }, [supabase]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!currentUser,
      isAuthLoading,
      currentUser,
      users,
      login,
      loginWithGoogle,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
