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

export default function AppProviders({ children }: { children: React.ReactNode }) {
    return (
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
    );
}
