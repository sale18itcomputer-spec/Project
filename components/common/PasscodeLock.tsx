'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, ArrowLeft, Smile } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useAuth } from "../../contexts/AuthContext";
import { readRecords, createRecord } from "../../services/api";
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
    const { currentUser } = useAuth();
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
        if (!currentUser) return;

        try {
            if (showLoader) setIsLoading(true);
            const records = await readRecords<UserPasscode>('User_Passcodes');
            const userRecord = records.find(r => r.UserID === currentUser.UserID);

            if (userRecord) {
                setSavedPasscode(userRecord.Passcode);
                setAutoLockTimeout(userRecord.AutoLockTimeout || '1h');
                setIsSettingMode(false);

                // Check if session is already unlocked
                const unlocked = sessionStorage.getItem(`limperial_unlocked_${currentUser.UserID}`);
                if (unlocked === 'true') {
                    setIsLocked(false);
                } else {
                    setIsLocked(true);
                }
            } else {
                // No passcode set yet, enter creation mode
                setIsSettingMode(true);
                setIsLocked(true);
            }
        } catch (err) {
            console.error("Failed to fetch passcode:", err);
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

    // Passcode Creation UI
    if (isSettingMode) {
        return (
            <div className="fixed inset-0 z-[99999] bg-[#0c121d] dark:bg-[#0a0f1a] flex flex-col items-center justify-start text-white font-sans">
                <header className="w-full p-4 flex items-center justify-between border-b border-white/5">
                    <button onClick={() => window.location.reload()} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-medium">Local passcode</h1>
                    <div className="w-10" />
                </header>

                <main className="flex-1 w-full max-w-sm px-6 py-12 flex flex-col items-center text-center">
                    <div className="relative mb-8">
                        <div className="w-32 h-32 bg-yellow-400 rounded-full flex items-center justify-center text-6xl shadow-2xl border-4 border-yellow-500 animate-bounce">
                            🦆
                        </div>
                        <div className="absolute -right-4 bottom-0 w-16 h-16 bg-slate-700 rounded-lg border-2 border-slate-600 flex items-center justify-center">
                            <Lock className="w-8 h-8 text-slate-400" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-semibold mb-4 text-[#eff0f1]">Create Local Passcode</h2>
                    <p className="text-[#7f91a4] text-sm leading-relaxed mb-10">
                        When a local passcode is set, a lock icon appears at the top of your navigation bar.
                    </p>

                    <div className="w-full space-y-8">
                        <div className="space-y-2 text-left">
                            <label className="text-[#3390ec] text-sm font-medium ml-1">Enter a passcode</label>
                            <Input
                                type="password"
                                value={newPasscode}
                                onChange={(e) => {
                                    setError(false);
                                    setNewPasscode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                                }}
                                className="bg-transparent border-0 border-b border-white/20 rounded-none h-12 text-xl tracking-[0.5em] focus:ring-0 focus:border-[#3390ec] transition-colors px-1 text-center"
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2 text-left">
                            <label className="text-[#7f91a4] text-sm font-medium ml-1">Re-enter new passcode</label>
                            <Input
                                type="password"
                                value={confirmPasscode}
                                onChange={(e) => {
                                    setError(false);
                                    setConfirmPasscode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                                }}
                                className="bg-transparent border-0 border-b border-white/20 rounded-none h-12 text-xl tracking-[0.5em] focus:ring-0 focus:border-[#3390ec] transition-colors px-1 text-center"
                            />
                        </div>

                        {error && (
                            <p className="text-rose-500 text-sm font-medium animate-shake">
                                {newPasscode.length < 4 ? "Passcode must be at least 4 digits" : "Passcodes do not match"}
                            </p>
                        )}

                        <Button
                            onClick={handleSavePasscode}
                            className="w-full bg-[#3390ec] hover:bg-[#2b7ecd] text-white h-12 text-lg font-medium rounded-lg transition-all mt-8"
                        >
                            Save Passcode
                        </Button>
                    </div>
                </main>
            </div>
        );
    }

    // Passcode Entry UI
    return (
        <div className="fixed inset-0 z-[99999] bg-[#0c121d] dark:bg-[#0a0f1a] flex flex-col items-center justify-center text-white px-6 font-sans">
            <div className="w-full max-w-sm flex flex-col items-center space-y-10">
                <h2 className="text-2xl font-normal text-slate-100">Enter your local passcode</h2>

                <div className="w-full space-y-2 relative">
                    <label className="text-[#3390ec] text-sm font-medium block">Your passcode</label>
                    <div className="relative border-b border-slate-600 focus-within:border-[#3390ec] transition-colors">
                        <Input
                            type="password"
                            value={passcode}
                            onChange={(e) => {
                                setError(false);
                                setPasscode(e.target.value.replace(/[^0-9]/g, '').slice(0, 10));
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUnlock();
                            }}
                            className="bg-transparent border-none rounded-none h-12 text-xl tracking-[0.2em] focus:ring-0 px-0 pr-10 w-full"
                            placeholder=""
                            autoFocus
                        />
                        <Smile className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 text-[#3390ec]/60" />
                    </div>
                </div>

                <div className="w-full flex flex-col items-center space-y-6">
                    <Button
                        onClick={handleUnlock}
                        className={`w-full bg-[#2b6cb0] hover:bg-[#2c5282] text-white h-12 text-lg font-medium rounded-lg transition-all shadow-lg ${error ? 'bg-rose-600 animate-shake hover:bg-rose-700' : ''}`}
                    >
                        {error ? 'Incorrect Passcode' : 'Submit'}
                    </Button>

                    <button
                        onClick={() => {
                            localStorage.removeItem('limperial_auth_user');
                            window.location.reload();
                        }}
                        className="text-[#3390ec] hover:underline text-base font-medium transition-colors"
                    >
                        Log out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PasscodeLock;

