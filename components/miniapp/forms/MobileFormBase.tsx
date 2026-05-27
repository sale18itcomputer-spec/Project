'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
    ChevronLeft, Plus, Trash2, Loader2, ChevronDown,
    ChevronUp, Search, Package, X,
} from 'lucide-react';
import { haptic } from '@/lib/miniapp/telegramShare';
import type { PricelistItem } from '@/types';

// ─── Header ───────────────────────────────────────────────────────────────────
export function MobileFormHeader({
    title,
    subtitle,
    onBack,
    onSave,
    isSaving,
    saveLabel = 'Save',
    accentColor = 'hsl(var(--primary))',
}: {
    title: string;
    subtitle?: string;
    onBack: () => void;
    onSave: () => void;
    isSaving: boolean;
    saveLabel?: string;
    accentColor?: string;
}) {
    return (
        <header
            className="flex-shrink-0 flex items-center gap-2 px-2 z-50 sticky top-0"
            style={{
                height: '52px',
                background: 'hsl(var(--card) / 0.94)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderBottom: '1px solid hsl(var(--border) / 0.5)',
            }}
        >
            <button
                onClick={() => { haptic('light'); onBack(); }}
                className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 active:opacity-60"
                style={{ color: accentColor }}
            >
                <ChevronLeft size={22} strokeWidth={2.5} />
            </button>
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-foreground truncate leading-tight">{title}</p>
                {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
            </div>
            <button
                onClick={() => { haptic('medium'); onSave(); }}
                disabled={isSaving}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-white active:opacity-80 disabled:opacity-50 transition-all"
                style={{ background: accentColor }}
            >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : saveLabel}
            </button>
        </header>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────
export function MobileFormSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <p
                className="text-[10px] font-bold uppercase tracking-widest px-4 mb-2"
                style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}
            >
                {title}
            </p>
            <div
                className="mx-3 rounded-2xl overflow-hidden"
                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.5)' }}
            >
                {children}
            </div>
        </div>
    );
}

// ─── Field row ────────────────────────────────────────────────────────────────
interface FieldProps {
    label: string;
    children: React.ReactNode;
    last?: boolean;
}
export function MobileField({ label, children, last }: FieldProps) {
    return (
        <div
            className="flex items-start gap-3 px-4 py-3"
            style={{ borderBottom: last ? 'none' : '1px solid hsl(var(--border) / 0.35)' }}
        >
            <span
                className="text-[12px] font-semibold flex-shrink-0 mt-2 w-28"
                style={{ color: 'hsl(var(--muted-foreground))' }}
            >
                {label}
            </span>
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}

// ─── Text input ───────────────────────────────────────────────────────────────
export function MobileInput({
    value,
    onChange,
    placeholder = '',
    type = 'text',
    readOnly = false,
    required = false,
}: {
    value?: string | number;
    onChange?: (v: string) => void;
    placeholder?: string;
    type?: string;
    readOnly?: boolean;
    required?: boolean;
}) {
    return (
        <input
            type={type}
            value={value ?? ''}
            onChange={e => onChange?.(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            required={required}
            className="w-full text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/40 py-1.5"
        />
    );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
export function MobileTextarea({
    value,
    onChange,
    placeholder = '',
    rows = 3,
}: {
    value?: string;
    onChange?: (v: string) => void;
    placeholder?: string;
    rows?: number;
}) {
    return (
        <textarea
            value={value ?? ''}
            onChange={e => onChange?.(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full text-[13px] text-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/40 py-1.5"
        />
    );
}

// ─── Native select ────────────────────────────────────────────────────────────
export function MobileSelect({
    value,
    onChange,
    options,
    placeholder = 'Select...',
}: {
    value?: string;
    onChange?: (v: string) => void;
    options: string[];
    placeholder?: string;
}) {
    return (
        <div className="relative">
            <select
                value={value ?? ''}
                onChange={e => onChange?.(e.target.value)}
                className="w-full text-[13px] text-foreground bg-transparent outline-none appearance-none py-1.5 pr-5"
            >
                <option value="" disabled>{placeholder}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'hsl(var(--muted-foreground))' }} />
        </div>
    );
}

// ─── Searchable company/contact dropdown ──────────────────────────────────────
export function MobileSearchSelect({
    value,
    onChange,
    options,
    placeholder = 'Search...',
}: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase())).slice(0, 60);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => { haptic('light'); setOpen(p => !p); setQ(''); }}
                className="w-full text-left text-[13px] py-1.5 flex items-center gap-1"
                style={{ color: value ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground) / 0.5)' }}
            >
                <span className="flex-1 truncate">{value || placeholder}</span>
                <ChevronDown size={13} style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
            </button>
            {open && (
                <div
                    className="absolute left-0 right-0 top-full mt-1 rounded-xl z-50 overflow-hidden shadow-xl"
                    style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', maxHeight: '240px' }}
                >
                    <div className="p-2 border-b" style={{ borderColor: 'hsl(var(--border) / 0.5)' }}>
                        <input
                            autoFocus
                            type="text"
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="Type to search..."
                            className="w-full text-[12px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40"
                        />
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: '180px' }}>
                        {filtered.length === 0 ? (
                            <p className="text-center text-[11px] py-4" style={{ color: 'hsl(var(--muted-foreground))' }}>No results</p>
                        ) : filtered.map(o => (
                            <button
                                key={o}
                                type="button"
                                onPointerDown={() => { onChange(o); setOpen(false); haptic('light'); }}
                                className="w-full text-left px-3 py-2.5 text-[12px] active:bg-muted transition-colors"
                                style={{
                                    color: o === value ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                                    fontWeight: o === value ? 700 : 500,
                                    borderBottom: '1px solid hsl(var(--border) / 0.3)',
                                }}
                            >
                                {o}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Line Item type ────────────────────────────────────────────────────────────
export interface MiniLineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName: string;
    description: string;
    qty: number | string;
    unitPrice: number | string;
    amount: number;
}

// ─── Pricelist search popup ────────────────────────────────────────────────────
function PricelistSearch({
    pricelist,
    onSelect,
    onClose,
    accentColor,
}: {
    pricelist: PricelistItem[];
    onSelect: (item: PricelistItem) => void;
    onClose: () => void;
    accentColor: string;
}) {
    const [q, setQ] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        if (!q.trim()) return pricelist.slice(0, 40);
        const lq = q.toLowerCase();
        return pricelist.filter(p =>
            p.Code?.toLowerCase().includes(lq) ||
            p.Model?.toLowerCase().includes(lq) ||
            p.Brand?.toLowerCase().includes(lq) ||
            p.Description?.toLowerCase().includes(lq)
        ).slice(0, 40);
    }, [q, pricelist]);

    return (
        <div
            className="fixed inset-0 z-[200] flex flex-col"
            style={{ background: 'hsl(var(--background))' }}
        >
            {/* Header */}
            <div
                className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
                style={{
                    background: 'hsl(var(--card))',
                    borderBottom: '1px solid hsl(var(--border) / 0.5)',
                }}
            >
                <button
                    onClick={() => { haptic('light'); onClose(); }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl active:opacity-60"
                    style={{ color: accentColor }}
                >
                    <X size={20} />
                </button>
                <div
                    className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: 'hsl(var(--muted) / 0.5)', border: '1px solid hsl(var(--border) / 0.4)' }}
                >
                    <Search size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
                    <input
                        ref={inputRef}
                        autoFocus
                        type="text"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="Search by code, model, brand..."
                        className="flex-1 text-[13px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40"
                    />
                    {q && (
                        <button onClick={() => setQ('')} className="active:opacity-60">
                            <X size={13} style={{ color: 'hsl(var(--muted-foreground))' }} />
                        </button>
                    )}
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Package size={36} style={{ color: 'hsl(var(--muted-foreground) / 0.3)' }} />
                        <p className="mt-3 text-[13px] font-semibold" style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}>
                            No items found
                        </p>
                    </div>
                ) : filtered.map(p => {
                    const price = parseFloat(String(p['End User Price']).replace(/[^0-9.]/g, '')) || 0;
                    return (
                        <button
                            key={p.Code}
                            type="button"
                            onPointerDown={() => { haptic('medium'); onSelect(p); onClose(); }}
                            className="w-full text-left rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform"
                            style={{
                                background: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border) / 0.5)',
                            }}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-bold text-foreground truncate">{p.Model}</p>
                                    <p className="text-[11px] mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                        {p.Brand} · <span className="font-mono">{p.Code}</span>
                                    </p>
                                    {p.Description && (
                                        <p className="text-[10px] mt-1 line-clamp-2" style={{ color: 'hsl(var(--muted-foreground) / 0.7)' }}>
                                            {p.Description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex-shrink-0 text-right">
                                    <p className="text-[14px] font-black" style={{ color: accentColor }}>
                                        ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                    <span
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                        style={{
                                            background: p.Status === 'Available' ? '#34d39920' : '#f4727220',
                                            color: p.Status === 'Available' ? '#34d399' : '#f47272',
                                        }}
                                    >
                                        {p.Status || 'Unknown'}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Improved Line Item Card ───────────────────────────────────────────────────
export function MobileLineItemCard({
    item,
    onChange,
    onRemove,
    accentColor = 'hsl(var(--primary))',
    currency = '$',
    pricelist,
}: {
    item: MiniLineItem;
    onChange: (id: string, field: keyof MiniLineItem, value: any) => void;
    onRemove: (id: string) => void;
    accentColor?: string;
    currency?: string;
    pricelist?: PricelistItem[];
}) {
    const [expanded, setExpanded] = useState(true);
    const [showPricelist, setShowPricelist] = useState(false);

    const amount = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
    const fmt = (n: number) => `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    const handlePricelistSelect = useCallback((p: PricelistItem) => {
        const price = parseFloat(String(p['End User Price']).replace(/[^0-9.]/g, '')) || 0;
        onChange(item.id, 'itemCode', p.Code || '');
        onChange(item.id, 'modelName', p.Model || '');
        onChange(item.id, 'description', p.Description || '');
        onChange(item.id, 'unitPrice', price);
        onChange(item.id, 'amount', (Number(item.qty) || 1) * price);
    }, [item.id, item.qty, onChange]);

    return (
        <>
            {showPricelist && pricelist && (
                <PricelistSearch
                    pricelist={pricelist}
                    onSelect={handlePricelistSelect}
                    onClose={() => setShowPricelist(false)}
                    accentColor={accentColor}
                />
            )}

            <div
                className="rounded-2xl mb-2.5 overflow-hidden"
                style={{
                    background: 'hsl(var(--card))',
                    border: `1px solid hsl(var(--border) / 0.6)`,
                    boxShadow: '0 1px 4px hsl(var(--foreground) / 0.04)',
                }}
            >
                {/* ── Card header row ── */}
                <div
                    className="flex items-center gap-2 px-3 py-2.5"
                    style={{ borderBottom: expanded ? '1px solid hsl(var(--border) / 0.4)' : 'none' }}
                >
                    {/* number badge */}
                    <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                        style={{ background: `${accentColor}25`, color: accentColor }}
                    >
                        {item.no}
                    </span>

                    {/* model name preview (collapsed) or code input (expanded) */}
                    {expanded ? (
                        <input
                            type="text"
                            value={item.itemCode}
                            onChange={e => onChange(item.id, 'itemCode', e.target.value)}
                            placeholder="Item code / SKU"
                            className="flex-1 text-[11px] font-mono text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30"
                        />
                    ) : (
                        <p className="flex-1 text-[13px] font-semibold text-foreground truncate">
                            {item.modelName || item.itemCode || 'Unnamed item'}
                        </p>
                    )}

                    {/* amount pill */}
                    <span className="text-[12px] font-black flex-shrink-0" style={{ color: accentColor }}>
                        {fmt(amount)}
                    </span>

                    {/* pricelist search button */}
                    {pricelist && pricelist.length > 0 && (
                        <button
                            type="button"
                            onClick={() => { haptic('light'); setShowPricelist(true); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg active:opacity-60 flex-shrink-0"
                            style={{ background: `${accentColor}18`, color: accentColor }}
                        >
                            <Search size={12} />
                        </button>
                    )}

                    {/* expand/collapse */}
                    <button
                        type="button"
                        onClick={() => { haptic('light'); setExpanded(p => !p); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg active:opacity-60 flex-shrink-0"
                        style={{ color: 'hsl(var(--muted-foreground) / 0.6)' }}
                    >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {/* delete */}
                    <button
                        type="button"
                        onClick={() => { haptic('medium'); onRemove(item.id); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg active:opacity-60 flex-shrink-0"
                        style={{ color: 'hsl(var(--destructive) / 0.7)' }}
                    >
                        <Trash2 size={13} />
                    </button>
                </div>

                {/* ── Expanded body ── */}
                {expanded && (
                    <div className="px-3 py-2.5 space-y-2">

                        {/* Model name */}
                        <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}>Model Name</label>
                            <input
                                type="text"
                                value={item.modelName}
                                onChange={e => onChange(item.id, 'modelName', e.target.value)}
                                placeholder="Product / service name"
                                className="w-full text-[13px] font-semibold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 mt-0.5"
                            />
                        </div>

                        {/* Description */}
                        <div
                            className="rounded-xl p-2.5"
                            style={{ background: 'hsl(var(--muted) / 0.35)' }}
                        >
                            <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}>Description</label>
                            <textarea
                                value={item.description}
                                onChange={e => onChange(item.id, 'description', e.target.value)}
                                placeholder="Additional details..."
                                rows={2}
                                className="w-full text-[11px] text-muted-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/30 mt-0.5"
                            />
                        </div>

                        {/* Qty × Price = Amount */}
                        <div className="grid grid-cols-3 gap-2 pt-0.5">
                            {/* Qty */}
                            <div
                                className="rounded-xl p-2.5 flex flex-col gap-0.5"
                                style={{ background: 'hsl(var(--muted) / 0.4)', border: '1px solid hsl(var(--border) / 0.3)' }}
                            >
                                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground) / 0.6)' }}>Qty</span>
                                <input
                                    type="number"
                                    value={item.qty}
                                    onChange={e => onChange(item.id, 'qty', e.target.value)}
                                    className="w-full text-[14px] font-black text-foreground bg-transparent outline-none"
                                    min="1"
                                />
                            </div>

                            {/* Unit Price */}
                            <div
                                className="rounded-xl p-2.5 flex flex-col gap-0.5 col-span-2"
                                style={{ background: 'hsl(var(--muted) / 0.4)', border: '1px solid hsl(var(--border) / 0.3)' }}
                            >
                                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground) / 0.6)' }}>Unit Price ({currency})</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={item.unitPrice}
                                    onChange={e => onChange(item.id, 'unitPrice', e.target.value)}
                                    className="w-full text-[14px] font-black text-foreground bg-transparent outline-none"
                                />
                            </div>
                        </div>

                        {/* Amount bar */}
                        <div
                            className="rounded-xl px-3 py-2 flex items-center justify-between"
                            style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}30` }}
                        >
                            <span className="text-[11px] font-semibold" style={{ color: `${accentColor}cc` }}>
                                {Number(item.qty) || 0} × {currency}{Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[14px] font-black" style={{ color: accentColor }}>
                                {fmt(amount)}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// ─── Add item button ───────────────────────────────────────────────────────────
export function MobileAddItemBtn({
    onAdd,
    accentColor,
    label = 'Add Item',
}: {
    onAdd: () => void;
    accentColor?: string;
    label?: string;
}) {
    return (
        <button
            type="button"
            onClick={() => { haptic('light'); onAdd(); }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[13px] font-bold active:scale-[0.97] transition-transform"
            style={{
                border: `1.5px dashed ${accentColor ?? 'hsl(var(--border))'}`,
                color: accentColor ?? 'hsl(var(--muted-foreground))',
                background: `${accentColor ?? '#888'}0a`,
            }}
        >
            <Plus size={16} strokeWidth={2.5} />
            {label}
        </button>
    );
}

// ─── Items section wrapper ─────────────────────────────────────────────────────
export function MobileItemsSection({
    items,
    onItemChange,
    onAddItem,
    onRemoveItem,
    accentColor,
    currency,
    pricelist,
    subTotal,
    tax,
    grandTotal,
    taxLabel = 'Tax (10% VAT)',
}: {
    items: MiniLineItem[];
    onItemChange: (id: string, field: keyof MiniLineItem, value: any) => void;
    onAddItem: () => void;
    onRemoveItem: (id: string) => void;
    accentColor: string;
    currency: string;
    pricelist?: PricelistItem[];
    subTotal: number;
    tax: number;
    grandTotal: number;
    taxLabel?: string;
}) {
    const fmt = (n: number) => `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    return (
        <div>
            {/* Section header */}
            <div className="flex items-center justify-between px-4 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}>
                    Line Items
                </p>
                <div className="flex items-center gap-1.5">
                    <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${accentColor}20`, color: accentColor }}
                    >
                        {items.length} item{items.length !== 1 ? 's' : ''}
                    </span>
                    {pricelist && pricelist.length > 0 && (
                        <span
                            className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'hsl(var(--muted) / 0.6)', color: 'hsl(var(--muted-foreground))' }}
                        >
                            🔍 tap to search catalog
                        </span>
                    )}
                </div>
            </div>

            {/* Cards */}
            <div className="px-3">
                {items.map(item => (
                    <MobileLineItemCard
                        key={item.id}
                        item={item}
                        onChange={onItemChange}
                        onRemove={onRemoveItem}
                        accentColor={accentColor}
                        currency={currency}
                        pricelist={pricelist}
                    />
                ))}
                <MobileAddItemBtn onAdd={onAddItem} accentColor={accentColor} />
            </div>

            {/* Totals */}
            <div
                className="mx-3 mt-3 rounded-2xl overflow-hidden"
                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.5)' }}
            >
                {/* Subtotal row */}
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid hsl(var(--border) / 0.35)' }}>
                    <span className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Subtotal</span>
                    <span className="text-[13px] font-semibold text-foreground">{fmt(subTotal)}</span>
                </div>
                {/* Tax row */}
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid hsl(var(--border) / 0.35)' }}>
                    <span className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{taxLabel}</span>
                    <span className="text-[13px] font-semibold text-foreground">{fmt(tax)}</span>
                </div>
                {/* Grand total */}
                <div
                    className="flex items-center justify-between px-4 py-3.5"
                    style={{ background: `${accentColor}0e` }}
                >
                    <span className="text-[13px] font-bold text-foreground">Grand Total</span>
                    <span className="text-[18px] font-black" style={{ color: accentColor }}>
                        {fmt(grandTotal)}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Totals-only card (kept for backwards compat) ──────────────────────────────
export function MobileTotals({
    subTotal, tax, grandTotal, currency = '$', accentColor,
}: {
    subTotal: number; tax: number; grandTotal: number;
    currency?: string; accentColor?: string;
}) {
    const fmt = (n: number) => `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    return (
        <div className="mx-3 rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.5)' }}>
            <div className="flex justify-between px-4 py-3" style={{ borderBottom: '1px solid hsl(var(--border) / 0.35)' }}>
                <span className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Subtotal</span>
                <span className="text-[13px] font-semibold text-foreground">{fmt(subTotal)}</span>
            </div>
            <div className="flex justify-between px-4 py-3" style={{ borderBottom: '1px solid hsl(var(--border) / 0.35)' }}>
                <span className="text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Tax (10% VAT)</span>
                <span className="text-[13px] font-semibold text-foreground">{fmt(tax)}</span>
            </div>
            <div className="flex justify-between px-4 py-3.5" style={{ background: `${accentColor ?? 'hsl(var(--primary))'}0e` }}>
                <span className="text-[13px] font-bold text-foreground">Grand Total</span>
                <span className="text-[18px] font-black" style={{ color: accentColor ?? 'hsl(var(--primary))' }}>{fmt(grandTotal)}</span>
            </div>
        </div>
    );
}


