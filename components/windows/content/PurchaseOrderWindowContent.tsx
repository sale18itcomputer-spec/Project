'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PurchaseOrder, PurchaseOrderItem } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { supabase } from '@/lib/supabase';
import { autoPostPurchaseOrderJournal } from '@/services/accountingApi';
import { convertPurchaseOrderToInventory } from '@/services/inventoryApi';
import { Plus, Trash2, Save, ShoppingCart, Download, Loader2, Eye } from 'lucide-react';
import { FormSection, FormInput, FormTextarea, FormSelect } from '@/components/common/FormControls';
import { formatCurrencySmartly, stripHtml } from '@/utils/formatters';
import { formatToInputDate } from '@/utils/time';
import { generatePDF } from '@/lib/pdfClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import PdfPreviewPane from '@/components/pdf/PdfPreviewPane';

// ── POItemCombobox ────────────────────────────────────────────────────────────
// Searches vendor_pricelist (dealer items) + main pricelist (B2C items) so
// every PO line item carries brand, category, and full description from day one.
interface POItemComboboxProps {
    value: string;
    onChange: (value: string) => void;
    onSelect: (fields: { item_number: string; model_name: string; description: string; unit_price: number; brand: string; category: string }) => void;
}

const POItemCombobox: React.FC<POItemComboboxProps> = ({ value, onChange, onSelect }) => {
    const { vendorPricelist, pricelist } = useData();
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    type ComboResult = {
        key: string; source: 'vendor' | 'pricelist';
        code: string; model: string; brand: string;
        category: string; spec: string; price: number; currency?: string;
    };

    const results = useMemo((): ComboResult[] => {
        if (!open) return [];
        const q = value.toLowerCase().trim();

        // ── Vendor pricelist (dealer pricing) ────────────────────────────────
        const vendorResults: ComboResult[] = (vendorPricelist ?? [])
            .filter(v =>
                !q ||
                (v.model_name ?? '').toLowerCase().includes(q) ||
                (v.brand ?? '').toLowerCase().includes(q) ||
                (v.specification ?? '').toLowerCase().includes(q)
            )
            .slice(0, 40)
            .map(v => ({
                key: `v-${v.id}`,
                source: 'vendor',
                code: v.model_name ?? '',
                model: v.model_name ?? '',
                brand: v.brand ?? '',
                category: '',           // vendor_pricelist has no category column
                spec: v.specification ?? '',
                price: v.dealer_price ?? 0,
                currency: v.currency,
            }));

        // ── Main pricelist (B2C / sales pricelist) ────────────────────────────
        const plResults: ComboResult[] = (pricelist ?? [])
            .filter(p =>
                !q ||
                (p.Code ?? '').toLowerCase().includes(q) ||
                (p.Model ?? '').toLowerCase().includes(q) ||
                (p.Brand ?? '').toLowerCase().includes(q) ||
                (p.Description ?? '').toLowerCase().includes(q)
            )
            .slice(0, 40)
            .map(p => ({
                key: `p-${p.Code}`,
                source: 'pricelist',
                code: p.Code ?? '',
                model: p.Model ?? '',
                brand: p.Brand ?? '',
                category: p.Category ?? '',
                spec: p.Description ?? '',
                price: parseFloat(String(p['End User Price'] ?? 0)) || 0,
                currency: p.Currency,
            }));

        // Deduplicate: if vendor already covers a code, skip pricelist duplicate
        const vendorCodes = new Set(vendorResults.map(r => r.code.toLowerCase()));
        const deduped = plResults.filter(r => !r.code || !vendorCodes.has(r.code.toLowerCase()));

        return [...vendorResults, ...deduped].slice(0, 60);
    }, [vendorPricelist, pricelist, value, open]);

    const hasVendor = results.some(r => r.source === 'vendor');
    const hasPricelist = results.some(r => r.source === 'pricelist');

    return (
        <div ref={wrapperRef} className="relative">
            <input
                className="w-full bg-transparent border-b border-transparent focus:border-brand-500 py-1.5 focus:outline-none transition text-sm"
                value={value}
                onChange={e => { onChange(e.target.value); if (!open) setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder="Search / SKU"
                autoComplete="off"
            />
            {open && results.length > 0 && (
                <div className="absolute z-[9999] left-0 w-[440px] mt-1 bg-card rounded-md shadow-xl border border-border">
                    <ScrollArea className="max-h-72">
                        {hasVendor && (
                            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 select-none">
                                🏭 Vendor Pricelist
                            </p>
                        )}
                        <ul>
                            {results.map((r, idx) => {
                                const prevIsVendor = idx > 0 && results[idx - 1].source === 'vendor';
                                const showPlHeader = hasPricelist && r.source === 'pricelist' && (idx === 0 || prevIsVendor);
                                return (
                                    <React.Fragment key={r.key}>
                                        {showPlHeader && (
                                            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 select-none border-t border-border mt-1">
                                                📋 Pricelist
                                            </p>
                                        )}
                                        <li>
                                            <button
                                                type="button"
                                                onMouseDown={e => {
                                                    e.preventDefault();
                                                    onSelect({
                                                        item_number: r.code,
                                                        model_name: r.model,
                                                        description: r.spec,
                                                        unit_price: r.price,
                                                        brand: r.brand,
                                                        category: r.category,
                                                    });
                                                    setOpen(false);
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                                            >
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-semibold text-foreground truncate">{r.model}</p>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {r.brand}{r.brand && r.code ? ' — ' : ''}{r.code}
                                                            {r.category ? ` · ${r.category}` : ''}
                                                        </p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="font-semibold text-foreground text-sm">
                                                            {r.currency === 'KHR'
                                                                ? `៛${Number(r.price).toLocaleString()}`
                                                                : `$${Number(r.price).toFixed(2)}`}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground capitalize">{r.source}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        </li>
                                    </React.Fragment>
                                );
                            })}
                        </ul>
                    </ScrollArea>
                </div>
            )}
        </div>
    );
};

interface PurchaseOrderWindowContentProps {
    windowId: string;
    poId: string | null;
    initialData?: Partial<PurchaseOrder>;
}

const PurchaseOrderWindowContent: React.FC<PurchaseOrderWindowContentProps> = ({ windowId, poId, initialData }) => {
    const { vendors, vendorPricelist, pricelist, purchaseOrders, refetchData } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { windows, openWindow, closeWindow, updateWindow } = useWindowManager();

    const existingPO = useMemo(
        () => (poId ? purchaseOrders?.find(po => po.id === poId) ?? null : null),
        [purchaseOrders, poId]
    );

    const previewWindowId = `po-preview-${windowId}`;
    const isPreviewOpen = windows.some(w => w.id === previewWindowId);

    const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
        po_number: '',
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: '',
        payment_term: '',
        vendor_id: '',
        ship_to_address: 'Limperial Co., Ltd.\nNo. 123, St. 456, Phnom Penh, Cambodia',
        ordered_by_name: currentUser?.Name || '',
        ordered_by_phone: currentUser?.['Phone 1'] || '',
        currency: 'USD',
        tax_type: 'VAT',
        status: 'Draft',
        remarks: '',
        prepared_by: currentUser?.Name || '',
        prepared_by_position: currentUser ? (
            currentUser.Name?.toLowerCase().includes('sreyneang')
                ? '017 594 524 | 010 345 994'
                : [
                    currentUser.Role,
                    [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '),
                    currentUser.Email
                ].filter(Boolean).join(' | ')
        ) : '',
        approved_by: '',
        approved_by_position: '',
        ...initialData
    });

    const [items, setItems] = useState<PurchaseOrderItem[]>([
        { line_number: 1, item_number: '', description: '', qty: 1, unit_price: 0 }
    ]);

    useEffect(() => {
        if (!poId && initialData) {
            const stored = sessionStorage.getItem('duplicate_purchase_order_items');
            if (stored) {
                try {
                    const parsedItems = JSON.parse(stored);
                    if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                        setItems(parsedItems.map((item: any, idx: number) => ({
                            ...item,
                            id: undefined,
                            purchase_order_id: undefined,
                            line_number: idx + 1
                        })));
                    }
                } catch (e) {
                    console.error('Failed to parse duplicate purchase order items', e);
                } finally {
                    sessionStorage.removeItem('duplicate_purchase_order_items');
                }
            }
        }
    }, [poId, initialData]);

    const [isSaving, setIsSaving] = useState(false);
    const [signaturePadding, setSignaturePadding] = useState(0);

    const totals = useMemo(() => {
        const sub_total = items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);
        const isVAT = formData.tax_type === 'VAT';
        const vat_amount = isVAT ? sub_total * 0.1 : 0;
        const grand_total = sub_total + vat_amount;
        return { sub_total, vat_amount, grand_total };
    }, [items, formData.tax_type]);

    const pdfOptions = useMemo(() => {
        const selectedVendor = vendors?.find(v => v.id === formData.vendor_id);
        return {
            type: 'Purchase Order' as const,
            headerData: {
                ...formData,
                'Vendor Name': formData.vendor_name || selectedVendor?.vendor_name,
                'Vendor Address': formData.vendor_address || selectedVendor?.address,
                'Vendor Contact': formData.vendor_contact || '',
                'Vendor Phone': formData.vendor_phone || selectedVendor?.phone,
                'Vendor Email': formData.vendor_email || selectedVendor?.email,
                'PO Number': formData.po_number,
                'Order Date': formData.order_date,
                'Delivery Date': formData.delivery_date,
                'Payment Term': formData.payment_term,
                'Ship To': formData.ship_to_address,
                'Currency': formData.currency,
                'Prepared By': formData.prepared_by,
                'Prepared By Position': formData.prepared_by_position,
                'Approved By': formData.approved_by,
                'Approved By Position': formData.approved_by_position,
            },
            items: items.map(item => ({
                no: item.line_number,
                itemCode: item.item_number,
                description: stripHtml(item.description),
                qty: item.qty,
                unitPrice: item.unit_price,
                amount: item.qty * item.unit_price,
                isPromotion: item.is_promotion,
            })),
            totals: {
                subTotal: totals.sub_total || 0,
                vat: totals.vat_amount || 0,
                grandTotal: totals.grand_total || 0,
            },
            currency: (formData.currency as 'USD' | 'KHR') || 'USD',
        };
    }, [formData, items, totals, vendors]);

    const buildPreviewContent = () => (
        <div className="h-full flex flex-col overflow-hidden">
            <PdfPreviewPane
                docLabel={`${formData.po_number || 'New PO'} • ${formData.vendor_name || 'No Vendor Selected'}`}
                signaturePadding={signaturePadding}
                onSignaturePaddingChange={setSignaturePadding}
                defaultSignaturePadding={0}
                pdfOptions={pdfOptions}
            />
        </div>
    );

    const openPreviewWindow = () => {
        openWindow({
            id: previewWindowId,
            title: `Preview: ${formData.po_number || 'New PO'}`,
            content: buildPreviewContent(),
            draggable: true,
            initialWidth: 750,
            initialHeight: 850,
            minWidth: 450,
            minHeight: 400,
        });
    };

    // Keep an already-open preview window's iframe in sync with live form edits
    useEffect(() => {
        if (!isPreviewOpen) return;
        updateWindow(previewWindowId, {
            title: `Preview: ${formData.po_number || 'New PO'}`,
            content: buildPreviewContent(),
        });
    }, [isPreviewOpen, previewWindowId, pdfOptions, signaturePadding, formData.po_number, formData.vendor_name, updateWindow]);

    useEffect(() => {
        if (existingPO) {
            setFormData({
                ...existingPO,
                order_date: formatToInputDate(existingPO.order_date),
                delivery_date: formatToInputDate(existingPO.delivery_date)
            });
            loadPOItems(existingPO.id!);
        } else {
            generatePONumber();
        }
    }, [existingPO]);

    const generatePONumber = async () => {
        const dateStr = new Date().getFullYear().toString();
        const { data } = await supabase
            .from('purchase_orders')
            .select('po_number')
            .order('created_at', { ascending: false })
            .limit(1);

        let nextNumber = 1;
        if (data && data.length > 0) {
            const lastPO = data[0].po_number;
            const lastNumber = parseInt(lastPO.split('-').pop() || '0');
            nextNumber = lastNumber + 1;
        }
        setFormData(prev => ({ ...prev, po_number: `PO-${dateStr}-${String(nextNumber).padStart(3, '0')}` }));
    };

    const loadPOItems = async (id: string) => {
        const { data } = await supabase
            .from('purchase_order_items')
            .select('*')
            .eq('po_id', id)
            .order('line_number', { ascending: true });
        if (data) {
            setItems(data.map(row => ({
                ...row,
                brand:        row.brand    ?? '',
                category:     row.category ?? '',
                is_promotion: row.line_number === 0 && row.unit_price < 0,
            })));
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'vendor_id' && vendors) {
            const vendor = vendors.find(v => v.id === value);
            if (vendor) {
                setFormData(prev => ({
                    ...prev,
                    vendor_id: value,
                    vendor_name: vendor.vendor_name,
                    vendor_address: vendor.address || '',
                    vendor_contact: vendor.contact_person || '',
                    vendor_phone: vendor.phone || '',
                    vendor_email: vendor.email || '',
                    payment_term: vendor.payment_terms || prev.payment_term
                }));
            }
        }
    };

    const handleItemChange = (index: number, field: keyof PurchaseOrderItem, value: any) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    /** Called when a user selects from the POItemCombobox — fills all fields at once */
    const handleItemSelectFromLookup = (index: number, fields: {
        item_number: string; model_name: string; description: string; unit_price: number; brand: string; category: string;
    }) => {
        setItems(prev => prev.map((item, i) =>
            i === index
                ? { ...item, ...fields }
                : item
        ));
    };

    const addItem = () => {
        setItems(prev => [...prev, { line_number: prev.length + 1, item_number: '', description: '', qty: 1, unit_price: 0 }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({
                ...item,
                line_number: item.is_promotion ? 0 : i + 1
            })));
        }
    };

    const addPromoRow = () => {
        setItems(prev => [...prev, { line_number: 0, item_number: '', description: '', qty: 1, unit_price: 0, is_promotion: true }]);
    };

    const handlePromoAmountChange = (index: number, value: string) => {
        const abs = Math.abs(parseFloat(value) || 0);
        setItems(prev => prev.map((item, i) => i === index ? { ...item, unit_price: -abs } : item));
    };

    const handleSave = async () => {
        if (!formData.vendor_id) {
            addToast('Please select a vendor', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const { items: _, id: __, created_at: ___, updated_at: ____, ...cleanFormData } = formData as any;
            const poPayload = {
                ...cleanFormData,
                ...totals,
                order_date: cleanFormData.order_date || null,
                delivery_date: cleanFormData.delivery_date || null,
                vendor_id: cleanFormData.vendor_id || null,
                created_by: cleanFormData.created_by || currentUser?.Name || 'System',
                updated_at: new Date().toISOString()
            };

            let savedPoId = formData.id;
            if (savedPoId) {
                const { error } = await supabase.from('purchase_orders').update(poPayload).eq('id', savedPoId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('purchase_orders').insert([poPayload]).select();
                if (error) throw error;
                savedPoId = (data as any)[0].id;
            }

            if (formData.id) {
                await supabase.from('purchase_order_items').delete().eq('po_id', savedPoId);
            }

            const itemsPayload = items.map(item => ({
                po_id: savedPoId,
                line_number: item.line_number,
                item_number: item.item_number,
                model_name: item.model_name ?? '',
                description: item.description,
                qty: item.qty,
                unit_price: item.unit_price,
                brand: item.brand ?? '',
                category: item.category ?? '',
                serial_number: item.serial_number ?? '',
            }));

            const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsPayload);
            if (itemsError) throw itemsError;

            if (formData.status === 'Completed') {
                // Auto-post: DR Inventory (per brand) / CR Accounts Payable (non-fatal)
                autoPostPurchaseOrderJournal({
                    poNumber: formData.po_number || savedPoId || '',
                    entryDate: formData.order_date || new Date().toISOString().slice(0, 10),
                    items: items.filter(i => !i.is_promotion).map(i => ({ brand: i.brand, qty: i.qty, unit_price: i.unit_price })),
                    createdBy: currentUser?.Name || 'system',
                }).catch(err => console.warn('[PurchaseOrderWindowContent] auto-post failed:', err));

                try {
                    const pricelistPayload = items
                        .filter(item => !item.is_promotion && (item.item_number || item.description))
                        .map(item => ({
                            vendor_id: formData.vendor_id,
                            brand: '',
                            model_name: item.item_number || stripHtml(item.description).substring(0, 50) || 'N/A',
                            specification: stripHtml(item.description),
                            dealer_price: item.unit_price,
                            currency: formData.currency || 'USD',
                            status: 'Available' as const,
                            created_by: currentUser?.Name || 'System'
                        }));

                    if (pricelistPayload.length > 0) {
                        const { error: priceError } = await supabase.from('vendor_pricelist').insert(pricelistPayload);
                        if (priceError) throw priceError;
                        addToast('Items automatically added to Vendor Pricelist!', 'success');
                    }
                } catch (pe: any) {
                    addToast(`PO saved, but pricelist sync failed: ${pe.message}`, 'info');
                }

                // ── Auto-convert PO → Inventory (non-fatal, guarded against double-conversion) ──
                try {
                    const result = await convertPurchaseOrderToInventory(
                        { ...formData, id: savedPoId, po_number: formData.po_number || '' } as PurchaseOrder,
                        items,
                        { pricelist, vendorPricelist, createdBy: currentUser?.Name || 'System' }
                    );
                    if (result.converted) {
                        addToast(`${result.count} item(s) added to Inventory!`, 'success');
                    }
                } catch (ie: any) {
                    // Non-fatal: PO is already saved — just warn
                    addToast(`PO saved, but inventory sync failed: ${ie.message}`, 'info');
                }
            }

            addToast('Purchase Order saved successfully!', 'success');
            await refetchData();
            closeWindow(previewWindowId);
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Error saving PO: ${err.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            await generatePDF({
                ...pdfOptions,
                filename: `${formData.po_number || 'PO'}.pdf`,
            });
        } catch (error: any) {
            addToast(`Error downloading PDF: ${error.message}`, 'error');
        }
    };

    useEffect(() => {
        const title = existingPO ? `Edit PO: ${formData.po_number}` : 'New Purchase Order';

        const footer = (
            <div className="flex justify-between items-center w-full">
                <button type="button" onClick={() => { closeWindow(previewWindowId); closeWindow(windowId); }} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition">
                    Cancel
                </button>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={openPreviewWindow}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-semibold shadow-sm border ${
                            isPreviewOpen
                                ? 'bg-brand-500/10 text-brand-600 border-brand-500/30'
                                : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        <Eye size={14} /> Preview
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 px-4 py-2 border border-brand-500/30 rounded-lg hover:bg-brand-500/10 transition text-sm font-semibold bg-card text-brand-600 shadow-sm"
                    >
                        <Download size={14} /> Download PDF
                    </button>
                    <button type="button" onClick={handleSave} disabled={isSaving} className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-8 rounded-lg transition-all duration-200 shadow-lg shadow-brand-500/20 min-w-[100px] flex items-center justify-center text-sm disabled:opacity-50">
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={14} className="mr-2" /> Save</>}
                    </button>
                </div>
            </div>
        );

        updateWindow(windowId, { title, footer });
    }, [windowId, existingPO, formData, items, totals, vendors, isSaving, isPreviewOpen, previewWindowId, updateWindow, closeWindow]);

    return (
        <form id={`po-form-${windowId}`} onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
                <FormSection title="Vendor Information">
                    <div className="flex flex-col md:col-span-2 mb-2">
                        <label className="text-sm font-medium text-foreground mb-1.5">Load from Database</label>
                        <select
                            name="vendor_id"
                            value={formData.vendor_id}
                            onChange={handleInputChange}
                            className="block w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:bg-background focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150"
                        >
                            <option value="">Select Vendor to auto-fill...</option>
                            {vendors?.map(v => (
                                <option key={v.id} value={v.id}>{v.vendor_name}</option>
                            ))}
                        </select>
                    </div>
                    <FormInput name="vendor_name" label="Vendor Name" value={formData.vendor_name || ''} onChange={handleInputChange} required />
                    <FormInput name="vendor_contact" label="Contact Name" value={formData.vendor_contact || ''} onChange={handleInputChange} />
                    <FormInput name="vendor_phone" label="Phone Number" value={formData.vendor_phone || ''} onChange={handleInputChange} />
                    <FormInput name="vendor_email" label="Email Address" value={formData.vendor_email || ''} onChange={handleInputChange} type="email" />
                    <div className="md:col-span-2 mt-2">
                        <FormTextarea name="vendor_address" label="Vendor Address" value={formData.vendor_address || ''} onChange={handleInputChange} rows={2} />
                    </div>
                </FormSection>

                <FormSection title="Order Details">
                    <FormInput name="po_number" label="PO Number #" value={formData.po_number || ''} onChange={handleInputChange} readOnly />
                    <div className="grid grid-cols-2 gap-4">
                        <FormSelect name="status" label="Status" value={formData.status || 'Draft'} onChange={handleInputChange} options={['Draft', 'Approved', 'Sent', 'Completed', 'Cancelled']} />
                        <FormSelect name="tax_type" label="Tax Type" value={formData.tax_type || 'VAT'} onChange={handleInputChange} options={['VAT', 'NON-VAT']} />
                    </div>
                    <FormInput name="order_date" label="Order Date" value={formData.order_date || ''} onChange={handleInputChange} type="date" />
                    <FormInput name="delivery_date" label="Delivery Date" value={formData.delivery_date || ''} onChange={handleInputChange} type="date" />
                    <FormInput name="payment_term" label="Payment Term" value={formData.payment_term || ''} onChange={handleInputChange} placeholder="e.g. Net 30" />
                    <FormInput name="ordered_by_name" label="Order By Name" value={formData.ordered_by_name || ''} onChange={handleInputChange} />
                    <FormInput name="ordered_by_phone" label="Order By Phone" value={formData.ordered_by_phone || ''} onChange={handleInputChange} />
                    <div className="md:col-span-2 mt-2">
                        <FormTextarea name="ship_to_address" label="Ship To Address" value={formData.ship_to_address || ''} onChange={handleInputChange} rows={2} />
                    </div>
                </FormSection>
            </div>

            {/* Line Items Section */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="bg-muted/30 px-4 py-3 border-b border-border flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-brand-500" /> Line Items</h3>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={addItem} className="text-sm font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1 transition">
                            <Plus className="w-4 h-4" /> Add Item
                        </button>
                        <button type="button" onClick={addPromoRow} className="text-sm font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 flex items-center gap-1 transition">
                            + Add Cashback
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[940px]">
                        <thead>
                            <tr className="bg-muted/20 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                                <th className="px-4 py-3 w-12">No.</th>
                                <th className="px-4 py-3 w-36">Item # / Code</th>
                                <th className="px-4 py-3 w-28">Model</th>
                                <th className="px-4 py-3 w-24">Brand</th>
                                <th className="px-4 py-3 w-28">Category</th>
                                <th className="px-4 py-3 min-w-[200px]">Description</th>
                                <th className="px-4 py-3 min-w-[160px]">Serial Numbers</th>
                                <th className="px-4 py-3 w-20">Qty</th>
                                <th className="px-4 py-3 w-28">Unit Price</th>
                                <th className="px-4 py-3 w-28">Total</th>
                                <th className="px-4 py-3 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => item.is_promotion ? (
                                <tr key={index} className="border-b border-amber-500/20 bg-amber-500/5">
                                    <td colSpan={9} className="px-4 py-3">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                <span className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400 whitespace-nowrap">Cashback / Promotion</span>
                                            </div>
                                            <input
                                                className="flex-1 bg-transparent border-b border-amber-500/30 focus:border-amber-500 py-1.5 focus:outline-none transition text-sm italic text-muted-foreground"
                                                value={item.description}
                                                onChange={e => handleItemChange(index, 'description', e.target.value)}
                                                placeholder="e.g. Buy 10-29pcs get cash back $40 · Period: 01st - 30th June 2026"
                                            />
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-xs text-muted-foreground">Amount:</span>
                                                <input
                                                    type="number" min={0} step="0.01"
                                                    className="w-28 bg-transparent border-b border-amber-500/30 focus:border-amber-500 py-1.5 focus:outline-none transition text-sm text-right text-rose-600"
                                                    value={Math.abs(item.unit_price)}
                                                    onChange={e => handlePromoAmountChange(index, e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold text-right text-rose-600">
                                        ({formatCurrencySmartly(Math.abs(item.unit_price), formData.currency)})
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button type="button" onClick={() => removeItem(index)} className="text-muted-foreground hover:text-rose-500 transition">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ) : (
                                <tr key={index} className="border-b border-border/50 hover:bg-muted/5 transition-colors">
                                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.line_number}</td>

                                    {/* ── Item # with searchable combobox ── */}
                                    <td className="px-2 py-3 min-w-[140px]">
                                        <POItemCombobox
                                            value={item.item_number}
                                            onChange={val => handleItemChange(index, 'item_number', val)}
                                            onSelect={fields => handleItemSelectFromLookup(index, fields)}
                                        />
                                    </td>

                                    {/* ── Model (auto-filled, editable) ── */}
                                    <td className="px-2 py-3">
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-brand-500 py-1.5 focus:outline-none transition text-sm"
                                            value={item.model_name ?? ''}
                                            onChange={e => handleItemChange(index, 'model_name', e.target.value)}
                                            placeholder="Model"
                                        />
                                    </td>

                                    {/* ── Brand (auto-filled, editable) ── */}
                                    <td className="px-2 py-3">
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-brand-500 py-1.5 focus:outline-none transition text-sm"
                                            value={item.brand ?? ''}
                                            onChange={e => handleItemChange(index, 'brand', e.target.value)}
                                            placeholder="Brand"
                                        />
                                    </td>

                                    {/* ── Category (auto-filled, editable) ── */}
                                    <td className="px-2 py-3">
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-brand-500 py-1.5 focus:outline-none transition text-sm"
                                            value={item.category ?? ''}
                                            onChange={e => handleItemChange(index, 'category', e.target.value)}
                                            placeholder="Category"
                                        />
                                    </td>

                                    {/* ── Description ── */}
                                    <td className="px-2 py-3 min-w-[300px]">
                                        <textarea
                                            className="w-full bg-background rounded border border-border/50 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-sm text-sm px-3 py-2 resize-y min-h-[60px] outline-none"
                                            value={item.description}
                                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                            placeholder="Add detailed description..."
                                            rows={2}
                                        />
                                    </td>

                                    {/* ── Serial Numbers (one per line) ── */}
                                    <td className="px-2 py-3 min-w-[160px]">
                                        <textarea
                                            className="w-full bg-background rounded border border-border/50 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-sm text-xs px-2 py-1.5 resize-y min-h-[60px] outline-none font-mono"
                                            value={item.serial_number ?? ''}
                                            onChange={(e) => handleItemChange(index, 'serial_number', e.target.value)}
                                            placeholder={'SN001\nSN002\nSN003...'}
                                            rows={2}
                                        />
                                    </td>

                                    <td className="px-2 py-3">
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-brand-500 py-1.5 focus:outline-none transition text-sm text-center"
                                            type="number"
                                            value={item.qty}
                                            onChange={(e) => handleItemChange(index, 'qty', parseFloat(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="px-2 py-3">
                                        <input
                                            className="w-full bg-transparent border-b border-transparent focus:border-brand-500 py-1.5 focus:outline-none transition text-sm text-right"
                                            type="number"
                                            step="0.01"
                                            value={item.unit_price}
                                            onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold text-right">
                                        {formatCurrencySmartly(item.qty * item.unit_price, formData.currency)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button type="button" onClick={() => removeItem(index)} className="text-muted-foreground hover:text-rose-500 transition">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="bg-muted/10 p-6">
                    <div className="w-full border-t border-border pt-4">
                        <div className="flex justify-between text-sm py-1">
                            <span className="text-muted-foreground font-medium">Sub Total:</span>
                            <span className="font-semibold">{formatCurrencySmartly(totals.sub_total, formData.currency)}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1">
                            <span className="text-muted-foreground font-medium">{formData.tax_type === 'VAT' ? 'VAT (10%):' : 'Tax (0%):'}</span>
                            <span className="font-semibold text-rose-600">{formatCurrencySmartly(totals.vat_amount, formData.currency)}</span>
                        </div>
                        <div className="flex justify-between text-lg py-3 border-t border-border mt-2">
                            <span className="font-bold text-foreground">Grand Total:</span>
                            <span className="font-bold text-brand-600">{formatCurrencySmartly(totals.grand_total, formData.currency)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Signature Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormSection title="Preparation">
                    <div className="grid grid-cols-1 gap-4">
                        <FormInput name="prepared_by" label="Prepared By" value={formData.prepared_by} onChange={handleInputChange} />
                        <FormInput name="prepared_by_position" label="Position" value={formData.prepared_by_position} onChange={handleInputChange} />
                    </div>
                </FormSection>
                <FormSection title="Approval">
                    <div className="grid grid-cols-1 gap-4">
                        <FormInput name="approved_by" label="Approved By" value={formData.approved_by} onChange={handleInputChange} />
                        <FormInput name="approved_by_position" label="Position" value={formData.approved_by_position} onChange={handleInputChange} />
                    </div>
                </FormSection>
            </div>
        </form>
    );
};

export default PurchaseOrderWindowContent;
