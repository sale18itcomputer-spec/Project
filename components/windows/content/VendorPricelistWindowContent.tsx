'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { VendorPricelistItem } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { insertRecord, updateRecord, deleteRecord } from '../../../services/b2bDb';
import { FormSection, FormInput, FormTextarea, FormDisplay } from '../../common/FormControls';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { Check, Pencil, Trash2 } from 'lucide-react';

interface VendorPricelistWindowContentProps {
    windowId: string;
    itemId: string | null;
    initialReadOnly?: boolean;
}

const VendorPricelistWindowContent: React.FC<VendorPricelistWindowContentProps> = ({ windowId, itemId, initialReadOnly = true }) => {
    const { vendorPricelist, vendors, refetchData } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { closeWindow, updateWindow } = useWindowManager();
    const { showField } = usePermissions();

    const canSeeVendorPricing = showField('showVendorPricing');

    const isEditMode = !!itemId;
    const item = itemId ? (vendorPricelist?.find(i => i.id === itemId) ?? null) : null;

    const [formData, setFormData] = useState<Partial<VendorPricelistItem>>(() =>
        isEditMode ? (item ?? {}) : { status: 'Available', currency: 'USD', created_by: currentUser?.Name || '' }
    );
    const [isReadOnly, setIsReadOnly] = useState(isEditMode ? initialReadOnly : false);
    const [saving, setSaving] = useState(false);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'number' ? parseFloat(value) : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    }, []);

    const handleCancelClick = useCallback(() => {
        if (isEditMode) {
            setFormData(item ?? {});
            setIsReadOnly(true);
        } else {
            closeWindow(windowId);
        }
    }, [isEditMode, item, windowId, closeWindow]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const submissionData = { ...formData };
        (['vendor_name', 'id', 'created_at', 'updated_at'] as const).forEach(f => delete (submissionData as any)[f]);

        if (!isEditMode && !submissionData.vendor_id) {
            addToast('Please select a vendor', 'error');
            return;
        }

        setSaving(true);
        try {
            if (isEditMode && itemId) {
                await updateRecord('vendor_pricelist', 'id', itemId, submissionData, false);
                addToast('Item updated!', 'success');
                refetchData();
                setIsReadOnly(true);
            } else {
                await insertRecord('vendor_pricelist', submissionData, false);
                addToast('Item added!', 'success');
                refetchData();
                closeWindow(windowId);
            }
        } catch (err: any) {
            addToast(`Failed to ${isEditMode ? 'update' : 'add'}: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!itemId) return;
        setDeleteConfirmOpen(false);
        try {
            await deleteRecord('vendor_pricelist', 'id', itemId, false);
            addToast('Item deleted!', 'success');
            refetchData();
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to delete: ${err.message}`, 'error');
        }
    };

    // Sync footer
    useEffect(() => {
        const title = isEditMode
            ? `${isReadOnly ? 'Item' : 'Editing'}: ${formData.model_name || itemId}`
            : 'Add Pricelist Item';

        const footer = isReadOnly ? (
            <div className="flex justify-between items-center w-full">
                <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="flex items-center gap-2 text-rose-500 hover:bg-rose-500/10 py-2 px-4 rounded-lg transition-colors font-semibold border border-rose-500/40"
                >
                    <Trash2 size={16} /> Delete
                </button>
                <div className="flex gap-3">
                    <button type="button" onClick={() => closeWindow(windowId)} className="py-2 px-4 border border-border rounded-lg hover:bg-muted transition">Close</button>
                    <button
                        type="button"
                        onClick={() => setIsReadOnly(false)}
                        className="bg-brand-600 hover:bg-brand-700 text-white py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg shadow-brand-600/20 transition"
                    >
                        <Pencil size={16} /> Edit
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex justify-end gap-3 w-full">
                <button type="button" onClick={handleCancelClick} className="py-2 px-4 border border-border rounded-lg hover:bg-muted transition">Cancel</button>
                <button
                    type="submit"
                    form={`vendor-pricelist-window-form-${windowId}`}
                    disabled={saving}
                    className="bg-brand-600 hover:bg-brand-700 text-white py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-brand-600/20 transition"
                >
                    <Check size={16} /> {saving ? 'Saving…' : (isEditMode ? 'Save Changes' : 'Save Item')}
                </button>
            </div>
        );

        updateWindow(windowId, { title, footer });
    }, [isEditMode, isReadOnly, saving, formData.model_name, itemId, windowId, updateWindow, closeWindow, handleCancelClick]);

    if (isEditMode && !item) {
        return <p className="text-muted-foreground">This vendor pricelist item no longer exists.</p>;
    }

    return (
        <>
            <form id={`vendor-pricelist-window-form-${windowId}`} onSubmit={handleSubmit} className="space-y-6">
                <FormSection title="Basic Info">
                    {isReadOnly ? (
                        <FormDisplay label="Vendor" value={formData.vendor_name} />
                    ) : (
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-muted-foreground/60 mb-1.5">Vendor{!isEditMode && <span className="text-rose-500 ml-1">*</span>}</label>
                            <select
                                name="vendor_id"
                                value={formData.vendor_id || ''}
                                onChange={handleChange}
                                required
                                className="bg-muted border border-border/50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 outline-none transition"
                            >
                                <option value="">Select Vendor</option>
                                {vendors?.map(v => (
                                    <option key={v.id} value={v.id}>{v.vendor_name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {isReadOnly ? <FormDisplay label="Brand" value={formData.brand} /> : <FormInput name="brand" label="Brand" value={formData.brand} onChange={handleChange} />}
                    {isReadOnly ? <FormDisplay label="Model Name" value={formData.model_name} /> : <FormInput name="model_name" label="Model Name" value={formData.model_name} onChange={handleChange} required />}
                </FormSection>

                <FormSection title="Specification">
                    {isReadOnly
                        ? <FormDisplay label="Specification" value={formData.specification} multiline />
                        : <FormTextarea name="specification" label="Specification" value={formData.specification} onChange={handleChange} rows={4} />
                    }
                </FormSection>

                <FormSection title="Pricing & Promotion">
                    {canSeeVendorPricing && (
                        isReadOnly
                            ? <FormDisplay label="Dealer Price" value={formData.dealer_price?.toLocaleString()} />
                            : <FormInput name="dealer_price" label="Dealer Price" value={formData.dealer_price?.toString()} onChange={handleChange} type="number" step="0.01" />
                    )}
                    {isReadOnly
                        ? <FormDisplay label="User Price" value={formData.user_price?.toLocaleString()} />
                        : <FormInput name="user_price" label="User Price" value={formData.user_price?.toString()} onChange={handleChange} type="number" step="0.01" />
                    }
                    {isReadOnly ? (
                        <FormDisplay label="Currency" value={formData.currency} />
                    ) : (
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-muted-foreground/60 mb-1.5">Currency</label>
                            <select name="currency" value={formData.currency} onChange={handleChange} className="bg-muted border border-border/50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 outline-none transition">
                                <option value="USD">USD ($)</option>
                                <option value="KHR">KHR (៛)</option>
                            </select>
                        </div>
                    )}
                    {isReadOnly ? (
                        <FormDisplay label="Status" value={formData.status} />
                    ) : (
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-muted-foreground/60 mb-1.5">Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} className="bg-muted border border-border/50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 outline-none transition">
                                <option value="Available">Available</option>
                                <option value="Out of Stock">Out of Stock</option>
                                <option value="Discontinued">Discontinued</option>
                            </select>
                        </div>
                    )}
                    {isReadOnly
                        ? <FormDisplay label="Promotion" value={formData.promotion} />
                        : <FormInput name="promotion" label="Promotion" value={formData.promotion} onChange={handleChange} />
                    }
                </FormSection>

                <FormSection title="Remarks">
                    {isReadOnly
                        ? <FormDisplay label="Remarks" value={formData.remarks} multiline />
                        : <FormTextarea name="remarks" label="Remarks" value={formData.remarks} onChange={handleChange} />
                    }
                </FormSection>
            </form>

            {isEditMode && (
                <ConfirmationModal
                    isOpen={isDeleteConfirmOpen}
                    onClose={() => setDeleteConfirmOpen(false)}
                    onConfirm={handleDelete}
                    title="Delete Vendor Pricelist Item"
                    confirmText="Delete"
                >
                    Are you sure you want to delete <strong>{item?.model_name}</strong>? This cannot be undone.
                </ConfirmationModal>
            )}
        </>
    );
};

export default VendorPricelistWindowContent;
