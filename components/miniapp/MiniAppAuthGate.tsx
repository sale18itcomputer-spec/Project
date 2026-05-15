'use client';

import { useMiniAppAuth } from '@/contexts/MiniAppAuthContext';
import { Loader2, ShieldAlert, Link2Off, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function MiniAppAuthGate({ children }: { children: React.ReactNode }) {
    const { authState, retry } = useMiniAppAuth();
    const [showRetry, setShowRetry] = useState(false);

    // Show retry button after 6s if still loading
    useEffect(() => {
        if (authState.status !== 'loading') { setShowRetry(false); return; }
        const t = setTimeout(() => setShowRetry(true), 6000);
        return () => clearTimeout(t);
    }, [authState.status]);

    if (authState.status === 'loading') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
                <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mb-2">
                    <span className="text-white font-bold text-2xl">L</span>
                </div>
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Signing you in...</p>
                {showRetry && (
                    <button
                        onClick={retry}
                        className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-foreground active:opacity-70"
                    >
                        <RefreshCw size={14} />
                        Taking too long? Retry
                    </button>
                )}
            </div>
        );
    }

    if (authState.status === 'no_telegram') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center mb-2">
                    <span className="text-white font-bold text-2xl">L</span>
                </div>
                <ShieldAlert className="w-10 h-10 text-amber-500" />
                <div>
                    <h2 className="text-lg font-bold text-foreground">Telegram Required</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        This app must be opened from the <strong>Limperial Telegram Bot</strong>.
                    </p>
                </div>
                <a
                    href="https://t.me/LimperialBot"
                    className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold"
                >
                    Open Telegram Bot
                </a>
                <p className="text-xs text-muted-foreground">
                    Desktop access →{' '}
                    <a href="https://project.limperialtech.com" className="underline">
                        project.limperialtech.com
                    </a>
                </p>
            </div>
        );
    }

    if (authState.status === 'not_linked') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center mb-2">
                    <span className="text-white font-bold text-2xl">L</span>
                </div>
                <Link2Off className="w-10 h-10 text-red-500" />
                <div>
                    <h2 className="text-lg font-bold text-foreground">Account Not Linked</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Hi <strong>{authState.firstName}</strong>, your Telegram is not linked to a Limperial account.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">Ask your admin to link your Telegram ID:</p>
                    <code className="mt-2 block text-xs bg-muted rounded-lg px-3 py-2 font-mono">
                        {authState.telegramId}
                    </code>
                </div>
                <button
                    onClick={retry}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium"
                >
                    <RefreshCw size={15} /> Try Again
                </button>
            </div>
        );
    }

    if (authState.status === 'error') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center gap-4">
                <ShieldAlert className="w-10 h-10 text-red-500" />
                <div>
                    <h2 className="text-lg font-bold text-foreground">Authentication Error</h2>
                    <p className="text-sm text-muted-foreground mt-1">{authState.message}</p>
                </div>
                <button
                    onClick={retry}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold"
                >
                    <RefreshCw size={15} /> Retry
                </button>
            </div>
        );
    }

    return <>{children}</>;
}
