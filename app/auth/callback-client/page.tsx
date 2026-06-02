'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../utils/supabase/client';
import { readRecords } from '../../../services/api';
import { localStorageSet, setCookie } from '../../../utils/storage';
import { Loader2, ShieldAlert, Mail, ArrowRight, RefreshCw } from 'lucide-react';
import type { User } from '../../../types';

const AUTH_STORAGE_KEY = 'limperial_auth_user';
const AUTH_USER_CACHE_KEY = 'limperial_auth_user_data';
const SETUP_PHASE_KEY = 'limperial_setup_phase';
const OTP_EMAIL_KEY = 'limperial_otp_email';

type Stage = 'loading' | 'pkce-sending' | 'pkce-email' | 'pkce-otp' | 'error';

function isPkceRelated(msg: string) {
    const m = msg.toLowerCase();
    return (
        m.includes('pkce') || m.includes('code verifier') || m.includes('storage') ||
        m.includes('session') || m.includes('cookie') || m.includes('exchange') ||
        m.includes('timed out') || m.includes('invalid grant')
    );
}

export default function AuthCallbackClientPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = getSupabaseBrowserClient();

    const [stage, setStage] = useState<Stage>('loading');
    const [errorMsg, setErrorMsg] = useState('');

    // PKCE fallback OTP state
    const [pkceEmail, setPkceEmail] = useState('');
    const [otpToken, setOtpToken] = useState('');
    const [busy, setBusy] = useState(false);

    const didRun = useRef(false);
    const isBusyRef = useRef(false);
    const pkceSendRan = useRef(false);

    // Completes the session: looks up user in Users table, writes localStorage
    // and cookie, then navigates to the intended destination.
    const finishSession = useCallback(async (email: string) => {
        try {
            const users = (await readRecords<any>('Users')) as User[];
            const user = users.find(
                u => u.Email?.trim().toLowerCase() === email.trim().toLowerCase()
            );
            if (!user) {
                setErrorMsg(`No account found for ${email}. Contact your administrator to be added.`);
                setStage('error');
                return;
            }
            if (user.Status !== 'Active') {
                setErrorMsg('Your account is inactive. Please contact your administrator.');
                setStage('error');
                return;
            }
            localStorageSet(AUTH_STORAGE_KEY, user.UserID);
            localStorageSet(AUTH_USER_CACHE_KEY, JSON.stringify(user));
            setCookie('limperial_legacy_session', user.UserID, 7);
        } catch {
            setErrorMsg('Failed to verify your account. Please try again.');
            setStage('error');
            return;
        }
        const next = searchParams.get('next');
        router.replace(next && next !== '/' ? next : '/dashboard');
    }, [searchParams, router]);

    // Send OTP — accepts an explicit email so it can be called for auto-send and manual send
    const sendOtpToEmail = useCallback(async (email: string) => {
        if (!email.trim() || isBusyRef.current) return;
        isBusyRef.current = true;
        setBusy(true);
        setErrorMsg('');
        const { error } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: { shouldCreateUser: false },
        });
        isBusyRef.current = false;
        setBusy(false);
        if (error) {
            setErrorMsg(error.message);
            setStage('pkce-email');
        } else {
            setOtpToken('');
            setStage('pkce-otp');
        }
    }, [supabase]);

    // When pkce-sending stage is entered, pkceEmail has already been set via
    // setPkceEmail — trigger the OTP send automatically.
    useEffect(() => {
        if (stage !== 'pkce-sending' || !pkceEmail || pkceSendRan.current) return;
        pkceSendRan.current = true;
        sendOtpToEmail(pkceEmail);
    }, [stage, pkceEmail, sendOtpToEmail]);

    useEffect(() => {
        if (didRun.current) return;
        didRun.current = true;

        const code = searchParams.get('code');

        // Try to recover using a cached user email — avoids asking the user to
        // re-type their email when the PKCE code exchange fails.
        // AUTH_USER_CACHE_KEY is cleared on logout, so we also check the
        // last-signin-email hint which intentionally survives logout.
        const tryAutoSendOtp = (fallbackStage: Stage) => {
            let email: string | null = null;
            try {
                const cached = localStorage.getItem(AUTH_USER_CACHE_KEY);
                if (cached) {
                    const user = JSON.parse(cached) as { Email?: string };
                    if (user?.Email) email = user.Email;
                }
            } catch { /* ignore JSON parse errors */ }
            if (!email) {
                email = localStorage.getItem('limperial_last_signin_email');
            }
            if (email) {
                setPkceEmail(email);
                setStage('pkce-sending'); // triggers the effect above
                return;
            }
            setStage(fallbackStage);
        };

        if (code) {
            // Race the PKCE exchange against a 12-second timeout so the user
            // is never stuck on the loading screen indefinitely.
            let settled = false;
            const timeoutId = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    tryAutoSendOtp('pkce-email');
                }
            }, 12000);

            supabase.auth.exchangeCodeForSession(code)
                .then(({ data, error }) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);

                    if (error) {
                        if (isPkceRelated(error.message)) {
                            tryAutoSendOtp('pkce-email');
                        } else {
                            setErrorMsg(error.message);
                            setStage('error');
                        }
                        return;
                    }
                    const email = (data as any)?.session?.user?.email;
                    if (email) finishSession(email);
                    else router.replace('/');
                })
                .catch((err) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    const msg = err?.message || 'Authentication code exchange failed.';
                    if (isPkceRelated(msg)) {
                        tryAutoSendOtp('pkce-email');
                    } else {
                        setErrorMsg(msg);
                        setStage('error');
                    }
                });
        } else {
            // Implicit / magic-link flow — token is in hash, handled client-side
            supabase.auth.getSession()
                .then(({ data: { session } }) => {
                    if (session?.user?.email) { finishSession(session.user.email); return; }

                    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                        if (event === 'SIGNED_IN' && session?.user?.email) {
                            subscription.unsubscribe();
                            finishSession(session.user.email);
                        }
                    });
                    setTimeout(() => {
                        subscription.unsubscribe();
                        setErrorMsg('Sign in timed out. Please try again.');
                        setStage('error');
                    }, 15000);
                })
                .catch((err) => {
                    setErrorMsg(err?.message || 'Failed to check active session.');
                    setStage('error');
                });
        }
     
    }, []);

    // Send OTP to the email entered on the PKCE fallback form
    const handleSendOtp = useCallback(async () => {
        await sendOtpToEmail(pkceEmail);
    }, [pkceEmail, sendOtpToEmail]);

    // Verify the OTP code and complete the session
    const handleVerifyOtp = useCallback(async (token: string) => {
        if (!token || isBusyRef.current) return;
        isBusyRef.current = true;
        setBusy(true);
        setErrorMsg('');
        const { data, error } = await supabase.auth.verifyOtp({
            email: pkceEmail,
            token,
            type: 'email',
        });
        if (error) {
            isBusyRef.current = false;
            setBusy(false);
            setErrorMsg(error.message);
            return;
        }
        // Mark that the user has already verified OTP so /unlock/otp skips straight
        // to PIN creation instead of sending another OTP (which would hit rate limits).
        sessionStorage.setItem(SETUP_PHASE_KEY, 'pin_create');
        sessionStorage.setItem(OTP_EMAIL_KEY, pkceEmail);
        // finishSession handles clearing busy/loading via navigation
        await finishSession(data?.user?.email ?? pkceEmail);
        isBusyRef.current = false;
        setBusy(false);
    }, [pkceEmail, supabase, finishSession]);

    // ─── Auto-sending OTP (cached email detected) ───────────────────────────────
    if (stage === 'pkce-sending') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
                <div className="w-full max-w-lg flex flex-col items-center justify-center gap-4 text-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-xl">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-2">Sending Sign-In Code</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                        Sending a code to <span className="font-medium text-slate-700 dark:text-slate-300">{pkceEmail}</span>…
                    </p>
                </div>
            </div>
        );
    }

    // ─── Loading ────────────────────────────────────────────────────────────────
    if (stage === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
                <div className="w-full max-w-lg flex flex-col items-center justify-center gap-4 text-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-xl">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-2">Completing Sign-In</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                        Establishing a secure session, please wait a moment…
                    </p>
                </div>
            </div>
        );
    }

    // ─── PKCE fallback — email input ────────────────────────────────────────────
    if (stage === 'pkce-email') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
                <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-xl p-8 flex flex-col gap-5">
                    <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-500 mx-auto">
                        <ShieldAlert className="h-7 w-7" />
                    </div>

                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                            Sign-In Couldn't Complete
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                            Google sign-in was blocked by your browser's security sandbox.
                            Enter your work email to receive a sign-in code instead.
                        </p>
                    </div>

                    {errorMsg && (
                        <p className="text-sm text-rose-500 dark:text-rose-400 text-center -mt-1">{errorMsg}</p>
                    )}

                    <div className="space-y-3">
                        <input
                            type="email"
                            placeholder="your@email.com"
                            value={pkceEmail}
                            onChange={e => { setPkceEmail(e.target.value); setErrorMsg(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                            disabled={busy}
                            autoFocus
                            autoComplete="email"
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:opacity-50 placeholder:text-slate-400"
                        />
                        <button
                            onClick={handleSendOtp}
                            disabled={busy || !pkceEmail.trim()}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-indigo-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {busy
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <><Mail className="h-4 w-4" /> Send Sign-In Code</>
                            }
                        </button>
                        <button
                            onClick={() => router.replace('/login')}
                            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── PKCE fallback — OTP code input ─────────────────────────────────────────
    if (stage === 'pkce-otp') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
                <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-xl p-8 flex flex-col gap-5">
                    <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 mx-auto">
                        <Mail className="h-7 w-7" />
                    </div>

                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                            Check Your Email
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                            We sent a 6-digit code to{' '}
                            <span className="font-medium text-slate-700 dark:text-slate-300">{pkceEmail}</span>.
                        </p>
                    </div>

                    {errorMsg && (
                        <p className="text-sm text-rose-500 dark:text-rose-400 text-center -mt-1">{errorMsg}</p>
                    )}

                    <div className="space-y-3">
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="000000"
                            value={otpToken}
                            maxLength={6}
                            disabled={busy}
                            autoFocus
                            autoComplete="one-time-code"
                            onChange={e => {
                                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                                setOtpToken(v);
                                setErrorMsg('');
                                if (v.length === 6) setTimeout(() => handleVerifyOtp(v), 0);
                            }}
                            onKeyDown={e => e.key === 'Enter' && otpToken.length === 6 && handleVerifyOtp(otpToken)}
                            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-center text-2xl tracking-[0.5em] font-mono text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:opacity-50 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        />
                        <button
                            onClick={() => handleVerifyOtp(otpToken)}
                            disabled={busy || otpToken.length < 6}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-indigo-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {busy
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <>Verify & Sign In <ArrowRight className="h-4 w-4" /></>
                            }
                        </button>
                        <button
                            onClick={() => { setOtpToken(''); setErrorMsg(''); handleSendOtp(); }}
                            disabled={busy}
                            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                        >
                            <RefreshCw className="h-3.5 w-3.5" /> Resend Code
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Generic error ───────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-xl p-8 flex flex-col items-center text-center gap-4">
                <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Authentication Failed</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">{errorMsg}</p>
                <button
                    onClick={() => router.replace('/login')}
                    className="mt-2 h-11 px-6 bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-white font-medium text-sm rounded-xl transition"
                >
                    Return to Login
                </button>
            </div>
        </div>
    );
}
