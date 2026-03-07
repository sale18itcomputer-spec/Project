'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { User } from '../types';
import { readRecords } from '../services/api';
import { localStorageGet, localStorageSet, localStorageRemove, setCookie, deleteCookie } from '../utils/storage';

const AUTH_STORAGE_KEY = 'limperial_auth_user';
const DEV_AUTO_LOGIN_EMAIL = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN ?? '';

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

    // Safety net: if the network never responds, unblock the UI after 10s
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('[Auth] Bootstrap timed out after 10s — forcing loading state to false.');
        setIsAuthLoading(false);
      }
    }, 10000);

    const bootstrapAuth = async () => {
      try {
        // Step 1: Get the active session (anon or authenticated)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) console.error('[Auth] Session error:', sessionError);
        if (!isMounted) return;

        // Step 2: Fetch the Users table exactly ONCE here.
        // The onAuthStateChange listener reuses this data via usersRef.
        const fetchedUsers = await readRecords<User>('Users').catch(err => {
          console.warn('[Auth] Failed to read Users table (RLS/Permissions):', err);
          return [] as User[];
        });
        if (!isMounted) return;

        setUsers(fetchedUsers);

        if (session?.user?.email) {
          syncUser(session.user.email, fetchedUsers);
        } else if (process.env.NODE_ENV === 'development' && DEV_AUTO_LOGIN_EMAIL) {
          syncUser(DEV_AUTO_LOGIN_EMAIL, fetchedUsers);
        } else {
          // Last resort: restore from localStorage for legacy (non-Supabase) sessions
          const savedUserId = localStorageGet(AUTH_STORAGE_KEY);
          if (savedUserId) {
            const user = fetchedUsers.find(u => u.UserID === savedUserId);
            if (user) setCurrentUser(user);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.email) {
        // Use already-fetched list; only fetch if somehow still null (edge case)
        const usersList = usersRef.current ?? await readRecords<User>('Users').catch(() => [] as User[]);
        if (!usersRef.current && isMounted) setUsers(usersList);
        syncUser(session.user.email, usersList);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorageRemove(AUTH_STORAGE_KEY);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
    // Intentionally only runs once on mount. syncUser and supabase are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        // Fallback: legacy plain-text password check against Users table
        if (!users) return { success: false, message: 'Auth service unavailable.' };
        const trimmedEmail = email.trim().toLowerCase();
        const user = users.find(u => u.Email && u.Email.trim().toLowerCase() === trimmedEmail);
        if (user && String(user.Password) === String(password).trim()) {
          if (user.Status !== 'Active') return { success: false, message: 'Account inactive.' };
          syncUser(user.Email || '', users);
          return { success: true, message: 'Login successful (Legacy)!' };
        }
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Login successful!' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [supabase, users, syncUser]);

  const loginWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, [supabase]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    localStorageRemove(AUTH_STORAGE_KEY);
    deleteCookie('limperial_legacy_session');
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
