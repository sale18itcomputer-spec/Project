import React, { useState, useEffect, useCallback } from 'react';
import { VendorPricelistItem, Vendor } from '../types';
import { insertRecord, updateRecord, deleteRecord } from '../utils/b2bDb';
import { useData } from '../contexts/DataContext';
import { FormSection, FormInput, FormTextarea, FormDisplay } from './FormControls';
import { useAuth } from '../contexts/AuthContext';
import { Check, Pencil, Trash2 } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import ResizableModal from './ResizableModal';

interface NewVendorPricelistItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingData?: VendorPricelistItem | null;
    initialReadOnly?: boolean;
    vendors: Vendor[];
}

const NewVendorPricelistItemModal: React.FC<NewVendorPricelistItemModalProps> = ({ isOpen, onClose, existingData, initialReadOnly = false, vendors }) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { refetchData } = useData();


    const [formData, setFormData] = useState<Partial<VendorPricelistItem>>({});
    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const isEditMode = !!existingData;

    useEffect(() => {
        if (isOpen) {
            setIsReadOnly(initialReadOnly);
            if (isEditMode && existingData) {
                setFormData(existingData);
            } else {
                setFormData({
                    status: 'Available',
                    currency: 'USD',
                    created_by: currentUser?.Name || '',
                });
            }
        }
    }, [isOpen, existingData, isEditMode, initialReadOnly, currentUser]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'number' ? parseFloat(value) : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.vendor_id) {
            addToast('Please select a vendor', 'error');
            return;
        }

        onClose();

        // Clean payload: Remove virtual fields and technical timestamps/IDs for the update/insert
        const submissionData = { ...formData };
        const fieldsToExclude = ['vendor_name', 'id', 'created_at', 'updated_at'];
        fieldsToExclude.forEach(field => delete (submissionData as any)[field]);

        if (isEditMode && existingData) {
            try {
                await updateRecord('vendor_pricelist', 'id', existingData.id, submissionData, false);
                addToast('Item updated!', 'success');
                refetchData();
            } catch (err: any) {
                addToast(`Failed to update item: ${err.message}`, 'error');
            }
        } else {
            try {
                await insertRecord('vendor_pricelist', submissionData, false);
                addToast('Item added!', 'success');
                refetchData();
            } catch (err: any) {
                addToast(`Failed to add item: ${err.message}`, 'error');
            }
        }

    };

    const handleDelete = async () => {
        if (!existingData) return;
        setDeleteConfirmOpen(false);
        onClose();

        try {
            await deleteRecord('vendor_pricelist', 'id', existingData.id, false);
            addToast('Item deleted!', 'success');
        } catch (err: any) {
            addToast(`Failed to delete item: ${err.message}`, 'error');
        }
    };

    const title = isEditMode ? (isReadOnly ? `Item: ${existingData.model_name}` : `Editing: ${existingData.model_name}`) : 'Add Pricelist Item';

    const footer = (
        <div className="flex justify-between items-center w-full">
            {isReadOnly ? (
                <>
                    <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 text-rose-500 hover:bg-rose-500/10 py-2 px-4 rounded-lg transition-colors" title="Delete">
                        <Trash2 size={20} /> Delete
                    </button>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 border rounded-lg">Close</button>
                        <button type="button" onClick={() => setIsReadOnly(false)} className="bg-brand-600 text-white py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg shadow-brand-600/20 hover:bg-brand-700 transition">
                            <Pencil size={20} /> Edit
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex justify-end gap-3 w-full">
                    <button type="button" onClick={onClose} className="py-2 px-4 border rounded-lg">Cancel</button>
                    <button type="submit" form="pricelist-item-form" className="bg-brand-600 text-white py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg shadow-brand-600/20 hover:bg-brand-700 transition">
                        <Check size={20} /> Save Item
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <>
            <ResizableModal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
                <form id="pricelist-item-form" onSubmit={handleSubmit} className="p-1 space-y-6">
                    <FormSection title="Basic Info">
                        {isReadOnly ? (
                            <FormDisplay label="Vendor" value={formData.vendor_name} />
                        ) : (
                            <div className="flex flex-col">
                                <label className="text-sm font-medium text-muted-foreground/60 mb-1.5">Vendor *</label>
                                <select
                                    name="vendor_id"
                                    value={formData.vendor_id}
                                    onChange={handleChange}
                                    className="bg-muted border border-border/50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 outline-none transition"
                                    required
                                >
                                    <option value="">Select Vendor</option>
                                    {vendors.map(v => (
                                        <option key={v.id} value={v.id}>{v.vendor_name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {isReadOnly ? <FormDisplay label="Brand" value={formData.brand} /> : <FormInput name="brand" label="Brand" value={formData.brand} onChange={handleChange} placeholder="e.g. Dell, HP, etc." />}
                        {isReadOnly ? <FormDisplay label="Model Name" value={formData.model_name} /> : <FormInput name="model_name" label="Model Name" value={formData.model_name} onChange={handleChange} required />}
                    </FormSection>

                    <FormSection title="Specification">
                        {isReadOnly ? <FormDisplay label="Specification" value={formData.specification} multiline /> : <FormTextarea name="specification" label="Specification" value={formData.specification} onChange={handleChange} placeholder="Item technical specifications..." rows={4} />}
                    </FormSection>

                    <FormSection title="Pricing & Promotion">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Dealer Price - Hidden for Sales roles */}
                            {currentUser?.Role !== 'Sales' && currentUser?.Role !== 'Senior Corporate Sales' && (
                                isReadOnly ? <FormDisplay label="Dealer Price" value={formData.dealer_price?.toLocaleString()} /> : <FormInput name="dealer_price" label="Dealer Price" value={formData.dealer_price?.toString()} onChange={handleChange} type="number" step="0.01" required />
                            )}
                            {isReadOnly ? <FormDisplay label="User Price" value={formData.user_price?.toLocaleString()} /> : <FormInput name="user_price" label="User Price" value={formData.user_price?.toString()} onChange={handleChange} type="number" step="0.01" />}
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
                        </div>
                        {/* Promotion - Hidden for Sales roles */}
                        {currentUser?.Role !== 'Sales' && currentUser?.Role !== 'Senior Corporate Sales' && (
                            isReadOnly ? <FormDisplay label="Promotion" value={formData.promotion} /> : <FormInput name="promotion" label="Promotion / Special Offer" value={formData.promotion} onChange={handleChange} placeholder="e.g. 10% Off, Buy 1 Get 1" />
                        )}
                    </FormSection>

                    <FormSection title="Remarks">
                        {isReadOnly ? <FormDisplay label="Remarks" value={formData.remarks} multiline /> : <FormTextarea name="remarks" label="Remarks" value={formData.remarks} onChange={handleChange} placeholder="Additional notes..." />}
                    </FormSection>
                </form>
            </ResizableModal>

            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Item">
                Are you sure you want to delete this pricelist item?
            </ConfirmationModal>
        </>
    );
};

export default NewVendorPricelistItemModal;
