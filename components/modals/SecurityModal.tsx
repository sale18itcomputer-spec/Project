'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, X, Lock, Key, Trash2, Clock, Smartphone, ArrowRight, ChevronRight, Monitor } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useAuth } from "../../contexts/AuthContext";
import { readRecords, createRecord, updateRecord, deleteRecord } from "../../services/api";
import Spinner from "../common/Spinner";

interface UserPasscode {
    UserID: string;
    Passcode: string;
    AutoLockTimeout?: string;
}

const TIMEOUT_OPTIONS = [
    { label: 'Off', value: 'off' },
    { label: '1 minute', value: '1m' },
    { label: '5 minutes', value: '5m' },
    { label: '1 hour', value: '1h' },
    { label: '5 hours', value: '5h' },
    { label: '1 day', value: '1d' }
];

const SecurityModal: React.FC = () => {
    const { currentUser } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [view, setView] = useState<'settings' | 'change' | 'create' | 'timeout'>('settings');
    const [currentRecord, setCurrentRecord] = useState<UserPasscode | null>(null);

    // Passcode states
    const [passcode, setPasscode] = useState('');
    const [confirmPasscode, setConfirmPasscode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchData = useCallback(async () => {
        if (!currentUser) return;
        try {
            setIsLoading(true);
            const records = await readRecords<UserPasscode>('User_Passcodes');
            const userRecord = records.find(r => r.UserID === currentUser.UserID);
            setCurrentRecord(userRecord || null);
            if (!userRecord && view === 'settings') {
                setView('create');
            }
        } catch (err) {
            console.error("Failed to fetch security data:", err);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, view]);

    useEffect(() => {
        const handleOpen = () => {
            setIsOpen(true);
            fetchData();
        };
        window.addEventListener('open-security-modal', handleOpen);
        return () => window.removeEventListener('open-security-modal', handleOpen);
    }, [fetchData]);

    const handleSavePasscode = async () => {
        if (!currentUser) return;
        setError('');

        if (passcode.length < 4) {
            setError('Passcode must be at least 4 digits');
            return;
        }

        if (passcode !== confirmPasscode) {
            setError('Passcodes do not match');
            return;
        }

        try {
            setIsLoading(true);
            if (currentRecord) {
                await updateRecord('User_Passcodes', currentUser.UserID, { Passcode: passcode });
            } else {
                await createRecord('User_Passcodes', { UserID: currentUser.UserID, Passcode: passcode, AutoLockTimeout: '1h' });
            }
            setSuccess('Passcode saved successfully!');
            window.dispatchEvent(new CustomEvent('security-settings-updated'));
            setPasscode('');
            setConfirmPasscode('');
            await fetchData();
            setTimeout(() => {
                setView('settings');
                setSuccess('');
            }, 1000);
        } catch (err) {
            setError('Failed to save passcode');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateTimeout = async (value: string) => {
        if (!currentUser || !currentRecord) return;
        try {
            setIsLoading(true);
            await updateRecord('User_Passcodes', currentUser.UserID, { AutoLockTimeout: value });
            await fetchData();
            window.dispatchEvent(new CustomEvent('security-settings-updated'));
            setView('settings');
            setSuccess('Auto-lock timeout updated');
            setTimeout(() => setSuccess(''), 2000);
        } catch (err) {
            setError('Failed to update timeout');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisablePasscode = async () => {
        if (!currentUser) return;
        try {
            setIsLoading(true);
            await deleteRecord('User_Passcodes', currentUser.UserID);
            setCurrentRecord(null);
            setView('create');
            sessionStorage.removeItem(`limperial_unlocked_${currentUser.UserID}`);
            setSuccess('Passcode disabled');
            window.dispatchEvent(new CustomEvent('security-settings-updated'));
            setTimeout(() => setSuccess(''), 2000);
        } catch (err) {
            console.error("Failed to disable passcode:", err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const currentTimeoutLabel = TIMEOUT_OPTIONS.find(o => o.value === (currentRecord?.AutoLockTimeout || '1h'))?.label || '1 hour';

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#17212b] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-[#eff0f1]">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {view !== 'settings' && view !== 'create' && (
                            <button onClick={() => setView('settings')} className="p-1 hover:bg-white/5 rounded-full transition-colors">
                                <ArrowRight className="w-5 h-5 rotate-180" />
                            </button>
                        )}
                        <h2 className="text-xl font-medium">Local passcode</h2>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-[#eff0f1]/60 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-0 overflow-y-auto max-h-[80vh]">
                    {isLoading && <div className="p-12 flex justify-center"><Spinner /></div>}

                    {!isLoading && view === 'settings' && (
                        <div className="divide-y divide-white/5">
                            {/* Change Passcode Option */}
                            <button
                                onClick={() => setView('change')}
                                className="w-full p-4 flex items-center hover:bg-white/5 transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 mr-4">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">Change passcode</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-white/20" />
                            </button>

                            {/* Auto-Lock Option */}
                            <button
                                onClick={() => setView('timeout')}
                                className="w-full p-4 flex items-center hover:bg-white/5 transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 mr-4">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">Auto-Lock if away for...</p>
                                </div>
                                <span className="text-[#3390ec] font-medium mr-2">{currentTimeoutLabel}</span>
                                <ChevronRight className="w-5 h-5 text-white/20" />
                            </button>

                            {/* Informational Text */}
                            <div className="p-4 bg-[#0e1621] text-xs text-[#7f91a4] space-y-2">
                                <p>When a local passcode is set, a lock icon appears at the top of your navigation bar.</p>
                                <p>Note: if you forget your passcode, you'll need to log out of Limperial Dashboard and log in again.</p>
                            </div>

                            {/* Disable Action */}
                            <button
                                onClick={handleDisablePasscode}
                                className="w-full p-4 flex items-center hover:bg-rose-500/5 transition-colors text-left text-rose-500"
                            >
                                <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center mr-4">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <p className="font-medium">Disable passcode</p>
                            </button>
                        </div>
                    )}

                    {!isLoading && view === 'timeout' && (
                        <div className="divide-y divide-white/5">
                            <div className="p-4 bg-[#0e1621] text-sm text-[#7f91a4] font-medium uppercase tracking-wider">
                                Choose timeout
                            </div>
                            {TIMEOUT_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleUpdateTimeout(option.value)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                                >
                                    <span className={currentRecord?.AutoLockTimeout === option.value ? 'text-[#3390ec] font-medium' : ''}>
                                        {option.label}
                                    </span>
                                    {currentRecord?.AutoLockTimeout === option.value && (
                                        <div className="w-2 h-2 rounded-full bg-[#3390ec]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {!isLoading && (view === 'create' || view === 'change') && (
                        <div className="p-8 space-y-8">
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-semibold">
                                    {view === 'create' ? 'Create Passcode' : 'Change Passcode'}
                                </h3>
                                <p className="text-[#7f91a4] text-sm">
                                    Enter 4-6 digits for your device security.
                                </p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[#7f91a4] ml-1">New passcode</Label>
                                    <Input
                                        type="password"
                                        value={passcode}
                                        onChange={(e) => setPasscode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                        className="bg-transparent border-0 border-b border-white/20 rounded-none h-12 text-xl tracking-[0.5em] focus:ring-0 focus:border-[#3390ec] transition-colors text-center"
                                        placeholder="••••"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[#7f91a4] ml-1">Confirm new passcode</Label>
                                    <Input
                                        type="password"
                                        value={confirmPasscode}
                                        onChange={(e) => setConfirmPasscode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                        className="bg-transparent border-0 border-b border-white/20 rounded-none h-12 text-xl tracking-[0.5em] focus:ring-0 focus:border-[#3390ec] transition-colors text-center"
                                        placeholder="••••"
                                    />
                                </div>
                            </div>

                            {error && (
                                <p className="text-rose-500 text-sm font-medium text-center animate-shake">{error}</p>
                            )}

                            {success && (
                                <p className="text-emerald-500 text-sm font-medium text-center">{success}</p>
                            )}

                            <Button
                                onClick={handleSavePasscode}
                                className="w-full bg-[#3390ec] hover:bg-[#2b7ecd] text-white h-12 rounded-lg"
                            >
                                Save Passcode
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SecurityModal;

