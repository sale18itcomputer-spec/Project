'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../utils/supabase/client';
import { readRecords } from '../../../services/api';
import { localStorageSet, setCookie } from '../../../utils/storage';
import { Loader2, ShieldAlert, Copy, Check, ArrowRight, Compass } from 'lucide-react';
import type { User } from '../../../types';

const AUTH_STORAGE_KEY = 'limperial_auth_user';
const AUTH_USER_CACHE_KEY = 'limperial_auth_user_data';

export default function AuthCallbackClientPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const didRun = useRef(false);

    useEffect(() => {
        if (didRun.current) return;
        didRun.current = true;

        const supabase = getSupabaseBrowserClient();

        const handleSession = async (email: string) => {
            try {
                const users = (await readRecords<any>('Users')) as User[];
                const user = users.find(
                    u => u.Email?.trim().toLowerCase() === email.trim().toLowerCase()
                );
                if (user && user.Status === 'Active') {
                    localStorageSet(AUTH_STORAGE_KEY, user.UserID);
                    localStorageSet(AUTH_USER_CACHE_KEY, JSON.stringify(user));
                    setCookie('limperial_legacy_session', user.UserID, 7);
                }
            } catch (e) {
                console.error('Error handling session details:', e);
            }
            router.replace('/dashboard');
        };

        const code = searchParams.get('code');

        if (code) {
            // PKCE flow
            supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
                if (error) { 
                    setError(error.message); 
                    return; 
                }
                const email = data.session?.user?.email;
                if (email) handleSession(email);
                else router.replace('/');
            }).catch((err) => {
                setError(err?.message || 'Authentication code exchange failed.');
            });
        } else {
            // Implicit flow — check session immediately first, then listen
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user?.email) {
                    handleSession(session.user.email);
                    return;
                }
                // Session not ready yet — wait for onAuthStateChange
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_IN' && session?.user?.email) {
                        subscription.unsubscribe();
                        handleSession(session.user.email);
                    }
                });
                // Timeout fallback
                setTimeout(() => {
                    subscription.unsubscribe();
                    setError('Sign in timed out. Please try again.');
                }, 15000);
            }).catch((err) => {
                setError(err?.message || 'Failed to check active session.');
            });
        }
    }, [router, searchParams]);

    const handleCopyLink = () => {
        if (typeof window !== 'undefined') {
            const loginUrl = `${window.location.origin}/login`;
            navigator.clipboard.writeText(loginUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        }
    };

    const isPkceError = 
        error.toLowerCase().includes('pkce') || 
        error.toLowerCase().includes('code verifier') || 
        error.toLowerCase().includes('storage') || 
        error.toLowerCase().includes('session') ||
        error.toLowerCase().includes('cookie') ||
        error.toLowerCase().includes('exchange');

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 transition-colors duration-300">
            <div className="w-full max-w-lg">
                {!error ? (
                    <div className="flex flex-col items-center justify-center gap-4 text-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-xl shadow-slate-100/50 dark:shadow-none">
                        <div className="relative flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-2">Completing Sign-In</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">Establishing a secure session, please wait a moment...</p>
                    </div>
                ) : isPkceError ? (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-100 dark:border-amber-950/20 shadow-xl shadow-amber-100/10 dark:shadow-none p-6 sm:p-8 overflow-hidden relative">
                        {/* Elegant background highlight */}
                        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex flex-col items-center text-center">
                            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-500 mb-5">
                                <ShieldAlert className="h-7 w-7 animate-pulse" />
                            </div>
                            
                            <span className="px-3 py-1 text-xs font-semibold tracking-wider uppercase text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40 rounded-full border border-amber-100 dark:border-amber-900/30 mb-3">
                                Security Sandbox Blocked
                            </span>

                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                Secure Redirect Mismatch
                            </h1>

                            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                                You likely initiated sign-in inside an in-app browser (such as <span className="font-semibold text-slate-700 dark:text-slate-300">Telegram</span> or <span className="font-semibold text-slate-700 dark:text-slate-300">Line</span>) which isolated your login data. When the login completed in your default browser, the secure keys could not be shared.
                            </p>

                            {/* Divider */}
                            <div className="w-full h-[1px] bg-slate-100 dark:bg-slate-800/80 my-6" />

                            {/* Easy instructions */}
                            <div className="text-left w-full space-y-4">
                                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Compass className="h-4.5 w-4.5" /> Quick Solution
                                </h3>

                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0 mt-0.5">
                                            1
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-normal">
                                            Copy the secure login link below.
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0 mt-0.5">
                                            2
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-normal">
                                            Open your standalone system browser (<span className="font-semibold">Safari</span> on iOS, <span className="font-semibold">Chrome</span> on Android).
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0 mt-0.5">
                                            3
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-normal">
                                            Paste the link and continue signing in seamlessly.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="w-full flex flex-col sm:flex-row gap-3 mt-8">
                                <button
                                    onClick={handleCopyLink}
                                    className="flex-1 h-12 flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm rounded-xl transition-all shadow-sm"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="h-4.5 w-4.5 text-emerald-500" />
                                            <span className="text-emerald-600 dark:text-emerald-400">Link Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-4.5 w-4.5 text-slate-400" />
                                            <span>Copy Sign-in Link</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => router.replace('/login')}
                                    className="flex-1 h-12 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20"
                                >
                                    <span>Try Again</span>
                                    <ArrowRight className="h-4.5 w-4.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-destructive/10 shadow-xl shadow-slate-100/50 dark:shadow-none p-8 flex flex-col items-center text-center">
                        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-destructive/10 text-destructive mb-4">
                            <ShieldAlert className="h-7 w-7" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Authentication Failed</h2>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{error}</p>
                        
                        <button
                            onClick={() => router.replace('/login')}
                            className="mt-6 h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl transition-all"
                        >
                            Return to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

