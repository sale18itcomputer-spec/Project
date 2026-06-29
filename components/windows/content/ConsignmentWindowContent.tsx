'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, PlusCircle, Trash2, Check } from 'lucide-react';
import { createConsignment } from '@/services/consignmentApi';
import { Consignment, ConsignmentItem } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { useWindowManager } from '@/contexts/WindowManagerContext';

const VOUCHER_STATUSES = ['Open', 'Closed'] as const;
const ITEM_STATUSES = ['Received', 'Transferred Back', 'Sold', 'Damaged'] as const;
const TODAY = new Date().toISOString().split('T')[0];

const emptyItem = (): Partial<ConsignmentItem> => ({
    item_code: '', product_name: '', brand: '', category: '',
    qty_sent: 1, qty_returned: 0, status: 'Received', notes: '',
});

interface ConsignmentWindowContentProps {
    windowId: string;
    onCreated?: () => void;
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

const ConsignmentWindowContent: React.FC<ConsignmentWindowContentProps> = ({ windowId, onCreated }) => {
    const { addToast } = useToast();
    const { closeWindow, updateWindow } = useWindowManager();

    const [saving, setSaving] = useState(false);
    const [header, setHeader] = useState<Partial<Consignment>>({
        voucher_no: '', transfer_date: TODAY, from_location: '', to_location: '',
        status: 'Open', received_by: '', received_date: TODAY, notes: '',
    });
    const [items, setItems] = useState<Partial<ConsignmentItem>[]>([emptyItem()]);

    const addItem = () => setItems(prev => [...prev, emptyItem()]);
    const removeItem = (idx: number) => setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
    const updateItem = (idx: number, field: keyof ConsignmentItem, val: any) =>
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!header.voucher_no?.trim()) { addToast('Voucher number is required.', 'error'); return; }
        if (!header.transfer_date)      { addToast('Transfer date is required.', 'error'); return; }
        const validItems = items.filter(i => i.item_code?.trim() && i.product_name?.trim());
        if (!validItems.length)         { addToast('At least one item with a code and name is required.', 'error'); return; }

        setSaving(true);
        try {
            const created = await createConsignment(
                {
                    voucher_no:     header.voucher_no!.trim(),
                    transfer_date:  header.transfer_date!,
                    from_location:  header.from_location || '',
                    to_location:    header.to_location || '',
                    status:         header.status || 'Open',
                    received_by:    header.received_by || '',
                    received_date:  header.received_date || null,
                    notes:          header.notes || '',
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
            addToast(`Consignment ${created.voucher_no} created.`, 'success');
            onCreated?.();
            closeWindow(windowId);
        } catch (e: any) {
            addToast(`Failed to create consignment: ${e.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        const footer = (
            <div className="flex justify-end gap-3 w-full">
                <button type="button" onClick={() => closeWindow(windowId)} className="px-4 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-accent/60 transition-colors">
                    Cancel
                </button>
                <button type="submit" form={`consignment-form-${windowId}`} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition-colors disabled:opacity-60 flex items-center gap-2">
                    <Check size={16} /> {saving ? 'Creating…' : 'Create Consignment'}
                </button>
            </div>
        );
        updateWindow(windowId, { title: 'New Consignment', footer });
    }, [saving, windowId, updateWindow, closeWindow]);

    return (
        <form id={`consignment-form-${windowId}`} onSubmit={handleSubmit} className="space-y-6">
            {/* Header fields */}
            <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Voucher Details</p>
                <div className="grid grid-cols-2 @md:grid-cols-3 gap-3">
                    <FieldInput label="Voucher No" value={header.voucher_no || ''} onChange={v => setHeader(p => ({ ...p, voucher_no: v }))} placeholder="e.g. KHST0005868" required />
                    <FieldInput label="Transfer Date" value={header.transfer_date || ''} onChange={v => setHeader(p => ({ ...p, transfer_date: v }))} type="date" required />
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                        <div className="relative">
                            <select
                                value={header.status || 'Open'}
                                onChange={e => setHeader(p => ({ ...p, status: e.target.value }))}
                                className="w-full appearance-none h-8 pl-2.5 pr-7 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                {VOUCHER_STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                    </div>
                    <FieldInput label="From Location" value={header.from_location || ''} onChange={v => setHeader(p => ({ ...p, from_location: v }))} placeholder="e.g. WH: KH" />
                    <FieldInput label="To Location"   value={header.to_location || ''}   onChange={v => setHeader(p => ({ ...p, to_location: v }))}   placeholder="e.g. TK (LPT Boeung Kak)" />
                    <FieldInput label="Received By"   value={header.received_by || ''}   onChange={v => setHeader(p => ({ ...p, received_by: v }))}   placeholder="e.g. LPT Showroom" />
                    <FieldInput label="Received Date" value={header.received_date || ''} onChange={v => setHeader(p => ({ ...p, received_date: v }))} type="date" />
                    <div className="col-span-full">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                        <textarea
                            value={header.notes || ''}
                            onChange={e => setHeader(p => ({ ...p, notes: e.target.value }))}
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
                    <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
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
                            {items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-muted/10">
                                    <td className="px-3 py-1.5 text-[12px] text-muted-foreground w-8">{idx + 1}</td>
                                    <td className="px-1.5 py-1.5 w-28">
                                        <input type="text" value={item.item_code || ''} onChange={e => updateItem(idx, 'item_code', e.target.value)} placeholder="LAC00001"
                                            className="w-full h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                    </td>
                                    <td className="px-1.5 py-1.5 min-w-[200px]">
                                        <input type="text" value={item.product_name || ''} onChange={e => updateItem(idx, 'product_name', e.target.value)} placeholder="Product name"
                                            className="w-full h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                    </td>
                                    <td className="px-1.5 py-1.5 w-24">
                                        <input type="text" value={item.brand || ''} onChange={e => updateItem(idx, 'brand', e.target.value)} placeholder="ASUS"
                                            className="w-full h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                    </td>
                                    <td className="px-1.5 py-1.5 w-28">
                                        <input type="text" value={item.category || ''} onChange={e => updateItem(idx, 'category', e.target.value)} placeholder="Laptop"
                                            className="w-full h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                    </td>
                                    <td className="px-1.5 py-1.5 w-16">
                                        <input type="number" min={1} value={item.qty_sent ?? 1} onChange={e => updateItem(idx, 'qty_sent', Number(e.target.value))}
                                            className="w-full h-7 px-2 text-xs text-right rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                    </td>
                                    <td className="px-1.5 py-1.5 w-16">
                                        <input type="number" min={0} max={item.qty_sent ?? 0} value={item.qty_returned ?? 0} onChange={e => updateItem(idx, 'qty_returned', Number(e.target.value))}
                                            className="w-full h-7 px-2 text-xs text-right rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500" />
                                    </td>
                                    <td className="px-1.5 py-1.5 w-36">
                                        <div className="relative">
                                            <select value={item.status || 'Received'} onChange={e => updateItem(idx, 'status', e.target.value)}
                                                className="w-full appearance-none h-7 pl-2 pr-6 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500">
                                                {ITEM_STATUSES.map(s => <option key={s}>{s}</option>)}
                                            </select>
                                            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                        </div>
                                    </td>
                                    <td className="px-1.5 py-1.5 w-8">
                                        {items.length > 1 && (
                                            <button type="button" onClick={() => removeItem(idx)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                    {items.filter(i => i.item_code?.trim() && i.product_name?.trim()).length} valid item{items.filter(i => i.item_code?.trim() && i.product_name?.trim()).length !== 1 ? 's' : ''}
                </p>
            </div>
        </form>
    );
};

export default ConsignmentWindowContent;
