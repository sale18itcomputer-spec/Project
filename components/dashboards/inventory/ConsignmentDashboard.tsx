'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    PackageCheck, Search, RefreshCw, MapPin, Calendar,
    User, FileText, ChevronDown, ArrowLeftRight,
    Package, AlertCircle, PlusCircle, X, Check, Edit2, Trash2,
} from 'lucide-react';
import {
    fetchConsignments, createConsignment, updateConsignment, updateConsignmentItem,
} from '@/services/consignmentApi';
import { Consignment, ConsignmentItem } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/contexts/ToastContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const ITEM_STATUSES  = ['Received', 'Transferred Back', 'Sold', 'Damaged'] as const;
const VOUCHER_STATUSES = ['Open', 'Closed'] as const;

const ITEM_STATUS_CLS: Record<string, string> = {
    'Received':         'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700',
    'Transferred Back': 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700',
    'Sold':             'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700',
    'Damaged':          'bg-red-100 text-red-900 border border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700',
};

const VOUCHER_STATUS_CLS: Record<string, string> = {
    'Open':   'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700',
    'Closed': 'bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-600',
};

const BRAND_COLORS: Record<string, string> = {
    'ASUS':   'bg-sky-100 text-sky-900 border border-sky-300 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700',
    'MSI':    'bg-red-100 text-red-900 border border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700',
    'Lenovo': 'bg-orange-100 text-orange-900 border border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700',
};

const TODAY = new Date().toISOString().split('T')[0];

const emptyItem = (): Partial<ConsignmentItem> => ({
    item_code: '', product_name: '', brand: '', category: '',
    qty_sent: 1, qty_returned: 0, status: 'Received', notes: '',
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
    const cls = map[status] ?? 'bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-600';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${cls}`}>
            {status}
        </span>
    );
}

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

function FieldInput({ label, value, onChange, type = 'text', placeholder = '', required = false, fullWidth = false }: {
    label: string; value: string; onChange: (v: string) => void;
    type?: string; placeholder?: string; required?: boolean; fullWidth?: boolean;
}) {
    return (
        <div className={fullWidth ? 'col-span-full' : ''}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
                {label}{required && <span className="text-destructive ml-0.5">*</span>}
            </label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-8 px-2.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-muted-foreground/50"
            />
        </div>
    );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function ConsignmentDashboard() {
    const { can } = usePermissions();
    const { addToast } = useToast();

    const canCreate = can('consignment', 'create');
    const canEdit   = can('consignment', 'edit');

    // ── Data ──────────────────────────────────────────────────────────────────
    const [consignments, setConsignments] = useState<Consignment[]>([]);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState<string | null>(null);
    const [selectedId, setSelectedId]     = useState<string>('');

    // ── Filters ───────────────────────────────────────────────────────────────
    const [search, setSearch]             = useState('');
    const [filterBrand, setFilterBrand]   = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // ── New consignment form ──────────────────────────────────────────────────
    const [showNewForm, setShowNewForm]   = useState(false);
    const [saving, setSaving]             = useState(false);
    const [newHeader, setNewHeader]       = useState<Partial<Consignment>>({
        voucher_no: '', transfer_date: TODAY, from_location: '', to_location: '',
        status: 'Open', received_by: '', received_date: TODAY, notes: '',
    });
    const [newItems, setNewItems]         = useState<Partial<ConsignmentItem>[]>([emptyItem()]);

    // ── Item status editing ───────────────────────────────────────────────────
    const [editingItemId, setEditingItemId]         = useState<string | null>(null);
    const [editingStatus, setEditingStatus]         = useState('');
    const [editingQtyReturned, setEditingQtyReturned] = useState(0);
    const [savingItemId, setSavingItemId]           = useState<string | null>(null);

    // ── Voucher status editing ────────────────────────────────────────────────
    const [editingVoucher, setEditingVoucher]       = useState(false);
    const [voucherStatus, setVoucherStatus]         = useState('');
    const [savingVoucher, setSavingVoucher]         = useState(false);

    // ── Load ──────────────────────────────────────────────────────────────────

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

    // ── Derived ───────────────────────────────────────────────────────────────

    const selected     = useMemo(() => consignments.find(c => c.id === selectedId), [consignments, selectedId]);
    const allItems     = useMemo((): ConsignmentItem[] => selected?.items ?? [], [selected]);
    const brands       = useMemo(() => [...new Set(allItems.map(i => i.brand).filter(Boolean))].sort(), [allItems]);
    const categories   = useMemo(() => [...new Set(allItems.map(i => i.category).filter(Boolean))].sort(), [allItems]);
    const statuses     = useMemo(() => [...new Set(allItems.map(i => i.status).filter(Boolean))].sort(), [allItems]);

    const filtered = useMemo(() => allItems.filter(item => {
        if (filterBrand    && item.brand    !== filterBrand)    return false;
        if (filterCategory && item.category !== filterCategory) return false;
        if (filterStatus   && item.status   !== filterStatus)   return false;
        if (search) {
            const q = search.toLowerCase();
            return item.item_code.toLowerCase().includes(q) || item.product_name.toLowerCase().includes(q);
        }
        return true;
    }), [allItems, filterBrand, filterCategory, filterStatus, search]);

    const totalSent     = allItems.reduce((s, i) => s + i.qty_sent, 0);
    const totalReturned = allItems.reduce((s, i) => s + i.qty_returned, 0);
    const inShowroom    = totalSent - totalReturned;

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

    // ── Handlers: New Consignment ─────────────────────────────────────────────

    const resetNewForm = () => {
        setNewHeader({ voucher_no: '', transfer_date: TODAY, from_location: '', to_location: '', status: 'Open', received_by: '', received_date: TODAY, notes: '' });
        setNewItems([emptyItem()]);
    };

    const addNewItem = () => setNewItems(prev => [...prev, emptyItem()]);

    const removeNewItem = (idx: number) =>
        setNewItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

    const updateNewItem = (idx: number, field: keyof ConsignmentItem, val: any) =>
        setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));

    const handleCreate = async () => {
        if (!newHeader.voucher_no?.trim()) { addToast('Voucher number is required.', 'error'); return; }
        if (!newHeader.transfer_date)      { addToast('Transfer date is required.', 'error'); return; }
        const validItems = newItems.filter(i => i.item_code?.trim() && i.product_name?.trim());
        if (!validItems.length)            { addToast('At least one item with a code and name is required.', 'error'); return; }

        setSaving(true);
        try {
            const created = await createConsignment(
                {
                    voucher_no:     newHeader.voucher_no!.trim(),
                    transfer_date:  newHeader.transfer_date!,
                    from_location:  newHeader.from_location || '',
                    to_location:    newHeader.to_location || '',
                    status:         newHeader.status || 'Open',
                    received_by:    newHeader.received_by || '',
                    received_date:  newHeader.received_date || null,
                    notes:          newHeader.notes || '',
                },
                validItems.map((item, idx) => ({
                    item_no:      idx + 1,
                    item_code:    item.item_code!.trim(),
                    product_name: item.product_name!.trim(),
                    brand:        item.brand || '',
                    category:     item.category || '',
                    qty_sent:     Number(item.qty_sent) || 1,
                    qty_returned: Number(item.qty_returned) || 0,
                    status:       item.status || 'Received',
                    notes:        item.notes || '',
                })),
            );
            setConsignments(prev => [created, ...prev]);
            setSelectedId(created.id);
            setShowNewForm(false);
            resetNewForm();
            addToast(`Consignment ${created.voucher_no} created.`, 'success');
        } catch (e: any) {
            addToast(`Failed to create consignment: ${e.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Handlers: Item Status ─────────────────────────────────────────────────

    const startEditItem = (item: ConsignmentItem) => {
        setEditingItemId(item.id);
        setEditingStatus(item.status);
        setEditingQtyReturned(item.qty_returned);
    };

    const cancelEditItem = () => setEditingItemId(null);

    const saveItemStatus = async (itemId: string, qtyMax: number) => {
        setSavingItemId(itemId);
        const qtyRet = Math.min(editingQtyReturned, qtyMax);
        try {
            const updated = await updateConsignmentItem(itemId, { status: editingStatus, qty_returned: qtyRet });
            setConsignments(prev => prev.map(c => ({
                ...c,
                items: c.items?.map(i => i.id === itemId ? { ...i, ...updated } : i),
            })));
            setEditingItemId(null);
            addToast('Item updated.', 'success');
        } catch (e: any) {
            addToast(`Failed to update item: ${e.message}`, 'error');
        } finally {
            setSavingItemId(null);
        }
    };

    // ── Handlers: Voucher Status ──────────────────────────────────────────────

    const startEditVoucher = () => {
        setVoucherStatus(selected?.status || 'Open');
        setEditingVoucher(true);
    };

    const saveVoucherStatus = async () => {
        if (!selected) return;
        setSavingVoucher(true);
        try {
            await updateConsignment(selected.id, { status: voucherStatus });
            setConsignments(prev => prev.map(c => c.id === selected.id ? { ...c, status: voucherStatus } : c));
            setEditingVoucher(false);
            addToast('Voucher status updated.', 'success');
        } catch (e: any) {
            addToast(`Failed to update status: ${e.message}`, 'error');
        } finally {
            setSavingVoucher(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading) return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading consignment data…
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center h-64 gap-2 text-destructive">
            <AlertCircle size={18} /> <span>{error}</span>
            <button onClick={load} className="ml-2 text-sm underline">Retry</button>
        </div>
    );

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">

            {/* ── Header ── */}
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
                    {consignments.length > 1 && (
                        <div className="relative">
                            <select
                                value={selectedId}
                                onChange={e => { setSelectedId(e.target.value); setSearch(''); setFilterBrand(''); setFilterCategory(''); setFilterStatus(''); }}
                                className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                {consignments.map(c => <option key={c.id} value={c.id}>{c.voucher_no}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                    )}
                    <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-background hover:bg-accent/60 text-foreground transition-colors">
                        <RefreshCw size={14} /> Refresh
                    </button>
                    {canCreate && (
                        <button
                            onClick={() => { resetNewForm(); setShowNewForm(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition-colors"
                        >
                            <PlusCircle size={14} /> New Consignment
                        </button>
                    )}
                </div>
            </div>

            {consignments.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <PackageCheck size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No consignment records found</p>
                    {canCreate && (
                        <button onClick={() => { resetNewForm(); setShowNewForm(true); }} className="mt-3 text-sm text-brand-600 hover:underline">
                            Create your first consignment
                        </button>
                    )}
                </div>
            ) : selected ? (
                <>
                    {/* ── Voucher Info Card ── */}
                    <div className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-base font-bold text-foreground">{selected.voucher_no}</span>
                                    {editingVoucher ? (
                                        <div className="flex items-center gap-1.5">
                                            <div className="relative">
                                                <select
                                                    value={voucherStatus}
                                                    onChange={e => setVoucherStatus(e.target.value)}
                                                    className="appearance-none pl-2 pr-6 py-0.5 text-xs rounded border border-brand-500 bg-background text-foreground focus:outline-none"
                                                >
                                                    {VOUCHER_STATUSES.map(s => <option key={s}>{s}</option>)}
                                                </select>
                                                <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                            </div>
                                            <button onClick={saveVoucherStatus} disabled={savingVoucher} className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20">
                                                <Check size={13} />
                                            </button>
                                            <button onClick={() => setEditingVoucher(false)} className="p-1 rounded text-muted-foreground hover:bg-muted">
                                                <X size={13} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <StatusBadge status={selected.status} map={VOUCHER_STATUS_CLS} />
                                            {canEdit && (
                                                <button onClick={startEditVoucher} className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors ml-0.5">
                                                    <Edit2 size={11} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <p className="text-[12px] text-muted-foreground line-clamp-2 max-w-lg">{selected.notes || '—'}</p>
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar size={13} className="shrink-0" />
                                <span>Transfer: <strong className="text-foreground">{fmtDate(selected.transfer_date)}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar size={13} className="shrink-0" />
                                <span>Received: <strong className="text-foreground">{fmtDate(selected.received_date)}</strong></span>
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

                    {/* ── Stats ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard label="Line Items"   value={allItems.length}  sub={`${brands.length} brand${brands.length !== 1 ? 's' : ''}`} icon={<FileText size={18} />} />
                        <StatCard label="Qty Sent"     value={totalSent}         sub="total units transferred"  icon={<Package size={18} />} />
                        <StatCard label="Qty Returned" value={totalReturned}     sub="transferred back"          icon={<ArrowLeftRight size={18} />} />
                        <StatCard label="In Showroom"  value={inShowroom}        sub="units currently displayed" icon={<PackageCheck size={18} />} />
                    </div>

                    {/* ── Brand Breakdown ── */}
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

                    {/* ── Items Table ── */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
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
                            <SelectFilter value={filterBrand}    onChange={setFilterBrand}    placeholder="All Brands"     options={brands} />
                            <SelectFilter value={filterCategory} onChange={setFilterCategory} placeholder="All Categories" options={categories} />
                            <SelectFilter value={filterStatus}   onChange={setFilterStatus}   placeholder="All Statuses"   options={statuses} />
                            {(search || filterBrand || filterCategory || filterStatus) && (
                                <button onClick={() => { setSearch(''); setFilterBrand(''); setFilterCategory(''); setFilterStatus(''); }} className="text-[12px] text-muted-foreground hover:text-foreground underline whitespace-nowrap">
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
                                        {canEdit && <th className="w-16 px-2" />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={canEdit ? 10 : 9} className="text-center py-10 text-muted-foreground text-sm">
                                                No items match the current filters.
                                            </td>
                                        </tr>
                                    ) : filtered.map((item, idx) => {
                                        const showroom = item.qty_sent - item.qty_returned;
                                        const brandCls = BRAND_COLORS[item.brand] ?? 'bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-600';
                                        const isEditing = editingItemId === item.id;
                                        const isSaving  = savingItemId  === item.id;

                                        return (
                                            <tr key={item.id} className={`group border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                                <td className="px-4 py-2.5 text-[12px] text-muted-foreground tabular-nums">{item.item_no}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="font-mono text-[12px] text-foreground">{item.item_code}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-[13px] text-foreground max-w-[260px]">
                                                    <span className="line-clamp-1">{item.product_name}</span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${brandCls}`}>{item.brand}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-[12px] text-muted-foreground">{item.category}</td>
                                                <td className="px-4 py-2.5 text-right tabular-nums text-[13px] font-medium text-foreground">{item.qty_sent}</td>
                                                <td className="px-4 py-2.5 text-right tabular-nums text-[13px] text-muted-foreground">
                                                    {isEditing && (editingStatus === 'Transferred Back') ? (
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={item.qty_sent}
                                                            value={editingQtyReturned}
                                                            onChange={e => setEditingQtyReturned(Math.min(Number(e.target.value), item.qty_sent))}
                                                            className="w-16 h-7 px-1.5 text-sm text-right rounded border border-brand-500 bg-background focus:outline-none"
                                                        />
                                                    ) : (
                                                        item.qty_returned || '—'
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums">
                                                    <span className={`text-[13px] font-semibold ${showroom > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                                        {isEditing && editingStatus === 'Transferred Back'
                                                            ? item.qty_sent - editingQtyReturned
                                                            : showroom
                                                        }
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    {isEditing ? (
                                                        <div className="relative">
                                                            <select
                                                                value={editingStatus}
                                                                onChange={e => {
                                                                    setEditingStatus(e.target.value);
                                                                    if (e.target.value !== 'Transferred Back') setEditingQtyReturned(item.qty_returned);
                                                                }}
                                                                className="appearance-none pl-2 pr-6 py-0.5 text-[11px] rounded border border-brand-500 bg-background text-foreground focus:outline-none"
                                                            >
                                                                {ITEM_STATUSES.map(s => <option key={s}>{s}</option>)}
                                                            </select>
                                                            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                                        </div>
                                                    ) : (
                                                        <StatusBadge status={item.status} map={ITEM_STATUS_CLS} />
                                                    )}
                                                </td>
                                                {canEdit && (
                                                    <td className="px-2 py-2.5">
                                                        {isEditing ? (
                                                            <div className="flex gap-1">
                                                                <button onClick={() => saveItemStatus(item.id, item.qty_sent)} disabled={isSaving} className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20">
                                                                    <Check size={13} />
                                                                </button>
                                                                <button onClick={cancelEditItem} disabled={isSaving} className="p-1 rounded text-muted-foreground hover:bg-muted">
                                                                    <X size={13} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => startEditItem(item)} className="p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
                                                                <Edit2 size={12} />
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
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
                                            <td colSpan={canEdit ? 2 : 1} />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </>
            ) : null}

            {/* ── New Consignment Modal ── */}
            {showNewForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl">

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                                <PackageCheck size={18} className="text-brand-600" />
                                New Consignment
                            </h2>
                            <button onClick={() => setShowNewForm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Header fields */}
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Voucher Details</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <FieldInput label="Voucher No" value={newHeader.voucher_no || ''} onChange={v => setNewHeader(p => ({ ...p, voucher_no: v }))} placeholder="e.g. KHST0005868" required />
                                    <FieldInput label="Transfer Date" value={newHeader.transfer_date || ''} onChange={v => setNewHeader(p => ({ ...p, transfer_date: v }))} type="date" required />
                                    <div>
                                        <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                                        <div className="relative">
                                            <select
                                                value={newHeader.status || 'Open'}
                                                onChange={e => setNewHeader(p => ({ ...p, status: e.target.value }))}
                                                className="w-full appearance-none h-8 pl-2.5 pr-7 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                                            >
                                                {VOUCHER_STATUSES.map(s => <option key={s}>{s}</option>)}
                                            </select>
                                            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                        </div>
                                    </div>
                                    <FieldInput label="From Location" value={newHeader.from_location || ''} onChange={v => setNewHeader(p => ({ ...p, from_location: v }))} placeholder="e.g. WH: KH" />
                                    <FieldInput label="To Location"   value={newHeader.to_location || ''}   onChange={v => setNewHeader(p => ({ ...p, to_location: v }))}   placeholder="e.g. TK (LPT Boeung Kak)" />
                                    <FieldInput label="Received By"   value={newHeader.received_by || ''}   onChange={v => setNewHeader(p => ({ ...p, received_by: v }))}   placeholder="e.g. LPT Showroom" />
                                    <FieldInput label="Received Date" value={newHeader.received_date || ''} onChange={v => setNewHeader(p => ({ ...p, received_date: v }))} type="date" />
                                    <div className="col-span-full">
                                        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                                        <textarea
                                            value={newHeader.notes || ''}
                                            onChange={e => setNewHeader(p => ({ ...p, notes: e.target.value }))}
                                            rows={2}
                                            placeholder="Any remarks about this consignment…"
                                            className="w-full px-2.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-muted-foreground/50 resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Items</p>
                                    <button onClick={addNewItem} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                                        <PlusCircle size={13} /> Add Row
                                    </button>
                                </div>

                                <div className="overflow-x-auto rounded-lg border border-border">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/40 border-b border-border">
                                                {['#', 'Item Code *', 'Product Name *', 'Brand', 'Category', 'Qty Sent', 'Qty Returned', 'Status', ''].map(h => (
                                                    <th key={h} className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {newItems.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-muted/10">
                                                    <td className="px-3 py-1.5 text-[12px] text-muted-foreground w-8">{idx + 1}</td>
                                                    <td className="px-1.5 py-1.5 w-28">
                                                        <input type="text" value={item.item_code || ''} onChange={e => updateNewItem(idx, 'item_code', e.target.value)} placeholder="LAC00001"
                                                            className="w-full h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                                    </td>
                                                    <td className="px-1.5 py-1.5 min-w-[200px]">
                                                        <input type="text" value={item.product_name || ''} onChange={e => updateNewItem(idx, 'product_name', e.target.value)} placeholder="Product name"
                                                            className="w-full h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                                    </td>
                                                    <td className="px-1.5 py-1.5 w-24">
                                                        <input type="text" value={item.brand || ''} onChange={e => updateNewItem(idx, 'brand', e.target.value)} placeholder="ASUS"
                                                            className="w-full h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                                    </td>
                                                    <td className="px-1.5 py-1.5 w-28">
                                                        <input type="text" value={item.category || ''} onChange={e => updateNewItem(idx, 'category', e.target.value)} placeholder="Laptop"
                                                            className="w-full h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                                    </td>
                                                    <td className="px-1.5 py-1.5 w-16">
                                                        <input type="number" min={1} value={item.qty_sent ?? 1} onChange={e => updateNewItem(idx, 'qty_sent', Number(e.target.value))}
                                                            className="w-full h-7 px-2 text-xs text-right rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                                    </td>
                                                    <td className="px-1.5 py-1.5 w-16">
                                                        <input type="number" min={0} max={item.qty_sent ?? 0} value={item.qty_returned ?? 0} onChange={e => updateNewItem(idx, 'qty_returned', Number(e.target.value))}
                                                            className="w-full h-7 px-2 text-xs text-right rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                                    </td>
                                                    <td className="px-1.5 py-1.5 w-36">
                                                        <div className="relative">
                                                            <select value={item.status || 'Received'} onChange={e => updateNewItem(idx, 'status', e.target.value)}
                                                                className="w-full appearance-none h-7 pl-2 pr-6 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500">
                                                                {ITEM_STATUSES.map(s => <option key={s}>{s}</option>)}
                                                            </select>
                                                            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                                        </div>
                                                    </td>
                                                    <td className="px-1.5 py-1.5 w-8">
                                                        {newItems.length > 1 && (
                                                            <button onClick={() => removeNewItem(idx)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-2">{newItems.filter(i => i.item_code?.trim() && i.product_name?.trim()).length} valid item{newItems.filter(i => i.item_code?.trim() && i.product_name?.trim()).length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 rounded-b-2xl">
                            <button onClick={() => setShowNewForm(false)} className="px-4 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-accent/60 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition-colors disabled:opacity-60">
                                {saving ? 'Creating…' : 'Create Consignment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Select Filter ─────────────────────────────────────────────────────────────

function SelectFilter({ value, onChange, placeholder, options }: {
    value: string; onChange: (v: string) => void; placeholder: string; options: string[];
}) {
    return (
        <div className="relative">
            <select value={value} onChange={e => onChange(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
    );
}
