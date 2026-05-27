'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, X, RefreshCw, FileText, ChevronRight, Calendar, User } from 'lucide-react';
import { haptic } from '@/lib/miniapp/telegramShare';

/* ─── Types ─────────────────────────────────────────────────── */
export interface DocListColumn {
    key: string;
    label: string;
    primary?: boolean;    // Bold heading text
    secondary?: boolean;  // Sub-heading
    amount?: boolean;     // Formatted as currency
    date?: boolean;       // Small date chip
    status?: boolean;     // Coloured status pill
    hidden?: boolean;     // Not shown in card body (still searchable)
}

export interface StatusConfig {
    [status: string]: { bg: string; color: string };
}

export interface DocListProps<T extends Record<string, any>> {
    /** All loaded records */
    data: T[] | null;
    /** Still loading? */
    loading?: boolean;
    /** Column definitions */
    columns: DocListColumn[];
    /** Status colour map */
    statusColors?: StatusConfig;
    /** Which field is the document ID (for dedup key) */
    idKey: string;
    /** Status field name for filter chips */
    statusKey?: string;
    /** Available status filter options */
    statusOptions?: string[];
    /** Default status filter (pre-selected) */
    defaultStatus?: string | null;
    /** Search placeholder text */
    searchPlaceholder?: string;
    /** Called when user taps a card */
    onSelect?: (item: T) => void;
    /** Called when user pulls/taps refresh */
    onRefresh?: () => void;
    /** Accent colour (CSS colour string) */
    accent?: string;
    /** Empty state message */
    emptyMessage?: string;
}

/* ─── Status badge ───────────────────────────────────────────── */
function StatusPill({ status, statusColors }: { status: string; statusColors?: StatusConfig }) {
    const cfg = statusColors?.[status];
    if (!status) return null;
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
            style={cfg
                ? { background: cfg.bg, color: cfg.color }
                : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
            }
        >
            {status}
        </span>
    );
}

/* ─── Skeleton card ──────────────────────────────────────────── */
function SkeletonCard() {
    return (
        <div
            className="rounded-2xl p-4 animate-pulse"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border)/0.4)' }}
        >
            <div className="flex justify-between mb-2">
                <div className="h-3 w-24 rounded-full bg-muted" />
                <div className="h-5 w-16 rounded-full bg-muted" />
            </div>
            <div className="h-4 w-40 rounded-full bg-muted mb-2" />
            <div className="h-3 w-28 rounded-full bg-muted" />
        </div>
    );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function DocList<T extends Record<string, any>>({
    data,
    loading = false,
    columns,
    statusColors,
    idKey,
    statusKey,
    statusOptions = [],
    defaultStatus = null,
    searchPlaceholder = 'Search...',
    onSelect,
    onRefresh,
    accent = 'hsl(var(--primary))',
    emptyMessage = 'No records found',
}: DocListProps<T>) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(defaultStatus);
    const [pressed, setPressed] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // Reset filter when defaultStatus changes (e.g. navigating between pages)
    useEffect(() => {
        setStatusFilter(defaultStatus);
    }, [defaultStatus]);

    const searchableKeys = useMemo(
        () => columns.map(c => c.key),
        [columns]
    );

    const filtered = useMemo(() => {
        let items = data ?? [];
        if (statusFilter && statusKey) {
            items = items.filter(item => item[statusKey] === statusFilter);
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            items = items.filter(item =>
                searchableKeys.some(k => String(item[k] ?? '').toLowerCase().includes(q))
            );
        }
        return items;
    }, [data, statusFilter, statusKey, search, searchableKeys]);

    const primaryCol   = columns.find(c => c.primary);
    const secondaryCol = columns.find(c => c.secondary);
    const statusCol    = statusKey ? columns.find(c => c.key === statusKey) : undefined;
    const amountCol    = columns.find(c => c.amount);
    const dateCol      = columns.find(c => c.date);
    const bodyColumns  = columns.filter(c => !c.primary && !c.secondary && !c.status && !c.amount && !c.date && !c.hidden);

    const handleRefresh = useCallback(async () => {
        if (!onRefresh || refreshing) return;
        haptic('light');
        setRefreshing(true);
        await onRefresh();
        setTimeout(() => setRefreshing(false), 800);
    }, [onRefresh, refreshing]);

    const handleCardPress = (item: T) => {
        const id = String(item[idKey]);
        haptic('light');
        setPressed(id);
        setTimeout(() => {
            setPressed(null);
            onSelect?.(item);
        }, 120);
    };

    const handleStatusFilter = (s: string) => {
        haptic('light');
        setStatusFilter(prev => prev === s ? null : s);
    };

    /* ─── Render ─── */
    return (
        <div className="flex flex-col h-full" style={{ background: 'hsl(var(--background))' }}>

            {/* ── Search bar ─────────────────────────────────────────── */}
            <div
                className="flex-shrink-0 px-3 pt-3 pb-2"
                style={{ background: 'hsl(var(--background))' }}
            >
                <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
                    style={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border)/0.5)',
                        boxShadow: '0 1px 4px hsl(var(--foreground)/0.04)',
                    }}
                >
                    <Search size={15} style={{ color: 'hsl(var(--muted-foreground))' }} className="flex-shrink-0" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center active:opacity-60"
                            style={{ background: 'hsl(var(--muted))' }}
                        >
                            <X size={11} style={{ color: 'hsl(var(--muted-foreground))' }} />
                        </button>
                    )}
                    {onRefresh && (
                        <button
                            onClick={handleRefresh}
                            className="flex-shrink-0 active:opacity-60"
                            style={{ color: 'hsl(var(--muted-foreground))' }}
                        >
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Status filter chips ─────────────────────────────────── */}
            {statusOptions.length > 0 && (
                <div className="flex-shrink-0 px-3 pb-2">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                        {/* All chip */}
                        <button
                            onClick={() => { haptic('light'); setStatusFilter(null); }}
                            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                            style={{
                                background: !statusFilter ? accent : 'hsl(var(--muted)/0.6)',
                                color: !statusFilter ? '#fff' : 'hsl(var(--muted-foreground))',
                                border: `1px solid ${!statusFilter ? accent : 'transparent'}`,
                            }}
                        >
                            All
                        </button>
                        {statusOptions.map(s => {
                            const active = statusFilter === s;
                            const cfg = statusColors?.[s];
                            return (
                                <button
                                    key={s}
                                    onClick={() => handleStatusFilter(s)}
                                    className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                                    style={{
                                        background: active ? (cfg?.color ?? accent) : 'hsl(var(--muted)/0.6)',
                                        color: active ? '#fff' : (cfg?.color ?? 'hsl(var(--muted-foreground))'),
                                        border: `1px solid ${active ? (cfg?.color ?? accent) : 'transparent'}`,
                                    }}
                                >
                                    {s}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Record count ────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-4 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'hsl(var(--muted-foreground)/0.5)' }}>
                    {loading && !data ? 'Loading...' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
                </p>
            </div>

            {/* ── Card list ───────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-2.5">
                {loading && !data ? (
                    // Skeleton
                    Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                ) : filtered.length === 0 ? (
                    // Empty state
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div
                            className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                            style={{ background: 'hsl(var(--muted)/0.5)' }}
                        >
                            <FileText size={28} style={{ color: 'hsl(var(--muted-foreground)/0.3)' }} />
                        </div>
                        <p className="text-[14px] font-semibold" style={{ color: 'hsl(var(--muted-foreground)/0.5)' }}>
                            {search ? `No results for "${search}"` : emptyMessage}
                        </p>
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="mt-3 text-[12px] font-semibold active:opacity-60"
                                style={{ color: accent }}
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                ) : (
                    filtered.map(item => {
                        const id = String(item[idKey]);
                        const isPressed = pressed === id;
                        const statusVal = statusKey ? item[statusKey] : undefined;
                        const statusCfg = statusVal ? statusColors?.[statusVal] : undefined;

                        return (
                            <button
                                key={id}
                                onPointerDown={() => setPressed(id)}
                                onPointerUp={() => handleCardPress(item)}
                                onPointerCancel={() => setPressed(null)}
                                onPointerLeave={() => setPressed(null)}
                                className="w-full text-left rounded-2xl px-4 py-3.5 transition-all"
                                style={{
                                    background: isPressed
                                        ? `hsl(var(--card))`
                                        : 'hsl(var(--card))',
                                    border: `1px solid ${isPressed ? (statusCfg?.color ?? accent) + '40' : 'hsl(var(--border)/0.5)'}`,
                                    transform: isPressed ? 'scale(0.985)' : 'scale(1)',
                                    boxShadow: isPressed
                                        ? `0 2px 12px ${statusCfg?.color ?? accent}20`
                                        : '0 1px 3px hsl(var(--foreground)/0.04)',
                                    transition: 'transform 80ms ease, border-color 80ms ease, box-shadow 80ms ease',
                                }}
                            >
                                {/* Top row: ID + status */}
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <div className="min-w-0 flex-1">
                                        {/* Document ID (monospace) */}
                                        <p
                                            className="text-[11px] font-mono font-semibold truncate"
                                            style={{ color: 'hsl(var(--muted-foreground)/0.6)' }}
                                        >
                                            {id}
                                        </p>
                                        {/* Primary field (company/title) */}
                                        {primaryCol && (
                                            <p
                                                className="text-[14px] font-bold leading-tight mt-0.5 truncate"
                                                style={{ color: 'hsl(var(--foreground))', letterSpacing: '-0.01em' }}
                                            >
                                                {item[primaryCol.key] || '—'}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        {statusVal && <StatusPill status={statusVal} statusColors={statusColors} />}
                                        {amountCol && item[amountCol.key] && (
                                            <span
                                                className="text-[12px] font-black"
                                                style={{ color: accent, letterSpacing: '-0.02em' }}
                                            >
                                                {item[amountCol.key]}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Secondary field */}
                                {secondaryCol && item[secondaryCol.key] && (
                                    <p
                                        className="text-[12px] truncate mb-1.5"
                                        style={{ color: 'hsl(var(--muted-foreground))' }}
                                    >
                                        {item[secondaryCol.key]}
                                    </p>
                                )}

                                {/* Body info row */}
                                {(bodyColumns.length > 0 || dateCol) && (
                                    <div className="flex items-center gap-3 flex-wrap mt-1">
                                        {dateCol && item[dateCol.key] && (
                                            <span className="flex items-center gap-1" style={{ color: 'hsl(var(--muted-foreground)/0.6)' }}>
                                                <Calendar size={10} />
                                                <span className="text-[10px] font-medium">{item[dateCol.key]}</span>
                                            </span>
                                        )}
                                        {bodyColumns.slice(0, 2).map(col => item[col.key] ? (
                                            <span
                                                key={col.key}
                                                className="flex items-center gap-1"
                                                style={{ color: 'hsl(var(--muted-foreground)/0.6)' }}
                                            >
                                                <User size={10} />
                                                <span className="text-[10px] font-medium truncate max-w-[100px]">{item[col.key]}</span>
                                            </span>
                                        ) : null)}
                                    </div>
                                )}

                                {/* Chevron indicator */}
                                <div className="flex justify-end mt-2">
                                    <ChevronRight
                                        size={13}
                                        style={{
                                            color: isPressed ? accent : 'hsl(var(--muted-foreground)/0.25)',
                                            transform: isPressed ? 'translateX(2px)' : 'none',
                                            transition: 'color 80ms, transform 80ms',
                                        }}
                                    />
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
