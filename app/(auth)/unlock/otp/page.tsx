'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { SETUP_PHASE_KEY, OTP_EMAIL_KEY } from '../../../../utils/security';

export default function RequestOtpPage() {
    const { currentUser, loginWithOtp, logout, isAuthLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    // While AuthContext is still bootstrapping, currentUser may not be
    // hydrated yet even though the user is authenticated. Block the send
    // button until loading is done so we never fire the "email not found"
    // error prematurely.
    const isBusy = isAuthLoading || loading;

    const handleSendOtp = async () => {
        if (isBusy) return;
        if (!currentUser?.Email) {
            setError('User email not found. Please sign out and log in again.');
            return;
        }
        setLoading(true);
        setError('');
        const res = await loginWithOtp(currentUser.Email);
        setLoading(false);
        if (res.success) {
            sessionStorage.setItem(OTP_EMAIL_KEY, currentUser.Email);
            sessionStorage.setItem(SETUP_PHASE_KEY, 'otp_verify');
            router.push('/unlock/otp/verify');
        } else {
            setError(res.message);
        }
    };

    const handleSignOut = async () => {
        try { await logout(); } catch { /* ignore */ }
        window.location.href = '/login';
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-[#0c121d] flex flex-col items-center justify-center text-white px-4 font-sans">
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)] border border-blue-500/20 mb-6">
                    <Mail className="w-7 h-7" />
                </div>

                <h2 className="text-2xl font-semibold tracking-tight text-white mb-2 text-center">Verify Your Identity</h2>
                <p className="text-sm text-slate-400 text-center mb-8 px-4 leading-relaxed">
                    Before setting up a passcode on this device, we need to verify your identity by sending an authentication code to your email.
                </p>

                {error && (
                    <div className="flex items-center gap-2 text-rose-400 text-sm font-medium px-4 py-2 bg-rose-500/10 rounded-lg border border-rose-500/20 mb-6 w-full justify-center">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="w-full space-y-4">
                    <button
                        onClick={handleSendOtp}
                        disabled={isBusy}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                    >
                        {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Code'}
                    </button>

                    <button
                        onClick={handleSignOut}
                        className="w-full py-2 text-rose-500/80 hover:text-rose-400 text-sm transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}