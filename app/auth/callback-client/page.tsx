'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../utils/supabase/client';
import { readRecords } from '../../../services/api';
import { localStorageSet, setCookie } from '../../../utils/storage';
import { Loader2 } from 'lucide-react';
import type { User } from '../../../types';

const AUTH_STORAGE_KEY = 'limperial_auth_user';
const AUTH_USER_CACHE_KEY = 'limperial_auth_user_data';

export default function AuthCallbackClientPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState('');
    const didRun = useRef(false);

    useEffect(() => {
        if (didRun.current) return;
        didRun.current = true;

        const supabase = getSupabaseBrowserClient();

        const handleSession = async (email: string) => {
            try {
                const users = await readRecords<User>('Users');
                const user = users.find(
                    u => u.Email?.trim().toLowerCase() === email.trim().toLowerCase()
                );
                if (user && user.Status === 'Active') {
                    localStorageSet(AUTH_STORAGE_KEY, user.UserID);
                    localStorageSet(AUTH_USER_CACHE_KEY, JSON.stringify(user));
                    setCookie('limperial_legacy_session', user.UserID, 7);
                }
            } catch {}
            router.replace('/');
        };

        const code = searchParams.get('code');

        if (code) {
            // PKCE flow
            supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
                if (error) { setError(error.message); return; }
                const email = data.session?.user?.email;
                if (email) handleSession(email);
                else router.replace('/');
            });
        } else {
            // Implicit flow — token arrives via hash, onAuthStateChange fires automatically
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' && session?.user?.email) {
                    subscription.unsubscribe();
                    handleSession(session.user.email);
                }
            });
            // Timeout fallback
            setTimeout(() => {
                setError('Sign in timed out. Please try again.');
            }, 10000);
        }
    }, [router, searchParams]);

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
