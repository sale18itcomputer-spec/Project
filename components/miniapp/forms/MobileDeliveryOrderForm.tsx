'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DeliveryOrder, Invoice, SaleOrder } from '@/types';
import { useData } from '@/contexts/MiniAppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createRecord, updateRecord } from '@/services/api';
import { formatToSheetDate, formatToInputDate } from '@/utils/time';
import { Trash2, Plus } from 'lucide-react';
import { haptic } from '@/lib/miniapp/telegramShare';
import {
    MobileFormHeader, MobileFormSection, MobileField,
    MobileInput, MobileTextarea, MobileSelect, MobileSearchSelect,
} from './MobileFormBase';

const ACCENT = '#fb923c';
const STATUS_OPTIONS = ['Pending', 'Delivered', 'Cancelled'];
const CURRENCY_OPTIONS = ['USD', 'KHR'];

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface DOLineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName: string;
    description: string;
    qty: number | string;
    serialNumber?: string;
}

interface Props {
    onBack: () => void;
    existingDO?: DeliveryOrder | null;
    initialData?: { action?: string; invoiceData?: Invoice; soData?: SaleOrder };
}

export default function MobileDeliveryOrderForm({ onBack, existingDO, initialData }: Props) {
    const { deliveryOrders, setDeliveryOrders, invoices, saleOrders, companies, contacts, refetchModule } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const nextDONo = useMemo(() => {
        const year = new Date().getFullYear().toString();
        const prefix = `DN${year}-`;
        const list = (deliveryOrders ?? []).filter(d => d['DO No']?.startsWith(prefix));
        if (!list.length) return `${prefix}00002`;
        const max = list.reduce((m, d) => {
            const n = parseInt(d['DO No'].slice(prefix.length), 10);
            return isNaN(n) ? m : Math.max(m, n);
        }, 1);
        return `${prefix}${String(max + 1).padStart(5, '0')}`;
    }, [deliveryOrders]);

    const [doc, setDoc] = useState<Partial<DeliveryOrder>>({});
    const [items, setItems] = useState<DOLineItem[]>([
        { id: `i-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1 },
    ]);

    const set = (k: string, v: any) => setDoc(p => ({ ...p, [k]: v }));

    useEffect(() => {
        if (existingDO) {
            setDoc({
                ...existingDO,
                'DO Date': existingDO['DO Date'] ? formatToInputDate(existingDO['DO Date']) : today(),
            });
            try {
                const parsed = typeof existingDO.ItemsJSON === 'string'
                    ? JSON.parse(existingDO.ItemsJSON) : existingDO.ItemsJSON;
                if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                    id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                    itemCode: it.itemCode || '', modelName: it.modelName || '',
                    description: it.description || '', qty: it.qty ?? 1,
                    serialNumber: it.serialNumber || '',
                })));
            } catch { }
        } else {
            const inv = initialData?.invoiceData;
            const so = initialData?.soData;
            const source: any = inv || so;
            const co = source ? companies?.find(c => c['Company Name'] === source['Company Name']) : null;
            setDoc(p => p['DO No'] ? p : {
                'DO No': nextDONo,
                'DO Date': today(),
                'Status': 'Pending',
                'Currency': source?.Currency || 'USD',
                'Inv No': inv?.['Inv No'] || '',
                'SO No': inv?.['SO No'] || so?.['SO No'] || '',
                'Company Name': source?.['Company Name'] || '',
                'Contact Name': source?.['Contact Name'] || '',
                'Phone Number': source?.['Phone Number'] || '',
                'Email': (source as any)?.Email || '',
                'Company Address': co?.['Address (English)'] || source?.['Company Address'] || '',
                'Payment Term': source?.['Payment Term'] || '',
                'Created By': currentUser?.Name || '',
                'Prepared By': currentUser?.Name || '',
                'Prepared By Position': currentUser
                    ? [currentUser.Role, [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '), currentUser.Email].filter(Boolean).join(' | ')
                    : '',
                'Approved By': '',
                'Approved By Position': '',
            });
            // auto-load items from source
            if (source?.ItemsJSON) {
                try {
                    const parsed = typeof source.ItemsJSON === 'string' ? JSON.parse(source.ItemsJSON) : source.ItemsJSON;
                    if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                        id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                        itemCode: it.itemCode || '', modelName: it.modelName || '',
                        description: it.description || '', qty: it.qty ?? 1,
                        serialNumber: '',
                    })));
                } catch { }
            }
        }
    }, [existingDO, initialData, nextDONo, companies, currentUser]);

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
        }));
    }, [companies, contacts]);

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
            'Company Address': co?.['Address (English)'] || p['Company Address'],
        }));
        try {
            const parsed = typeof inv.ItemsJSON === 'string' ? JSON.parse(inv.ItemsJSON) : inv.ItemsJSON;
            if (Array.isArray(parsed) && parsed.length) setItems(parsed.map((it: any, i: number) => ({
                id: it.id || `i-${Date.now()}-${i}`, no: it.no ?? i + 1,
                itemCode: it.itemCode || '', modelName: it.modelName || '',
                description: it.description || '', qty: it.qty ?? 1, serialNumber: '',
            })));
        } catch { }
        addToast(`Loaded from Invoice ${invNo}`, 'success');
    }, [invoices, companies, addToast]);

    const addItem = () => {
        const no = items.length ? Math.max(...items.map(i => i.no)) + 1 : 1;
        setItems(p => [...p, { id: `i-${Date.now()}`, no, itemCode: '', modelName: '', description: '', qty: 1 }]);
    };
    const removeItem = (id: string) => {
        if (items.length === 1) return;
        setItems(p => p.filter(i => i.id !== id).map((it, idx) => ({ ...it, no: idx + 1 })));
    };
    const setItemField = (id: string, k: keyof DOLineItem, v: any) => setItems(p => p.map(it => it.id === id ? { ...it, [k]: v } : it));

    const handleSave = async () => {
        if (!doc['DO No'] || !doc['Company Name']) {
            addToast('Please fill in DO No. and Company Name', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                ...doc,
                'DO Date': doc['DO Date'] ? formatToSheetDate(doc['DO Date']) : null,
                'ItemsJSON': items,
                'Created By': doc['Created By'] || currentUser?.Name || '',
                updated_at: new Date().toISOString(),
            };
            if (existingDO) {
                await updateRecord('Delivery Orders', existingDO['DO No'], payload);
                setDeliveryOrders(cur => cur ? cur.map(d => d['DO No'] === doc['DO No'] ? payload as DeliveryOrder : d) : [payload as DeliveryOrder]);
            } else {
                await createRecord('Delivery Orders', payload);
                setDeliveryOrders(cur => cur ? [payload as DeliveryOrder, ...cur] : [payload as DeliveryOrder]);
            }
            refetchModule('Delivery Orders');
            addToast(`DO ${doc['DO No']} saved!`, 'success');
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

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'hsl(var(--background))' }}>
            <MobileFormHeader
                title={existingDO ? `Edit ${doc['DO No'] || ''}` : 'New Delivery Order'}
                subtitle={doc['Company Name'] || 'No company selected'}
                onBack={onBack}
                onSave={handleSave}
                isSaving={isSaving}
                accentColor={ACCENT}
            />

            <div className="flex-1 overflow-y-auto py-4 space-y-5 pb-10">

                <MobileFormSection title="Delivery Order Info">
                    <MobileField label="DO No." last={false}>
                        <MobileInput value={doc['DO No']} onChange={v => set('DO No', v)} readOnly />
                    </MobileField>
                    <MobileField label="DO Date" last={false}>
                        <MobileInput type="date" value={doc['DO Date']} onChange={v => set('DO Date', v)} />
                    </MobileField>
                    <MobileField label="Status" last={false}>
                        <MobileSelect value={doc['Status']} onChange={v => set('Status', v)} options={STATUS_OPTIONS} placeholder="Status" />
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
                    <MobileField label="Address" last={true}>
                        <MobileTextarea value={doc['Company Address']} onChange={v => set('Company Address', v)} rows={2} />
                    </MobileField>
                </MobileFormSection>

                {/* DO Items - no pricing, but has serial numbers */}
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest px-4 mb-2"
                        style={{ color: 'hsl(var(--muted-foreground) / 0.5)' }}>Delivery Items</p>
                    <div className="px-3 space-y-2">
                        {items.map(it => (
                            <div
                                key={it.id}
                                className="rounded-2xl p-3"
                                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.5)' }}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span
                                        className="text-[10px] font-black px-2 py-0.5 rounded-lg flex-shrink-0"
                                        style={{ background: `${ACCENT}20`, color: ACCENT }}
                                    >#{it.no}</span>
                                    <input type="text" value={it.itemCode}
                                        onChange={e => setItemField(it.id, 'itemCode', e.target.value)}
                                        placeholder="Item Code"
                                        className="flex-1 text-[12px] font-mono text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30"
                                    />
                                    <input type="number" value={it.qty}
                                        onChange={e => setItemField(it.id, 'qty', e.target.value)}
                                        className="w-14 text-[12px] font-bold text-center text-foreground bg-transparent border rounded-lg px-1 py-0.5 outline-none"
                                        style={{ borderColor: 'hsl(var(--border))' }}
                                    />
                                    <span className="text-[10px] text-muted-foreground">pcs</span>
                                    <button type="button" onClick={() => { haptic('light'); removeItem(it.id); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg active:opacity-60 flex-shrink-0"
                                        style={{ color: 'hsl(var(--destructive))' }}>
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                                <input type="text" value={it.modelName}
                                    onChange={e => setItemField(it.id, 'modelName', e.target.value)}
                                    placeholder="Model name"
                                    className="w-full text-[13px] font-semibold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 mb-1.5"
                                />
                                <textarea value={it.description}
                                    onChange={e => setItemField(it.id, 'description', e.target.value)}
                                    placeholder="Description"
                                    rows={2}
                                    className="w-full text-[11px] text-muted-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/30 mb-1.5"
                                />
                                <div
                                    className="rounded-xl p-2"
                                    style={{ background: 'hsl(var(--muted) / 0.3)' }}
                                >
                                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1"
                                        style={{ color: 'hsl(var(--muted-foreground) / 0.6)' }}>Serial Numbers (one per line)</p>
                                    <textarea
                                        value={it.serialNumber || ''}
                                        onChange={e => setItemField(it.id, 'serialNumber', e.target.value)}
                                        rows={3}
                                        placeholder="SN001&#10;SN002&#10;SN003..."
                                        className="w-full text-[11px] font-mono text-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/30"
                                    />
                                </div>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => { haptic('light'); addItem(); }}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-bold active:opacity-70"
                            style={{
                                border: `1.5px dashed ${ACCENT}`,
                                color: ACCENT,
                                background: `${ACCENT}08`,
                            }}
                        >
                            <Plus size={16} /> Add Item
                        </button>
                    </div>
                </div>

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
