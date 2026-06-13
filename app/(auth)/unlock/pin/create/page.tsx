'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { TEMP_PIN_KEY } from '../../../../../utils/security';
import { PinDots, PinPad } from '../../../../../components/common/PinPad';

export default function CreatePinPage() {
    const [pin, setPin] = useState('');
    const router = useRouter();

    const processPin = useCallback(() => {
        if (pin.length < 4 || pin.length > 6) return;
        sessionStorage.setItem(TEMP_PIN_KEY, pin);
        router.push('/unlock/pin/confirm');
    }, [pin, router]);

    const appendDigit = useCallback((d: string) => {
        setPin(prev => prev.length < 6 ? prev + d : prev);
    }, []);

    const deleteDigit = useCallback(() => {
        setPin(prev => prev.slice(0, -1));
    }, []);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (/^[0-9]$/.test(e.key)) appendDigit(e.key);
            else if (e.key === 'Backspace') deleteDigit();
            else if (e.key === 'Enter') processPin();
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [appendDigit, deleteDigit, processPin]);

    return (
        <div className="fixed inset-0 z-[99999] bg-[#0c121d] flex flex-col items-center justify-center text-white px-4 font-sans selection:bg-transparent">
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center gap-4 mb-10">
                    <div className="w-16 h-16 bg-brand-500/20 text-brand-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_hsl(var(--brand-500)/0.15)] border border-brand-500/20">
                        <Lock className="w-7 h-7" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-semibold tracking-tight text-white">Create a PIN</h2>
                        <p className="text-sm text-slate-400 mt-2">Set a 4 to 6-digit PIN to secure this device.</p>
                    </div>
                </div>

                <PinDots length={6} filled={pin.length} />

                <PinPad 
                    onDigit={appendDigit} 
                    onDelete={deleteDigit} 
                    onSubmit={processPin} 
                    submitDisabled={pin.length < 4}
                />

                <p className="hidden md:block text-slate-500 text-sm mt-8 text-center px-6 leading-relaxed">
                    This PIN is only stored on this browser and will not be sent to our servers.
                </p>
            </div>
        </div>
    );
}