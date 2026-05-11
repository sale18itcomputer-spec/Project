'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { User } from '../types';
import { readRecords } from '../services/api';
import { localStorageGet, localStorageSet, localStorageRemove, setCookie, deleteCookie } from '../utils/storage';

const AUTH_STORAGE_KEY = 'limperial_auth_user';
const AUTH_USER_CACHE_KEY = 'limperial_auth_user_data';
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
  loginWithOtp: (email: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ success: boolean; message: string }>;
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
      localStorageSet(AUTH_USER_CACHE_KEY, JSON.stringify(user));
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
    }, 10000);

    const bootstrapAuth = async () => {
      try {
        // Step 0: Restore full user from cache — real object, not a stub
        const savedUserId = localStorageGet(AUTH_STORAGE_KEY);
        const savedUserRaw = localStorageGet(AUTH_USER_CACHE_KEY);
        let cachedUser: User | null = null;
        if (savedUserRaw) {
          try {
            cachedUser = JSON.parse(savedUserRaw) as User;
            if (cachedUser?.UserID && isMounted) {
              setCurrentUser(cachedUser);
              // Cache hit — unblock UI immediately, verify in background
              setIsAuthLoading(false);
            }
          } catch { cachedUser = null; }
        }

        // Step 1: Get the active session with a 5s timeout
        const { data: { session }, error: sessionError } = await Promise.race([
          supabase!.auth.getSession(),
          new Promise<{ data: { session: null }, error: Error }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null }, error: new Error('getSession timed out') }), 8000)
          )
        ]);
        if (sessionError) {
          console.error('[Auth] Session error:', sessionError);
          if (sessionError.message?.toLowerCase().includes('refresh token')) {
            // Invalid token — clear Supabase session, fall back to PIN
            await supabase!.auth.signOut({ scope: 'local' }).catch(() => {});
            // Keep currentUser from localStorage so PasscodeLock handles re-auth
          }
          // For timeout or other errors, continue with savedUserId below
        }
        if (!isMounted) return;

        // Step 2: Fetch Users — skip if cache is already warm from callback
        // This avoids a duplicate network call when signing in via Google OAuth
        const cacheIsWarm = !!cachedUser && !!savedUserId;
        const fetchedUsers = cacheIsWarm && !session
          ? [] // will use cachedUser path below
          : await Promise.race([
              readRecords<User>('Users'),
              new Promise<User[]>((_, reject) =>
                setTimeout(() => reject(new Error('Users fetch timed out')), 8000)
              )
            ]).catch(err => {
              console.warn('[Auth] Failed to read Users table:', err);
              return [] as User[];
            });
        if (!isMounted) return;
        if (fetchedUsers.length > 0) setUsers(fetchedUsers);

        if (session?.user?.email) {
          syncUser(session.user.email, fetchedUsers);
        } else if (DEV_AUTO_LOGIN_EMAIL) {
          syncUser(DEV_AUTO_LOGIN_EMAIL, fetchedUsers);
        } else if (savedUserId) {
          // Restore from localStorage — verify the user still exists and is active
          const user = fetchedUsers.find(u => u.UserID === savedUserId);
          if (user && user.Status === 'Active') {
            setCurrentUser(user);
            // Refresh the cache with latest user data
            localStorageSet(AUTH_USER_CACHE_KEY, JSON.stringify(user));
          } else if (!user && cachedUser) {
            // Supabase fetch failed/empty but we have cached user — keep them
            setCurrentUser(cachedUser);
          } else {
            // User no longer active or found — clear everything
            setCurrentUser(null);
            localStorageRemove(AUTH_STORAGE_KEY);
            localStorageRemove(AUTH_USER_CACHE_KEY);
            deleteCookie('limperial_legacy_session');
          }
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
      // Stale refresh token — clear Supabase session but keep local user
      // so PasscodeLock handles re-auth instead of forcing full login
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('[Auth] Refresh token invalid — falling back to PIN.');
        await supabase!.auth.signOut({ scope: 'local' }).catch(() => {});
        // Do NOT clear currentUser or AUTH_STORAGE_KEY here —
        // PasscodeLock will lock and ask for PIN, then re-validate
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
        localStorageRemove(AUTH_USER_CACHE_KEY);
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
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectTo = `${origin}/auth/callback`;
    await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account', // always show account picker
        },
      },
    });
  }, [supabase]);

  const loginWithOtp = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { error } = await supabase!.auth.signInWithOtp({ 
        email,
        options: {
          shouldCreateUser: false,
        }
      });
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'OTP sent successfully!' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [supabase]);

    const verifyOtp = useCallback(async (email: string, token: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error } = await supabase!.auth.verifyOtp({ email, token, type: 'email' });
      if (error) return { success: false, message: error.message };
      
      if (data?.user?.email) {
        // Use cached users list — avoid slow fetch on production
        const usersList = usersRef.current;
        if (usersList && usersList.length > 0) {
          syncUser(data.user.email, usersList);
        }
        // If no cached list, AuthContext onAuthStateChange will sync on next event
      }
      return { success: true, message: 'OTP verified successfully!' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [supabase, syncUser]);

  const logout = useCallback(async () => {
    // Signal that this SIGNED_OUT event is intentional so the listener
    // knows it is safe to clear auth state.
    isLoggingOutRef.current = true;

    // Clear local state and the middleware cookie immediately so any
    // redirects during the async signOut don't see a stale session.
    setCurrentUser(null);
    localStorageRemove(AUTH_STORAGE_KEY);
    localStorageRemove(AUTH_USER_CACHE_KEY);
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
      loginWithOtp,
      verifyOtp,
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
