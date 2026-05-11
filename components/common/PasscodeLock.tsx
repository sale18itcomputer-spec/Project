'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, RefreshCw, AlertCircle, Delete, Settings, X, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';

const PIN_STORAGE_KEY = 'limperial_local_pin';
const UNLOCK_STORAGE_KEY = 'limperial_unlocked';
const AUTOLOCK_STORAGE_KEY = 'limperial_autolock_ms';
const SETUP_PHASE_KEY = 'limperial_setup_phase';

async function sha256(message: string) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface PasscodeLockProps {
    children: React.ReactNode;
}

export default function PasscodeLock({ children }: PasscodeLockProps) {
    const [isChecking, setIsChecking] = useState(true);
    const [isLocked, setIsLocked] = useState(true);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    
    // Auth
    const { logout, currentUser, loginWithOtp, verifyOtp } = useAuth();
    const router = useRouter();

    // Flow modes
    const [setupMode, setSetupMode] = useState(false);
    const [verifyChangeMode, setVerifyChangeMode] = useState(false);
    
    // Setup Phases: otp_send -> otp_verify -> pin_create -> pin_confirm
    const [setupPhase, setSetupPhase] = useState<'otp_send' | 'otp_verify' | 'pin_create' | 'pin_confirm' | null>(null);
    const [firstPin, setFirstPin] = useState('');
    
    // OTP States
    const [otpToken, setOtpToken] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);

    // Dialogs
    const [showForgotConfirm, setShowForgotConfirm] = useState(false);
    
    // Settings state
    const [showSettings, setShowSettings] = useState(false);
    const [autoLockMs, setAutoLockMs] = useState(3600000); // 1 hour default
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Initialization
    useEffect(() => {
        const storedPin = localStorage.getItem(PIN_STORAGE_KEY);
        const isUnlocked = sessionStorage.getItem(UNLOCK_STORAGE_KEY) === 'true';
        const storedTimeout = localStorage.getItem(AUTOLOCK_STORAGE_KEY);
        
        if (storedTimeout) {
            setAutoLockMs(parseInt(storedTimeout, 10));
        }

        if (!storedPin) {
            setSetupMode(true);
            const savedPhase = sessionStorage.getItem(SETUP_PHASE_KEY) as any;
            if (savedPhase === 'otp_verify' || savedPhase === 'pin_create') {
                setSetupPhase(savedPhase);
            } else {
                setSetupPhase('otp_send');
            }
        } else if (isUnlocked) {
            setIsLocked(false);
        }
        setIsChecking(false);
    }, []);

    // Activity Timer logic
    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (isLocked || autoLockMs <= 0 || setupMode) return;

        timerRef.current = setTimeout(() => {
            setIsLocked(true);
            sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
        }, autoLockMs);
    }, [isLocked, autoLockMs, setupMode]);

    useEffect(() => {
        if (!isLocked && autoLockMs > 0) {
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
            events.forEach(name => window.addEventListener(name, resetTimer));
            resetTimer();

            return () => {
                events.forEach(name => window.removeEventListener(name, resetTimer));
                if (timerRef.current) clearTimeout(timerRef.current);
            };
        }
    }, [isLocked, autoLockMs, resetTimer]);

    // Global Event Listeners (Triggered from Header.tsx)
    useEffect(() => {
        const handleLock = () => {
            setIsLocked(true);
            sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
        };
        const handleOpenSettings = () => {
            setShowSettings(true);
        };

        window.addEventListener('lock-app', handleLock);
        window.addEventListener('open-security-modal', handleOpenSettings);

        return () => {
            window.removeEventListener('lock-app', handleLock);
            window.removeEventListener('open-security-modal', handleOpenSettings);
        };
    }, []);

    // OTP Handlers
    const handleSendOtp = async () => {
        if (!currentUser?.Email) {
            setError('User email not found. Please log in again.');
            return;
        }
        setOtpLoading(true);
        setError('');
        const res = await loginWithOtp(currentUser.Email);
        setOtpLoading(false);
        if (res.success) {
            setSetupPhase('otp_verify');
            sessionStorage.setItem(SETUP_PHASE_KEY, 'otp_verify');
            setOtpToken('');
        } else {
            setError(res.message);
        }
    };

    const handleVerifyOtp = async () => {
        if (otpToken.length < 6 || !currentUser?.Email) return;
        setOtpLoading(true);
        setError('');
        const res = await verifyOtp(currentUser.Email, otpToken);
        setOtpLoading(false);
        if (res.success) {
            setSetupPhase('pin_create');
            sessionStorage.setItem(SETUP_PHASE_KEY, 'pin_create');
            setPin('');
            setOtpToken('');
        } else {
            setError(res.message);
            setOtpToken('');
        }
    };

    // Pin processing
    const processPin = useCallback(async (currentPin: string) => {
        if (verifyChangeMode) {
            const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
            const inputHash = await sha256(currentPin);
            
            if (storedHash === inputHash) {
                setVerifyChangeMode(false);
                setSetupMode(true);
                // Skip OTP for manual change because they verified old PIN
                setSetupPhase('pin_create');
                setPin('');
            } else {
                setError('Incorrect current PIN');
                setPin('');
            }
        } else if (setupMode && setupPhase === 'pin_create') {
            setFirstPin(currentPin);
            setPin('');
            setSetupPhase('pin_confirm');
        } else if (setupMode && setupPhase === 'pin_confirm') {
            if (currentPin === firstPin) {
                const hashed = await sha256(currentPin);
                localStorage.setItem(PIN_STORAGE_KEY, hashed);
                sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
                sessionStorage.removeItem(SETUP_PHASE_KEY);
                setIsLocked(false);
                setSetupMode(false);
                setSetupPhase(null);
                setShowSettings(false);
                setPin('');
                setFirstPin('');
            } else {
                setError('PINs do not match. Try again.');
                setPin('');
                setSetupPhase('pin_create');
                setFirstPin('');
            }
        } else if (!setupMode) {
            const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
            const inputHash = await sha256(currentPin);
            
            if (storedHash === inputHash) {
                sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
                setIsLocked(false);
            } else {
                setError('Incorrect PIN');
                setPin('');
            }
        }
    }, [verifyChangeMode, setupMode, setupPhase, firstPin]);

    useEffect(() => {
        if (pin.length === 4) {
            const timeout = setTimeout(() => processPin(pin), 150);
            return () => clearTimeout(timeout);
        }
    }, [pin, processPin]);

    const handleKeyPress = useCallback((e: KeyboardEvent) => {
        if (isChecking || (!isLocked && !setupMode) || showSettings) return;
        if (setupPhase === 'otp_send' || setupPhase === 'otp_verify') return; // let normal inputs handle keypresses
        
        if (/^[0-9]$/.test(e.key)) {
            setPin(prev => {
                if (prev.length < 4) {
                    setError('');
                    return prev + e.key;
                }
                return prev;
            });
        } else if (e.key === 'Backspace') {
            setPin(prev => prev.slice(0, -1));
            setError('');
        }
    }, [isChecking, isLocked, setupMode, showSettings, setupPhase]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleKeyPress]);

    const handlePadClick = (num: string) => {
        if (pin.length < 4) {
            setError('');
            setPin(prev => prev + num);
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    };

    const handleForgotPin = () => {
        setShowForgotConfirm(true);
    };

    const confirmForgotPin = async () => {
        // Reset process: clear stored PIN, require OTP
        localStorage.removeItem(PIN_STORAGE_KEY);
        sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
        sessionStorage.setItem(SETUP_PHASE_KEY, 'otp_send');
        setShowForgotConfirm(false);
        setSetupMode(true);
        setSetupPhase('otp_send');
        setPin('');
        setError('');
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = parseInt(e.target.value, 10);
        setAutoLockMs(val);
        localStorage.setItem(AUTOLOCK_STORAGE_KEY, val.toString());
    };

    const handleChangePin = () => {
        setVerifyChangeMode(true);
        setSetupMode(false);
        setSetupPhase(null);
        setPin('');
        setFirstPin('');
        setError('');
        setIsLocked(true);
        setShowSettings(false);
    };

    if (isChecking) {
        return <div className="fixed inset-0 bg-[#0c121d] z-[99999]" />;
    }

    // Unlocked Content + Floating Settings Modal
    if (!isLocked && !setupMode && !verifyChangeMode) {
        return (
            <>
                {children}
                
                {/* Security Settings Overlay */}
                {showSettings && (
                    <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 relative animate-slide-up">
                            <button 
                                onClick={() => setShowSettings(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            
                            <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                Security Settings
                            </h3>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="text-sm font-medium text-slate-300 block mb-2">
                                        Auto-Lock Timer
                                    </label>
                                    <select 
                                        value={autoLockMs}
                                        onChange={handleTimeChange}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value={60000}>1 Minute</option>
                                        <option value={300000}>5 Minutes</option>
                                        <option value={900000}>15 Minutes</option>
                                        <option value={3600000}>1 Hour</option>
                                        <option value={0}>Never (Manual Lock Only)</option>
                                    </select>
                                    <p className="text-xs text-slate-500 mt-2">
                                        The app will automatically lock after this period of inactivity.
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-slate-800">
                                    <button
                                        onClick={handleChangePin}
                                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                                    >
                                        Change PIN
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // Lock Screen rendering
    return (
        <div className="fixed inset-0 z-[99999] bg-[#0c121d] flex flex-col items-center justify-center text-white px-4 font-sans selection:bg-transparent">
            
            {/* OTP Phases */}
            {setupMode && (setupPhase === 'otp_send' || setupPhase === 'otp_verify') ? (
                <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)] border border-blue-500/20 mb-6">
                        <Mail className="w-7 h-7" />
                    </div>
                    
                    <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">
                        {setupPhase === 'otp_send' ? 'Verify Your Identity' : 'Enter Login Code'}
                    </h2>
                    <p className="text-sm text-slate-400 text-center mb-8 px-4 leading-relaxed">
                        {setupPhase === 'otp_send' 
                            ? 'Before setting up a passcode on this device, we need to verify your identity via email.' 
                            : `We sent a 6-digit code to ${currentUser?.Email || 'your email'}.`}
                    </p>

                    {error && (
                        <div className="flex items-center gap-2 text-rose-400 text-sm font-medium animate-shake px-4 py-2 bg-rose-500/10 rounded-lg border border-rose-500/20 mb-6 w-full justify-center">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    )}

                    {setupPhase === 'otp_send' ? (
                        <div className="w-full space-y-4">
                            <button
                                onClick={handleSendOtp}
                                disabled={otpLoading}
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                            >
                                {otpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Code'}
                            </button>
                            <button
                                onClick={() => {
                                    setSetupPhase('otp_verify');
                                    sessionStorage.setItem(SETUP_PHASE_KEY, 'otp_verify');
                                    setError('');
                                }}
                                className="w-full py-2 text-slate-500 hover:text-white text-sm transition-colors"
                            >
                                I already have a code
                            </button>
                            <button
                                onClick={async () => {
                                    localStorage.removeItem(PIN_STORAGE_KEY);
                                    sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
                                    sessionStorage.removeItem(SETUP_PHASE_KEY);
                                    await logout();
                                    router.replace('/login');
                                }}
                                className="w-full py-2 text-rose-500/80 hover:text-rose-400 text-sm transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <div className="w-full space-y-4">
                            <input 
                                type="text" 
                                value={otpToken}
                                onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                placeholder="00000000"
                                className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono outline-none transition-all placeholder:text-slate-600"
                                onKeyDown={(e) => e.key === 'Enter' && otpToken.length === 8 && handleVerifyOtp()}
                                autoFocus
                            />
                            <button
                                onClick={handleVerifyOtp}
                                disabled={otpLoading || otpToken.length < 8}
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                            >
                                {otpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Code'}
                            </button>
                            <button
                                onClick={() => { 
                                    setSetupPhase('otp_send'); 
                                    sessionStorage.setItem(SETUP_PHASE_KEY, 'otp_send');
                                    setOtpToken(''); 
                                    setError(''); 
                                }}
                                className="w-full py-2 text-slate-500 hover:text-white text-sm transition-colors"
                            >
                                Resend Code
                            </button>
                            <button
                                onClick={async () => {
                                    localStorage.removeItem(PIN_STORAGE_KEY);
                                    sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
                                    sessionStorage.removeItem(SETUP_PHASE_KEY);
                                    await logout();
                                    router.replace('/login');
                                }}
                                className="w-full py-2 text-rose-500/80 hover:text-rose-400 text-sm transition-colors mt-2"
                            >
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* PIN Pad Phases (Unlock, Create, Confirm, Verify Old) */
                <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex flex-col items-center gap-4 mb-10">
                        <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)] border border-blue-500/20">
                            <Lock className="w-7 h-7" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-semibold tracking-tight text-white">
                                {verifyChangeMode 
                                    ? 'Enter current PIN' 
                                    : setupMode 
                                        ? (setupPhase === 'pin_confirm' ? 'Confirm PIN' : 'Create a PIN') 
                                        : 'Enter your PIN'}
                            </h2>
                            <p className="text-sm text-slate-400 mt-2">
                                {verifyChangeMode
                                    ? 'Verify your identity to change the PIN.'
                                    : setupMode 
                                        ? 'This 4-digit PIN secures the app on this device.' 
                                        : 'Please enter your 4-digit PIN to unlock.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-center gap-6 mb-12 h-6 items-center">
                        {[0, 1, 2, 3].map((index) => (
                            <div 
                                key={index} 
                                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                                    index < pin.length 
                                        ? 'bg-blue-500 scale-125 shadow-[0_0_15px_rgba(59,130,246,0.6)]' 
                                        : 'bg-slate-700/50 border border-slate-600'
                                }`} 
                            />
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

                    {/* Optional Numpad for touch convenience - hidden on larger screens */}
                    <div className="grid grid-cols-3 gap-x-8 gap-y-4 max-w-[280px] mx-auto w-full md:hidden">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                onClick={() => handlePadClick(num.toString())}
                                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto focus:outline-none"
                            >
                                {num}
                            </button>
                        ))}
                        <div />
                        <button
                            onClick={() => handlePadClick('0')}
                            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto focus:outline-none"
                        >
                            0
                        </button>
                        <button
                            onClick={handleDelete}
                            className="w-16 h-16 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto focus:outline-none"
                        >
                            <Delete className="w-6 h-6" />
                        </button>
                    </div>
                    
                    <p className="hidden md:block text-slate-500 text-sm mt-8">
                        Use your keyboard to enter the PIN
                    </p>

                    {(!setupMode && !verifyChangeMode) && (
                        <button
                            onClick={handleForgotPin}
                            className="text-slate-500 hover:text-white text-sm transition-colors mt-8 flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5 focus:outline-none"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Forgot PIN?
                        </button>
                    )}
                    
                    {verifyChangeMode && (
                        <button
                            onClick={() => {
                                setVerifyChangeMode(false);
                                setIsLocked(false);
                                setPin('');
                                setError('');
                            }}
                            className="text-slate-500 hover:text-white text-sm transition-colors mt-8 flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5 focus:outline-none"
                        >
                            <X className="w-4 h-4" />
                            Cancel
                        </button>
                    )}

                    {/* Forgot PIN Confirmation Modal */}
                    {showForgotConfirm && (
                        <div className="fixed inset-0 z-[100001] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl w-full max-w-sm p-6 relative animate-slide-up text-center">
                                <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                                    <RefreshCw className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">Reset PIN?</h3>
                                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                                    To reset your local PIN, we need to verify your identity by sending an authentication code to your email.
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setShowForgotConfirm(false)}
                                        className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmForgotPin}
                                        className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                                    >
                                        Verify via Email
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
