'use client';

import React from 'react';
import ReactDOM from 'react-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { B2BProvider } from '@/contexts/B2BContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ConnectivityProvider } from '@/contexts/ConnectivityContext';

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
const ThemeContext = React.createContext<{
    isDark: boolean;
    toggle: () => void;
}>({ isDark: false, toggle: () => {} });

export const useTheme = () => React.useContext(ThemeContext);

function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [isDark, setIsDark] = React.useState(() => {
        if (typeof window === 'undefined') return false;
        const saved = localStorage.getItem('limperial-theme');
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    React.useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            root.classList.remove('b2b-dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('limperial-theme', isDark ? 'dark' : 'light');

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
    }, [isDark]);

    const toggle = React.useCallback(() => setIsDark(p => !p), []);

    return (
        <ThemeContext.Provider value={{ isDark, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}
// -------------------------------------------------------

export default function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AuthProvider>
                <DataProvider>
                    <B2BProvider>
                        <NavigationProvider>
                            <NotificationProvider>
                                <ConnectivityProvider>
                                    {children}
                                </ConnectivityProvider>
                            </NotificationProvider>
                        </NavigationProvider>
                    </B2BProvider>
                </DataProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
