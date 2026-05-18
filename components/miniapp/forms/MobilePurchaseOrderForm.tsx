'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PurchaseOrder, PurchaseOrderItem } from '@/types';
import { useData } from '@/contexts/MiniAppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { formatToInputDate } from '@/utils/time';
import { Trash2, Plus } from 'lucide-react';
import { haptic } from '@/lib/miniapp/telegramShare';
import {
    MobileFormHeader, MobileFormSection, MobileField,
    MobileInput, MobileTextarea, MobileSelect, MobileSearchSelect,
} from './MobileFormBase';

const ACCENT = '#f59e0b';
const STATUS_OPTIONS = ['Draft', 'Approved', 'Sent', 'Completed', 'Cancelled'];
const CURRENCY_OPTIONS = ['USD', 'KHR'];
const TAX_OPTIONS = ['VAT', 'NON-VAT'];

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Props {
    onBack: () => void;
    existingPO?: PurchaseOrder | null;
    initialData?: Partial<PurchaseOrder>;
}

export default function MobilePurchaseOrderForm({ onBack, existingPO, initialData }: Props) {
    const { vendors } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const [doc, setDoc] = useState<Partial<PurchaseOrder>>({});
    const [items, setItems] = useState<PurchaseOrderItem[]>([
        { line_number: 1, item_number: '', description: '', qty: 1, unit_price: 0 },
    ]);

    const set = (k: keyof PurchaseOrder, v: any) => setDoc(p => ({ ...p, [k]: v }));

    useEffect(() => {
        if (existingPO) {
            setDoc({
                ...existingPO,
                order_date: existingPO.order_date ? formatToInputDate(existingPO.order_date) : today(),
                delivery_date: existingPO.delivery_date ? formatToInputDate(existingPO.delivery_date) : '',
            });
            const loadItems = async () => {
                if (existingPO.id) {
                    const { data } = await supabase
                        .from('purchase_order_items')
                        .select('*')
                        .eq('po_id', existingPO.id)
                        .order('line_number');
                    if (data?.length) setItems(data);
                }
            };
            loadItems();
        } else {
            // Generate PO number
            const generatePONo = async () => {
                const year = new Date().getFullYear().toString();
                const { data } = await supabase
                    .from('purchase_orders')
                    .select('po_number')
                    .order('created_at', { ascending: false })
                    .limit(1);
                let next = 2;
                if (data?.length) {
                    const last = parseInt(data[0].po_number.split('-').pop() || '1', 10);
                    next = last + 1;
                }
                setDoc(p => ({ ...p, po_number: `PO-${year}-${String(next).padStart(3, '0')}` }));
            };
            setDoc({
                order_date: today(),
                delivery_date: '',
                status: 'Draft',
                currency: 'USD',
                tax_type: 'VAT',
                ordered_by_name: currentUser?.Name || '',
                ordered_by_phone: currentUser?.['Phone 1'] || '',
                prepared_by: currentUser?.Name || '',
                prepared_by_position: currentUser
                    ? [currentUser.Role, [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '), currentUser.Email].filter(Boolean).join(' | ')
                    : '',
                approved_by: '',
                approved_by_position: '',
                ship_to_address: 'Limperial Co., Ltd.\nNo. 123, St. 456, Phnom Penh, Cambodia',
                ...initialData,
            });
            generatePONo();
        }
    }, [existingPO, currentUser, initialData]);

    const totals = useMemo(() => {
        const sub = items.reduce((s, i) => s + (i.qty * i.unit_price), 0);
        const vat = doc.tax_type === 'VAT' ? sub * 0.1 : 0;
        return { sub, vat, grand: sub + vat };
    }, [items, doc.tax_type]);

    const handleVendorSelect = (vendorId: string) => {
        const v = vendors?.find(x => x.id === vendorId);
        if (!v) return;
        setDoc(p => ({
            ...p,
            vendor_id: vendorId,
            vendor_name: v.vendor_name,
            vendor_address: v.address || '',
            vendor_contact: v.contact_person || '',
            vendor_phone: v.phone || '',
            vendor_email: v.email || '',
            payment_term: v.payment_terms || p.payment_term,
        }));
    };

    const setItemField = (idx: number, k: keyof PurchaseOrderItem, v: any) => {
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));
    };
    const addItem = () => setItems(p => [...p, { line_number: p.length + 1, item_number: '', description: '', qty: 1, unit_price: 0 }]);
    const removeItem = (idx: number) => {
        if (items.length === 1) return;
        setItems(p => p.filter((_, i) => i !== idx).map((it, i) => ({ ...it, line_number: i + 1 })));
    };

    const handleSave = async () => {
        if (!doc.vendor_name && !doc.vendor_id) {
            addToast('Please select or enter a vendor name', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const { items: _, id: __, created_at: ___, updated_at: ____, ...cleanDoc } = doc as any;
            const poPayload = {
                ...cleanDoc,
                sub_total: totals.sub,
                vat_amount: totals.vat,
                grand_total: totals.grand,
                order_date: cleanDoc.order_date || null,
                delivery_date: cleanDoc.delivery_date || null,
                created_by: cleanDoc.created_by || currentUser?.Name || 'System',
                updated_at: new Date().toISOString(),
            };

            let poId = doc.id;
            if (poId) {
                const { error } = await supabase.from('purchase_orders').update(poPayload).eq('id', poId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('purchase_orders').insert([poPayload]).select();
                if (error) throw error;
                poId = (data as any)[0].id;
            }
            if (doc.id) await supabase.from('purchase_order_items').delete().eq('po_id', poId);
            const itemsPayload = items.map(it => ({
                po_id: poId,
                line_number: it.line_number,
                item_number: it.item_number,
                description: it.description,
                qty: it.qty,
                unit_price: it.unit_price,
            }));
            const { error: itemsErr } = await supabase.from('purchase_order_items').insert(itemsPayload);
            if (itemsErr) throw itemsErr;

            addToast(`PO ${doc.po_number} saved!`, 'success');
            onBack();
        } catch (err: any) {
            addToast(err.message || 'Failed to save', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const vendorOptions = useMemo(() => vendors?.map(v => v.vendor_name) ?? [], [vendors]);
    const currSym = doc.currency === 'KHR' ? '៛' : '$';
    const fmt = (n: number) => `${currSym}${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'hsl(var(--background))' }}>
            <MobileFormHeader
                title={existingPO ? `Edit ${doc.po_number || ''}` : 'New Purchase Order'}
                subtitle={doc.vendor_name || 'No vendor selected'}
                onBack={onBack}
                onSave={handleSave}
                isSaving={isSaving}
                accentColor={ACCENT}
            />

            <div className="flex-1 overflow-y-auto py-4 space-y-5 pb-10">

                <MobileFormSection title="Purchase Order Info">
                    <MobileField label="PO Number" last={false}>
                        <MobileInput value={doc.po_number} onChange={v => set('po_number', v)} readOnly />
                    </MobileField>
                    <MobileField label="Order Date" last={false}>
                        <MobileInput type="date" value={doc.order_date} onChange={v => set('order_date', v)} />
                    </MobileField>
                    <MobileField label="Delivery Date" last={false}>
                        <MobileInput type="date" value={doc.delivery_date} onChange={v => set('delivery_date', v)} />
                    </MobileField>
                    <MobileField label="Status" last={false}>
                        <MobileSelect value={doc.status} onChange={v => set('status', v)} options={STATUS_OPTIONS} placeholder="Status" />
                    </MobileField>
                    <MobileField label="Currency" last={false}>
                        <MobileSelect value={doc.currency} onChange={v => set('currency', v)} options={CURRENCY_OPTIONS} placeholder="USD" />
                    </MobileField>
                    <MobileField label="Tax Type" last={false}>
                        <MobileSelect value={doc.tax_type} onChange={v => set('tax_type', v)} options={TAX_OPTIONS} placeholder="VAT" />
                    </MobileField>
                    <MobileField label="Payment Term" last={true}>
                        <MobileInput value={doc.payment_term} onChange={v => set('payment_term', v)} placeholder="e.g. Net 30" />
                    </MobileField>
                </MobileFormSection>

                <MobileFormSection title="Vendor">
                    <MobileField label="Select Vendor" last={false}>
                        <MobileSearchSelect
                            value={doc.vendor_name || ''}
                            onChange={name => {
                                const v = vendors?.find(x => x.vendor_name === name);
                                if (v) handleVendorSelect(v.id);
                                else setDoc(p => ({ ...p, vendor_name: name }));
                            }}
                            options={vendorOptions}
                            placeholder="Search vendor..."
                        />
                    </MobileField>
                    <MobileField label="Vendor Name" last={false}>
                        <MobileInput value={doc.vendor_name} onChange={v => set('vendor_name', v)} placeholder="Vendor name" />
                    </MobileField>
                    <MobileField label="Contact" last={false}>
                        <MobileInput value={doc.vendor_contact} onChange={v => set('vendor_contact', v)} placeholder="Contact person" />
                    </MobileField>
                    <MobileField label="Phone" last={false}>
                        <MobileInput value={doc.vendor_phone} onChange={v => set('vendor_phone', v)} placeholder="Phone" />
                    </MobileField>
                    <MobileField label="Email" last={false}>
                        <MobileInput type="email" value={doc.vendor_email} onChange={v => set('vendor_email', v)} placeholder="Email" />
                    </MobileField>
                    <MobileField label="Address" last={true}>
                        <MobileTextarea value={doc.vendor_address} onChange={v => set('vendor_address', v)} rows={2} />
                    </MobileField>
                </MobileFormSection>

                {/* Line Items */}
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest px-4 mb-2"
                        style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}>Line Items</p>
                    <div className="px-3 space-y-2">
                        {items.map((it, idx) => (
                            <div key={idx}
                                className="rounded-2xl p-3"
                                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.5)' }}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg flex-shrink-0"
                                        style={{ background: `${ACCENT}20`, color: ACCENT }}>
                                        #{it.line_number}
                                    </span>
                                    <input type="text" value={it.item_number}
                                        onChange={e => setItemField(idx, 'item_number', e.target.value)}
                                        placeholder="Item # / SKU"
                                        className="flex-1 text-[12px] font-mono text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30"
                                    />
                                    <button type="button" onClick={() => { haptic('light'); removeItem(idx); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg active:opacity-60"
                                        style={{ color: 'hsl(var(--destructive))' }}>
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                                <textarea value={it.description}
                                    onChange={e => setItemField(idx, 'description', e.target.value)}
                                    placeholder="Product description..."
                                    rows={2}
                                    className="w-full text-[12px] text-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/30 mb-2"
                                />
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl flex-1"
                                        style={{ background: 'hsl(var(--muted) / 0.4)' }}>
                                        <span className="text-[10px] text-muted-foreground">Qty</span>
                                        <input type="number" value={it.qty}
                                            onChange={e => setItemField(idx, 'qty', parseFloat(e.target.value) || 0)}
                                            className="w-12 text-[12px] font-bold text-foreground bg-transparent outline-none text-center"
                                        />
                                    </div>
                                    <span className="text-muted-foreground text-[11px]">×</span>
                                    <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl flex-1"
                                        style={{ background: 'hsl(var(--muted) / 0.4)' }}>
                                        <span className="text-[10px] text-muted-foreground">{currSym}</span>
                                        <input type="number" step="0.01" value={it.unit_price}
                                            onChange={e => setItemField(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                            className="flex-1 text-[12px] font-bold text-foreground bg-transparent outline-none text-right"
                                        />
                                    </div>
                                    <span className="text-[12px] font-black flex-shrink-0" style={{ color: ACCENT }}>
                                        {fmt(it.qty * it.unit_price)}
                                    </span>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={() => { haptic('light'); addItem(); }}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-bold active:opacity-70"
                            style={{ border: `1.5px dashed ${ACCENT}`, color: ACCENT, background: `${ACCENT}08` }}>
                            <Plus size={16} /> Add Item
                        </button>
                    </div>
                </div>

                {/* Totals */}
                <div className="mx-3 rounded-2xl p-4 space-y-2"
                    style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.5)' }}>
                    <div className="flex justify-between text-[12px]">
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Subtotal</span>
                        <span className="font-semibold text-foreground">{fmt(totals.sub)}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>{doc.tax_type === 'VAT' ? 'VAT (10%)' : 'Tax (0%)'}</span>
                        <span className="font-semibold text-foreground">{fmt(totals.vat)}</span>
                    </div>
                    <div className="flex justify-between pt-2" style={{ borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
                        <span className="text-[13px] font-bold text-foreground">Grand Total</span>
                        <span className="text-[15px] font-black" style={{ color: ACCENT }}>{fmt(totals.grand)}</span>
                    </div>
                </div>

                <MobileFormSection title="Shipping">
                    <MobileField label="Ship To" last={false}>
                        <MobileTextarea value={doc.ship_to_address} onChange={v => set('ship_to_address', v)} rows={2} />
                    </MobileField>
                    <MobileField label="Ordered By" last={false}>
                        <MobileInput value={doc.ordered_by_name} onChange={v => set('ordered_by_name', v)} />
                    </MobileField>
                    <MobileField label="Order Phone" last={true}>
                        <MobileInput value={doc.ordered_by_phone} onChange={v => set('ordered_by_phone', v)} />
                    </MobileField>
                </MobileFormSection>

                <MobileFormSection title="Preparation">
                    <MobileField label="Prepared By" last={false}>
                        <MobileInput value={doc.prepared_by} onChange={v => set('prepared_by', v)} />
                    </MobileField>
                    <MobileField label="Position" last={false}>
                        <MobileInput value={doc.prepared_by_position} onChange={v => set('prepared_by_position', v)} />
                    </MobileField>
                    <MobileField label="Approved By" last={false}>
                        <MobileInput value={doc.approved_by} onChange={v => set('approved_by', v)} />
                    </MobileField>
                    <MobileField label="App. Position" last={true}>
                        <MobileInput value={doc.approved_by_position} onChange={v => set('approved_by_position', v)} />
                    </MobileField>
                </MobileFormSection>

                <MobileFormSection title="Remarks">
                    <MobileField label="Remarks" last={true}>
                        <MobileTextarea value={doc.remarks} onChange={v => set('remarks', v)} rows={3} />
                    </MobileField>
                </MobileFormSection>
            </div>
        </div>
    );
}
