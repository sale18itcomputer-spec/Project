'use client';

import React from 'react';
import { Delete, Check } from 'lucide-react';

// --- PinDots ---

interface PinDotsProps {
    length: number;
    filled: number;
}

export function PinDots({ length = 4, filled }: PinDotsProps) {
    return (
        <div className="flex justify-center gap-6 mb-12 h-6 items-center">
            {Array.from({ length }).map((_, i) => (
                <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${
                        i < filled
                            ? 'bg-brand-500 scale-125 shadow-[0_0_15px_hsl(var(--brand-500)/0.6)]'
                            : 'bg-slate-700/50 border border-slate-600'
                    }`}
                />
            ))}
        </div>
    );
}

// --- PinPad ---

interface PinPadProps {
    onDigit: (d: string) => void;
    onDelete: () => void;
    onSubmit?: () => void;
    submitDisabled?: boolean;
}

const ROWS = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
];

export function PinPad({ onDigit, onDelete, onSubmit, submitDisabled }: PinPadProps) {
    return (
        <div className="grid grid-cols-3 gap-x-8 gap-y-4 max-w-[280px] mx-auto w-full md:hidden">
            {ROWS.flat().map((num) => (
                <button
                    key={num}
                    onClick={() => onDigit(String(num))}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto"
                >
                    {num}
                </button>
            ))}
            {onSubmit ? (
                <button
                    onClick={onSubmit}
                    disabled={submitDisabled}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors mx-auto ${
                        submitDisabled 
                            ? 'text-slate-700 cursor-not-allowed' 
                            : 'text-brand-400 hover:text-white hover:bg-white/10 active:bg-white/20'
                    }`}
                >
                    <Check className="w-8 h-8" />
                </button>
            ) : (
                <div />
            )}
            <button
                onClick={() => onDigit('0')}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto"
            >
                0
            </button>
            <button
                onClick={onDelete}
                className="w-16 h-16 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto"
            >
                <Delete className="w-6 h-6" />
            </button>
        </div>
    );
}
