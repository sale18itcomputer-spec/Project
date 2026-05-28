'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle } from 'lucide-react';
import { PIN_STORAGE_KEY, UNLOCK_STORAGE_KEY, SETUP_PHASE_KEY, TEMP_PIN_KEY, hashPin } from '../../../../../utils/security';
import { PinDots, PinPad } from '../../../../../components/common/PinPad';
import { useAuth } from '../../../../../contexts/AuthContext';
import { readRecords, createRecord, updateRecord } from '../../../../../services/api';

export default function ConfirmPinPage() {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const { currentUser } = useAuth();
    const router = useRouter();

    // Capture the first PIN once at mount so processPin never re-reads
    // sessionStorage at submit time (sessionStorage can be cleared by the
    // browser if the tab is suspended and restored mid-flow).
    const firstPinRef = useRef<string | null>(null);

    // null = not yet determined, 0 = missing (redirect back), >0 = known length
    const [expectedLength, setExpectedLength] = useState<number | null>(null);

    useEffect(() => {
        const firstPin = sessionStorage.getItem(TEMP_PIN_KEY);
        if (firstPin) {
            firstPinRef.current = firstPin;
            setExpectedLength(firstPin.length);
        } else {
            // No temp PIN — go back to create step
            router.replace('/unlock/pin/create');
        }
    }, [router]);

    const processPin = useCallback(async (currentPin: string) => {
        const firstPin = firstPinRef.current;

        if (currentPin === firstPin) {
            const hashed = await hashPin(currentPin);
            localStorage.setItem(PIN_STORAGE_KEY, hashed);
            sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
            sessionStorage.removeItem(TEMP_PIN_KEY);
            sessionStorage.removeItem(SETUP_PHASE_KEY);

            // Sync to Supabase so SecurityModal sees the PIN exists
            if (currentUser?.UserID) {
                try {
                    const existing = await readRecords<{ UserID: string }>('User_Passcodes');
                    const hasRecord = existing.some(r => r.UserID === currentUser.UserID);
                    if (hasRecord) {
                        await updateRecord('User_Passcodes', currentUser.UserID, { Passcode: currentPin });
                    } else {
                        await createRecord('User_Passcodes', { UserID: currentUser.UserID, Passcode: currentPin, AutoLockTimeout: '1h' });
                    }
                } catch {
                    // Non-fatal — local PIN still works
                }
            }

            router.replace('/dashboard');
        } else {
            setError('PINs do not match. Try again.');
            setPin('');
            setTimeout(() => router.replace('/unlock/pin/create'), 1500);
        }
    }, [currentUser, router]);

    useEffect(() => {
        if (expectedLength && pin.length === expectedLength) {
            const timeout = setTimeout(() => processPin(pin), 150);
            return () => clearTimeout(timeout);
        }
    }, [pin, expectedLength, processPin]);

    const appendDigit = useCallback((d: string) => {
        setPin(prev => prev.length < (expectedLength ?? 6) ? prev + d : prev);
        setError('');
    }, [expectedLength]);

    const deleteDigit = useCallback(() => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    }, []);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (/^[0-9]$/.test(e.key)) appendDigit(e.key);
            else if (e.key === 'Backspace') deleteDigit();
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [appendDigit, deleteDigit]);

    // Don't render the pad until expectedLength is resolved from sessionStorage
    if (!expectedLength) return null;

    return (
        <div className="fixed inset-0 z-[99999] bg-[#0c121d] flex flex-col items-center justify-center text-white px-4 font-sans selection:bg-transparent">
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center gap-4 mb-10">
                    <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)] border border-blue-500/20">
                        <Lock className="w-7 h-7" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-semibold tracking-tight text-white">Confirm PIN</h2>
                        <p className="text-sm text-slate-400 mt-2">Re-enter your {expectedLength}-digit PIN to confirm.</p>
                    </div>
                </div>

                <PinDots length={expectedLength} filled={pin.length} />

                <div className="h-6 mb-6 w-full flex justify-center">
                    {error && (
                        <div className="flex items-center gap-2 text-rose-400 text-sm font-medium animate-shake px-4 py-1.5 bg-rose-500/10 rounded-full border border-rose-500/20">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <PinPad onDigit={appendDigit} onDelete={deleteDigit} />
            </div>
        </div>
    );
}
