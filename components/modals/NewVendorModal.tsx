'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Vendor } from "../../types";
import { insertRecord, updateRecord, deleteRecord } from "../../services/b2bDb";
import { FormSection, FormInput, FormTextarea, FormDisplay } from "../common/FormControls";
import { useAuth } from "../../contexts/AuthContext";
import { Check, Pencil, Trash2 } from 'lucide-react';
import ConfirmationModal from "./ConfirmationModal";
import { useToast } from "../../contexts/ToastContext";
import ResizableModal from "./ResizableModal";

interface NewVendorModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingData?: Vendor | null;
    initialReadOnly?: boolean;
}

const NewVendorModal: React.FC<NewVendorModalProps> = ({ isOpen, onClose, existingData, initialReadOnly = false }) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();

    const [formData, setFormData] = useState<Partial<Vendor>>({});
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
                    status: 'Active',
                    created_by: currentUser?.Name || '',
                });
            }
        }
    }, [isOpen, existingData, isEditMode, initialReadOnly, currentUser]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onClose();

        const submissionData = { ...formData };

        if (isEditMode && existingData) {
            try {
                await updateRecord('vendors', 'id', existingData.id, submissionData, false);
                addToast('Vendor updated!', 'success');
            } catch (err: any) {
                addToast(`Failed to update vendor: ${err.message}`, 'error');
            }
        } else {
            try {
                await insertRecord('vendors', submissionData, false);
                addToast('Vendor created!', 'success');
            } catch (err: any) {
                addToast(`Failed to create vendor: ${err.message}`, 'error');
            }
        }
    };

    const handleDelete = async () => {
        if (!existingData) return;
        setDeleteConfirmOpen(false);
        onClose();

        try {
            await deleteRecord('vendors', 'id', existingData.id, false);
            addToast('Vendor deleted!', 'success');
        } catch (err: any) {
            addToast(`Failed to delete vendor: ${err.message}`, 'error');
        }
    };

    const title = isEditMode ? (isReadOnly ? `Vendor: ${existingData.vendor_name}` : `Editing: ${existingData.vendor_name}`) : 'Add New Vendor';

    const footer = (
        <div className="flex justify-between items-center w-full">
            {isReadOnly ? (
                <>
                    <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 text-rose-500 hover:bg-rose-500/10 py-2 px-4 rounded-lg transition-colors">
                        <Trash2 size={20} /> Delete
                    </button>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 border rounded-lg">Close</button>
                        <button type="button" onClick={() => setIsReadOnly(false)} className="bg-brand-600 text-white py-2 px-4 rounded-lg flex items-center gap-2">
                            <Pencil size={20} /> Edit
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex justify-end gap-3 w-full">
                    <button type="button" onClick={onClose} className="py-2 px-4 border rounded-lg">Cancel</button>
                    <button type="submit" form="vendor-form" className="bg-brand-600 text-white py-2 px-4 rounded-lg flex items-center gap-2">
                        <Check size={20} /> Save Vendor
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <>
            <ResizableModal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
                <form id="vendor-form" onSubmit={handleSubmit} className="space-y-6">
                    <FormSection title="Basic Information">
                        {isReadOnly ? <FormDisplay label="Vendor Name" value={formData.vendor_name} /> : <FormInput name="vendor_name" label="Vendor Name" value={formData.vendor_name} onChange={handleChange} required />}
                        {isReadOnly ? <FormDisplay label="Category" value={formData.category} /> : <FormInput name="category" label="Category" value={formData.category} onChange={handleChange} placeholder="e.g. Hardware, Software" />}
                        {isReadOnly ? (
                            <FormDisplay label="Status" value={formData.status} />
                        ) : (
                            <div className="flex flex-col">
                                <label className="text-sm font-medium text-muted-foreground/60 mb-1.5">Status</label>
                                <select name="status" value={formData.status} onChange={handleChange} className="bg-muted border rounded-lg p-2.5 text-sm">
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="Blocked">Blocked</option>
                                </select>
                            </div>
                        )}
                    </FormSection>

                    <FormSection title="Contact Person">
                        {isReadOnly ? <FormDisplay label="Contact Name" value={formData.contact_person} /> : <FormInput name="contact_person" label="Contact Name" value={formData.contact_person} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Phone" value={formData.phone} /> : <FormInput name="phone" label="Phone" value={formData.phone} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Email" value={formData.email} /> : <FormInput name="email" label="Email" value={formData.email} onChange={handleChange} type="email" />}
                    </FormSection>

                    <FormSection title="Company Details">
                        {isReadOnly ? <FormDisplay label="Tax ID" value={formData.tax_id} /> : <FormInput name="tax_id" label="Tax ID / TIN" value={formData.tax_id} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Payment Terms" value={formData.payment_terms} /> : <FormInput name="payment_terms" label="Payment Terms" value={formData.payment_terms} onChange={handleChange} placeholder="e.g. Net 30" />}
                        {isReadOnly ? <FormDisplay label="Address" value={formData.address} multiline /> : <FormTextarea name="address" label="Address" value={formData.address} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Website" value={formData.website} /> : <FormInput name="website" label="Website" value={formData.website} onChange={handleChange} type="url" />}
                    </FormSection>

                    <FormSection title="Remarks">
                        {isReadOnly ? <FormDisplay label="Remarks" value={formData.remarks} multiline /> : <FormTextarea name="remarks" label="Remarks" value={formData.remarks} onChange={handleChange} />}
                    </FormSection>
                </form>
            </ResizableModal>

            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Vendor">
                Are you sure you want to delete this vendor? This will also remove all their pricelist items.
            </ConfirmationModal>
        </>
    );
};

export default NewVendorModal;

