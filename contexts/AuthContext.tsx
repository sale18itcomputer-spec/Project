import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { useData } from './DataContext';
import { User } from '../types';

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  currentUser: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { users, loading: isDataLoading } = useData();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitialAuthCheckComplete, setInitialAuthCheckComplete] = useState(false);

  // Check for saved session only on the initial data load
  useEffect(() => {
    // This effect should only run once when the user data is available for the first time.
    if (!isDataLoading && !isInitialAuthCheckComplete) {
      try {
        const savedUserId = localStorage.getItem('limperial_auth_user');
        if (savedUserId && users) {
          const user = users.find(u => u.UserID === savedUserId);
          if (user) {
            setCurrentUser(user);
          }
        }
      } catch (error) {
        console.error("Failed to load user session from localStorage", error);
      } finally {
        // Mark the initial check as complete, regardless of outcome.
        setInitialAuthCheckComplete(true);
      }
    }
  }, [isDataLoading, users, isInitialAuthCheckComplete]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    if (!users) {
      return { success: false, message: "User data is not available. Please try again later." };
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
    isAuthLoading: !isInitialAuthCheckComplete,
    currentUser,
    login,
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
