'use client';

import React from 'react';
import ReactDOM from 'react-dom';
import { useTheme } from './AppProviders';
import { MiniAppAuthProvider } from '@/contexts/MiniAppAuthContext';
import MiniAppAuthGate from '@/components/miniapp/MiniAppAuthGate';
import MiniAppDataProvider from '@/contexts/MiniAppDataContext';

// Polyfill findDOMNode
if (typeof window !== 'undefined' && !(ReactDOM as any).findDOMNode) {
    (ReactDOM as any).findDOMNode = (instance: any) => {
        if (!instance) return null;
        if (instance instanceof HTMLElement) return instance;
        return (instance as any).getDOMNode ? (instance as any).getDOMNode() : null;
    };
}

const ThemeContext = React.createContext<{ isDark: boolean; toggle: () => void }>({ isDark: false, toggle: () => {} });
export { ThemeContext };

function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [isDark, setIsDark] = React.useState(() => {
        if (typeof window === 'undefined') return false;
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.colorScheme) return tg.colorScheme === 'dark';
        const saved = localStorage.getItem('limperial-theme');
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    React.useEffect(() => {
        const root = document.documentElement;
        if (isDark) root.classList.add('dark');
        else root.classList.remove('dark');
        localStorage.setItem('limperial-theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    const toggle = React.useCallback(() => setIsDark(p => !p), []);
    return <ThemeContext.Provider value={{ isDark, toggle }}>{children}</ThemeContext.Provider>;
}

export default function MiniAppProviders({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <MiniAppAuthProvider>
                <MiniAppAuthGate>
                    <MiniAppDataProvider>
                        {children}
                    </MiniAppDataProvider>
                </MiniAppAuthGate>
            </MiniAppAuthProvider>
        </ThemeProvider>
    );
}
