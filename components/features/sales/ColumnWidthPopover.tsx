'use client';

/**
 * ColumnWidthPopover.tsx
 * Icon button → floating panel rendered via React portal.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, X, SlidersHorizontal } from 'lucide-react';
import type { DocTypeKey } from '../../../hooks/useColumnWidths';
import { DOC_COL_LABELS, DOC_COL_EDITABLE } from '../../../hooks/useColumnWidths';

interface Props {
    docType: DocTypeKey;
    widths: number[];
    onChange: (w: number[]) => void;
    onReset: () => void;
}

const COL_COLORS = [
    '#378ADD',
    '#1D9E75',
    '#7F77DD',
    '#D85A30',
    '#BA7517',
    '#D4537E',
];

export const ColumnWidthPopover: React.FC<Props> = ({ docType, widths, onChange, onReset }) => {
    const [open, setOpen] = useState(false);
    const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const labels = DOC_COL_LABELS[docType];
    const editable = DOC_COL_EDITABLE[docType];
    const isFixed = editable.every(e => !e);

    const activeTotal = widths.reduce((s, w) => s + w, 0);
    const totalRounded = Math.round(activeTotal);
    const totalOk = totalRounded === 100;
    const totalOver = totalRounded > 100;

    const updatePos = useCallback(() => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        setPanelPos({
            top: rect.bottom + 8,
            right: window.innerWidth - rect.right,
        });
    }, []);

    const handleOpen = () => { updatePos(); setOpen(o => !o); };

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target as Node) &&
                btnRef.current && !btnRef.current.contains(e.target as Node)
            ) setOpen(false);
        };
        window.addEventListener('resize', updatePos);
        document.addEventListener('mousedown', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            window.removeEventListener('resize', updatePos);
        };
    }, [open, updatePos]);

    const handleSlider = (idx: number, val: number) => {
        const next = [...widths];
        next[idx] = Math.round(val);
        onChange(next);
    };

    const handleNumber = (idx: number, val: string) => {
        const v = Math.min(70, Math.max(0, Math.round(Number(val) || 0)));
        const next = [...widths];
        next[idx] = v;
        onChange(next);
    };

    const handleBalance = () => {
        const t = activeTotal;
        if (t === 0) return;
        const scale = 100 / t;
        let sum = 0;
        const next = widths.map((w, i) => {
            if (i === widths.length - 1) return Math.max(0, 100 - sum);
            const v = Math.round(w * scale);
            sum += v;
            return v;
        });
        onChange(next);
    };

    const totalColor = totalOk
        ? 'text-emerald-500'
        : totalOver
        ? 'text-rose-500'
        : 'text-amber-500';

    const panel = open ? (
        <div
            ref={panelRef}
            style={{ position: 'fixed', top: panelPos.top, right: panelPos.right, zIndex: 1000001, width: 320 }}
            className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-brand-500" />
                    <span className="text-xs font-bold text-foreground tracking-wide">Table columns</span>
                </div>
                <div className="flex items-center gap-1">
                    {!isFixed && (
                        <button
                            type="button"
                            onClick={handleBalance}
                            title="Auto-balance to 100%"
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-md border border-border transition-all"
                        >
                            <SlidersHorizontal className="w-3 h-3" />
                            Balance
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => { onReset(); }}
                        title="Reset to defaults"
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {isFixed ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                    This document uses a fixed column layout.
                </p>
            ) : (
                <>
                    {/* ── Stacked bar ── */}
                    <div className="px-4 pt-3 pb-2 border-b border-border">
                        <div className="flex h-2 rounded-full overflow-hidden gap-px bg-muted">
                            {widths.map((w, i) =>
                                labels[i] && w > 0 ? (
                                    <div
                                        key={i}
                                        style={{ flex: w, background: COL_COLORS[i] ?? '#888', minWidth: 2, transition: 'flex 0.15s' }}
                                    />
                                ) : null
                            )}
                        </div>
                        <div className="flex justify-between items-center mt-1.5">
                            <span className="text-[10px] text-muted-foreground">Distribution</span>
                            <span className={`text-[11px] font-bold tabular-nums ${totalColor}`}>
                                {totalRounded}%
                                {!totalOk && (
                                    <span className="ml-1 text-[10px] font-normal">
                                        {totalOver ? `(−${totalRounded - 100} over)` : `(+${100 - totalRounded} short)`}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* ── Column rows ── */}
                    <div className="py-1">
                        {widths.map((w, idx) => {
                            if (!labels[idx]) return null;
                            const isEditable = editable[idx];
                            return (
                                <div
                                    key={idx}
                                    className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40 transition-colors"
                                >
                                    {/* Color dot */}
                                    <div
                                        style={{ background: COL_COLORS[idx] ?? '#888', width: 8, height: 8, borderRadius: 2, flexShrink: 0 }}
                                    />
                                    {/* Label */}
                                    <span className="text-[12px] text-foreground" style={{ minWidth: 72, flex: '0 0 72px' }}>
                                        {labels[idx]}
                                    </span>
                                    {/* Slider */}
                                    <input
                                        type="range"
                                        min={0}
                                        max={70}
                                        step={1}
                                        value={w}
                                        disabled={!isEditable}
                                        onChange={e => handleSlider(idx, Number(e.target.value))}
                                        className="flex-1 accent-brand-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    />
                                    {/* Number input */}
                                    <input
                                        type="number"
                                        min={0}
                                        max={70}
                                        step={1}
                                        value={w}
                                        disabled={!isEditable}
                                        onChange={e => handleNumber(idx, e.target.value)}
                                        className="text-right text-[12px] font-semibold text-foreground bg-muted border border-border rounded-md disabled:opacity-30 disabled:cursor-not-allowed"
                                        style={{ width: 44, padding: '2px 4px' }}
                                    />
                                    <span className="text-[11px] text-muted-foreground" style={{ width: 12 }}>%</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Footer total ── */}
                    <div className={`flex justify-between items-center px-4 py-2.5 border-t border-border ${
                        totalOk ? 'bg-emerald-500/5' : totalOver ? 'bg-rose-500/5' : 'bg-amber-500/5'
                    }`}>
                        <span className="text-[11px] font-semibold text-muted-foreground">Total</span>
                        <span className={`text-xs font-bold tabular-nums ${totalColor}`}>
                            {totalRounded}% {totalOk ? '✓' : totalOver ? '— reduce widths' : '— increase widths'}
                        </span>
                    </div>
                </>
            )}
        </div>
    ) : null;

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={handleOpen}
                title="Column Widths"
                className={`flex items-center gap-1.5 px-2.5 py-2 text-sm font-bold rounded-lg transition-all border shadow-sm ${
                    open
                        ? 'bg-brand-500/10 text-brand-600 border-brand-500/30'
                        : 'bg-card text-muted-foreground hover:text-foreground border-border hover:border-muted-foreground/30'
                }`}
            >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden lg:inline text-xs">Columns</span>
            </button>

            {typeof window !== 'undefined' && createPortal(panel, document.body)}
        </>
    );
};

export default ColumnWidthPopover;
