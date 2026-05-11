'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { SETUP_PHASE_KEY } from '../../../../../utils/security';

export default function VerifyOtpPage() {
    const { currentUser, verifyOtp, logout } = useAuth();
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleVerify = async () => {
        const email = currentUser?.Email || sessionStorage.getItem('limperial_otp_email');
        if (token.length < 6 || !email) {
            if (!email) setError('Session expired. Please try sending the code again.');
            return;
        }
        
        setLoading(true);
        setError('');
        try {
            const res = await verifyOtp(email, token);
            if (res.success) {
                sessionStorage.setItem(SETUP_PHASE_KEY, 'pin_create');
                router.replace('/unlock/pin/create');
            } else {
                setError(res.message);
                setToken('');
                setLoading(false);
            }
        } catch (err) {
            setError('Verification failed. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-[#0c121d] flex flex-col items-center justify-center text-white px-4 font-sans">
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)] border border-blue-500/20 mb-6">
                    <Mail className="w-7 h-7" />
                </div>
                
                <h2 className="text-2xl font-semibold tracking-tight text-white mb-2 text-center">Enter Login Code</h2>
                <p className="text-sm text-slate-400 text-center mb-8 px-4 leading-relaxed">
                    We sent a 6-digit code to {currentUser?.Email || sessionStorage.getItem('limperial_otp_email') || 'your email'}.
                </p>

                {error && (
                    <div className="flex items-center gap-2 text-rose-400 text-sm font-medium px-4 py-2 bg-rose-500/10 rounded-lg border border-rose-500/20 mb-6 w-full justify-center">
                        <AlertCircle className="w-4 h-4" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="w-full space-y-4">
                    <input 
                        type="text" 
                        value={token}
                        onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono outline-none transition-all placeholder:text-slate-600"
                        onKeyDown={(e) => e.key === 'Enter' && token.length === 6 && handleVerify()}
                        autoFocus
                    />
                    <button
                        onClick={handleVerify}
                        disabled={loading || token.length < 6}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Code'}
                    </button>
                    <button
                        onClick={() => router.replace('/unlock/otp')}
                        className="w-full py-2 text-slate-500 hover:text-white text-sm transition-colors"
                    >
                        Resend Code
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                await logout();
                                window.location.href = '/login';
                            } catch {
                                window.location.href = '/login';
                            }
                        }}
                        className="w-full py-2 text-rose-500/80 hover:text-rose-400 text-sm transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}