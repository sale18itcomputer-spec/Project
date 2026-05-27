'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';

type BusinessMode = 'B2C' | 'B2B';

/**
 * B2BContext owns ONLY the mode flag (B2C ↔ B2B toggle) and the admin gate.
 *
 * The actual B2B/B2C data routing is handled by DataContext: it reads `isB2B`
 * from this context, configures the API service-layer accordingly, and fetches
 * from the right table set. There is no separate B2B data state here anymore —
 * DataContext exposes a single set of data that always reflects the current mode.
 */
interface B2BContextType {
    mode: BusinessMode;
    setMode: (mode: BusinessMode) => void;
    toggleMode: () => void;
    isB2B: boolean;
    canAccessB2B: boolean;
    b2bTheme: 'light' | 'dark';
    toggleB2BTheme: () => void;
}

const B2BContext = createContext<B2BContextType | undefined>(undefined);

const STORAGE_KEY = 'limperial-business-mode';
const THEME_STORAGE_KEY = 'limperial-b2b-theme';

export const B2BProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser, isAuthLoading } = useAuth();
    const isAdmin = currentUser?.Role === 'Admin';

    // ── Initialise mode from localStorage immediately (no admin check here) ──
    // Reading from localStorage in the lazy initialiser means the FIRST render
    // already knows the correct mode, so DataContext's boot fetch targets the
    // right tables without any async restore step.
    //
    // The admin-gate is enforced by the force-B2C effect below, which fires as
    // soon as auth resolves and confirms the user is not an admin. Because that
    // effect is guarded by `isAuthLoading`, it does NOT run while auth is still
    // bootstrapping and therefore never incorrectly resets a legitimate admin's
    // B2B session back to B2C before `currentUser` is populated.
    //
    // SSR safety: `localStorage` throws on the server — the catch returns 'B2C'.
    const [mode, setModeState] = useState<BusinessMode>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return (saved === 'B2B') ? 'B2B' : 'B2C';
        } catch {
            return 'B2C'; // server-side render / localStorage unavailable
        }
    });

    const [b2bTheme] = useState<'light' | 'dark'>(() => {
        try {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            return (saved === 'light' || saved === 'dark') ? saved : 'dark';
        } catch {
            return 'dark';
        }
    });

    // Force B2C for non-admins once auth has finished loading.
    // The `isAuthLoading` guard is critical: without it this effect fires on
    // the very first render when `currentUser` is still null (isAdmin = false),
    // which would immediately reset a legitimate admin's B2B session back to B2C
    // before auth resolves — undoing the synchronous localStorage initialisation.
    // Defensive: if the localStorage value is B2B but the user is not an admin
    // (e.g. account was downgraded between sessions), this resets to B2C silently.
    useEffect(() => {
        if (isAuthLoading) return; // wait for auth before enforcing the admin gate
        if (!isAdmin && mode === 'B2B') {
            setModeState('B2C');
            try { localStorage.setItem(STORAGE_KEY, 'B2C'); } catch { }
        }
    }, [isAdmin, isAuthLoading, mode]);

    // NOTE: The async "restore B2B after auth" effect that previously lived here
    // is intentionally removed. Mode is now read from localStorage synchronously
    // in the useState initialiser above, so no async restore is needed. The
    // first render already has the correct mode — DataContext's boot fetch uses
    // it immediately and avoids the B2C-then-B2B race entirely.

    const setMode = (newMode: BusinessMode) => {
        if (newMode === 'B2B' && !isAdmin) {
            console.warn('Only admin users can access B2B mode');
            return;
        }
        setModeState(newMode);
        try { localStorage.setItem(STORAGE_KEY, newMode); } catch { }
    };

    const toggleMode = () => {
        if (!isAdmin) return;
        setMode(mode === 'B2C' ? 'B2B' : 'B2C');
    };

    const toggleB2BTheme = () => {
        // B2B theme is now controlled by the unified ThemeProvider;
        // kept here as a no-op for API compatibility with older callers.
    };

    const isB2B = mode === 'B2B';

    // B2B no longer applies its own dark class — ThemeProvider owns that
    useEffect(() => {
        document.documentElement.classList.remove('b2b-dark');
    }, [isB2B]);

    return (
        <B2BContext.Provider value={{
            mode, setMode, toggleMode, isB2B, canAccessB2B: isAdmin,
            b2bTheme, toggleB2BTheme,
        }}>
            {children}
        </B2BContext.Provider>
    );
};

export const useB2B = () => {
    const context = useContext(B2BContext);
    if (context === undefined) {
        // Miniapp runs without B2BProvider — return a safe B2C-mode fallback.
        return {
            mode: 'B2C' as const,
            setMode: () => {},
            toggleMode: () => {},
            isB2B: false,
            canAccessB2B: false,
            b2bTheme: 'light' as const,
            toggleB2BTheme: () => {},
        };
    }
    return context;
};
