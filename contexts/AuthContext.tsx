'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
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
  const supabase = createClient();
  const [users, setUsers] = useState<User[] | null>(null);
  const usersRef = React.useRef<User[] | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Keep ref in sync for callbacks
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Sync Supabase user with our custom Users table
  const syncUser = useCallback((email: string, allUsers: User[]) => {
    const user = allUsers.find(
      u => u.Email?.trim().toLowerCase() === email.trim().toLowerCase()
    );
    if (user && user.Status === 'Active') {
      setCurrentUser(user);
      localStorageSet(AUTH_STORAGE_KEY, user.UserID);
      setCookie('limperial_legacy_session', user.UserID, 7); // Ensure middleware sees active session
      return user;
    }
    return null;
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout to prevent permanent hang
    const timeoutId = setTimeout(() => {
      if (isMounted && isAuthLoading) {
        console.warn('Auth bootstrap timed out after 10s. Forcing loading state to false.');
        setIsAuthLoading(false);
      }
    }, 10000);

    const bootstrapAuth = async () => {
      console.log('Starting auth bootstrap...');
      try {
        // 1. Establish session first to ensure auth tokens are active before fetching data
        console.log('Fetching session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Supabase session error:', sessionError);
        }

        if (!isMounted) return;
        console.log('Session fetched:', session ? `User: ${session.user?.email}` : 'No active session');

        // 2. Safely read users data now that session is theoretically active
        console.log('Fetching users table...');
        const fetchedUsers = await readRecords<User>('Users').catch(err => {
          console.warn("Failed to read user table (RLS/Permissions):", err);
          return [];
        });

        if (!isMounted) return;
        console.log(`Users fetched: ${fetchedUsers?.length || 0} records`);
        setUsers(fetchedUsers);

        if (session?.user?.email) {
          console.log('Syncing authenticated user...');
          syncUser(session.user.email, fetchedUsers);
        }
        // 2. Dev auto-login bypass (if no session)
        else if (process.env.NODE_ENV === 'development' && DEV_AUTO_LOGIN_EMAIL) {
          console.log('Applying dev auto-login...');
          syncUser(DEV_AUTO_LOGIN_EMAIL, fetchedUsers);
        }
        // 3. Last resort: Restore from localStorage (for non-Supabase sessions)
        else {
          console.log('Restoring user from localStorage if possible...');
          const savedUserId = localStorageGet(AUTH_STORAGE_KEY);
          if (savedUserId) {
            const user = fetchedUsers.find(u => u.UserID === savedUserId);
            if (user) {
              console.log(`Restored user: ${user.Email}`);
              setCurrentUser(user);
            }
          }
        }
      } catch (error) {
        console.error('CRITICAL: Failed to load user data for authentication', error);
      } finally {
        if (isMounted) {
          console.log('Auth bootstrap completed, setting loading to false.');
          setIsAuthLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    bootstrapAuth();

    // Listen for auth state changes
    console.log('Setting up auth state change listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth state change: ${event}`, session ? `User: ${session.user?.email}` : 'No session');
      if (session?.user?.email) {
        // Use ref to get latest users or fetch if empty
        let currentUsersList = usersRef.current;
        if (!currentUsersList) {
          console.log('Fetching users for state change sync...');
          currentUsersList = await readRecords<User>('Users').catch(() => []);
          if (isMounted) setUsers(currentUsersList);
        }
        syncUser(session.user.email, currentUsersList);
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
    // supabase and syncUser are stable. users is omitted to prevent loop.
  }, [supabase, syncUser, isAuthLoading]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      // First, attempt Supabase Auth
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Fallback to custom table check for legacy support
        if (!users) return { success: false, message: 'Auth service unavailable.' };

        const trimmedEmail = email.trim().toLowerCase();
        const user = users.find(u => u.Email && u.Email.trim().toLowerCase() === trimmedEmail);

        if (user && String(user.Password) === String(password).trim()) {
          if (user.Status !== 'Active') return { success: false, message: 'Account inactive.' };
          syncUser(user.Email || '', users); // This handles setting the cookie and state
          return { success: true, message: 'Login successful (Legacy)!' };
        }

        return { success: false, message: error.message };
      }

      return { success: true, message: 'Login successful!' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, [supabase, users]);

  const loginWithGoogle = useCallback(async () => {
    const siteUrl = window.location.origin;

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: siteUrl,
      },
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
