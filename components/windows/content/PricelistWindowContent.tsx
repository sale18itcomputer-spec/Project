'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PricelistItem } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useB2B } from '../../../contexts/B2BContext';
import { useToast } from '../../../contexts/ToastContext';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import { createRecord, updateRecord, deleteRecord } from '../../../services/api';
import { FormSection, FormInput, FormTextarea, FormSelect, FormDisplay } from '../../common/FormControls';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { Check, Pencil, Trash2 } from 'lucide-react';

const STATUS_OPTIONS = ['Available', 'Pre-Order', 'Out of Stock'];

interface PricelistWindowContentProps {
    windowId: string;
    itemCode: string | null;
    initialReadOnly?: boolean;
}

const PricelistWindowContent: React.FC<PricelistWindowContentProps> = ({ windowId, itemCode, initialReadOnly = true }) => {
    const { pricelist, setPricelist } = useData();
    const { currentUser } = useAuth();
    const { isB2B } = useB2B();
    const { addToast } = useToast();
    const { closeWindow, updateWindow } = useWindowManager();

    const isEditMode = !!itemCode;
    const item = itemCode ? (pricelist?.find(i => i.Code === itemCode) ?? null) : null;

    const showDealerPrice = React.useMemo(() => {
        const role = currentUser?.Role?.toLowerCase();
        return role === 'admin' || role === 'b2b' || isB2B;
    }, [currentUser, isB2B]);

    const [formData, setFormData] = useState<Partial<PricelistItem>>(() =>
        isEditMode ? (item ?? {}) : { Status: 'Available', Currency: 'USD', 'Dealer Price': '' }
    );
    const [isReadOnly, setIsReadOnly] = useState(isEditMode ? initialReadOnly : false);
    const [saving, setSaving] = useState(false);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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

        const toNumeric = (val: any) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            return parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0;
        };

        const { fullDescription: _, ...cleanData } = formData as any;
        const submissionData = {
            ...cleanData,
            'Dealer Price': toNumeric(formData['Dealer Price']),
            'End User Price': toNumeric(formData['End User Price']),
        };

        if (!isEditMode && !submissionData.Code) {
            addToast('Code is required.', 'error');
            return;
        }

        setSaving(true);
        try {
            if (isEditMode && itemCode) {
                const updatedRecord: PricelistItem = await updateRecord('Raw', itemCode, submissionData);
                setPricelist(curr => curr ? curr.map(p => p.Code === itemCode ? updatedRecord : p) : [updatedRecord]);
                addToast('Pricelist item updated!', 'success');
                setIsReadOnly(true);
            } else {
                const createdRecord: PricelistItem = await createRecord('Raw', submissionData);
                setPricelist(curr => curr ? [createdRecord, ...curr] : [createdRecord]);
                addToast('Pricelist item created!', 'success');
                closeWindow(windowId);
            }
        } catch (err: any) {
            addToast(`Failed to ${isEditMode ? 'update' : 'create'}: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!itemCode) return;
        setDeleteConfirmOpen(false);
        const original = pricelist ? [...pricelist] : [];
        setPricelist(curr => curr ? curr.filter(p => p.Code !== itemCode) : null);
        try {
            await deleteRecord('Raw', itemCode);
            addToast('Pricelist item deleted!', 'success');
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to delete: ${err.message}`, 'error');
            setPricelist(original);
        }
    };

    // Sync footer whenever read/edit mode or saving state changes
    useEffect(() => {
        const title = isEditMode
            ? `${isReadOnly ? 'Item' : 'Editing'}: ${formData.Code || itemCode}`
            : 'Create New Pricelist Item';

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
                    form={`pricelist-window-form-${windowId}`}
                    disabled={saving}
                    className="bg-brand-600 hover:bg-brand-700 text-white py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-brand-600/20 transition"
                >
                    <Check size={16} /> {saving ? 'Saving…' : (isEditMode ? 'Save Changes' : 'Save Item')}
                </button>
            </div>
        );

        updateWindow(windowId, { title, footer });
    }, [isEditMode, isReadOnly, saving, formData.Code, itemCode, windowId, updateWindow, closeWindow, handleCancelClick]);

    if (isEditMode && !item) {
        return <p className="text-muted-foreground">This pricelist item no longer exists.</p>;
    }

    return (
        <>
            <form id={`pricelist-window-form-${windowId}`} onSubmit={handleSubmit} className="space-y-6">
                <FormSection title="General Information">
                    {isEditMode
                        ? <FormDisplay label="Code" value={formData.Code} />
                        : <FormInput name="Code" label="Code" value={formData.Code} onChange={handleChange} required />
                    }
                    {isReadOnly ? <FormDisplay label="Brand" value={formData.Brand} /> : <FormInput name="Brand" label="Brand" value={formData.Brand} onChange={handleChange} />}
                    {isReadOnly ? <FormDisplay label="Model" value={formData.Model} /> : <FormInput name="Model" label="Model" value={formData.Model} onChange={handleChange} />}
                    {isReadOnly ? <FormDisplay label="Category" value={formData.Category} /> : <FormInput name="Category" label="Category" value={formData.Category} onChange={handleChange} />}
                    {isReadOnly ? <FormDisplay label="Description" value={formData.Description} multiline /> : <FormTextarea name="Description" label="Description" value={formData.Description} onChange={handleChange} />}
                    {isReadOnly ? <FormDisplay label="Promotion" value={formData.Promotion || '-'} /> : <FormInput name="Promotion" label="Promotion" value={formData.Promotion} onChange={handleChange} />}
                </FormSection>

                <FormSection title="Pricing & Status">
                    {showDealerPrice && (
                        isReadOnly
                            ? <FormDisplay label="Dealer Price" value={formData['Dealer Price']} />
                            : <FormInput name="Dealer Price" label="Dealer Price" value={formData['Dealer Price']} onChange={handleChange} type="text" />
                    )}
                    {isReadOnly
                        ? <FormDisplay label="Unit Price" value={formData['End User Price']} />
                        : <FormInput name="End User Price" label="Unit Price" value={formData['End User Price']} onChange={handleChange} type="text" />
                    }
                    {isReadOnly
                        ? <FormDisplay label="Status" value={formData.Status} />
                        : <FormSelect name="Status" label="Status" value={formData.Status} onChange={handleChange} options={STATUS_OPTIONS} />
                    }
                </FormSection>
            </form>

            {isEditMode && (
                <ConfirmationModal
                    isOpen={isDeleteConfirmOpen}
                    onClose={() => setDeleteConfirmOpen(false)}
                    onConfirm={handleDelete}
                    title="Delete Pricelist Item"
                    confirmText="Delete"
                >
                    Are you sure you want to delete <strong>{itemCode}</strong>? This action cannot be undone.
                </ConfirmationModal>
            )}
        </>
    );
};

export default PricelistWindowContent;
