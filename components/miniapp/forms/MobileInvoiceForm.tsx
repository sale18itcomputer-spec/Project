'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Invoice, SaleOrder } from '@/types';
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

const ACCENT = '#a78bfa';
const STATUS_OPTIONS = ['Draft', 'Processing', 'Completed', 'Cancel'];
const TAXABLE_OPTIONS = ['VAT', 'NON-VAT', 'Commercial Invoice'];
const CURRENCY_OPTIONS = ['USD', 'KHR'];

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getNextInvNo = (taxable: string, allInvoices: Invoice[]) => {
    const year = new Date().getFullYear().toString();
    const prefix = taxable === 'VAT' ? `TI${year}-` : taxable === 'Commercial Invoice' ? `CI${year}-` : `INV${year}-`;
    const thisYear = allInvoices.filter(i => i['Inv No']?.startsWith(prefix));
    if (!thisYear.length) return `${prefix}00002`;
    const max = thisYear.reduce((m, i) => {
        const n = parseInt(i['Inv No'].slice(prefix.length), 10);
        return isNaN(n) ? m : Math.max(m, n);
    }, 1);
    return `${prefix}${String(max + 1).padStart(5, '0')}`;
};

interface Props {
    onBack: () => void;
    existingInvoice: Invoice | null;
    initialData?: { action?: string; soData?: SaleOrder };
}

export default function MobileInvoiceForm({ onBack, existingInvoice, initialData }: Props) {
    const { invoices, setInvoices, companies, contacts, saleOrders, refetchModule } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const [doc, setDoc] = useState<Partial<Invoice>>({});
    const [items, setItems] = useState<MiniLineItem[]>([
        { id: `i-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 },
    ]);

    const set = (k: string, v: any) => setDoc(p => {
        const upd = { ...p, [k]: v };
        // auto-update invoice number when taxable type changes
        if (k === 'Taxable' && !existingInvoice) {
            upd['Inv No'] = getNextInvNo(v, invoices ?? []);
        }
        return upd;
    });

    useEffect(() => {
        if (existingInvoice) {
            setDoc({
                ...existingInvoice,
                'Inv Date': existingInvoice['Inv Date'] ? formatToInputDate(existingInvoice['Inv Date']) : today(),
                'Due Date': existingInvoice['Due Date'] ? formatToInputDate(existingInvoice['Due Date']) : '',
            });
            try {
                const parsed = typeof existingInvoice.ItemsJSON === 'string'
                    ? JSON.parse(existingInvoice.ItemsJSON)
                    : existingInvoice.ItemsJSON;
                if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                    id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                    itemCode: it.itemCode || '', modelName: it.modelName || '',
                    description: it.description || '', qty: it.qty ?? 1,
                    unitPrice: it.unitPrice ?? 0, amount: it.amount ?? 0,
                })));
            } catch { }
        } else {
            const so = initialData?.soData;
            const initialTaxable = so?.['Bill Invoice'] || 'VAT';
            const co = so ? companies?.find(c => c['Company Name'] === so['Company Name']) : null;
            setDoc(p => p['Inv No'] ? p : {
                'Inv No': getNextInvNo(initialTaxable, invoices ?? []),
                'Inv Date': today(),
                'Status': 'Draft',
                'Currency': so?.Currency || 'USD',
                'Taxable': initialTaxable,
                'SO No': so?.['SO No'] || '',
                'Company Name': so?.['Company Name'] || '',
                'Contact Name': so?.['Contact Name'] || '',
                'Phone Number': so?.['Phone Number'] || '',
                'Email': so?.Email || '',
                'Company Address': co?.['Address (English)'] || '',
                'Tin No': co?.['Tin No'] || co?.['Patent'] || '',
                'Payment Term': so?.['Payment Term'] || '',
                'Prepared By': currentUser?.Name || '',
                'Prepared By Position': currentUser
                    ? [currentUser.Role, [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '), currentUser.Email].filter(Boolean).join(' | ')
                    : '',
            });
            // load SO items
            if (so?.ItemsJSON) {
                try {
                    const parsed = typeof so.ItemsJSON === 'string' ? JSON.parse(so.ItemsJSON) : so.ItemsJSON;
                    if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                        id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                        itemCode: it.itemCode || '', modelName: it.modelName || '',
                        description: it.description || '', qty: it.qty ?? 1,
                        unitPrice: it.unitPrice ?? 0, amount: it.amount ?? 0,
                    })));
                } catch { }
            }
        }
    }, [existingInvoice, initialData, invoices, companies, currentUser]);

    const totals = useMemo(() => {
        const sub = items.reduce((s, i) => s + (Number(i.qty) * Number(i.unitPrice)), 0);
        const tax = doc['Taxable'] === 'VAT' ? sub * 0.1 : 0;
        return { subTotal: sub, tax, grandTotal: sub + tax };
    }, [items, doc['Taxable']]);

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

    const handleSOSelect = useCallback((soNo: string) => {
        const so = saleOrders?.find(s => s['SO No'] === soNo);
        if (!so) { set('SO No', soNo); return; }
        const co = companies?.find(c => c['Company Name'] === so['Company Name']);
        setDoc(p => ({
            ...p,
            'SO No': soNo,
            'Company Name': so['Company Name'] || p['Company Name'],
            'Contact Name': so['Contact Name'] || p['Contact Name'],
            'Phone Number': so['Phone Number'] || p['Phone Number'],
            'Email': so.Email || p['Email'],
            'Taxable': so['Bill Invoice'] || 'NON-VAT',
            'Currency': so.Currency || 'USD',
            'Payment Term': so['Payment Term'] || p['Payment Term'],
            'Company Address': co?.['Address (English)'] || p['Company Address'],
        }));
        try {
            const parsed = typeof so.ItemsJSON === 'string' ? JSON.parse(so.ItemsJSON) : so.ItemsJSON;
            if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                itemCode: it.itemCode || '', modelName: it.modelName || '',
                description: it.description || '', qty: it.qty ?? 1,
                unitPrice: it.unitPrice ?? 0, amount: it.amount ?? 0,
            })));
        } catch { }
        addToast(`Loaded from SO ${soNo}`, 'success');
    }, [saleOrders, companies, addToast]);

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
        if (!doc['Inv No'] || !doc['Company Name']) {
            addToast('Please fill in Inv No. and Company Name', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                ...doc,
                'Inv Date': doc['Inv Date'] ? formatToSheetDate(doc['Inv Date']) : null,
                'Due Date': doc['Due Date'] ? formatToSheetDate(doc['Due Date']) : null,
                'Amount': totals.grandTotal,
                'ItemsJSON': items,
                'Created By': doc['Created By'] || currentUser?.Name || '',
            };
            if (existingInvoice) {
                await updateRecord('Invoices', existingInvoice['Inv No'], payload);
                setInvoices(cur => cur ? cur.map(i => i['Inv No'] === doc['Inv No'] ? payload as Invoice : i) : [payload as Invoice]);
            } else {
                await createRecord('Invoices', payload);
                setInvoices(cur => cur ? [payload as Invoice, ...cur] : [payload as Invoice]);
            }
            refetchModule('Invoices');
            addToast(`Invoice ${doc['Inv No']} saved!`, 'success');
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
    const soOptions = useMemo(() =>
        saleOrders ? saleOrders.map(s => s['SO No']).filter(Boolean).sort().reverse() : [],
        [saleOrders]
    );
    const currSym = doc['Currency'] === 'KHR' ? '៛' : '$';

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'hsl(var(--background))' }}>
            <MobileFormHeader
                title={existingInvoice ? `Edit ${doc['Inv No'] || ''}` : 'New Invoice'}
                subtitle={doc['Company Name'] || 'No company selected'}
                onBack={onBack}
                onSave={handleSave}
                isSaving={isSaving}
                accentColor={ACCENT}
            />

            <div className="flex-1 overflow-y-auto py-4 space-y-5 pb-10">

                <MobileFormSection title="Invoice Info">
                    <MobileField label="Inv No." last={false}>
                        <MobileInput value={doc['Inv No']} onChange={v => set('Inv No', v)} readOnly />
                    </MobileField>
                    <MobileField label="Invoice Date" last={false}>
                        <MobileInput type="date" value={doc['Inv Date']} onChange={v => set('Inv Date', v)} />
                    </MobileField>
                    <MobileField label="Due Date" last={false}>
                        <MobileInput type="date" value={doc['Due Date']} onChange={v => set('Due Date', v)} />
                    </MobileField>
                    <MobileField label="Status" last={false}>
                        <MobileSelect value={doc['Status']} onChange={v => set('Status', v)} options={STATUS_OPTIONS} placeholder="Status" />
                    </MobileField>
                    <MobileField label="Tax Type" last={false}>
                        <MobileSelect value={doc['Taxable']} onChange={v => set('Taxable', v)} options={TAXABLE_OPTIONS} placeholder="VAT" />
                    </MobileField>
                    <MobileField label="Currency" last={false}>
                        <MobileSelect value={doc['Currency']} onChange={v => set('Currency', v)} options={CURRENCY_OPTIONS} placeholder="USD" />
                    </MobileField>
                    <MobileField label="SO Reference" last={false}>
                        <MobileSearchSelect
                            value={doc['SO No'] || ''}
                            onChange={handleSOSelect}
                            options={soOptions}
                            placeholder="Link to sale order..."
                        />
                    </MobileField>
                    <MobileField label="Payment Term" last={true}>
                        <MobileInput value={doc['Payment Term']} onChange={v => set('Payment Term', v)} placeholder="e.g. Net 30" />
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
                    <MobileField label="TIN No." last={false}>
                        <MobileInput value={doc['Tin No']} onChange={v => set('Tin No', v)} placeholder="Tax ID" />
                    </MobileField>
                    <MobileField label="Address" last={true}>
                        <MobileTextarea value={doc['Company Address']} onChange={v => set('Company Address', v)} rows={2} />
                    </MobileField>
                </MobileFormSection>

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

                <MobileFormSection title="Additional">
                    <MobileField label="Deposit" last={false}>
                        <MobileInput type="number" value={doc['Deposit']} onChange={v => set('Deposit', v)} placeholder="0.00" />
                    </MobileField>
                    <MobileField label="Remark" last={true}>
                        <MobileTextarea value={doc['Remark']} onChange={v => set('Remark', v)} rows={3} />
                    </MobileField>
                </MobileFormSection>
            </div>
        </div>
    );
}
