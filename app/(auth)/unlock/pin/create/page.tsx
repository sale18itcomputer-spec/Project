'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Delete } from 'lucide-react';
import { SETUP_PHASE_KEY } from '../../../../../utils/security';

export default function CreatePinPage() {
    const [pin, setPin] = useState('');
    const router = useRouter();

    const processPin = useCallback((currentPin: string) => {
        sessionStorage.setItem('temp_pin', currentPin);
        router.push('/unlock/pin/confirm');
    }, [router]);

    useEffect(() => {
        if (pin.length === 4) {
            const timeout = setTimeout(() => processPin(pin), 150);
            return () => clearTimeout(timeout);
        }
    }, [pin, processPin]);

    const handleKeyPress = useCallback((e: KeyboardEvent) => {
        if (/^[0-9]$/.test(e.key)) {
            setPin(prev => prev.length < 4 ? prev + e.key : prev);
        } else if (e.key === 'Backspace') {
            setPin(prev => prev.slice(0, -1));
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleKeyPress]);

    return (
        <div className="fixed inset-0 z-[99999] bg-[#0c121d] flex flex-col items-center justify-center text-white px-4 font-sans selection:bg-transparent">
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center gap-4 mb-10">
                    <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)] border border-blue-500/20">
                        <Lock className="w-7 h-7" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-semibold tracking-tight text-white">Create a PIN</h2>
                        <p className="text-sm text-slate-400 mt-2">Set a 4-digit PIN to secure this device.</p>
                    </div>
                </div>

                <div className="flex justify-center gap-6 mb-12 h-6 items-center">
                    {[0, 1, 2, 3].map((index) => (
                        <div key={index} className={`w-4 h-4 rounded-full transition-all duration-300 ${index < pin.length ? 'bg-blue-500 scale-125 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-slate-700/50 border border-slate-600'}`} />
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-x-8 gap-y-4 max-w-[280px] mx-auto w-full md:hidden">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button key={num} onClick={() => setPin(p => p.length < 4 ? p + num : p)} className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto">{num}</button>
                    ))}
                    <div />
                    <button onClick={() => setPin(p => p.length < 4 ? p + '0' : p)} className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto">0</button>
                    <button onClick={() => setPin(p => p.slice(0, -1))} className="w-16 h-16 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto"><Delete className="w-6 h-6" /></button>
                </div>
                
                <p className="hidden md:block text-slate-500 text-sm mt-8 text-center px-6 leading-relaxed">
                    This PIN is only stored on this browser and will not be sent to our servers.
                </p>
            </div>
        </div>
    );
}