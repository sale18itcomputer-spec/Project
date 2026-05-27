'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Receipt, Invoice, DeliveryOrder, SaleOrder } from '@/types';
import { useData } from '@/contexts/MiniAppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createRecord, updateRecord } from '@/services/api';
import { formatToSheetDate, formatToInputDate } from '@/utils/time';
import {
    MobileFormHeader, MobileFormSection, MobileField,
    MobileInput, MobileTextarea, MobileSelect, MobileSearchSelect,
    MobileLineItemCard, MobileAddItemBtn, MobileTotals, MiniLineItem,
} from './MobileFormBase';

const ACCENT = '#f472b6';
const STATUS_OPTIONS: Receipt['Status'][] = ['Draft', 'Issued', 'Cancelled'];
const CURRENCY_OPTIONS = ['USD', 'KHR'];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'ABA', 'KHQR', 'Other'];
const TAX_TYPE_OPTIONS = ['VAT', 'NON-VAT'];

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Props {
    onBack: () => void;
    existingReceipt?: Receipt | null;
    initialData?: {
        action?: string;
        invoiceData?: Invoice;
        doData?: DeliveryOrder;
        soData?: SaleOrder;
    };
}

export default function MobileReceiptForm({ onBack, existingReceipt, initialData }: Props) {
    const { receipts, setReceipts, invoices, deliveryOrders, saleOrders, companies, contacts, refetchModule } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const nextRVNo = useMemo(() => {
        const year = new Date().getFullYear().toString();
        const prefix = `OR${year}-`;
        const list = (receipts ?? []).filter(r => r['RV No']?.startsWith(prefix));
        if (!list.length) return `${prefix}00002`;
        const max = list.reduce((m, r) => {
            const n = parseInt(r['RV No'].slice(prefix.length), 10);
            return isNaN(n) ? m : Math.max(m, n);
        }, 1);
        return `${prefix}${String(max + 1).padStart(5, '0')}`;
    }, [receipts]);

    const [doc, setDoc] = useState<Partial<Receipt>>({});
    const [items, setItems] = useState<MiniLineItem[]>([
        { id: `i-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 },
    ]);

    const set = (k: string, v: any) => setDoc(p => ({ ...p, [k]: v }));

    // ── init ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (existingReceipt) {
            setDoc({
                ...existingReceipt,
                'RV Date': existingReceipt['RV Date'] ? formatToInputDate(existingReceipt['RV Date']) : today(),
            });
            try {
                const parsed = typeof existingReceipt.ItemsJSON === 'string'
                    ? JSON.parse(existingReceipt.ItemsJSON) : existingReceipt.ItemsJSON;
                if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                    id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                    itemCode: it.itemCode || '', modelName: it.modelName || '',
                    description: it.description || '', qty: it.qty ?? 1,
                    unitPrice: it.unitPrice ?? 0, amount: it.amount ?? 0,
                })));
            } catch { }
        } else {
            // auto-fill from linked document
            const source: any = initialData?.invoiceData || initialData?.doData || initialData?.soData;
            const co = source ? companies?.find(c => c['Company Name'] === source['Company Name']) : null;
            setDoc(p => p['RV No'] ? p : {
                'RV No': nextRVNo,
                'RV Date': today(),
                'Status': 'Draft',
                'Currency': source?.Currency || 'USD',
                'Tax Type': 'NON-VAT',
                'Payment Method': 'Cash',
                'Inv No': (initialData?.invoiceData as any)?.['Inv No'] || '',
                'DO No': (initialData?.doData as any)?.['DO No'] || '',
                'SO No': source?.['SO No'] || '',
                'Company Name': source?.['Company Name'] || '',
                'Contact Name': source?.['Contact Name'] || '',
                'Phone Number': source?.['Phone Number'] || '',
                'Email': (source as any)?.Email || '',
                'Company Address': co?.['Address (English)'] || source?.['Company Address'] || '',
                'Tin No': co?.['Tin No'] || co?.['Patent'] || '',
                'Payment Term': source?.['Payment Term'] || '',
                'Created By': currentUser?.Name || '',
                'Prepared By': currentUser?.Name || '',
                'Prepared By Position': currentUser
                    ? [currentUser.Role, [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '), currentUser.Email].filter(Boolean).join(' | ')
                    : '',
                'Approved By': '',
                'Approved By Position': '',
            });
            // load items from source
            if (source?.ItemsJSON) {
                try {
                    const parsed = typeof source.ItemsJSON === 'string' ? JSON.parse(source.ItemsJSON) : source.ItemsJSON;
                    if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                        id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                        itemCode: it.itemCode || '', modelName: it.modelName || '',
                        description: it.description || '', qty: it.qty ?? 1,
                        unitPrice: it.unitPrice ?? 0, amount: it.amount ?? 0,
                    })));
                } catch { }
            }
        }
    }, [existingReceipt, initialData, nextRVNo, companies, currentUser]);

    const totals = useMemo(() => {
        const sub = items.reduce((s, i) => s + (Number(i.qty) * Number(i.unitPrice)), 0);
        const tax = doc['Tax Type'] === 'VAT' ? sub * 0.1 : 0;
        return { subTotal: sub, tax, grandTotal: sub + tax };
    }, [items, doc['Tax Type']]);

    // ── company auto-fill ─────────────────────────────────────────────────────
    const handleCompanySelect = useCallback((name: string) => {
        const co = companies?.find(c => c['Company Name'] === name);
        const ct = contacts?.find(c => c['Company Name'] === name);
        setDoc(p => ({
            ...p,
            'Company Name': name,
            'Contact Name': ct?.Name || p['Contact Name'] || '',
            'Phone Number': co?.['Phone Number'] || ct?.['Tel (1)'] || p['Phone Number'] || '',
            'Email': co?.Email || ct?.Email || p['Email'] || '',
            'Company Address': co?.['Address (English)'] || p['Company Address'] || '',
            'Tin No': co?.['Tin No'] || co?.['Patent'] || p['Tin No'] || '',
            'Payment Term': co?.['Payment Term'] || p['Payment Term'] || '',
        }));
    }, [companies, contacts]);

    // ── invoice auto-fill ──────────────────────────────────────────────────────
    const handleInvSelect = useCallback((invNo: string) => {
        const inv = invoices?.find(i => i['Inv No'] === invNo);
        if (!inv) { set('Inv No', invNo); return; }
        const co = companies?.find(c => c['Company Name'] === inv['Company Name']);
        setDoc(p => ({
            ...p,
            'Inv No': invNo,
            'SO No': inv['SO No'] || p['SO No'],
            'Company Name': inv['Company Name'] || p['Company Name'],
            'Contact Name': inv['Contact Name'] || p['Contact Name'],
            'Phone Number': inv['Phone Number'] || p['Phone Number'],
            'Email': inv.Email || p['Email'],
            'Company Address': co?.['Address (English)'] || p['Company Address'],
            'Tin No': co?.['Tin No'] || co?.['Patent'] || p['Tin No'],
            'Payment Term': inv['Payment Term'] || p['Payment Term'],
            'Currency': inv.Currency || p['Currency'] || 'USD',
            'Tax Type': inv.Taxable === 'VAT' ? 'VAT' : 'NON-VAT',
        }));
        // pre-fill amount from invoice
        const invAmount = parseFloat(String(inv['Amount'] ?? inv['Total Amount'] ?? '0')) || 0;
        if (invAmount > 0) {
            setItems([{ id: `i-${Date.now()}`, no: 1, itemCode: '', modelName: 'Payment for Invoice ' + invNo, description: '', qty: 1, unitPrice: invAmount, amount: invAmount }]);
        } else if (inv.ItemsJSON) {
            try {
                const parsed = typeof inv.ItemsJSON === 'string' ? JSON.parse(inv.ItemsJSON) : inv.ItemsJSON;
                if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                    id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                    itemCode: it.itemCode || '', modelName: it.modelName || '',
                    description: it.description || '', qty: it.qty ?? 1,
                    unitPrice: it.unitPrice ?? 0, amount: it.amount ?? 0,
                })));
            } catch { }
        }
        addToast(`Loaded from Invoice ${invNo}`, 'success');
    }, [invoices, companies, addToast]);

    // ── items ─────────────────────────────────────────────────────────────────
    const handleItemChange = (id: string, field: keyof MiniLineItem, value: any) => {
        setItems(prev => prev.map(it => {
            if (it.id !== id) return it;
            const upd = { ...it, [field]: value };
            upd.amount = (Number(upd.qty) || 0) * (Number(upd.unitPrice) || 0);
            return upd;
        }));
    };
    const addItem = () => {
        const no = items.length ? Math.max(...items.map(i => i.no)) + 1 : 1;
        setItems(p => [...p, { id: `i-${Date.now()}`, no, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]);
    };
    const removeItem = (id: string) => {
        if (items.length === 1) return;
        setItems(p => p.filter(i => i.id !== id).map((it, idx) => ({ ...it, no: idx + 1 })));
    };

    // ── save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!doc['RV No'] || !doc['Company Name']) {
            addToast('Please fill in RV No. and Company Name', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                ...doc,
                'RV Date': doc['RV Date'] ? formatToSheetDate(doc['RV Date']) : null,
                'Amount': totals.grandTotal,
                'ItemsJSON': items,
                'Created By': doc['Created By'] || currentUser?.Name || '',
                updated_at: new Date().toISOString(),
            };
            if (existingReceipt) {
                await updateRecord('Receipts', existingReceipt['RV No'], payload);
                setReceipts(cur => cur ? cur.map(r => r['RV No'] === doc['RV No'] ? payload as Receipt : r) : [payload as Receipt]);
            } else {
                await createRecord('Receipts', payload);
                setReceipts(cur => cur ? [payload as Receipt, ...cur] : [payload as Receipt]);
            }
            refetchModule('Receipts');
            addToast(`Receipt ${doc['RV No']} saved!`, 'success');
            onBack();
        } catch (err: any) {
            addToast(err.message || 'Failed to save', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const companyOptions = useMemo(() =>
        companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() as string[] : [],
        [companies]
    );
    const invOptions = useMemo(() =>
        invoices ? invoices.map(i => i['Inv No']).filter(Boolean).sort().reverse() : [],
        [invoices]
    );
    const currSym = doc['Currency'] === 'KHR' ? '៛' : '$';

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'hsl(var(--background))' }}>
            <MobileFormHeader
                title={existingReceipt ? `Edit ${doc['RV No'] || ''}` : 'New Receipt'}
                subtitle={doc['Company Name'] || 'No company selected'}
                onBack={onBack}
                onSave={handleSave}
                isSaving={isSaving}
                accentColor={ACCENT}
            />

            <div className="flex-1 overflow-y-auto py-4 space-y-5 pb-10">

                {/* ─ Receipt Info ─ */}
                <MobileFormSection title="Receipt Info">
                    <MobileField label="RV No." last={false}>
                        <MobileInput value={doc['RV No']} onChange={v => set('RV No', v)} readOnly />
                    </MobileField>
                    <MobileField label="Receipt Date" last={false}>
                        <MobileInput type="date" value={doc['RV Date']} onChange={v => set('RV Date', v)} />
                    </MobileField>
                    <MobileField label="Status" last={false}>
                        <MobileSelect value={doc['Status']} onChange={v => set('Status', v)} options={STATUS_OPTIONS} placeholder="Status" />
                    </MobileField>
                    <MobileField label="Currency" last={false}>
                        <MobileSelect value={doc['Currency']} onChange={v => set('Currency', v)} options={CURRENCY_OPTIONS} placeholder="USD" />
                    </MobileField>
                    <MobileField label="Tax Type" last={false}>
                        <MobileSelect value={doc['Tax Type']} onChange={v => set('Tax Type', v)} options={TAX_TYPE_OPTIONS} placeholder="NON-VAT" />
                    </MobileField>
                    <MobileField label="Payment Method" last={false}>
                        <MobileSelect value={doc['Payment Method']} onChange={v => set('Payment Method', v)} options={PAYMENT_METHODS} placeholder="Cash" />
                    </MobileField>
                    <MobileField label="Invoice Ref" last={false}>
                        <MobileSearchSelect
                            value={doc['Inv No'] || ''}
                            onChange={handleInvSelect}
                            options={invOptions}
                            placeholder="Link to invoice..."
                        />
                    </MobileField>
                    <MobileField label="SO Reference" last={false}>
                        <MobileInput value={doc['SO No']} onChange={v => set('SO No', v)} placeholder="SO No." />
                    </MobileField>
                    <MobileField label="DO Reference" last={false}>
                        <MobileInput value={doc['DO No']} onChange={v => set('DO No', v)} placeholder="DO No." />
                    </MobileField>
                    <MobileField label="Payment Term" last={true}>
                        <MobileInput value={doc['Payment Term']} onChange={v => set('Payment Term', v)} placeholder="e.g. Net 30" />
                    </MobileField>
                </MobileFormSection>

                {/* ─ Customer ─ */}
                <MobileFormSection title="Customer">
                    <MobileField label="Company" last={false}>
                        <MobileSearchSelect
                            value={doc['Company Name'] || ''}
                            onChange={handleCompanySelect}
                            options={companyOptions}
                            placeholder="Select company..."
                        />
                    </MobileField>
                    <MobileField label="Contact" last={false}>
                        <MobileInput value={doc['Contact Name']} onChange={v => set('Contact Name', v)} placeholder="Contact name" />
                    </MobileField>
                    <MobileField label="Phone" last={false}>
                        <MobileInput value={doc['Phone Number']} onChange={v => set('Phone Number', v)} placeholder="Phone" />
                    </MobileField>
                    <MobileField label="Email" last={false}>
                        <MobileInput type="email" value={doc['Email']} onChange={v => set('Email', v)} placeholder="Email" />
                    </MobileField>
                    <MobileField label="TIN No." last={false}>
                        <MobileInput value={doc['Tin No']} onChange={v => set('Tin No', v)} placeholder="Tax ID" />
                    </MobileField>
                    <MobileField label="Address" last={true}>
                        <MobileTextarea value={doc['Company Address']} onChange={v => set('Company Address', v)} rows={2} />
                    </MobileField>
                </MobileFormSection>

                {/* ─ Items ─ */}
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest px-4 mb-2"
                        style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}>
                        Items / Payment Details
                    </p>
                    <div className="px-3">
                        {items.map(it => (
                            <MobileLineItemCard
                                key={it.id}
                                item={it}
                                onChange={handleItemChange}
                                onRemove={removeItem}
                                accentColor={ACCENT}
                                currency={currSym}
                            />
                        ))}
                        <MobileAddItemBtn onAdd={addItem} accentColor={ACCENT} />
                    </div>
                </div>

                <MobileTotals
                    subTotal={totals.subTotal}
                    tax={totals.tax}
                    grandTotal={totals.grandTotal}
                    currency={currSym}
                    accentColor={ACCENT}
                />

                {/* ─ Signatures ─ */}
                <MobileFormSection title="Preparation">
                    <MobileField label="Prepared By" last={false}>
                        <MobileInput value={doc['Prepared By']} onChange={v => set('Prepared By', v)} />
                    </MobileField>
                    <MobileField label="Position" last={false}>
                        <MobileInput value={doc['Prepared By Position']} onChange={v => set('Prepared By Position', v)} />
                    </MobileField>
                    <MobileField label="Approved By" last={false}>
                        <MobileInput value={doc['Approved By']} onChange={v => set('Approved By', v)} />
                    </MobileField>
                    <MobileField label="App. Position" last={true}>
                        <MobileInput value={doc['Approved By Position']} onChange={v => set('Approved By Position', v)} />
                    </MobileField>
                </MobileFormSection>

                {/* ─ Remarks ─ */}
                <MobileFormSection title="Remarks">
                    <MobileField label="Remark" last={false}>
                        <MobileTextarea value={doc['Remark']} onChange={v => set('Remark', v)} rows={3} />
                    </MobileField>
                    <MobileField label="Terms" last={true}>
                        <MobileTextarea value={doc['Terms and Conditions']} onChange={v => set('Terms and Conditions', v)} rows={3} />
                    </MobileField>
                </MobileFormSection>

            </div>
        </div>
    );
}
