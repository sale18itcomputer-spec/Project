import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';

type BusinessMode = 'B2C' | 'B2B';

interface B2BContextType {
    mode: BusinessMode;
    setMode: (mode: BusinessMode) => void;
    toggleMode: () => void;
    isB2B: boolean;
    canAccessB2B: boolean;
}

const B2BContext = createContext<B2BContextType | undefined>(undefined);

const STORAGE_KEY = 'limperial-business-mode';

export const B2BProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.Role === 'Admin';

    const [mode, setModeState] = useState<BusinessMode>(() => {
        // Non-admin users are always in B2C mode
        if (!isAdmin) {
            return 'B2C';
        }

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return (saved === 'B2B' || saved === 'B2C') ? saved : 'B2C';
        } catch {
            return 'B2C';
        }
    });

    // Force B2C mode for non-admin users
    useEffect(() => {
        if (!isAdmin && mode === 'B2B') {
            setModeState('B2C');
            try {
                localStorage.setItem(STORAGE_KEY, 'B2C');
            } catch (error) {
                console.error('Failed to save business mode to localStorage', error);
            }
        }
    }, [isAdmin, mode]);

    const setMode = (newMode: BusinessMode) => {
        // Only admins can switch to B2B mode
        if (newMode === 'B2B' && !isAdmin) {
            console.warn('Only admin users can access B2B mode');
            return;
        }

        setModeState(newMode);
        try {
            localStorage.setItem(STORAGE_KEY, newMode);
        } catch (error) {
            console.error('Failed to save business mode to localStorage', error);
        }
    };

    const toggleMode = () => {
        // Only admins can toggle
        if (!isAdmin) {
            console.warn('Only admin users can toggle business mode');
            return;
        }
        setMode(mode === 'B2C' ? 'B2B' : 'B2C');
    };

    const isB2B = mode === 'B2B';

    return (
        <B2BContext.Provider value={{ mode, setMode, toggleMode, isB2B, canAccessB2B: isAdmin }}>
            {children}
        </B2BContext.Provider>
    );
};

export const useB2B = () => {
    const context = useContext(B2BContext);
    if (context === undefined) {
        throw new Error('useB2B must be used within a B2BProvider');
    }
    return context;
};
