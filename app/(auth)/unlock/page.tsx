'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, RefreshCw, AlertCircle } from 'lucide-react';
import { PIN_STORAGE_KEY, UNLOCK_STORAGE_KEY, hashPin } from '../../../utils/security';
import { useAuth } from '../../../contexts/AuthContext';
import { PinDots, PinPad } from '../../../components/common/PinPad';

export default function UnlockPage() {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isChecking, setIsChecking] = useState(true);
    const { logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Dev bypass: skip PIN entirely when NEXT_PUBLIC_DEV_BYPASS_LOCK is set
        if (
            process.env.NODE_ENV === 'development' &&
            process.env.NEXT_PUBLIC_DEV_BYPASS_LOCK === 'true'
        ) {
            sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
            router.replace('/dashboard');
            return;
        }

        const storedPin = localStorage.getItem(PIN_STORAGE_KEY);
        const isUnlocked = sessionStorage.getItem(UNLOCK_STORAGE_KEY) === 'true';

        if (isUnlocked) {
            router.replace('/dashboard');
        } else if (!storedPin) {
            router.replace('/unlock/otp');
        } else {
            setIsChecking(false);
        }
    }, [router]);

    // Check PIN against stored hash on every keystroke when length is 4-6
    useEffect(() => {
        const checkPin = async () => {
            if (pin.length >= 4) {
                const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
                const inputHash = await hashPin(pin);
                
                if (storedHash === inputHash) {
                    sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
                    router.replace('/dashboard');
                } else if (pin.length === 6) {
                    // Only show error and reset if they reached the maximum length
                    setError('Incorrect PIN');
                    setPin('');
                }
            }
        };
        
        checkPin();
    }, [pin, router]);

    const appendDigit = useCallback((d: string) => {
        if (isChecking) return;
        setPin(prev => prev.length < 6 ? prev + d : prev);
        setError('');
    }, [isChecking]);

    const deleteDigit = useCallback(() => {
        if (isChecking) return;
        setPin(prev => prev.slice(0, -1));
        setError('');
    }, [isChecking]);

    const handleManualSubmit = useCallback(async () => {
        if (pin.length < 4) return;
        const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
        const inputHash = await hashPin(pin);
        
        if (storedHash === inputHash) {
            sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
            router.replace('/dashboard');
        } else {
            setError('Incorrect PIN');
            setPin('');
        }
    }, [pin, router]);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (/^[0-9]$/.test(e.key)) appendDigit(e.key);
            else if (e.key === 'Backspace') deleteDigit();
            else if (e.key === 'Enter') handleManualSubmit();
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [appendDigit, deleteDigit, handleManualSubmit]);

    const handleForgotPin = () => {
        localStorage.removeItem(PIN_STORAGE_KEY);
        router.push('/unlock/otp');
    };

    const handleSignOut = async () => {
        try { await logout(); } catch { /* ignore */ }
        window.location.href = '/login';
    };

    if (isChecking) return null;

    return (
        <div className="fixed inset-0 z-[99999] bg-[#0c121d] flex flex-col items-center justify-center text-white px-4 font-sans selection:bg-transparent">
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center gap-4 mb-10">
                    <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)] border border-blue-500/20">
                        <Lock className="w-7 h-7" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-semibold tracking-tight text-white">Enter your PIN</h2>
                        <p className="text-sm text-slate-400 mt-2">Please enter your 4 to 6-digit PIN to unlock.</p>
                    </div>
                </div>

                <PinDots length={6} filled={pin.length} />

                <div className="h-6 mb-6 w-full flex justify-center">
                    {error && (
                        <div className="flex items-center gap-2 text-rose-400 text-sm font-medium animate-shake px-4 py-1.5 bg-rose-500/10 rounded-full border border-rose-500/20">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <PinPad 
                    onDigit={appendDigit} 
                    onDelete={deleteDigit} 
                    onSubmit={handleManualSubmit}
                    submitDisabled={pin.length < 4}
                />

                <p className="hidden md:block text-slate-500 text-sm mt-8 text-center px-6 leading-relaxed">
                    Use your keyboard or the on-screen pad. Press Enter or Check to submit.
                </p>

                <div className="flex flex-col items-center gap-2 mt-8">
                    <button
                        onClick={handleForgotPin}
                        className="text-slate-500 hover:text-white text-sm transition-colors flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Forgot PIN?
                    </button>
                    <button
                        onClick={handleSignOut}
                        className="text-rose-500/60 hover:text-rose-400 text-sm transition-colors px-4 py-2"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}