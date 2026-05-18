'use client';

import { useMiniAppAuth } from '@/contexts/MiniAppAuthContext';
import { Loader2, ShieldAlert, Link2Off, RefreshCw, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

// ── Shared logo mark ─────────────────────────────────────────────────────────
function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sz = size === 'lg' ? 'w-20 h-20 text-3xl' : size === 'sm' ? 'w-10 h-10 text-base' : 'w-16 h-16 text-2xl';
    return (
        <div className={`${sz} rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/20`}>
            <span className="text-white font-bold">L</span>
        </div>
    );
}

// ── Shared screen wrapper ─────────────────────────────────────────────────────
function Screen({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center gap-5">
            {children}
        </div>
    );
}

export default function MiniAppAuthGate({ children }: { children: React.ReactNode }) {
    const { authState, retry } = useMiniAppAuth();
    const [showRetry, setShowRetry] = useState(false);
    const [retrying, setRetrying] = useState(false);

    // Show retry button after 6s if still loading
    useEffect(() => {
        if (authState.status !== 'loading') {
            setShowRetry(false);
            setRetrying(false);
            return;
        }
        const t = setTimeout(() => setShowRetry(true), 6000);
        return () => clearTimeout(t);
    }, [authState.status]);

    const handleRetry = () => {
        setRetrying(true);
        retry();
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (authState.status === 'loading') {
        return (
            <Screen>
                <LogoMark size="lg" />
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        {retrying ? 'Retrying...' : 'Signing you in…'}
                    </p>
                </div>
                {showRetry && !retrying && (
                    <button
                        onClick={handleRetry}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border
                                   text-sm text-foreground font-medium active:opacity-70 transition-opacity"
                    >
                        <RefreshCw size={14} />
                        Taking too long? Retry
                    </button>
                )}
            </Screen>
        );
    }

    // ── No Telegram context ───────────────────────────────────────────────────
    if (authState.status === 'no_telegram') {
        return (
            <Screen>
                <LogoMark size="lg" />
                <div className="flex flex-col items-center gap-1">
                    <ShieldAlert className="w-8 h-8 text-amber-500" />
                    <h2 className="text-lg font-bold text-foreground mt-1">Telegram Required</h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        This app must be opened from the{' '}
                        <strong className="text-foreground">Limperial Telegram Bot</strong>.
                    </p>
                </div>
                <a
                    href="https://t.me/LimperialBot"
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600
                               text-white text-sm font-semibold active:opacity-80 transition-opacity shadow-md shadow-brand-600/20"
                >
                    <Send size={15} />
                    Open in Telegram
                </a>
                <p className="text-xs text-muted-foreground">
                    Desktop?{' '}
                    <a href="https://project.limperialtech.com" className="underline underline-offset-2 text-foreground">
                        project.limperialtech.com
                    </a>
                </p>
            </Screen>
        );
    }

    // ── Not linked ────────────────────────────────────────────────────────────
    if (authState.status === 'not_linked') {
        return (
            <Screen>
                <LogoMark size="lg" />
                <div className="flex flex-col items-center gap-1">
                    <Link2Off className="w-8 h-8 text-red-500" />
                    <h2 className="text-lg font-bold text-foreground mt-1">Account Not Linked</h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        Hi <strong className="text-foreground">{authState.firstName}</strong> — your Telegram
                        isn't linked to a Limperial account yet.
                    </p>
                </div>
                <div className="w-full max-w-xs bg-muted rounded-xl px-4 py-3 text-left">
                    <p className="text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Your Telegram ID</p>
                    <code className="text-sm font-mono text-foreground font-semibold">
                        {authState.telegramId}
                    </code>
                    <p className="text-[11px] text-muted-foreground mt-2">
                        Share this ID with your admin to get linked.
                    </p>
                </div>
                <button
                    onClick={handleRetry}
                    disabled={retrying}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border
                               text-sm font-medium active:opacity-70 transition-opacity disabled:opacity-50"
                >
                    <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
                    {retrying ? 'Checking…' : 'Try Again'}
                </button>
            </Screen>
        );
    }

    // ── Auth error ────────────────────────────────────────────────────────────
    if (authState.status === 'error') {
        return (
            <Screen>
                <LogoMark size="md" />
                <div className="flex flex-col items-center gap-1">
                    <ShieldAlert className="w-8 h-8 text-red-500" />
                    <h2 className="text-lg font-bold text-foreground mt-1">Authentication Failed</h2>
                    <p className="text-sm text-muted-foreground max-w-xs">{authState.message}</p>
                </div>
                <button
                    onClick={handleRetry}
                    disabled={retrying}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600
                               text-white text-sm font-semibold active:opacity-80 transition-opacity
                               disabled:opacity-50 shadow-md shadow-brand-600/20"
                >
                    <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
                    {retrying ? 'Retrying…' : 'Retry'}
                </button>
            </Screen>
        );
    }

    return <>{children}</>;
}
