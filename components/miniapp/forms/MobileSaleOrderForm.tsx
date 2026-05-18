'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { SaleOrder } from '@/types';
import { useData } from '@/contexts/MiniAppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createSaleOrderSheet } from '@/services/api';
import { formatToInputDate } from '@/utils/time';
import {
    MobileFormHeader, MobileFormSection, MobileField,
    MobileInput, MobileTextarea, MobileSelect, MobileSearchSelect,
    MobileLineItemCard, MobileAddItemBtn, MobileTotals, MiniLineItem,
} from './MobileFormBase';

const ACCENT = '#34d399';
const STATUS_OPTIONS = ['Pending', 'Completed', 'Cancel'];
const CURRENCY_OPTIONS = ['USD', 'KHR'];
const BILL_INVOICE_OPTIONS = ['VAT', 'NON-VAT'];

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Props {
    onBack: () => void;
    existingSaleOrder: SaleOrder | null;
    initialData?: Partial<SaleOrder>;
}

export default function MobileSaleOrderForm({ onBack, existingSaleOrder, initialData }: Props) {
    const { saleOrders, setSaleOrders, companies, contacts, quotations, refetchModule } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const nextSONo = useMemo(() => {
        if (!saleOrders?.length) return 'SO-0000001';
        const max = saleOrders.reduce((m, so) => {
            const n = parseInt((so['SO No'].match(/\d+$/) || ['0'])[0], 10);
            return isNaN(n) ? m : Math.max(m, n);
        }, 0);
        return `SO-${String(max + 1).padStart(7, '0')}`;
    }, [saleOrders]);

    const [doc, setDoc] = useState<Partial<SaleOrder>>({});
    const [items, setItems] = useState<MiniLineItem[]>([
        { id: `i-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 },
    ]);

    const set = (k: string, v: any) => setDoc(p => ({ ...p, [k]: v }));

    useEffect(() => {
        if (existingSaleOrder) {
            setDoc({
                ...existingSaleOrder,
                'SO Date': existingSaleOrder['SO Date'] ? formatToInputDate(existingSaleOrder['SO Date']) : today(),
                'Delivery Date': existingSaleOrder['Delivery Date'] ? formatToInputDate(existingSaleOrder['Delivery Date']) : today(),
            });
            try {
                const parsed = typeof existingSaleOrder.ItemsJSON === 'string'
                    ? JSON.parse(existingSaleOrder.ItemsJSON)
                    : existingSaleOrder.ItemsJSON;
                if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                    id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                    itemCode: it.itemCode || '', modelName: it.modelName || '',
                    description: it.description || '', qty: it.qty ?? 1,
                    unitPrice: it.unitPrice ?? 0, amount: it.amount ?? 0,
                })));
            } catch { }
        } else {
            setDoc(p => p['SO No'] ? p : {
                'SO No': nextSONo,
                'SO Date': today(),
                'Delivery Date': today(),
                'Status': 'Pending',
                'Currency': 'USD',
                'Bill Invoice': 'VAT',
                'Created By': currentUser?.Name || '',
                'Prepared By': currentUser?.Name || '',
                'Prepared By Position': currentUser
                    ? [currentUser.Role, [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '), currentUser.Email].filter(Boolean).join(' | ')
                    : '',
                'Approved By': '',
                'Approved By Position': '',
                ...initialData,
            });
        }
    }, [existingSaleOrder, nextSONo, currentUser, initialData]);

    const totals = useMemo(() => {
        const sub = items.reduce((s, i) => s + (Number(i.qty) * Number(i.unitPrice)), 0);
        const tax = doc['Bill Invoice'] === 'VAT' ? sub * 0.1 : 0;
        return { subTotal: sub, tax, grandTotal: sub + tax };
    }, [items, doc['Bill Invoice']]);

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
            'Payment Term': co?.['Payment Term'] || p['Payment Term'] || '',
        }));
    }, [companies, contacts]);

    // When quote is selected, auto-fill data
    const handleQuoteSelect = useCallback((quoteNo: string) => {
        const q = quotations?.find(x => x['Quote No'] === quoteNo);
        if (!q) { set('Quote No', quoteNo); return; }
        setDoc(p => ({
            ...p,
            'Quote No': quoteNo,
            'Company Name': q['Company Name'] || p['Company Name'],
            'Contact Name': q['Contact Name'] || p['Contact Name'],
            'Phone Number': q['Contact Number'] || p['Phone Number'],
            'Email': q['Contact Email'] || p['Email'],
            'Payment Term': q['Payment Term'] || p['Payment Term'],
            'Bill Invoice': q['Tax Type'] === 'VAT' ? 'VAT' : 'NON-VAT',
            'Currency': q.Currency || 'USD',
        }));
        try {
            const parsed = typeof q.ItemsJSON === 'string' ? JSON.parse(q.ItemsJSON) : q.ItemsJSON;
            if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                itemCode: it.itemCode || '', modelName: it.modelName || '',
                description: it.description || '', qty: it.qty ?? 1,
                unitPrice: it.unitPrice ?? 0, amount: it.amount ?? 0,
            })));
        } catch { }
        addToast(`Loaded items from ${quoteNo}`, 'success');
    }, [quotations, addToast]);

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

    const handleSave = async () => {
        if (!doc['SO No'] || !doc['Company Name']) {
            addToast('Please fill in SO No. and Company Name', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const masterData: SaleOrder = {
                'SO No': doc['SO No']!,
                'SO Date': doc['SO Date'] || null,
                'File': '',
                'Quote No': doc['Quote No'] || '',
                'Company Name': doc['Company Name'] || '',
                'Contact Name': doc['Contact Name'] || '',
                'Phone Number': doc['Phone Number'] || '',
                'Email': doc['Email'] || '',
                'Tax': String(totals.tax),
                'Total Amount': String(totals.grandTotal),
                'Commission': '0',
                'Status': doc['Status'] || 'Pending',
                'Delivery Date': doc['Delivery Date'] || '',
                'Payment Term': doc['Payment Term'] || '',
                'Bill Invoice': doc['Bill Invoice'] as any || 'VAT',
                'Install Software': doc['Install Software'] || '',
                'Currency': doc['Currency'] || 'USD',
                'Created By': doc['Created By'] || currentUser?.Name || '',
                'Attachment': doc['Attachment'] || '',
                'Company Address': doc['Company Address'] || '',
                'Prepared By': doc['Prepared By'] || '',
                'Approved By': doc['Approved By'] || '',
                'Prepared By Position': doc['Prepared By Position'] || '',
                'Approved By Position': doc['Approved By Position'] || '',
                'Remark': doc['Remark'] || '',
                'Terms and Conditions': doc['Terms and Conditions'] || '',
            };
            const payload = { ...masterData, ItemsJSON: items };
            await createSaleOrderSheet(masterData['SO No'], payload);
            if (existingSaleOrder) {
                setSaleOrders(cur => cur ? cur.map(so => so['SO No'] === masterData['SO No'] ? masterData : so) : [masterData]);
            } else {
                setSaleOrders(cur => cur ? [masterData, ...cur] : [masterData]);
            }
            refetchModule('Sale Orders');
            addToast(`Sale Order ${masterData['SO No']} saved!`, 'success');
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
    const quoteOptions = useMemo(() =>
        quotations ? quotations.map(q => q['Quote No']).filter(Boolean).sort().reverse() : [],
        [quotations]
    );
    const currSym = doc['Currency'] === 'KHR' ? '៛' : '$';

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'hsl(var(--background))' }}>
            <MobileFormHeader
                title={existingSaleOrder ? `Edit ${doc['SO No'] || ''}` : 'New Sale Order'}
                subtitle={doc['Company Name'] || 'No company selected'}
                onBack={onBack}
                onSave={handleSave}
                isSaving={isSaving}
                saveLabel="Save"
                accentColor={ACCENT}
            />

            <div className="flex-1 overflow-y-auto py-4 space-y-5 pb-10">

                <MobileFormSection title="Sale Order Info">
                    <MobileField label="SO No." last={false}>
                        <MobileInput value={doc['SO No']} onChange={v => set('SO No', v)} readOnly />
                    </MobileField>
                    <MobileField label="SO Date" last={false}>
                        <MobileInput type="date" value={doc['SO Date']} onChange={v => set('SO Date', v)} />
                    </MobileField>
                    <MobileField label="Delivery Date" last={false}>
                        <MobileInput type="date" value={doc['Delivery Date']} onChange={v => set('Delivery Date', v)} />
                    </MobileField>
                    <MobileField label="Status" last={false}>
                        <MobileSelect value={doc['Status']} onChange={v => set('Status', v)} options={STATUS_OPTIONS} placeholder="Status" />
                    </MobileField>
                    <MobileField label="Currency" last={false}>
                        <MobileSelect value={doc['Currency']} onChange={v => set('Currency', v)} options={CURRENCY_OPTIONS} placeholder="USD" />
                    </MobileField>
                    <MobileField label="Tax Type" last={false}>
                        <MobileSelect value={doc['Bill Invoice']} onChange={v => set('Bill Invoice', v)} options={BILL_INVOICE_OPTIONS} placeholder="VAT" />
                    </MobileField>
                    <MobileField label="Payment Term" last={false}>
                        <MobileInput value={doc['Payment Term']} onChange={v => set('Payment Term', v)} placeholder="e.g. Net 30" />
                    </MobileField>
                    <MobileField label="Quote Ref" last={true}>
                        <MobileSearchSelect
                            value={doc['Quote No'] || ''}
                            onChange={handleQuoteSelect}
                            options={quoteOptions}
                            placeholder="Link to quotation..."
                        />
                    </MobileField>
                </MobileFormSection>

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
                    <MobileField label="Address" last={true}>
                        <MobileTextarea value={doc['Company Address']} onChange={v => set('Company Address', v)} rows={2} />
                    </MobileField>
                </MobileFormSection>

                {/* Items */}
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest px-4 mb-2"
                        style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}>Line Items</p>
                    <div className="px-3">
                        {items.map(it => (
                            <MobileLineItemCard
                                key={it.id} item={it}
                                onChange={handleItemChange} onRemove={removeItem}
                                accentColor={ACCENT} currency={currSym}
                            />
                        ))}
                        <MobileAddItemBtn onAdd={addItem} accentColor={ACCENT} />
                    </div>
                </div>

                <MobileTotals subTotal={totals.subTotal} tax={totals.tax} grandTotal={totals.grandTotal} currency={currSym} accentColor={ACCENT} />

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
