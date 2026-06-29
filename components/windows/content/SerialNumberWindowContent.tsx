'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SerialNumber } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { supabase } from '@/lib/supabase';
import { FormSection, FormInput, FormTextarea } from '@/components/common/FormControls';
import SearchableSelect from '@/components/common/SearchableSelect';
import ConfirmationModal from '@/components/modals/ConfirmationModal';
import { Check, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const STATUS_OPTIONS = ['Active', 'In Service', 'Returned', 'Written Off', 'Retired'] as const;
const STOCK_STATUS_OPTIONS = ['In Stock', 'Sold'] as const;

interface SerialNumberWindowContentProps {
    windowId: string;
    snId: string | null;
    prefillData?: Partial<SerialNumber>;
}

const SerialNumberWindowContent: React.FC<SerialNumberWindowContentProps> = ({
    windowId,
    snId,
    prefillData,
}) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { serialNumbers, setSerialNumbers, companies, contacts, invoices, pricelist, fetchModule } = useData();
    const { closeWindow, updateWindow } = useWindowManager();

    const [formData, setFormData] = useState<Partial<SerialNumber>>({});
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Invoice-picker state
    const [showInvoicePicker, setShowInvoicePicker] = useState(false);
    const [selectedInvNo, setSelectedInvNo] = useState('');
    const [selectedItemIdx, setSelectedItemIdx] = useState<number>(-1);

    const isEditMode = !!snId;
    const existingSN = useMemo(() => snId ? serialNumbers?.find(s => s.id === snId) ?? null : null, [serialNumbers, snId]);

    const companyOptions = useMemo(
        () => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() as string[] : [],
        [companies]
    );

    const contactOptions = useMemo(() => {
        if (!contacts) return [];
        const filtered = formData.company_name
            ? contacts.filter(c => c['Company Name'] === formData.company_name)
            : contacts;
        return [...new Set(filtered.map(c => c.Name).filter(Boolean))].sort() as string[];
    }, [contacts, formData.company_name]);

    // Invoice options for picker
    const invoiceOptions = useMemo(() => {
        if (!invoices) return [];
        return invoices
            .filter(inv => inv['Status'] === 'Completed' || inv['Status'] === 'Processing')
            .map(inv => inv['Inv No'])
            .filter(Boolean) as string[];
    }, [invoices]);

    // Brand lookup from pricelist
    const brandByCode = useMemo(() => {
        const map = new Map<string, string>();
        (pricelist ?? []).forEach(p => { if (p['Code']) map.set(p['Code'], p['Brand'] ?? ''); });
        return map;
    }, [pricelist]);

    // Items from selected invoice
    const selectedInvoice = useMemo(() => {
        if (!selectedInvNo || !invoices) return null;
        return invoices.find(inv => inv['Inv No'] === selectedInvNo) ?? null;
    }, [selectedInvNo, invoices]);

    const invoiceItems = useMemo(() => {
        if (!selectedInvoice) return [];
        try {
            const raw = typeof selectedInvoice['ItemsJSON'] === 'string'
                ? JSON.parse(selectedInvoice['ItemsJSON'])
                : selectedInvoice['ItemsJSON'];
            return Array.isArray(raw) ? raw : [];
        } catch {
            return [];
        }
    }, [selectedInvoice]);

    useEffect(() => {
        fetchModule('Company List', 'Contact_List', 'Invoices', 'Raw');
    }, [fetchModule]);

    useEffect(() => {
        setShowInvoicePicker(false);
        setSelectedInvNo('');
        setSelectedItemIdx(-1);

        if (isEditMode && existingSN) {
            setFormData(existingSN);
        } else if (prefillData) {
            setFormData({
                ...prefillData,
                status: prefillData.status ?? 'Active',
                stock_status: prefillData.stock_status ?? 'In Stock',
                warranty_period_months: prefillData.warranty_period_months ?? 12,
                created_by: currentUser?.Name || '',
            });
        } else {
            setFormData({
                status: 'Active',
                stock_status: 'In Stock',
                warranty_period_months: 12,
                created_by: currentUser?.Name || '',
            });
        }
    }, [existingSN, isEditMode, prefillData]);

    const applyInvoiceItem = useCallback((itemIdx: number) => {
        if (!selectedInvoice || itemIdx < 0 || itemIdx >= invoiceItems.length) return;
        const item = invoiceItems[itemIdx];
        setFormData(prev => ({
            ...prev,
            company_name: selectedInvoice['Company Name'] ?? prev.company_name,
            contact_name: selectedInvoice['Contact Name'] ?? prev.contact_name,
            so_no: selectedInvoice['SO No'] ?? prev.so_no,
            model_name: item.modelName ?? prev.model_name,
            description: item.description ?? prev.description,
            brand: brandByCode.get(item.itemCode ?? '') || prev.brand || '',
        }));
        setSelectedItemIdx(itemIdx);
    }, [selectedInvoice, invoiceItems, brandByCode]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleCancelClick = useCallback(() => {
        closeWindow(windowId);
    }, [windowId, closeWindow]);

    const handleSave = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!formData.serial_number) { addToast('Serial number is required.', 'error'); return; }
        setIsSaving(true);
        try {
            if (isEditMode && existingSN?.id) {
                const { id: _id, created_at: _ca, ...rest } = formData as any;
                const { data, error } = await supabase
                    .from('serial_numbers')
                    .update({ ...rest, updated_at: new Date().toISOString() })
                    .eq('id', existingSN.id)
                    .select()
                    .single();
                if (error) throw new Error(error.message);
                setSerialNumbers(prev => prev ? prev.map(s => s.id === existingSN.id ? data : s) : prev);
                addToast('Serial number updated!', 'success');
            } else {
                const { data, error } = await supabase
                    .from('serial_numbers')
                    .insert([{ ...formData, created_by: currentUser?.Name || '' }])
                    .select()
                    .single();
                if (error) throw new Error(error.message);
                setSerialNumbers(prev => prev ? [data, ...prev] : [data]);
                addToast('Serial number added!', 'success');
            }
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to save: ${err.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }, [formData, isEditMode, existingSN, setSerialNumbers, addToast, closeWindow, windowId, currentUser]);

    const handleDelete = useCallback(async () => {
        if (!existingSN?.id) return;
        setDeleteConfirmOpen(false);
        try {
            await supabase.from('serial_numbers').delete().eq('id', existingSN.id);
            setSerialNumbers(prev => prev ? prev.filter(s => s.id !== existingSN.id) : prev);
            addToast('Serial number deleted!', 'success');
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to delete: ${err.message}`, 'error');
        }
    }, [existingSN, setSerialNumbers, addToast, closeWindow, windowId]);

    // Dynamic title & footer
    useEffect(() => {
        const title = isEditMode ? `Editing: ${formData.serial_number}` : 'Add Serial Number';

        const footer = (
            <div className="flex justify-between items-center w-full">
                {isEditMode ? (
                    <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 text-rose-500 hover:bg-rose-500/10 py-2 px-4 rounded-lg transition-colors text-sm">
                        <Trash2 size={16} /> Delete
                    </button>
                ) : <span />}
                <div className="flex gap-3">
                    <button type="button" onClick={handleCancelClick} className="bg-card hover:bg-muted text-foreground font-semibold py-2 px-4 rounded-md border border-border transition text-sm">Cancel</button>
                    <button type="submit" form={`serial-number-window-form-${windowId}`} disabled={isSaving} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                        {isEditMode ? 'Save Changes' : 'Save'}
                    </button>
                </div>
            </div>
        );
        updateWindow(windowId, { title, footer });
    }, [windowId, isEditMode, isSaving, formData.serial_number, updateWindow, handleCancelClick]);

    return (
        <>
            <form id={`serial-number-window-form-${windowId}`} onSubmit={handleSave} className="space-y-6 max-h-full overflow-y-auto p-1 pr-2 custom-scrollbar">

                {/* Invoice quick-import — only for new entries */}
                {!isEditMode && (
                    <div className="rounded-lg border border-dashed border-brand-500/40 bg-brand-500/5 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowInvoicePicker(p => !p)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-brand-500 hover:bg-brand-500/10 transition"
                        >
                            <span>Import from Invoice</span>
                            {showInvoicePicker ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {showInvoicePicker && (
                            <div className="px-4 pb-4 space-y-3 border-t border-brand-500/20 pt-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-muted-foreground/60">Invoice No</label>
                                    <SearchableSelect
                                        value={selectedInvNo}
                                        onChange={v => { setSelectedInvNo(v); setSelectedItemIdx(-1); }}
                                        options={invoiceOptions}
                                        placeholder="Search invoice..."
                                    />
                                </div>

                                {selectedInvoice && invoiceItems.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-muted-foreground/60">
                                            Line Item — {selectedInvoice['Company Name']} / {selectedInvoice['SO No']}
                                        </label>
                                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                            {invoiceItems.map((item: any, idx: number) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => applyInvoiceItem(idx)}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition border ${
                                                        selectedItemIdx === idx
                                                            ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                                                            : 'border-border bg-muted/40 hover:bg-muted text-foreground'
                                                    }`}
                                                >
                                                    <span className="font-semibold">{item.modelName || item.itemCode || '—'}</span>
                                                    {item.itemCode && item.modelName && (
                                                        <span className="ml-2 text-muted-foreground font-mono">{item.itemCode}</span>
                                                    )}
                                                    {item.description && (
                                                        <span className="block text-muted-foreground truncate">{item.description}</span>
                                                    )}
                                                    <span className="text-muted-foreground">Qty: {item.qty ?? 1}</span>
                                                </button>
                                            ))}
                                        </div>
                                        {selectedItemIdx >= 0 && (
                                            <p className="text-xs text-emerald-500">
                                                Fields pre-filled — enter the serial number below to complete.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {selectedInvoice && invoiceItems.length === 0 && (
                                    <p className="text-xs text-muted-foreground">No line items found for this invoice.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <FormSection title="Serial Number Details">
                    <FormInput name="serial_number" label="Serial Number" value={formData.serial_number} onChange={handleChange} required />
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput name="brand" label="Brand" value={formData.brand} onChange={handleChange} />
                        <FormInput name="model_name" label="Model" value={formData.model_name} onChange={handleChange} />
                    </div>
                    <FormTextarea name="description" label="Description" value={formData.description} onChange={handleChange} />
                </FormSection>

                <FormSection title="Customer & Sale">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-muted-foreground/60">Company Name</label>
                        <SearchableSelect value={formData.company_name ?? ''} onChange={v => setFormData(p => ({ ...p, company_name: v }))} options={companyOptions} placeholder="Select company..." allowCustomValue />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-muted-foreground/60">Contact Name</label>
                        <SearchableSelect value={formData.contact_name ?? ''} onChange={v => setFormData(p => ({ ...p, contact_name: v }))} options={contactOptions} placeholder="Select contact..." allowCustomValue />
                    </div>
                    <FormInput name="so_no" label="SO No" value={formData.so_no} onChange={handleChange} />
                </FormSection>

                <FormSection title="Warranty">
                    <div className="grid grid-cols-2 @md:grid-cols-3 gap-4">
                        <FormInput name="warranty_start_date" label="Start Date" type="date" value={formData.warranty_start_date ?? ''} onChange={handleChange} />
                        <FormInput name="warranty_end_date" label="End Date" type="date" value={formData.warranty_end_date ?? ''} onChange={handleChange} />
                        <FormInput name="warranty_period_months" label="Period (months)" type="number" value={formData.warranty_period_months ?? 12} onChange={handleChange} />
                    </div>
                </FormSection>

                <FormSection title="Status & Notes">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-muted-foreground/60">Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} className="bg-muted border border-border rounded-lg p-2.5 text-sm">
                                {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-muted-foreground/60">Stock Status</label>
                            <select name="stock_status" value={formData.stock_status || 'In Stock'} onChange={handleChange} className="bg-muted border border-border rounded-lg p-2.5 text-sm">
                                {STOCK_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                            </select>
                        </div>
                    </div>
                    <FormTextarea name="notes" label="Notes" value={formData.notes} onChange={handleChange} />
                </FormSection>
            </form>
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Serial Number" variant="danger">
                Are you sure you want to delete serial number "{existingSN?.serial_number}"?
            </ConfirmationModal>
        </>
    );
};

export default SerialNumberWindowContent;
