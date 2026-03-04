'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { User } from '../types';
import { readRecords } from '../services/api';
import { localStorageGet, localStorageSet, localStorageRemove } from '../utils/storage';

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
      return user;
    }
    return null;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      try {
        const fetchedUsers = await readRecords<User>('Users');
        if (!isMounted) return;
        setUsers(fetchedUsers);

        // 1. Check for active Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session?.user?.email) {
          syncUser(session.user.email, fetchedUsers);
        }
        // 2. Dev auto-login bypass (if no session)
        else if (process.env.NODE_ENV === 'development' && DEV_AUTO_LOGIN_EMAIL) {
          syncUser(DEV_AUTO_LOGIN_EMAIL, fetchedUsers);
        }
        // 3. Last resort: Restore from localStorage (for non-Supabase sessions)
        else {
          const savedUserId = localStorageGet(AUTH_STORAGE_KEY);
          if (savedUserId) {
            const user = fetchedUsers.find(u => u.UserID === savedUserId);
            if (user) setCurrentUser(user);
          }
        }
      } catch (error) {
        console.error('Failed to load user data for authentication', error);
      } finally {
        if (isMounted) setIsAuthLoading(false);
      }
    };

    bootstrapAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.email) {
        // Use ref to get latest users or fetch if empty
        let currentUsersList = usersRef.current;
        if (!currentUsersList) {
          currentUsersList = await readRecords<User>('Users');
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
      subscription.unsubscribe();
    };
    // supabase and syncUser are stable. users is omitted to prevent loop.
  }, [supabase, syncUser]);

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
          setCurrentUser(user);
          localStorageSet(AUTH_STORAGE_KEY, user.UserID);
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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const callbackUrl = `${siteUrl}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
      },
    });
  }, [supabase]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    localStorageRemove(AUTH_STORAGE_KEY);
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
