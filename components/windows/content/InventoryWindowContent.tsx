'use client';

import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { useToast } from '../../../contexts/ToastContext';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import { supabase } from '../../../lib/supabase';
import { FormSection, FormInput, FormSelect, FormTextarea, FormDisplay } from '../../common/FormControls';
import { Check } from 'lucide-react';

const INVENTORY_STATUS_OPTIONS = ['In Stock', 'Reserved', 'Out of Stock'] as const;
const INVENTORY_CURRENCY_OPTIONS = ['USD', 'KHR'] as const;

interface InventoryWindowContentProps {
    windowId: string;
    itemId: string;
}

/**
 * Self-contained inventory item edit form, mounted directly by
 * WindowManagerRoot. Manages its own state and persists across page
 * navigation — independent of whichever page called openWindow().
 */
const InventoryWindowContent: React.FC<InventoryWindowContentProps> = ({ windowId, itemId }) => {
    const { inventoryItems, setInventoryItems } = useData();
    const { addToast } = useToast();
    const { closeWindow, updateWindow } = useWindowManager();

    const item = inventoryItems?.find(i => i.id === itemId) ?? null;

    const [formData, setFormData] = useState<Partial<InventoryItem>>(item ?? {});
    const [saving, setSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const updated = {
            category: formData.category,
            code: formData.code,
            brand: formData.brand,
            model_name: formData.model_name,
            description: formData.description,
            serial_number: formData.serial_number,
            qty: Number(formData.qty) || 0,
            unit_price: Number(formData.unit_price) || 0,
            currency: formData.currency,
            status: formData.status,
        };

        try {
            const { error } = await supabase
                .from('inventory')
                .update({ ...updated, updated_at: new Date().toISOString() })
                .eq('id', itemId);
            if (error) throw error;
            setInventoryItems(prev => prev ? prev.map(i => i.id === itemId ? { ...i, ...updated } : i) : null);
            addToast('Inventory item updated.', 'success');
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to update: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        const title = `Editing: ${formData.model_name || formData.code || 'Inventory Item'}`;
        const footer = (
            <div className="flex justify-end gap-3 w-full">
                <button type="button" onClick={() => closeWindow(windowId)} className="py-2 px-4 border border-border rounded-lg hover:bg-muted transition">Cancel</button>
                <button type="submit" form={`edit-inventory-form-${windowId}`} disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50">
                    <Check size={20} /> {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        );

        updateWindow(windowId, { title, footer });
    }, [formData.model_name, formData.code, saving, windowId, updateWindow, closeWindow]);

    if (!item) {
        return <p className="text-muted-foreground">This inventory item no longer exists.</p>;
    }

    return (
        <form id={`edit-inventory-form-${windowId}`} onSubmit={handleSubmit} className="space-y-6">
            <FormSection title="Item Details">
                <FormInput name="category" label="Category" value={formData.category} onChange={handleChange} placeholder="e.g. Components & Parts" />
                <FormInput name="code" label="Code" value={formData.code} onChange={handleChange} placeholder="e.g. ABC-123" />
                <FormInput name="brand" label="Brand" value={formData.brand} onChange={handleChange} placeholder="e.g. ASUS" />
                <FormInput name="model_name" label="Model" value={formData.model_name} onChange={handleChange} placeholder="e.g. ROG Strix B650" />
                <FormInput name="serial_number" label="Serial Number" value={formData.serial_number} onChange={handleChange} placeholder="Device serial (comma-separate if more than one)" />
                <FormTextarea name="description" label="Description" value={formData.description} onChange={handleChange} rows={3} />
            </FormSection>

            <FormSection title="Stock & Pricing">
                <FormInput name="qty" label="Qty" type="number" value={formData.qty} onChange={handleChange} step="0.01" />
                <FormInput name="unit_price" label="Unit Price" type="number" value={formData.unit_price} onChange={handleChange} step="0.01" />
                <FormSelect name="currency" label="Currency" value={formData.currency} onChange={handleChange} options={INVENTORY_CURRENCY_OPTIONS} />
                <FormSelect name="status" label="Status" value={formData.status} onChange={handleChange} options={INVENTORY_STATUS_OPTIONS} />
            </FormSection>

            <FormSection title="Source">
                <FormDisplay label="Source PO" value={formData.po_number} />
                <FormDisplay label="Vendor" value={formData.vendor_name} />
            </FormSection>
        </form>
    );
};

export default InventoryWindowContent;
