'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PdiRecord, PdiItem } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { generatePdiNo, savePdiRecord } from '@/services/api';
import { formatToInputDate } from '@/utils/time';
import { supabase } from '@/lib/supabase';
import { FormSection, FormInput, FormSelect, FormTextarea } from '@/components/common/FormControls';
import SearchableSelect from '@/components/common/SearchableSelect';
import { Plus, Trash2, Check, Loader2, Pencil } from 'lucide-react';

const STATUS_OPTIONS    = ['Pending', 'In Progress', 'Completed', 'Failed'] as const;
const CONDITION_OPTIONS = ['New', 'Good', 'Fair', 'Poor', 'Damaged'] as const;
const TEST_OPTIONS      = ['Pass', 'Fail', 'N/A'] as const;

const emptyItem = (lineNumber: number): PdiItem => ({
    line_number: lineNumber,
    serial_number: '',
    brand: '',
    model_name: '',
    physical_condition: 'Pass',
    power_test: 'Pass',
    software_test: 'Pass',
    accessories_check: 'Pass',
    seal_applied: false,
    item_notes: '',
});

interface PdiWindowContentProps {
    windowId: string;
    pdiId: string | null;
    initialReadOnly?: boolean;
}

const PdiWindowContent: React.FC<PdiWindowContentProps> = ({ windowId, pdiId, initialReadOnly = false }) => {
    const { fetchModule, pdiRecords, setPdiRecords, companies, contacts } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { closeWindow, updateWindow } = useWindowManager();

    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isSaving, setIsSaving] = useState(false);

    const isEditMode = !!pdiId;
    const existingRecord = useMemo(() => pdiId ? pdiRecords?.find(r => r.id === pdiId) ?? null : null, [pdiRecords, pdiId]);

    const [formData, setFormData] = useState<Omit<PdiRecord, 'items'>>({
        pdi_no: '',
        pdi_date: new Date().toISOString().split('T')[0],
        status: 'Pending',
        so_no: '',
        company_name: '',
        contact_name: '',
        assigned_engineer: '',
        inspection_notes: '',
        software_installed: '',
        warranty_seal_applied: false,
        warranty_seal_number: '',
        seal_photo_url: '',
        overall_condition: 'New',
        created_by: currentUser?.Name ?? '',
    });
    const [items, setItems] = useState<PdiItem[]>([emptyItem(1)]);

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

    useEffect(() => {
        fetchModule('Company List', 'Contact_List');
    }, [fetchModule]);

    const loadItems = useCallback(async (pdiRecordId: string) => {
        const { data } = await supabase.from('pdi_items').select('*').eq('pdi_id', pdiRecordId).order('line_number', { ascending: true });
        if (data && data.length > 0) setItems(data);
    }, []);

    useEffect(() => {
        if (isEditMode && existingRecord) {
            const { items: _items, ...header } = existingRecord as any;
            setFormData({ ...header, pdi_date: formatToInputDate(header.pdi_date) });
            loadItems(existingRecord.id!);
        } else if (!isEditMode) {
            generatePdiNo().then(no => setFormData(prev => ({ ...prev, pdi_no: no })));
        }
    }, [existingRecord, isEditMode, loadItems]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }, []);

    const handleItemChange = useCallback((index: number, field: keyof PdiItem, value: any) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    }, []);

    const addItem = useCallback(() => setItems(prev => [...prev, emptyItem(prev.length + 1)]), []);
    const removeItem = useCallback((index: number) => {
        setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, line_number: i + 1 })) : prev);
    }, []);

    const handleCancelClick = useCallback(() => {
        if (isEditMode && existingRecord) {
            const { items: _items, ...header } = existingRecord as any;
            setFormData({ ...header, pdi_date: formatToInputDate(header.pdi_date) });
            loadItems(existingRecord.id!);
            setIsReadOnly(true);
        } else {
            closeWindow(windowId);
        }
    }, [isEditMode, existingRecord, loadItems, windowId, closeWindow]);

    const handleSave = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!formData.pdi_date || !formData.company_name) {
            addToast('Please fill in Date and Company Name.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const result = await savePdiRecord(formData as PdiRecord, items);
            if (existingRecord?.id) {
                setPdiRecords(prev => prev
                    ? prev.map(r => r.id === existingRecord.id ? { ...r, ...formData } as PdiRecord : r)
                    : prev
                );
                addToast('PDI record updated.', 'success');
            } else {
                const newRecord: PdiRecord = { ...formData, id: result.id, pdi_no: result.pdi_no } as PdiRecord;
                setPdiRecords(prev => prev ? [newRecord, ...prev] : [newRecord]);
                addToast('PDI record created.', 'success');
            }
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to save: ${err.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }, [formData, items, existingRecord, setPdiRecords, addToast, closeWindow, windowId]);

    // Dynamic title & footer
    useEffect(() => {
        const title = isEditMode
            ? (isReadOnly ? `PDI: ${formData.pdi_no}` : `Editing PDI: ${formData.pdi_no}`)
            : 'New PDI Record';

        const footer = isReadOnly ? (
            <div className="flex justify-between items-center w-full">
                <button type="button" onClick={() => closeWindow(windowId)} className="font-semibold py-2 px-4 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-sm">Close</button>
                <button type="button" onClick={() => setIsReadOnly(false)} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-sm">
                    <Pencil size={16} /> Edit
                </button>
            </div>
        ) : (
            <div className="flex justify-end gap-3 w-full">
                <button type="button" onClick={handleCancelClick} className="bg-card hover:bg-muted text-foreground font-semibold py-2 px-4 rounded-md border border-border transition text-sm">Cancel</button>
                <button type="submit" form={`pdi-window-form-${windowId}`} disabled={isSaving} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                    {isEditMode ? 'Save Changes' : 'Save PDI'}
                </button>
            </div>
        );
        updateWindow(windowId, { title, footer });
    }, [windowId, isEditMode, isReadOnly, isSaving, formData.pdi_no, updateWindow, closeWindow, handleCancelClick]);

    return (
        <form id={`pdi-window-form-${windowId}`} onSubmit={handleSave} className="space-y-6 max-h-full overflow-y-auto p-1 pr-2 custom-scrollbar">
            <FormSection title="PDI Information">
                <div className="grid grid-cols-2 @md:grid-cols-4 gap-4">
                    <FormInput name="pdi_no" label="PDI No" value={formData.pdi_no} onChange={handleChange} readOnly />
                    <FormInput name="pdi_date" label="Date" type="date" value={formData.pdi_date} onChange={handleChange} readOnly={isReadOnly} required />
                    <FormInput name="so_no" label="SO No" value={formData.so_no} onChange={handleChange} readOnly={isReadOnly} />
                    <FormSelect name="status" label="Status" value={formData.status} onChange={handleChange} options={STATUS_OPTIONS as unknown as string[]} disabled={isReadOnly} />
                </div>
                <div className="grid grid-cols-1 @md:grid-cols-2 gap-4">
                    <FormSelect name="overall_condition" label="Overall Condition" value={formData.overall_condition} onChange={handleChange} options={CONDITION_OPTIONS as unknown as string[]} disabled={isReadOnly} />
                    <FormInput name="assigned_engineer" label="Assigned Engineer" value={formData.assigned_engineer} onChange={handleChange} readOnly={isReadOnly} />
                </div>
            </FormSection>

            <FormSection title="Customer">
                <div className="grid grid-cols-1 @md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-muted-foreground/60">Company Name</label>
                        <SearchableSelect
                            value={formData.company_name ?? ''}
                            onChange={v => setFormData(prev => ({ ...prev, company_name: v, contact_name: prev.company_name !== v ? '' : prev.contact_name }))}
                            options={companyOptions}
                            placeholder="Search or type company..."
                            allowCustomValue
                            disabled={isReadOnly}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-muted-foreground/60">Contact Name</label>
                        <SearchableSelect
                            value={formData.contact_name ?? ''}
                            onChange={v => setFormData(prev => ({ ...prev, contact_name: v }))}
                            options={contactOptions}
                            placeholder="Search or type contact..."
                            allowCustomValue
                            disabled={isReadOnly}
                        />
                    </div>
                </div>
            </FormSection>

            <FormSection title="Inspection Details">
                <FormTextarea name="inspection_notes" label="Inspection Notes" value={formData.inspection_notes} onChange={handleChange} rows={2} readOnly={isReadOnly} />
                <FormTextarea name="software_installed" label="Software Installed" value={formData.software_installed} onChange={handleChange} rows={2} readOnly={isReadOnly} />
                <div className="grid grid-cols-1 @md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 mt-4">
                        <input type="checkbox" id={`warranty_seal_applied-${windowId}`} name="warranty_seal_applied" checked={!!formData.warranty_seal_applied} onChange={handleChange} disabled={isReadOnly} className="w-4 h-4 rounded border-border" />
                        <label htmlFor={`warranty_seal_applied-${windowId}`} className="text-sm font-medium">Warranty Seal Applied</label>
                    </div>
                    <FormInput name="warranty_seal_number" label="Seal Number" value={formData.warranty_seal_number} onChange={handleChange} readOnly={isReadOnly} />
                    <FormInput name="seal_photo_url" label="Seal Photo URL" value={formData.seal_photo_url} onChange={handleChange} readOnly={isReadOnly} />
                </div>
            </FormSection>

            <FormSection title="Inspection Items">
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div key={index} className="bg-muted/40 rounded-lg border border-border p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded">#{index + 1}</span>
                                {!isReadOnly && (
                                    <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1}
                                        className="p-1.5 text-muted-foreground hover:text-rose-500 disabled:opacity-30 transition rounded-full hover:bg-rose-500/10">
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 @md:grid-cols-3 gap-3">
                                <FormInput label="Serial Number" value={item.serial_number} onChange={e => handleItemChange(index, 'serial_number', e.target.value)} name={`sn-${windowId}-${index}`} readOnly={isReadOnly} />
                                <FormInput label="Brand" value={item.brand} onChange={e => handleItemChange(index, 'brand', e.target.value)} name={`brand-${windowId}-${index}`} readOnly={isReadOnly} />
                                <FormInput label="Model" value={item.model_name} onChange={e => handleItemChange(index, 'model_name', e.target.value)} name={`model-${windowId}-${index}`} readOnly={isReadOnly} />
                            </div>
                            <div className="grid grid-cols-2 @md:grid-cols-5 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-muted-foreground/60">Physical</label>
                                    <select value={item.physical_condition} onChange={e => handleItemChange(index, 'physical_condition', e.target.value)} disabled={isReadOnly} className="bg-muted border border-border rounded-lg p-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                        {TEST_OPTIONS.map(o => <option key={o}>{o}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-muted-foreground/60">Power</label>
                                    <select value={item.power_test} onChange={e => handleItemChange(index, 'power_test', e.target.value)} disabled={isReadOnly} className="bg-muted border border-border rounded-lg p-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                        {TEST_OPTIONS.map(o => <option key={o}>{o}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-muted-foreground/60">Software</label>
                                    <select value={item.software_test} onChange={e => handleItemChange(index, 'software_test', e.target.value)} disabled={isReadOnly} className="bg-muted border border-border rounded-lg p-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                        {TEST_OPTIONS.map(o => <option key={o}>{o}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-muted-foreground/60">Accessories</label>
                                    <select value={item.accessories_check} onChange={e => handleItemChange(index, 'accessories_check', e.target.value)} disabled={isReadOnly} className="bg-muted border border-border rounded-lg p-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                        {TEST_OPTIONS.map(o => <option key={o}>{o}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 pt-5">
                                    <input type="checkbox" id={`seal-${windowId}-${index}`} checked={!!item.seal_applied} onChange={e => handleItemChange(index, 'seal_applied', e.target.checked)} disabled={isReadOnly} className="w-4 h-4 rounded border-border" />
                                    <label htmlFor={`seal-${windowId}-${index}`} className="text-sm">Seal</label>
                                </div>
                            </div>
                            <FormInput label="Item Notes" value={item.item_notes} onChange={e => handleItemChange(index, 'item_notes', e.target.value)} name={`notes-${windowId}-${index}`} readOnly={isReadOnly} />
                        </div>
                    ))}
                </div>
                {!isReadOnly && (
                    <button
                        type="button"
                        onClick={addItem}
                        className="mt-3 flex items-center gap-2 text-sm text-brand-500 hover:text-brand-400 font-semibold transition"
                    >
                        <Plus size={16} /> Add Item
                    </button>
                )}
            </FormSection>
        </form>
    );
};

export default PdiWindowContent;
