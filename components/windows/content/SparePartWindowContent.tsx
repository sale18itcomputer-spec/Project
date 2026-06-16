'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SparePart } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { generatePartNo } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { FormSection, FormInput, FormTextarea } from '@/components/common/FormControls';
import ConfirmationModal from '@/components/modals/ConfirmationModal';
import { Check, Pencil, Trash2, Loader2 } from 'lucide-react';

const STATUS_OPTIONS   = ['In Stock', 'Low Stock', 'Out of Stock', 'Discontinued'] as const;
const CATEGORY_OPTIONS = ['Spare Part', 'Replacement Unit', 'Accessory', 'Consumable'] as const;
const CURRENCY_OPTIONS = ['USD', 'KHR'] as const;
const UNIT_OPTIONS     = ['pcs', 'set', 'box', 'kg', 'liter', 'meter', 'roll'] as const;

interface SparePartWindowContentProps {
    windowId: string;
    partId: string | null;
    initialReadOnly?: boolean;
}

const SparePartWindowContent: React.FC<SparePartWindowContentProps> = ({ windowId, partId, initialReadOnly = false }) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { spareParts, setSpareParts } = useData();
    const { closeWindow, updateWindow } = useWindowManager();

    const [formData, setFormData] = useState<Partial<SparePart>>({});
    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const isEditMode = !!partId;
    const existingPart = useMemo(() => partId ? spareParts?.find(p => p.id === partId) ?? null : null, [spareParts, partId]);

    useEffect(() => {
        if (isEditMode && existingPart) {
            setFormData(existingPart);
        } else if (!isEditMode) {
            generatePartNo().then(no =>
                setFormData({
                    part_no: no,
                    status: 'In Stock',
                    category: 'Spare Part',
                    qty: 0,
                    unit: 'pcs',
                    unit_cost: 0,
                    currency: 'USD',
                    min_qty: 1,
                    created_by: currentUser?.Name || '',
                })
            );
        }
    }, [existingPart, isEditMode, currentUser]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
        }));
    }, []);

    const handleCancelClick = useCallback(() => {
        if (isEditMode && existingPart) {
            setFormData(existingPart);
            setIsReadOnly(true);
        } else {
            closeWindow(windowId);
        }
    }, [isEditMode, existingPart, windowId, closeWindow]);

    const handleSave = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!formData.part_name) { addToast('Part name is required.', 'error'); return; }
        setIsSaving(true);
        try {
            if (isEditMode && existingPart?.id) {
                const { id: _id, created_at: _ca, ...rest } = formData as any;
                const { data, error } = await supabase.from('spare_parts').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', existingPart.id).select().single();
                if (error) throw new Error(error.message);
                setSpareParts(prev => prev ? prev.map(p => p.id === existingPart.id ? data : p) : prev);
                addToast('Spare part updated!', 'success');
            } else {
                const { data, error } = await supabase.from('spare_parts').insert([{ ...formData, created_by: currentUser?.Name || '' }]).select().single();
                if (error) throw new Error(error.message);
                setSpareParts(prev => prev ? [data, ...prev] : [data]);
                addToast('Spare part added!', 'success');
            }
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to save: ${err.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }, [formData, isEditMode, existingPart, setSpareParts, addToast, closeWindow, windowId, currentUser]);

    const handleDelete = useCallback(async () => {
        if (!existingPart?.id) return;
        setDeleteConfirmOpen(false);
        try {
            await supabase.from('spare_parts').delete().eq('id', existingPart.id);
            setSpareParts(prev => prev ? prev.filter(p => p.id !== existingPart.id) : prev);
            addToast('Spare part deleted!', 'success');
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to delete: ${err.message}`, 'error');
        }
    }, [existingPart, setSpareParts, addToast, closeWindow, windowId]);

    // Dynamic title & footer
    useEffect(() => {
        const title = isEditMode
            ? (isReadOnly ? `Part: ${formData.part_no}` : `Editing: ${formData.part_no}`)
            : 'Add Spare Part';

        const footer = isReadOnly ? (
            <div className="flex justify-between items-center w-full">
                <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 text-rose-500 hover:bg-rose-500/10 py-2 px-4 rounded-lg transition-colors text-sm">
                    <Trash2 size={16} /> Delete
                </button>
                <div className="flex gap-3">
                    <button type="button" onClick={() => closeWindow(windowId)} className="font-semibold py-2 px-4 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-sm">Close</button>
                    <button type="button" onClick={() => setIsReadOnly(false)} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-sm">
                        <Pencil size={16} /> Edit
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex justify-end gap-3 w-full">
                <button type="button" onClick={handleCancelClick} className="bg-card hover:bg-muted text-foreground font-semibold py-2 px-4 rounded-md border border-border transition text-sm">Cancel</button>
                <button type="submit" form={`spare-part-window-form-${windowId}`} disabled={isSaving} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                    {isEditMode ? 'Save Changes' : 'Save Part'}
                </button>
            </div>
        );
        updateWindow(windowId, { title, footer });
    }, [windowId, isEditMode, isReadOnly, isSaving, formData.part_no, updateWindow, closeWindow, handleCancelClick]);

    return (
        <>
            <form id={`spare-part-window-form-${windowId}`} onSubmit={handleSave} className="space-y-6 max-h-full overflow-y-auto p-1 pr-2 custom-scrollbar">
                <FormSection title="Part Information">
                    <FormInput name="part_no" label="Part No" value={formData.part_no} onChange={handleChange} readOnly />
                    <FormInput name="part_name" label="Part Name" value={formData.part_name} onChange={handleChange} required readOnly={isReadOnly} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput name="brand" label="Brand" value={formData.brand} onChange={handleChange} readOnly={isReadOnly} />
                        <FormInput name="model_name" label="Model" value={formData.model_name} onChange={handleChange} readOnly={isReadOnly} />
                    </div>
                    {isReadOnly ? (
                        <span className="text-sm py-1">{formData.category}</span>
                    ) : (
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-muted-foreground/60">Category</label>
                            <select name="category" value={formData.category} onChange={handleChange} className="bg-muted border border-border rounded-lg p-2.5 text-sm">
                                {CATEGORY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                            </select>
                        </div>
                    )}
                </FormSection>

                <FormSection title="Stock">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FormInput name="qty" label="Quantity" type="number" value={formData.qty ?? 0} onChange={handleChange} readOnly={isReadOnly} />
                        {isReadOnly ? (
                            <span className="text-sm py-1 self-end">{formData.unit}</span>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-muted-foreground/60">Unit</label>
                                <select name="unit" value={formData.unit} onChange={handleChange} className="bg-muted border border-border rounded-lg p-2.5 text-sm">
                                    {UNIT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                                </select>
                            </div>
                        )}
                        <FormInput name="min_qty" label="Min Qty" type="number" value={formData.min_qty ?? 1} onChange={handleChange} readOnly={isReadOnly} />
                        <FormInput name="location" label="Location" value={formData.location} onChange={handleChange} readOnly={isReadOnly} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <FormInput name="unit_cost" label="Unit Cost" type="number" value={formData.unit_cost ?? 0} onChange={handleChange} readOnly={isReadOnly} />
                        {isReadOnly ? (
                            <span className="text-sm py-1 self-end">{formData.currency}</span>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-muted-foreground/60">Currency</label>
                                <select name="currency" value={formData.currency} onChange={handleChange} className="bg-muted border border-border rounded-lg p-2.5 text-sm">
                                    {CURRENCY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                                </select>
                            </div>
                        )}
                        <FormInput name="supplier_name" label="Supplier" value={formData.supplier_name} onChange={handleChange} readOnly={isReadOnly} />
                    </div>
                </FormSection>

                <FormSection title="Status & Remarks">
                    {isReadOnly ? (
                        <span className="text-sm py-1">{formData.status}</span>
                    ) : (
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-muted-foreground/60">Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} className="bg-muted border border-border rounded-lg p-2.5 text-sm">
                                {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                            </select>
                        </div>
                    )}
                    <FormTextarea name="remarks" label="Remarks" value={formData.remarks} onChange={handleChange} readOnly={isReadOnly} />
                </FormSection>
            </form>
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Spare Part" variant="danger">
                Are you sure you want to delete spare part "{existingPart?.part_no} - {existingPart?.part_name}"?
            </ConfirmationModal>
        </>
    );
};

export default SparePartWindowContent;
