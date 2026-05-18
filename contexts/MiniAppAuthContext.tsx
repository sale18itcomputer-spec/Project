'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const STORAGE_KEY = 'miniapp_auth_user';
const AUTH_TIMEOUT_MS = 10000;

export interface MiniAppUser {
    UserID: string;
    Name: string;
    Role: string;
    Email: string;
    Picture?: string;
    Status: string;
    telegram_id?: number;
}

interface TelegramUser {
    id: number;
    first_name: string;
    username?: string;
    photo_url?: string;
}

type AuthState =
    | { status: 'loading' }
    | { status: 'authenticated'; user: MiniAppUser; telegramUser?: TelegramUser }
    | { status: 'not_linked'; telegramId: number; firstName: string; username?: string }
    | { status: 'error'; message: string }
    | { status: 'no_telegram' };

interface MiniAppAuthContextType {
    authState: AuthState;
    retry: () => void;
    logout: () => void;
}

const MiniAppAuthContext = createContext<MiniAppAuthContextType | undefined>(undefined);

export function MiniAppAuthProvider({ children }: { children: ReactNode }) {
    const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });
    const mountedRef = React.useRef(false);

    const safeSet = useCallback((state: AuthState) => {
        if (mountedRef.current) setAuthState(state);
    }, []);

    const authenticate = useCallback(async () => {
        safeSet({ status: 'loading' });

        // Restore from sessionStorage for instant load
        try {
            const cached = sessionStorage.getItem(STORAGE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.user?.UserID) {
                    safeSet({ status: 'authenticated', user: parsed.user, telegramUser: parsed.telegramUser });
                    return;
                }
            }
        } catch {}

        // Wait for Telegram WebApp SDK to be ready
        await new Promise<void>(resolve => {
            if ((window as any).Telegram?.WebApp?.initData) return resolve();
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if ((window as any).Telegram?.WebApp?.initData || attempts > 20) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });

        const tg = (window as any).Telegram?.WebApp;

        if (!tg?.initData) {
            safeSet({ status: 'no_telegram' });
            return;
        }

        tg.ready();
        tg.expand();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

            const res = await fetch('/api/miniapp/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const data = await res.json();

            if (res.ok && data.ok) {
                const payload = { user: data.user, telegramUser: data.telegramUser };
                try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
                safeSet({ status: 'authenticated', user: data.user, telegramUser: data.telegramUser });
            } else if (res.status === 403 && data.error === 'not_linked') {
                safeSet({ status: 'not_linked', telegramId: data.telegramId, firstName: data.firstName, username: data.username });
            } else {
                safeSet({ status: 'error', message: data.error || 'Authentication failed' });
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                safeSet({ status: 'error', message: 'Authentication timed out. Check your connection.' });
            } else {
                safeSet({ status: 'error', message: err.message || 'Network error' });
            }
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        authenticate();
        return () => { mountedRef.current = false; };
    }, [authenticate]);

    const retry = useCallback(() => {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
        authenticate();
    }, [authenticate]);

    const logout = useCallback(() => {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
        safeSet({ status: 'no_telegram' });
    }, [safeSet]);

    return (
        <MiniAppAuthContext.Provider value={{ authState, retry, logout }}>
            {children}
        </MiniAppAuthContext.Provider>
    );
}

export function useMiniAppAuth() {
    const ctx = useContext(MiniAppAuthContext);
    if (!ctx) throw new Error('useMiniAppAuth must be used within MiniAppAuthProvider');
    return ctx;
}
