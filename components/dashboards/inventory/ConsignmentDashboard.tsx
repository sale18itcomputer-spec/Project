'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    PackageCheck, Search, RefreshCw, MapPin, Calendar,
    User, FileText, ChevronDown, ArrowLeftRight,
    Package, AlertCircle,
} from 'lucide-react';
import { fetchConsignments } from '@/services/consignmentApi';
import { Consignment, ConsignmentItem } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ITEM_STATUS_CLS: Record<string, string> = {
    'Received':         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Transferred Back': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Sold':             'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Damaged':          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const VOUCHER_STATUS_CLS: Record<string, string> = {
    'Open':   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Closed': 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
};

const BRAND_COLORS: Record<string, string> = {
    'ASUS':   'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    'MSI':    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Lenovo': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
    const cls = map[status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${cls}`}>
            {status}
        </span>
    );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
    return (
        <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-600/10 flex items-center justify-center text-brand-600 dark:text-brand-400">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
                <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
                {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function ConsignmentDashboard() {
    const [consignments, setConsignments] = useState<Consignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string>('');
    const [search, setSearch] = useState('');
    const [filterBrand, setFilterBrand] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchConsignments();
            setConsignments(data);
            if (data.length) setSelectedId(prev => prev || data[0].id);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const selected = useMemo(
        () => consignments.find(c => c.id === selectedId),
        [consignments, selectedId],
    );

    const allItems: ConsignmentItem[] = useMemo(() => selected?.items ?? [], [selected]);

    const brands     = useMemo(() => [...new Set(allItems.map(i => i.brand).filter(Boolean))].sort(), [allItems]);
    const categories = useMemo(() => [...new Set(allItems.map(i => i.category).filter(Boolean))].sort(), [allItems]);
    const statuses   = useMemo(() => [...new Set(allItems.map(i => i.status).filter(Boolean))].sort(), [allItems]);

    const filtered = useMemo(() => allItems.filter(item => {
        if (filterBrand    && item.brand    !== filterBrand)    return false;
        if (filterCategory && item.category !== filterCategory) return false;
        if (filterStatus   && item.status   !== filterStatus)   return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                item.item_code.toLowerCase().includes(q) ||
                item.product_name.toLowerCase().includes(q)
            );
        }
        return true;
    }), [allItems, filterBrand, filterCategory, filterStatus, search]);

    // Stats for selected voucher
    const totalSent      = allItems.reduce((s, i) => s + i.qty_sent, 0);
    const totalReturned  = allItems.reduce((s, i) => s + i.qty_returned, 0);
    const inShowroom     = totalSent - totalReturned;

    // Brand breakdown
    const brandSummary = useMemo(() => {
        const map: Record<string, { sent: number; returned: number; items: number }> = {};
        allItems.forEach(i => {
            if (!map[i.brand]) map[i.brand] = { sent: 0, returned: 0, items: 0 };
            map[i.brand].sent     += i.qty_sent;
            map[i.brand].returned += i.qty_returned;
            map[i.brand].items++;
        });
        return Object.entries(map).sort((a, b) => b[1].sent - a[1].sent);
    }, [allItems]);

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <RefreshCw size={20} className="animate-spin mr-2" />
                Loading consignment data…
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 gap-2 text-destructive">
                <AlertCircle size={18} />
                <span>{error}</span>
                <button onClick={load} className="ml-2 text-sm underline">Retry</button>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-600/10 flex items-center justify-center text-brand-600 dark:text-brand-400">
                        <PackageCheck size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground leading-tight">Stock Consignment</h1>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                            Supplier stock on loan for showroom display — not LPT-owned inventory
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Voucher selector */}
                    {consignments.length > 1 && (
                        <div className="relative">
                            <select
                                value={selectedId}
                                onChange={e => {
                                    setSelectedId(e.target.value);
                                    setSearch('');
                                    setFilterBrand('');
                                    setFilterCategory('');
                                    setFilterStatus('');
                                }}
                                className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                {consignments.map(c => (
                                    <option key={c.id} value={c.id}>{c.voucher_no}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                    )}
                    <button
                        onClick={load}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-background hover:bg-accent/60 text-foreground transition-colors"
                    >
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                </div>
            </div>

            {consignments.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <PackageCheck size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No consignment records found</p>
                </div>
            ) : selected ? (
                <>
                    {/* Voucher Info Card */}
                    <div className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-base font-bold text-foreground">{selected.voucher_no}</span>
                                    <StatusBadge status={selected.status} map={VOUCHER_STATUS_CLS} />
                                </div>
                                <p className="text-[12px] text-muted-foreground line-clamp-2 max-w-lg">{selected.notes || '—'}</p>
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar size={13} className="shrink-0" />
                                <span>Transfer: <strong className="text-foreground">{fmt(selected.transfer_date)}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar size={13} className="shrink-0" />
                                <span>Received: <strong className="text-foreground">{fmt(selected.received_date)}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <MapPin size={13} className="shrink-0" />
                                <span>From: <strong className="text-foreground">{selected.from_location || '—'}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <MapPin size={13} className="shrink-0" />
                                <span>To: <strong className="text-foreground">{selected.to_location || '—'}</strong></span>
                            </div>
                        </div>
                        {selected.received_by && (
                            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                                <User size={13} className="shrink-0" />
                                <span>Received by: <strong className="text-foreground">{selected.received_by}</strong></span>
                            </div>
                        )}
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard
                            label="Line Items"
                            value={allItems.length}
                            sub={`${brands.length} brand${brands.length !== 1 ? 's' : ''}`}
                            icon={<FileText size={18} />}
                        />
                        <StatCard
                            label="Qty Sent"
                            value={totalSent}
                            sub="total units transferred"
                            icon={<Package size={18} />}
                        />
                        <StatCard
                            label="Qty Returned"
                            value={totalReturned}
                            sub="transferred back"
                            icon={<ArrowLeftRight size={18} />}
                        />
                        <StatCard
                            label="In Showroom"
                            value={inShowroom}
                            sub="units currently displayed"
                            icon={<PackageCheck size={18} />}
                        />
                    </div>

                    {/* Brand Breakdown */}
                    {brandSummary.length > 0 && (
                        <div className="bg-card border border-border rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-foreground mb-3">Brand Breakdown</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {brandSummary.map(([brand, stat]) => {
                                    const inShow = stat.sent - stat.returned;
                                    const pct = stat.sent > 0 ? Math.round((inShow / stat.sent) * 100) : 0;
                                    const cls = BRAND_COLORS[brand] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300';
                                    return (
                                        <div key={brand} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                                            <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-bold ${cls}`}>{brand}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground">{inShow} / {stat.sent} units</p>
                                                <p className="text-[11px] text-muted-foreground">{stat.items} items · {pct}% in showroom</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Items Table */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                        {/* Table header with filters */}
                        <div className="p-4 border-b border-border flex flex-wrap items-center gap-2">
                            <div className="relative flex-1 min-w-[180px] max-w-xs">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search code or name…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>

                            <SelectFilter
                                value={filterBrand}
                                onChange={setFilterBrand}
                                placeholder="All Brands"
                                options={brands}
                            />
                            <SelectFilter
                                value={filterCategory}
                                onChange={setFilterCategory}
                                placeholder="All Categories"
                                options={categories}
                            />
                            <SelectFilter
                                value={filterStatus}
                                onChange={setFilterStatus}
                                placeholder="All Statuses"
                                options={statuses}
                            />

                            {(search || filterBrand || filterCategory || filterStatus) && (
                                <button
                                    onClick={() => { setSearch(''); setFilterBrand(''); setFilterCategory(''); setFilterStatus(''); }}
                                    className="text-[12px] text-muted-foreground hover:text-foreground underline whitespace-nowrap"
                                >
                                    Clear filters
                                </button>
                            )}

                            <span className="ml-auto text-[12px] text-muted-foreground whitespace-nowrap">
                                {filtered.length} of {allItems.length} items
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-10">#</th>
                                        <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Code</th>
                                        <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Product Name</th>
                                        <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Brand</th>
                                        <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
                                        <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sent</th>
                                        <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Returned</th>
                                        <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">In Showroom</th>
                                        <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-10 text-muted-foreground text-sm">
                                                No items match the current filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((item, idx) => {
                                            const showroom = item.qty_sent - item.qty_returned;
                                            const brandCls = BRAND_COLORS[item.brand] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400';
                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}
                                                >
                                                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground tabular-nums">{item.item_no}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className="font-mono text-[12px] text-foreground">{item.item_code}</span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-[13px] text-foreground max-w-[280px]">
                                                        <span className="line-clamp-1">{item.product_name}</span>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${brandCls}`}>
                                                            {item.brand}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground">{item.category}</td>
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-[13px] font-medium text-foreground">{item.qty_sent}</td>
                                                    <td className="px-4 py-2.5 text-right tabular-nums text-[13px] text-muted-foreground">{item.qty_returned || '—'}</td>
                                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                                        <span className={`text-[13px] font-semibold ${showroom > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                                            {showroom}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <StatusBadge status={item.status} map={ITEM_STATUS_CLS} />
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {filtered.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t border-border bg-muted/20">
                                            <td colSpan={5} className="px-4 py-2.5 text-[12px] font-semibold text-foreground">
                                                Totals ({filtered.length} items)
                                            </td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-[13px] font-bold text-foreground">
                                                {filtered.reduce((s, i) => s + i.qty_sent, 0)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-[13px] font-medium text-muted-foreground">
                                                {filtered.reduce((s, i) => s + i.qty_returned, 0) || '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                                                {filtered.reduce((s, i) => s + (i.qty_sent - i.qty_returned), 0)}
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}

// ── Select Filter helper ──────────────────────────────────────────────────────

function SelectFilter({
    value, onChange, placeholder, options,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    options: string[];
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
    );
}
