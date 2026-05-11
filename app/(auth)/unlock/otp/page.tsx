'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { SETUP_PHASE_KEY } from '../../../../utils/security';

export default function RequestOtpPage() {
    const { currentUser, loginWithOtp, logout } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSendOtp = async () => {
        if (!currentUser?.Email) {
            setError('User email not found. Please log in again.');
            return;
        }
        setLoading(true);
        setError('');
        const res = await loginWithOtp(currentUser.Email);
        setLoading(false);
        if (res.success) {
            sessionStorage.setItem(SETUP_PHASE_KEY, 'otp_verify');
            router.push('/unlock/otp/verify');
        } else {
            setError(res.message);
        }
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
                        <AlertCircle className="w-4 h-4" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="w-full space-y-4">
                    <button
                        onClick={handleSendOtp}
                        disabled={loading}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Code'}
                    </button>
                    
                    <button
                        onClick={() => {
                            sessionStorage.setItem(SETUP_PHASE_KEY, 'otp_verify');
                            router.push('/unlock/otp/verify');
                        }}
                        className="w-full py-2 text-slate-500 hover:text-white text-sm transition-colors"
                    >
                        I already have a code
                    </button>

                    <button
                        onClick={async () => {
                            await logout();
                            router.replace('/login');
                        }}
                        className="w-full py-2 text-rose-500/80 hover:text-rose-400 text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}