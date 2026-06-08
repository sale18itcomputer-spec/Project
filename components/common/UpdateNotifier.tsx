'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_TIMEOUT_MS = 3000; // stop waiting on SW/cache APIs and refresh anyway

async function fetchVersion(): Promise<string | null> {
    try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return typeof data?.version === 'string' ? data.version : null;
    } catch {
        return null;
    }
}

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
    return Promise.race([
        promise,
        new Promise<void>((resolve) => setTimeout(resolve, ms)),
    ]);
}

/**
 * A refresh that actually defeats stale builds. location.reload() (≈ F5) —
 * and even a manual Ctrl+Shift+R — can still serve old code when something
 * is intercepting requests below the browser's normal cache layer. So instead:
 *
 *  1. Unregister any service worker — e.g. a leftover from a previous deploy
 *     that's been silently serving its own cached responses ever since.
 *  2. Empty the Cache Storage API — where a SW (or anything else) stashes
 *     responses; this survives ordinary reloads entirely.
 *  3. Navigate to a cache-busting URL the browser has never seen, so there's
 *     nothing to serve from cache even if steps 1-2 found nothing to clear.
 *
 * Each step is independently guarded: Telegram's in-app WebView and some
 * browsers don't fully support these APIs, and a failure here must never
 * block the final navigation from happening.
 */
async function hardRefresh() {
    await withTimeout((async () => {
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
            }
        } catch { /* unsupported or blocked — fall through to navigation */ }

        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
            }
        } catch { /* unsupported or blocked — fall through to navigation */ }
    })(), CLEANUP_TIMEOUT_MS);

    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());
    window.location.replace(url.toString());
}

/**
 * Polls /api/version in the background and prompts the user to refresh
 * once a newer build is detected. Browsers can otherwise hold onto a
 * stale bundle indefinitely (even surviving a hard reload via service
 * worker / disk cache), leaving users on old code after a deploy.
 *
 * We never reload automatically — that would blow away in-progress work —
 * we just surface a persistent toast with a one-click refresh action.
 */
export default function UpdateNotifier() {
    const knownVersion = useRef<string | null>(null);
    const notified = useRef(false);

    useEffect(() => {
        let cancelled = false;

        const check = async () => {
            if (notified.current || cancelled) return;
            const version = await fetchVersion();
            if (cancelled || !version) return;

            if (knownVersion.current === null) {
                knownVersion.current = version;
                return;
            }

            if (version !== knownVersion.current) {
                notified.current = true;
                toast('A new version is available', {
                    description: 'Refresh to get the latest features and fixes.',
                    duration: Infinity,
                    action: {
                        label: 'Refresh',
                        onClick: () => { void hardRefresh(); },
                    },
                });
            }
        };

        check();
        const interval = setInterval(check, CHECK_INTERVAL_MS);

        // Catch the common case: someone returns to a tab they left open
        // across a deploy — check right away instead of waiting on the timer.
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') check();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            cancelled = true;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    return null;
}
