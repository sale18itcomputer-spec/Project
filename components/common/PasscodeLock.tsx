'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useAuth } from "../../contexts/AuthContext";
import { readRecords, createRecord, updateRecord } from "../../services/api";
import Spinner from "./Spinner";

interface PasscodeLockProps {
    children: React.ReactNode;
}

interface UserPasscode {
    UserID: string;
    Passcode: string;
    AutoLockTimeout?: string;
    IsWindowsHelloEnabled?: boolean;
}

const PasscodeLock: React.FC<PasscodeLockProps> = ({ children }) => {
    const { currentUser, logout } = useAuth();
    const router = useRouter();
    const [isLocked, setIsLocked] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [passcode, setPasscode] = useState('');
    const [savedPasscode, setSavedPasscode] = useState<string | null>(null);
    const [autoLockTimeout, setAutoLockTimeout] = useState<string>('1h');
    const [error, setError] = useState(false);

    // Setting mode state (for creation)
    const [isSettingMode, setIsSettingMode] = useState(false);
    const [newPasscode, setNewPasscode] = useState('');
    const [confirmPasscode, setConfirmPasscode] = useState('');

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchPasscode = useCallback(async (showLoader = false) => {
        if (!currentUser?.UserID) {
            setIsLoading(false);
            return;
        }

        // If the user is only an optimistic stub (no Name/Email yet), wait
        // for the real user to be loaded before fetching passcode
        if (!currentUser.Name && !currentUser.Email) {
            setIsLoading(false);
            return;
        }

        try {
            if (showLoader) setIsLoading(true);
            const records = await readRecords<UserPasscode>('User_Passcodes');
            const userRecord = records.find(r => r.UserID === currentUser.UserID);

            if (userRecord) {
                setSavedPasscode(userRecord.Passcode);
                setAutoLockTimeout(userRecord.AutoLockTimeout || '1h');
                setIsSettingMode(false);

                const unlocked = sessionStorage.getItem(`limperial_unlocked_${currentUser.UserID}`);
                if (unlocked === 'true') {
                    setIsLocked(false);
                } else {
                    setIsLocked(true);
                }
            } else {
                // No passcode set yet — new user, enter creation mode
                setIsSettingMode(true);
                setIsLocked(true);
            }
        } catch (err) {
            console.error('Failed to fetch passcode:', err);
            // On network failure, if session was previously unlocked keep it unlocked
            const unlocked = sessionStorage.getItem(`limperial_unlocked_${currentUser.UserID}`);
            if (unlocked === 'true') setIsLocked(false);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchPasscode(true);
    }, [fetchPasscode]);

    // Handle internal locking events (avoids full page reload sign-outs)
    useEffect(() => {
        const handleLock = () => {
            setIsLocked(true);
            sessionStorage.removeItem(`limperial_unlocked_${currentUser?.UserID}`);
        };

        const handleRefresh = () => {
            fetchPasscode(false);
        };

        window.addEventListener('lock-app', handleLock);
        window.addEventListener('security-settings-updated', handleRefresh);

        return () => {
            window.removeEventListener('lock-app', handleLock);
            window.removeEventListener('security-settings-updated', handleRefresh);
        };
    }, [currentUser, fetchPasscode]);

    // Auto-lock logic
    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (isLocked || autoLockTimeout === 'off') return;

        let ms = 3600000; // default 1h
        switch (autoLockTimeout) {
            case '1m': ms = 60000; break;
            case '5m': ms = 300000; break;
            case '1h': ms = 3600000; break;
            case '5h': ms = 18000000; break;
            case '1d': ms = 86400000; break;
        }

        timerRef.current = setTimeout(() => {
            setIsLocked(true);
            sessionStorage.removeItem(`limperial_unlocked_${currentUser?.UserID}`);
        }, ms);
    }, [isLocked, autoLockTimeout, currentUser?.UserID]);

    useEffect(() => {
        if (!isLocked && autoLockTimeout !== 'off') {
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
            events.forEach(name => window.addEventListener(name, resetTimer));
            resetTimer();

            return () => {
                events.forEach(name => window.removeEventListener(name, resetTimer));
                if (timerRef.current) clearTimeout(timerRef.current);
            };
        }
    }, [isLocked, autoLockTimeout, resetTimer]);

    const handleUnlock = () => {
        if (!currentUser) return;
        if (passcode === savedPasscode) {
            setIsLocked(false);
            sessionStorage.setItem(`limperial_unlocked_${currentUser.UserID}`, 'true');
            setPasscode('');
            setError(false);
        } else {
            setError(true);
            setTimeout(() => setError(false), 500);
            setPasscode('');
        }
    };

    const handleSavePasscode = async () => {
        if (!currentUser) return;
        if (newPasscode !== confirmPasscode) {
            setError(true);
            return;
        }
        if (newPasscode.length < 4) {
            setError(true);
            return;
        }

        try {
            setIsLoading(true);
            await createRecord('User_Passcodes', {
                UserID: currentUser.UserID,
                Passcode: newPasscode,
                AutoLockTimeout: '1h'
            });
            setSavedPasscode(newPasscode);
            setAutoLockTimeout('1h');
            setIsSettingMode(false);
            setIsLocked(false);
            sessionStorage.setItem(`limperial_unlocked_${currentUser.UserID}`, 'true');
        } catch (err) {
            console.error("Failed to save passcode:", err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-background flex items-center justify-center z-[99999]">
                <Spinner />
            </div>
        );
    }

    if (!isLocked) {
        return <>{children}</>;
    }

    // Passcode Creation UI — shown for new users on first login
    if (isSettingMode) {
        return (
            <div className="fixed inset-0 z-[99999] bg-[#0c121d] flex flex-col items-center justify-start text-white font-sans">
                <header className="w-full p-4 flex items-center justify-between border-b border-white/5">
                    <button onClick={async () => { await logout(); router.replace('/login'); }} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-medium">Set up your PIN</h1>
                    <div className="w-10" />
                </header>

                <main className="flex-1 w-full max-w-sm px-6 py-12 flex flex-col items-center text-center">
                    {/* Welcome */}
                    <div className="mb-8">
                        <div className="w-20 h-20 bg-brand-600 rounded-full flex items-center justify-center text-3xl font-bold mb-4 mx-auto shadow-lg">
                            {currentUser?.Name?.charAt(0) || '?'}
                        </div>
                        <h2 className="text-2xl font-semibold text-white">
                            Welcome, {currentUser?.Name?.split(' ')[0] || 'there'}!
                        </h2>
                        <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                            You're all set up. Create a PIN to secure your account.
                            You'll use this PIN every time you open the app.
                        </p>
                    </div>

                    <div className="w-full space-y-6">
                        <div className="space-y-2 text-left">
                            <label className="text-[#3390ec] text-sm font-medium ml-1">Create a PIN (4–6 digits)</label>
                            <Input
                                type="password"
                                value={newPasscode}
                                onChange={(e) => {
                                    setError(false);
                                    setNewPasscode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                                }}
                                className="bg-transparent border-0 border-b border-white/20 rounded-none h-12 text-xl tracking-[0.5em] focus:ring-0 focus:border-[#3390ec] transition-colors px-1 text-center"
                                autoFocus
                                inputMode="numeric"
                            />
                        </div>

                        <div className="space-y-2 text-left">
                            <label className="text-[#7f91a4] text-sm font-medium ml-1">Confirm PIN</label>
                            <Input
                                type="password"
                                value={confirmPasscode}
                                onChange={(e) => {
                                    setError(false);
                                    setConfirmPasscode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSavePasscode(); }}
                                className="bg-transparent border-0 border-b border-white/20 rounded-none h-12 text-xl tracking-[0.5em] focus:ring-0 focus:border-[#3390ec] transition-colors px-1 text-center"
                                inputMode="numeric"
                            />
                        </div>

                        {error && (
                            <p className="text-rose-400 text-sm font-medium">
                                {newPasscode.length < 4 ? 'PIN must be at least 4 digits' : 'PINs do not match'}
                            </p>
                        )}

                        <Button
                            onClick={handleSavePasscode}
                            className="w-full bg-[#3390ec] hover:bg-[#2b7ecd] text-white h-12 text-base font-medium rounded-lg transition-all mt-4"
                            disabled={newPasscode.length < 4}
                        >
                            Save PIN & Enter
                        </Button>
                    </div>
                </main>
            </div>
        );
    }

    // PIN Entry UI
    return (
        <div className="fixed inset-0 z-[99999] bg-[#0c121d] flex flex-col items-center justify-center text-white px-6 font-sans">
            <div className="w-full max-w-sm flex flex-col items-center space-y-8">

                {/* Avatar + name */}
                <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-brand-600 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
                        {currentUser?.Name?.charAt(0) || '?'}
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-semibold text-white">{currentUser?.Name || 'Welcome back'}</p>
                        <p className="text-sm text-slate-400">{currentUser?.Email || ''}</p>
                    </div>
                </div>

                <div className="w-full space-y-2">
                    <label className="text-[#3390ec] text-sm font-medium block">Enter your PIN</label>
                    <div className="relative border-b border-slate-600 focus-within:border-[#3390ec] transition-colors">
                        <Input
                            type="password"
                            value={passcode}
                            onChange={(e) => {
                                setError(false);
                                setPasscode(e.target.value.replace(/[^0-9]/g, '').slice(0, 10));
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock(); }}
                            className="bg-transparent border-none rounded-none h-12 text-xl tracking-[0.2em] focus:ring-0 px-0 w-full"
                            placeholder=""
                            autoFocus
                            inputMode="numeric"
                        />
                    </div>
                </div>

                <div className="w-full flex flex-col items-center space-y-4">
                    <Button
                        onClick={handleUnlock}
                        className={`w-full h-12 text-base font-medium rounded-lg transition-all shadow-lg ${
                            error
                                ? 'bg-rose-600 hover:bg-rose-700 animate-shake'
                                : 'bg-[#2b6cb0] hover:bg-[#2c5282]'
                        }`}
                    >
                        {error ? 'Incorrect PIN — try again' : 'Unlock'}
                    </Button>

                    <button
                        onClick={async () => { await logout(); router.replace('/login'); }}
                        className="text-slate-400 hover:text-white text-sm transition-colors"
                    >
                        Sign out
                    </button>
                </div>

            </div>
        </div>
    );
};

export default PasscodeLock;

