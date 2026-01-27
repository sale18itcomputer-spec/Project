import React, { useState, useEffect, useCallback } from 'react';
import { PricelistItem } from '../types';
import { createRecord, updateRecord, deleteRecord } from '../services/api';
import { FormSection, FormInput, FormTextarea, FormSelect, FormDisplay } from './FormControls';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useB2B } from '../contexts/B2BContext';
import { useToast } from '../contexts/ToastContext';
import ConfirmationModal from './ConfirmationModal';
import ResizableModal from './ResizableModal';
import { GoogleGenAI } from '@google/genai';
import { Check, Pencil, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

// --- Environment Variable Note ---
// The Google Gemini API Key is securely managed as an environment variable (`process.env.API_KEY`).
// It is NOT hardcoded in the application. You can assume this is configured in the deployment environment.
// ---

interface NewPricelistItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingData?: PricelistItem | null;
    initialReadOnly?: boolean;
}

const STATUS_OPTIONS = ['Available', 'Pre-Order', 'Out of Stock'];

const NewPricelistItemModal: React.FC<NewPricelistItemModalProps> = ({ isOpen, onClose, existingData, initialReadOnly = false }) => {
    const { pricelist, setPricelist } = useData();
    const { currentUser } = useAuth();
    const { isB2B } = useB2B();
    const { addToast } = useToast();

    const showDealerPrice = React.useMemo(() => {
        const role = currentUser?.Role?.toLowerCase();
        return role === 'admin' || role === 'b2b' || isB2B;
    }, [currentUser, isB2B]);

    const [formData, setFormData] = useState<Partial<PricelistItem>>({});
    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isSearchingWebsite, setIsSearchingWebsite] = useState(false);

    const isEditMode = !!existingData;

    const getInitialState = useCallback(() => {
        return {
            'Status': 'Available',
            'Sheet Name': '',
            'Dealer Price': '',
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            setIsReadOnly(initialReadOnly);
            if (isEditMode) {
                setFormData(existingData);
            } else {
                setFormData(getInitialState());
            }
            setDeleteConfirmOpen(false);
        }
    }, [isOpen, existingData, isEditMode, initialReadOnly, getInitialState]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleFindWebsite = async (brand?: string, model?: string) => {
        if (!brand || !model) {
            addToast('Brand and Model are required to search.', 'error');
            return;
        }
        setIsSearchingWebsite(true);
        try {
            if (!process.env.API_KEY) {
                throw new Error("API key is not configured.");
            }
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Find the official product website for "${brand} ${model}". Return only the URL, nothing else.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            const url = response.text.trim();

            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                window.open(url, '_blank', 'noopener,noreferrer');
            } else {
                addToast('Could not find a valid product website.', 'error');
            }

        } catch (err: any) {
            console.error("Error finding product website:", err);
            addToast(err.message || "An unexpected error occurred while searching.", 'error');
        } finally {
            setIsSearchingWebsite(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Helper to ensure numeric values are sent correctly
        const toNumeric = (val: any) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            return parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0;
        };

        // Prepare submission data - exclude computed fields like 'fullDescription'
        const { fullDescription, ...cleanFormData } = formData as any;

        const submissionData = {
            ...cleanFormData,
            'Sheet Name': formData['Sheet Name'] || '',
            'Dealer Price': toNumeric(formData['Dealer Price']),
            'End User Price': toNumeric(formData['End User Price']),
        };

        if (!submissionData.Code) {
            addToast('Code is required.', 'error');
            return;
        }

        onClose();

        if (isEditMode) {
            const originalPricelist = pricelist ? [...pricelist] : [];
            const updatedId = existingData.Code;
            // Optimistic update
            setPricelist(current => current ? current.map(p => p.Code === updatedId ? { ...p, ...submissionData } as PricelistItem : p) : null);

            try {
                const updatedRecord: PricelistItem = await updateRecord('Raw', updatedId, submissionData);
                addToast('Pricelist item updated!', 'success');
                // Replace optimistic with server record
                setPricelist(current => current ? current.map(p => p.Code === updatedId ? updatedRecord : p) : [updatedRecord]);
            } catch (err: any) {
                addToast(`Failed to update item: ${err.message}`, 'error');
                setPricelist(originalPricelist); // Revert
            }
        } else { // CREATE
            const tempId = submissionData.Code;
            // Optimistic update
            setPricelist(current => current ? [submissionData as PricelistItem, ...current] : [submissionData as PricelistItem]);

            try {
                const createdRecord: PricelistItem = await createRecord('Raw', submissionData);
                addToast('Pricelist item created!', 'success');
                // Replace temp record with the one from the server.
                setPricelist(current => {
                    if (!current) return [createdRecord];
                    return current.map(p => p.Code === tempId ? createdRecord : p);
                });
            } catch (err: any) {
                addToast(`Failed to create item: ${err.message}`, 'error');
                // Revert by removing the optimistic data.
                setPricelist(current => current ? current.filter(p => p.Code !== tempId) : null);
            }
        }
    };

    const handleDelete = async () => {
        if (!existingData) return;

        const originalPricelist = pricelist ? [...pricelist] : [];
        const itemToDeleteId = existingData.Code;

        setDeleteConfirmOpen(false);
        onClose();

        setPricelist(current => current ? current.filter(p => p.Code !== itemToDeleteId) : null);

        try {
            const response: { deletedId: string } = await deleteRecord('Raw', itemToDeleteId);
            if (response.deletedId === itemToDeleteId) {
                addToast('Pricelist item deleted!', 'success');
            } else {
                throw new Error("Backend did not confirm deletion.");
            }
        } catch (err: any) {
            addToast(`Failed to delete item: ${err.message}`, 'error');
            setPricelist(originalPricelist); // Revert
        }
    };

    const title = isEditMode ? (isReadOnly ? `Details: ${existingData.Code}` : `Editing: ${existingData.Code}`) : 'Create New Pricelist Item';
    const submitText = isEditMode ? 'Save Changes' : 'Save Item';

    const handleCancelClick = () => {
        if (isEditMode) {
            setFormData(existingData);
            setIsReadOnly(true);
        } else {
            onClose();
        }
    };

    const formId = `pricelist-item-form-${existingData?.Code || 'new'}`;

    const modalFooter = (
        <div className="flex justify-between items-center w-full">
            {isReadOnly ? (
                <>
                    <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 font-semibold py-2 px-6 rounded-lg transition-all duration-200 border border-rose-500/50 text-rose-500 hover:bg-rose-500/10 disabled:opacity-50">
                        <Trash2 className="w-5 h-5" /> Delete
                    </button>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onClose} className="bg-card hover:bg-muted text-foreground font-semibold py-2 px-6 rounded-lg border border-border transition-all duration-200 shadow-sm">Close</button>
                        <button type="button" onClick={() => setIsReadOnly(false)} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 shadow-lg shadow-brand-500/20 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]">
                            <Pencil className="w-5 h-5" /> Edit
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex justify-end gap-3 w-full">
                    <button type="button" onClick={handleCancelClick} className="bg-card hover:bg-muted text-foreground font-semibold py-2 px-6 rounded-lg border border-border transition-all duration-200">Cancel</button>
                    <button type="submit" form={formId} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 shadow-lg shadow-brand-500/20 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]">
                        <Check className="w-5 h-5" />
                        {submitText}
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <>
            <ResizableModal
                isOpen={isOpen}
                onClose={onClose}
                title={title}
                footer={modalFooter}
            >
                <form id={formId} onSubmit={handleSubmit} className="space-y-6">
                    <FormSection title="General Information">
                        {isReadOnly || isEditMode ? <FormDisplay label="Code" value={formData.Code} /> : <FormInput name="Code" label="Code" value={formData.Code} onChange={handleChange} required />}
                        {isReadOnly ? <FormDisplay label="Brand" value={formData.Brand} /> : <FormInput name="Brand" label="Brand" value={formData.Brand} onChange={handleChange} />}
                        {isReadOnly ? (
                            <FormDisplay label="Model">
                                <div className="flex items-center justify-between w-full">
                                    <span className="truncate pr-2">{formData.Model}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 flex-shrink-0"
                                        onClick={() => handleFindWebsite(formData.Brand, formData.Model)}
                                        disabled={isSearchingWebsite || !formData.Brand || !formData.Model}
                                        title="Find product website"
                                    >
                                        {isSearchingWebsite ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </Button>
                                </div>
                            </FormDisplay>
                        ) : (
                            <FormInput name="Model" label="Model" value={formData.Model} onChange={handleChange} />
                        )}
                        {isReadOnly ? <FormDisplay label="Category" value={formData.Category} /> : <FormInput name="Category" label="Category" value={formData.Category} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Description" value={formData.Description} multiline /> : <FormTextarea name="Description" label="Description" value={formData.Description} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Promotion" value={formData.Promotion || '-'} /> : <FormInput name="Promotion" label="Promotion" value={formData.Promotion} onChange={handleChange} />}
                    </FormSection>

                    <FormSection title="Pricing & Status">
                        {showDealerPrice && (
                            isReadOnly ? <FormDisplay label="Dealer Price" value={formData['Dealer Price']} /> : <FormInput name="Dealer Price" label="Dealer Price" value={formData['Dealer Price']} onChange={handleChange} type="text" />
                        )}
                        {isReadOnly ? <FormDisplay label="Unit Price" value={formData['End User Price']} /> : <FormInput name="End User Price" label="Unit Price" value={formData['End User Price']} onChange={handleChange} type="text" />}
                        {isReadOnly ? <FormDisplay label="Status">{formData.Status && <StatusBadge status={formData.Status} />}</FormDisplay> : <FormSelect name="Status" label="Status" value={formData.Status} onChange={handleChange} options={STATUS_OPTIONS} />}
                    </FormSection>
                </form>
            </ResizableModal>
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Pricelist Item" confirmText="Delete">
                Are you sure you want to delete this item? This action cannot be undone.
            </ConfirmationModal>
        </>
    );
};

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (!status) return <span className="text-muted-foreground italic">N/A</span>;
    let colorClass = 'bg-muted text-muted-foreground';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('available')) colorClass = 'bg-emerald-500/10 text-emerald-500';
    else if (lowerStatus.includes('pre-order')) colorClass = 'bg-amber-500/10 text-amber-500';
    else if (lowerStatus.includes('out of stock')) colorClass = 'bg-rose-500/10 text-rose-500';
    return <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${colorClass}`}>{status}</span>;
};

export default NewPricelistItemModal;