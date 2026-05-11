'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, RefreshCw, AlertCircle, Delete } from 'lucide-react';
import { PIN_STORAGE_KEY, UNLOCK_STORAGE_KEY, hashPin } from '../../../utils/security';
import { useAuth } from '../../../contexts/AuthContext';

export default function UnlockPage() {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isChecking, setIsChecking] = useState(true);
    const { logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
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

    const processPin = useCallback(async (currentPin: string) => {
        const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
        const inputHash = await hashPin(currentPin);
        
        if (storedHash === inputHash) {
            sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
            router.replace('/dashboard');
        } else {
            setError('Incorrect PIN');
            setPin('');
        }
    }, [router]);

    useEffect(() => {
        if (pin.length === 4) {
            const timeout = setTimeout(() => processPin(pin), 150);
            return () => clearTimeout(timeout);
        }
    }, [pin, processPin]);

    const handleKeyPress = useCallback((e: KeyboardEvent) => {
        if (isChecking) return;
        if (/^[0-9]$/.test(e.key)) {
            setPin(prev => prev.length < 4 ? prev + e.key : prev);
            setError('');
        } else if (e.key === 'Backspace') {
            setPin(prev => prev.slice(0, -1));
            setError('');
        }
    }, [isChecking]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleKeyPress]);

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
                        <p className="text-sm text-slate-400 mt-2">Please enter your 4-digit PIN to unlock.</p>
                    </div>
                </div>

                <div className="flex justify-center gap-6 mb-12 h-6 items-center">
                    {[0, 1, 2, 3].map((index) => (
                        <div key={index} className={`w-4 h-4 rounded-full transition-all duration-300 ${index < pin.length ? 'bg-blue-500 scale-125 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-slate-700/50 border border-slate-600'}`} />
                    ))}
                </div>

                <div className="h-6 mb-6 w-full flex justify-center">
                    {error && (
                        <div className="flex items-center gap-2 text-rose-400 text-sm font-medium animate-shake px-4 py-1.5 bg-rose-500/10 rounded-full border border-rose-500/20">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-x-8 gap-y-4 max-w-[280px] mx-auto w-full md:hidden">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button key={num} onClick={() => setPin(p => p.length < 4 ? p + num : p)} className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto">{num}</button>
                    ))}
                    <div />
                    <button onClick={() => setPin(p => p.length < 4 ? p + '0' : p)} className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto">0</button>
                    <button onClick={() => setPin(p => p.slice(0, -1))} className="w-16 h-16 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto"><Delete className="w-6 h-6" /></button>
                </div>
                
                <p className="hidden md:block text-slate-500 text-sm mt-8">Use your keyboard to enter the PIN</p>

                <div className="flex flex-col items-center gap-2 mt-8">
                    <button onClick={() => { localStorage.removeItem(PIN_STORAGE_KEY); router.push('/unlock/otp'); }} className="text-slate-500 hover:text-white text-sm transition-colors flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5">
                        <RefreshCw className="w-4 h-4" />
                        Forgot PIN?
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
                        className="text-rose-500/60 hover:text-rose-400 text-sm transition-colors px-4 py-2"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}