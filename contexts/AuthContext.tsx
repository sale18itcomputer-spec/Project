import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { User } from '../types';
import { readRecords } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  currentUser: User | null;
  users: User[] | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  loginWithGoogle: (email: string) => Promise<{ success: boolean; message: string; }>;
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

        const savedUserId = localStorage.getItem('limperial_auth_user');
        if (savedUserId && fetchedUsers) {
          const user = fetchedUsers.find(u => u.UserID === savedUserId);
          if (user) {
            setCurrentUser(user);
          }
        }
      } catch (error) {
        console.error("Failed to load user data for authentication", error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    bootstrapAuth();
  }, []);


  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    if (!users) {
      return { success: false, message: "Authentication service is temporarily unavailable. Please try again later." };
    }
    
    const trimmedEmail = email.trim().toLowerCase();
    const user = users.find(u => u.Email && u.Email.trim().toLowerCase() === trimmedEmail);

    if (!user) {
        return { success: false, message: "Invalid Email or Password." };
    }
    
    if (user.Status !== 'Active') {
        return { success: false, message: "This user account is inactive. Please contact an administrator." };
    }

    // Compare passwords as strings to prevent type mismatches (e.g., number 12345678 vs string "12345678")
    if (String(user.Password) === password) {
      setCurrentUser(user);
      try {
        localStorage.setItem('limperial_auth_user', user.UserID);
      } catch (error) {
        console.error("Failed to save user session to localStorage", error);
      }
      return { success: true, message: "Login successful!" };
    }
    
    return { success: false, message: "Invalid Email or Password." };
  }, [users]);

  const loginWithGoogle = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    if (!users) {
        return { success: false, message: "Authentication service is temporarily unavailable. Please try again later." };
    }
    
    const trimmedEmail = email.trim().toLowerCase();
    const user = users.find(u => u.Email && u.Email.trim().toLowerCase() === trimmedEmail);

    if (!user) {
        return { success: false, message: "No user found with this Google account. Please sign in with your registered email and password." };
    }
    
    if (user.Status !== 'Active') {
        return { success: false, message: "This user account is inactive. Please contact an administrator." };
    }

    setCurrentUser(user);
    try {
        localStorage.setItem('limperial_auth_user', user.UserID);
    } catch (error) {
        console.error("Failed to save user session to localStorage", error);
    }
    return { success: true, message: "Login successful!" };
  }, [users]);


  const logout = useCallback(() => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('limperial_auth_user');
    } catch (error)      {
      console.error("Failed to clear user session from localStorage", error);
    }
  }, []);

  const value = {
    isAuthenticated: !!currentUser,
    isAuthLoading,
    currentUser,
    users,
    login,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};