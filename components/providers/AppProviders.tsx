'use client';

import React from 'react';
import ReactDOM from 'react-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { B2BProvider } from '@/contexts/B2BContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ConnectivityProvider } from '@/contexts/ConnectivityContext';
import { WindowManagerProvider } from '@/contexts/WindowManagerContext';
import WindowManagerRoot from '@/components/windows/WindowManagerRoot';

// Polyfill findDOMNode for compatibility with legacy libraries like react-quill
// in environments where it might be missing (React 19+ or specific Next.js builds)
if (typeof window !== 'undefined' && !(ReactDOM as any).findDOMNode) {
    (ReactDOM as any).findDOMNode = (instance: any) => {
        if (!instance) return null;
        if (instance instanceof HTMLElement) return instance;
        return (instance as any).getDOMNode ? (instance as any).getDOMNode() : null;
    };
}

// ---- Inline Theme Provider (no extra file needed) ----
export type ThemeMode = 'light' | 'dark' | 'claude';

const ThemeContext = React.createContext<{
    theme: ThemeMode;
    isDark: boolean;
    setTheme: (theme: ThemeMode) => void;
    toggle: () => void;
}>({ theme: 'light', isDark: false, setTheme: () => {}, toggle: () => {} });

export const useTheme = () => React.useContext(ThemeContext);

function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = React.useState<ThemeMode>(() => {
        if (typeof window === 'undefined') return 'light';
        const saved = localStorage.getItem('limperial-theme');
        if (saved === 'light' || saved === 'dark' || saved === 'claude') return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    React.useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark' || theme === 'claude') {
            root.classList.add('dark');
            root.classList.remove('b2b-dark');
        } else {
            root.classList.remove('dark');
        }
        root.classList.toggle('claude', theme === 'claude');
        localStorage.setItem('limperial-theme', theme);

        // Re-register ECharts theme and force all chart instances to redraw
        import('echarts').then(echarts => {
            import('../charts/echartsTheme').then(({ buildLimperialTheme }) => {
                echarts.registerTheme('limperial', buildLimperialTheme());
                // Trigger resize on all live ECharts instances so they re-apply
                // the new theme. A resize call causes ECharts to re-render fully.
                try {
                    (echarts as any).getInstanceByDom &&
                    document.querySelectorAll('[_echarts_instance_]').forEach((el) => {
                        const instance = (echarts as any).getInstanceByDom(el as HTMLElement);
                        if (instance && !instance.isDisposed()) {
                            instance.resize();
                        }
                    });
                } catch (_e) {
                    // Silently ignore — some chart instances may not exist yet
                }
            });
        });
    }, [theme]);

    const setTheme = React.useCallback((next: ThemeMode) => setThemeState(next), []);
    const toggle = React.useCallback(() => {
        setThemeState(p => p === 'light' ? 'dark' : p === 'dark' ? 'claude' : 'light');
    }, []);

    const isDark = theme !== 'light';

    return (
        <ThemeContext.Provider value={{ theme, isDark, setTheme, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}
// -------------------------------------------------------

export default function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AuthProvider>
                <B2BProvider>
                    <DataProvider>
                        <NavigationProvider>
                            <NotificationProvider>
                                <ConnectivityProvider>
                                    <WindowManagerProvider>
                                        {children}
                                        <WindowManagerRoot />
                                    </WindowManagerProvider>
                                </ConnectivityProvider>
                            </NotificationProvider>
                        </NavigationProvider>
                    </DataProvider>
                </B2BProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
