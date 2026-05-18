'use client';

/**
 * MiniAppCompatProviders
 *
 * Shims for useAuth(), useB2B(), and useToast() so shared dashboard
 * components don't throw when running inside the miniapp route group.
 *
 * NavigationContext is NOT shimmed here — MiniAppNavigationProvider
 * (mounted in MiniAppProviders above this) handles it for real.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useMiniAppAuth } from '@/contexts/MiniAppAuthContext';

// ─── AuthContext shim ─────────────────────────────────────────────────────────
const AuthShimContext = createContext<any>(undefined);

function MiniAppAuthShim({ children }: { children: React.ReactNode }) {
    const { authState } = useMiniAppAuth();

    const value = useMemo(() => {
        const user = authState.status === 'authenticated' ? authState.user : null;
        return {
            isAuthenticated: authState.status === 'authenticated',
            isAuthLoading: authState.status === 'loading',
            currentUser: user ? {
                UserID: user.UserID,
                Name: user.Name,
                Role: user.Role,
                Email: user.Email,
                Picture: user.Picture,
                Status: user.Status,
            } : null,
            users: null,
            login: async () => ({ success: false, message: 'Not available in miniapp' }),
            loginWithGoogle: async () => {},
            loginWithOtp: async () => ({ success: false, message: 'Not available in miniapp' }),
            verifyOtp: async () => ({ success: false, message: 'Not available in miniapp' }),
            logout: () => {},
        };
    }, [authState]);

    return <AuthShimContext.Provider value={value}>{children}</AuthShimContext.Provider>;
}

// ─── B2BContext shim ──────────────────────────────────────────────────────────
const B2BShimContext = createContext<any>(undefined);

function MiniAppB2BShim({ children }: { children: React.ReactNode }) {
    const value = useMemo(() => ({
        mode: 'B2C' as const,
        setMode: () => {},
        toggleMode: () => {},
        isB2B: false,
        canAccessB2B: false,
        b2bTheme: 'light' as const,
        toggleB2BTheme: () => {},
        companies: null,
        projects: null,
        quotations: null,
        loading: false,
        error: null,
        setCompanies: () => {},
        setProjects: () => {},
        setQuotations: () => {},
        refreshB2BData: async () => {},
    }), []);

    return <B2BShimContext.Provider value={value}>{children}</B2BShimContext.Provider>;
}

// ─── ToastContext shim ────────────────────────────────────────────────────────
const ToastShimContext = createContext<any>(undefined);

function MiniAppToastShim({ children }: { children: React.ReactNode }) {
    const value = useMemo(() => ({
        addToast: (msg: string, type?: string) => console.log(`[MiniApp Toast] [${type}] ${msg}`),
        removeToast: () => {},
        toasts: [],
    }), []);

    return <ToastShimContext.Provider value={value}>{children}</ToastShimContext.Provider>;
}

// ─── Composed export ──────────────────────────────────────────────────────────
export default function MiniAppCompatProviders({ children }: { children: React.ReactNode }) {
    return (
        <MiniAppAuthShim>
            <MiniAppB2BShim>
                <MiniAppToastShim>
                    {children}
                </MiniAppToastShim>
            </MiniAppB2BShim>
        </MiniAppAuthShim>
    );
}

export const useAuthShim = () => useContext(AuthShimContext);
export const useB2BShim = () => useContext(B2BShimContext);
export const useToastShim = () => useContext(ToastShimContext);
