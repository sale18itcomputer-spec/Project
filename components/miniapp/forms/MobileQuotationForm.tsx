'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Quotation } from '@/types';
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

const ACCENT = '#38bdf8';
const STATUS_OPTIONS = ['Open', 'Close (Win)', 'Close (Lose)', 'Cancel'];
const CURRENCY_OPTIONS = ['USD', 'KHR'];
const TAX_OPTIONS = ['VAT', 'NON-VAT'];

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Props {
    onBack: () => void;
    existingQuotation: Quotation | null;
    initialData?: Partial<Quotation>;
}

export default function MobileQuotationForm({ onBack, existingQuotation, initialData }: Props) {
    const { quotations, setQuotations, companies, contacts, pricelist, refetchModule } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    // ── auto quote number ────────────────────────────────────────────────────
    const nextQuoteNo = useMemo(() => {
        const year = new Date().getFullYear().toString();
        const prefix = `QT${year}-`;
        const list = (quotations ?? []).filter(q => q['Quote No']?.startsWith(prefix));
        if (!list.length) return `${prefix}00002`;
        const max = list.reduce((m, q) => {
            const n = parseInt(q['Quote No'].slice(prefix.length), 10);
            return isNaN(n) ? m : Math.max(m, n);
        }, 1);
        return `${prefix}${String(max + 1).padStart(5, '0')}`;
    }, [quotations]);

    // ── form state ───────────────────────────────────────────────────────────
    const [doc, setDoc] = useState<Partial<Quotation>>({});
    const [items, setItems] = useState<MiniLineItem[]>([
        { id: `i-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 },
    ]);

    const set = (k: string, v: any) => setDoc(p => ({ ...p, [k]: v }));

    // ── init ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (existingQuotation) {
            setDoc({
                ...existingQuotation,
                'Quote Date': existingQuotation['Quote Date'] ? formatToInputDate(existingQuotation['Quote Date']) : today(),
                'Validity Date': existingQuotation['Validity Date'] ? formatToInputDate(existingQuotation['Validity Date']) : '',
            });
            try {
                const parsed = typeof existingQuotation.ItemsJSON === 'string'
                    ? JSON.parse(existingQuotation.ItemsJSON)
                    : existingQuotation.ItemsJSON;
                if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                    id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                    itemCode: it.itemCode || '', modelName: it.modelName || '',
                    description: it.description || '', qty: it.qty ?? 1,
                    unitPrice: it.unitPrice ?? 0, amount: it.amount ?? 0,
                })));
            } catch { }
        } else {
            setDoc(p => p['Quote No'] ? p : {
                'Quote No': nextQuoteNo,
                'Quote Date': today(),
                'Status': 'Open',
                'Currency': 'USD',
                'Tax Type': 'VAT',
                'Prepared By': currentUser?.Name || '',
                'Prepared By Position': currentUser
                    ? [currentUser.Role, [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '), currentUser.Email].filter(Boolean).join(' | ')
                    : '',
                'Approved By': '',
                'Approved By Position': '',
                ...initialData,
            });
        }
    }, [existingQuotation, nextQuoteNo, currentUser, initialData]);

    // ── totals ───────────────────────────────────────────────────────────────
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
            'Contact Number': co?.['Phone Number'] || ct?.['Tel (1)'] || p['Contact Number'] || '',
            'Contact Email': co?.Email || ct?.Email || p['Contact Email'] || '',
            'Company Address': co?.['Address (English)'] || p['Company Address'] || '',
            'Payment Term': co?.['Payment Term'] || p['Payment Term'] || '',
        }));
    }, [companies, contacts]);

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

    // ── save ─────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!doc['Quote No'] || !doc['Company Name']) {
            addToast('Please fill in Quote No. and Company Name', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                ...doc,
                'Quote Date': doc['Quote Date'] ? formatToSheetDate(doc['Quote Date']) : null,
                'Validity Date': doc['Validity Date'] ? formatToSheetDate(doc['Validity Date']) : null,
                'Amount': totals.grandTotal,
                'ItemsJSON': items,
                'Created By': doc['Created By'] || currentUser?.Name || '',
            };
            if (existingQuotation) {
                await updateRecord('Quotations', existingQuotation['Quote No'], payload);
                setQuotations(cur => cur ? cur.map(q => q['Quote No'] === doc['Quote No'] ? payload as Quotation : q) : [payload as Quotation]);
            } else {
                await createRecord('Quotations', payload);
                setQuotations(cur => cur ? [payload as Quotation, ...cur] : [payload as Quotation]);
            }
            refetchModule('Quotations');
            addToast(`Quotation ${doc['Quote No']} saved!`, 'success');
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
    const currSym = doc['Currency'] === 'KHR' ? '៛' : '$';

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'hsl(var(--background))' }}>
            <MobileFormHeader
                title={existingQuotation ? `Edit ${doc['Quote No'] || ''}` : 'New Quotation'}
                subtitle={doc['Company Name'] || 'No company selected'}
                onBack={onBack}
                onSave={handleSave}
                isSaving={isSaving}
                saveLabel="Save"
                accentColor={ACCENT}
            />

            <div className="flex-1 overflow-y-auto py-4 space-y-5 pb-10">

                {/* ─ Header ─ */}
                <MobileFormSection title="Quotation Info">
                    <MobileField label="Quote No." last={false}>
                        <MobileInput value={doc['Quote No']} onChange={v => set('Quote No', v)} placeholder="Auto-generated" readOnly />
                    </MobileField>
                    <MobileField label="Quote Date" last={false}>
                        <MobileInput type="date" value={doc['Quote Date']} onChange={v => set('Quote Date', v)} />
                    </MobileField>
                    <MobileField label="Valid Until" last={false}>
                        <MobileInput type="date" value={doc['Validity Date']} onChange={v => set('Validity Date', v)} />
                    </MobileField>
                    <MobileField label="Status" last={false}>
                        <MobileSelect value={doc['Status']} onChange={v => set('Status', v)} options={STATUS_OPTIONS} placeholder="Select status" />
                    </MobileField>
                    <MobileField label="Currency" last={false}>
                        <MobileSelect value={doc['Currency']} onChange={v => set('Currency', v)} options={CURRENCY_OPTIONS} placeholder="USD" />
                    </MobileField>
                    <MobileField label="Tax Type" last={true}>
                        <MobileSelect value={doc['Tax Type']} onChange={v => set('Tax Type', v)} options={TAX_OPTIONS} placeholder="VAT" />
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
                        <MobileInput value={doc['Contact Number']} onChange={v => set('Contact Number', v)} placeholder="Phone number" />
                    </MobileField>
                    <MobileField label="Email" last={false}>
                        <MobileInput type="email" value={doc['Contact Email']} onChange={v => set('Contact Email', v)} placeholder="Email" />
                    </MobileField>
                    <MobileField label="Payment Term" last={false}>
                        <MobileInput value={doc['Payment Term']} onChange={v => set('Payment Term', v)} placeholder="e.g. Net 30" />
                    </MobileField>
                    <MobileField label="Address" last={true}>
                        <MobileTextarea value={doc['Company Address']} onChange={v => set('Company Address', v)} placeholder="Company address" rows={2} />
                    </MobileField>
                </MobileFormSection>

                {/* ─ Items ─ */}
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest px-4 mb-2"
                        style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}>
                        Line Items
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

                {/* ─ Totals ─ */}
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
                        <MobileInput value={doc['Prepared By']} onChange={v => set('Prepared By', v)} placeholder="Name" />
                    </MobileField>
                    <MobileField label="Position" last={false}>
                        <MobileInput value={doc['Prepared By Position']} onChange={v => set('Prepared By Position', v)} placeholder="Title / Phone" />
                    </MobileField>
                    <MobileField label="Approved By" last={false}>
                        <MobileInput value={doc['Approved By']} onChange={v => set('Approved By', v)} placeholder="Name" />
                    </MobileField>
                    <MobileField label="App. Position" last={true}>
                        <MobileInput value={doc['Approved By Position']} onChange={v => set('Approved By Position', v)} placeholder="Title / Phone" />
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
