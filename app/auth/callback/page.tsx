'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../utils/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
    const router = useRouter();
    const [error, setError] = useState('');

    useEffect(() => {
        const supabase = getSupabaseBrowserClient();

        // Supabase JS automatically parses the code/token from the URL
        // and exchanges it for a session. onAuthStateChange fires when done.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                subscription.unsubscribe();
                router.replace('/');
            }
        });

        // Also handle the case where session is already established
        // (e.g. user lands on callback page after redirect)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                subscription.unsubscribe();
                router.replace('/');
            }
        });

        // Timeout — if nothing happens in 10s, something went wrong
        const timeout = setTimeout(() => {
            setError('Sign in timed out. Please try again.');
        }, 10000);

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
                        <button
                            onClick={() => router.replace('/login')}
                            className="text-primary hover:underline text-sm"
                        >
                            Back to login
                        </button>
                    </>
                ) : (
                    <>
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Completing sign in...</p>
                    </>
                )}
            </div>
        </div>
    );
}
