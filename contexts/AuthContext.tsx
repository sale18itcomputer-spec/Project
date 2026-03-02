'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { User } from '../types';
import { readRecords } from '../services/api';
import { localStorageGet, localStorageSet, localStorageRemove } from '../utils/storage';

const AUTH_STORAGE_KEY = 'limperial_auth_user';
// Set NEXT_PUBLIC_DEV_AUTO_LOGIN=sale18itcomputer@gmail.com in .env.local to skip login in dev
const DEV_AUTO_LOGIN_EMAIL = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN ?? '';

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  currentUser: User | null;
  users: User[] | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  loginWithGoogle: (email: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[] | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const fetchedUsers = await readRecords<User>('Users');
        setUsers(fetchedUsers);

        // ── Dev auto-login bypass ───────────────────────────────────────
        if (process.env.NODE_ENV === 'development' && DEV_AUTO_LOGIN_EMAIL && fetchedUsers) {
          const devUser = fetchedUsers.find(
            u => u.Email?.trim().toLowerCase() === DEV_AUTO_LOGIN_EMAIL.trim().toLowerCase()
          );
          if (devUser) {
            setCurrentUser(devUser);
            setIsAuthLoading(false);
            return; // skip normal session restore
          }
        }
        // ───────────────────────────────────────────────────────────────

        // Restore session from localStorage
        const savedUserId = localStorageGet(AUTH_STORAGE_KEY);
        if (savedUserId && fetchedUsers) {
          const user = fetchedUsers.find(u => u.UserID === savedUserId);
          if (user) setCurrentUser(user);
        }
      } catch (error) {
        console.error('Failed to load user data for authentication', error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    if (!users) {
      return { success: false, message: 'Authentication service is temporarily unavailable. Please try again later.' };
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = users.find(u => u.Email && u.Email.trim().toLowerCase() === trimmedEmail);

    if (!user) return { success: false, message: 'Invalid Email or Password.' };
    if (user.Status !== 'Active') return { success: false, message: 'This account is inactive. Please contact an administrator.' };

    // Compare passwords as strings (handles numeric passwords stored as numbers)
    if (String(user.Password) === String(password).trim()) {
      setCurrentUser(user);
      localStorageSet(AUTH_STORAGE_KEY, user.UserID);
      return { success: true, message: 'Login successful!' };
    }

    return { success: false, message: 'Invalid Email or Password.' };
  }, [users]);

  const loginWithGoogle = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    if (!users) {
      return { success: false, message: 'Authentication service is temporarily unavailable. Please try again later.' };
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = users.find(u => u.Email && u.Email.trim().toLowerCase() === trimmedEmail);

    if (!user) return { success: false, message: 'No user found with this Google account.' };
    if (user.Status !== 'Active') return { success: false, message: 'This account is inactive. Please contact an administrator.' };

    setCurrentUser(user);
    localStorageSet(AUTH_STORAGE_KEY, user.UserID);
    return { success: true, message: 'Login successful!' };
  }, [users]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorageRemove(AUTH_STORAGE_KEY);
  }, []);

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
