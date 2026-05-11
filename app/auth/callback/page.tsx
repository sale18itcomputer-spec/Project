'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../utils/supabase/client';
import { readRecords } from '../../../services/api';
import { localStorageSet, setCookie } from '../../../utils/storage';
import { Loader2 } from 'lucide-react';
import type { User } from '../../../types';

const AUTH_STORAGE_KEY = 'limperial_auth_user';
const AUTH_USER_CACHE_KEY = 'limperial_auth_user_data';

export default function AuthCallbackPage() {
    const router = useRouter();
    const [error, setError] = useState('');
    const didRun = useRef(false);

    useEffect(() => {
        // Prevent double-run in React strict mode
        if (didRun.current) return;
        didRun.current = true;

        const supabase = getSupabaseBrowserClient();
        let redirected = false;

        const doRedirect = () => {
            if (redirected) return;
            redirected = true;
            router.replace('/');
        };

        const handleSession = async (email: string) => {
            try {
                // Fetch + cache user while still on the callback page
                // so AppShell finds it in localStorage instantly — no extra fetch needed
                const users = await readRecords<User>('Users');
                const user = users.find(
                    u => u.Email?.trim().toLowerCase() === email.trim().toLowerCase()
                );
                if (user && user.Status === 'Active') {
                    localStorageSet(AUTH_STORAGE_KEY, user.UserID);
                    localStorageSet(AUTH_USER_CACHE_KEY, JSON.stringify(user));
                    setCookie('limperial_legacy_session', user.UserID, 7);
                }
            } catch {
                // Best effort — AuthContext will re-fetch if cache is missing
            } finally {
                doRedirect();
            }
        };

        // Listen for the SIGNED_IN event (fires after code exchange)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user?.email) {
                subscription.unsubscribe();
                handleSession(session.user.email);
            } else if (event === 'SIGNED_IN' && session) {
                subscription.unsubscribe();
                doRedirect();
            }
        });

        // Check if session already exists (e.g. page reload on callback)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.email) {
                subscription.unsubscribe();
                handleSession(session.user.email);
            }
        });

        // Timeout fallback
        const timeout = setTimeout(() => {
            setError('Sign in timed out. Please try again.');
        }, 12000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4 text-center px-6">
                {error ? (
                    <>
                        <p className="text-destructive font-medium">{error}</p>
                        <button onClick={() => router.replace('/login')} className="text-primary hover:underline text-sm">
                            Back to login
                        </button>
                    </>
                ) : (
                    <>
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Signing you in...</p>
                    </>
                )}
            </div>
        </div>
    );
}
