'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { SETUP_PHASE_KEY, OTP_EMAIL_KEY } from '../../../../utils/security';

export default function RequestOtpPage() {
    const { currentUser, loginWithOtp, logout, isAuthLoading } = useAuth();
    const [stage, setStage] = useState<'sending' | 'error'>('sending');
    const [error, setError] = useState('');
    const router = useRouter();

    // Tracks whether we have already fired the OTP send so StrictMode
    // double-invoke and fast navigations don't send two emails.
    const hasSentRef = useRef(false);
    // Bumped by the Retry button to re-trigger the send effect.
    const [retryCount, setRetryCount] = useState(0);

    const sendOtp = useCallback(async (email: string) => {
        setStage('sending');
        setError('');
        const res = await loginWithOtp(email);
        if (res.success) {
            sessionStorage.setItem(OTP_EMAIL_KEY, email);
            sessionStorage.setItem(SETUP_PHASE_KEY, 'otp_verify');
            router.push('/unlock/otp/verify');
        } else {
            setStage('error');
            setError(res.message);
        }
    }, [loginWithOtp, router]);

    // Auto-send as soon as currentUser is ready — no manual click needed.
    useEffect(() => {
        if (isAuthLoading) return;
        if (!currentUser?.Email) {
            setStage('error');
            setError('User email not found. Please sign out and log in again.');
            return;
        }
        if (hasSentRef.current) return;
        hasSentRef.current = true;
        sendOtp(currentUser.Email);
    }, [isAuthLoading, currentUser, sendOtp, retryCount]);

    const handleRetry = () => {
        hasSentRef.current = false;
        setRetryCount(c => c + 1);
    };

    const handleSignOut = async () => {
        try { await logout(); } catch { /* ignore */ }
        window.location.href = '/login';
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-[#0c121d] flex flex-col items-center justify-center text-white px-4 font-sans">
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)] border border-blue-500/20 mb-6">
                    {stage === 'error' ? <Mail className="w-7 h-7" /> : <Loader2 className="w-7 h-7 animate-spin" />}
                </div>

                {stage === 'sending' ? (
                    <>
                        <h2 className="text-2xl font-semibold tracking-tight text-white mb-2 text-center">
                            Sending Verification Code
                        </h2>
                        <p className="text-sm text-slate-400 text-center px-4 leading-relaxed">
                            Sending a sign-in code to{' '}
                            <span className="text-slate-300 font-medium">
                                {currentUser?.Email ?? '…'}
                            </span>
                        </p>
                    </>
                ) : (
                    <>
                        <h2 className="text-2xl font-semibold tracking-tight text-white mb-2 text-center">
                            Couldn't Send Code
                        </h2>

                        <div className="flex items-center gap-2 text-rose-400 text-sm font-medium px-4 py-2 bg-rose-500/10 rounded-lg border border-rose-500/20 mb-6 w-full justify-center">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>

                        <div className="w-full space-y-3">
                            <button
                                onClick={handleRetry}
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={handleSignOut}
                                className="w-full py-2 text-rose-500/80 hover:text-rose-400 text-sm transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
