'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ContactLog, Company, Contact } from '@/types';
import { createRecord, updateRecord, deleteRecord } from '@/services/api';
import { FormSection, FormInput, FormTextarea, FormSelect } from '@/components/common/FormControls';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/contexts/ToastContext';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { formatToSheetDate, formatToInputDate } from '@/utils/time';
import { Check, Trash2, Loader2 } from 'lucide-react';
import ConfirmationModal from '@/components/modals/ConfirmationModal';
import NewCompanyModal from '@/components/modals/NewCompanyModal';
import NewContactModal from '@/components/modals/NewContactModal';
import SearchableSelect from '@/components/common/SearchableSelect';

const TYPE_OPTIONS = ['Call', 'Message', 'Email'];

const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

interface ContactLogWindowContentProps {
    windowId: string;
    logId: string | null;
}

const ContactLogWindowContent: React.FC<ContactLogWindowContentProps> = ({
    windowId,
    logId,
}) => {
    const { currentUser } = useAuth();
    const { companies, contacts, contactLogs, setContactLogs } = useData();
    const { addToast } = useToast();
    const { closeWindow, updateWindow } = useWindowManager();

    const [formData, setFormData] = useState<Partial<ContactLog>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
    const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);

    const isEditMode = !!logId;
    const existingData = useMemo(() => contactLogs?.find(l => l['Log ID'] === logId) || null, [contactLogs, logId]);

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const contactOptions = useMemo(() => contacts?.filter(c => c['Company Name'] === formData['Company Name']).map(c => c.Name) || [], [contacts, formData['Company Name']]);
    const filteredContacts = useMemo(() => contacts?.filter(c => c['Company Name'] === formData['Company Name']) || [], [contacts, formData['Company Name']]);

    const getInitialState = useCallback((): Partial<ContactLog> => {
        let nextId = 'CONTL00000001';
        if (contactLogs && contactLogs.length > 0) {
            const nums = contactLogs.map(l => l['Log ID']).filter(id => id?.startsWith('CONTL')).map(id => parseInt(id!.substring(5), 10)).filter(n => !isNaN(n));
            if (nums.length > 0) nextId = `CONTL${String(Math.max(...nums) + 1).padStart(8, '0')}`;
        }
        return { 'Log ID': nextId, 'Contact Date': getTodayDateString(), 'Responsible By': currentUser?.Name || '', 'Type': 'Call' };
    }, [contactLogs, currentUser]);

    useEffect(() => {
        if (isEditMode && existingData) {
            setFormData({ ...existingData, 'Contact Date': formatToInputDate(existingData['Contact Date']) });
        } else if (!isEditMode) {
            setFormData(getInitialState());
        }
    }, [existingData, isEditMode, getInitialState]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleCompanySelect = (companyName: string) => {
        setFormData(prev => ({ ...prev, 'Company Name': companyName, 'Contact Name': '', 'Position': '', 'Phone Number': '', 'Email': '' }));
    };

    const handleContactChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const contactName = e.target.value;
        const selected = filteredContacts.find(c => c.Name === contactName);
        setFormData(prev => ({
            ...prev, 'Contact Name': contactName,
            'Position': selected?.Role || '',
            'Phone Number': selected?.['Tel (1)'] || '',
            'Email': selected?.Email || '',
        }));
    };

    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSubmitting(true);
        const submissionData: Partial<ContactLog> = { ...formData, 'Contact Date': formatToSheetDate(formData['Contact Date']) };

        if (isEditMode && existingData) {
            const originalLogs = contactLogs ? [...contactLogs] : [];
            const updatedId = existingData['Log ID']!;
            setContactLogs(cur => cur ? cur.map(l => l['Log ID'] === updatedId ? { ...l, ...submissionData } as ContactLog : l) : null);
            try {
                const updated: ContactLog = await updateRecord('Contact_Logs', updatedId, submissionData);
                setContactLogs(cur => cur ? cur.map(l => l['Log ID'] === updatedId ? updated : l) : [updated]);
                addToast('Contact log updated!', 'success');
                closeWindow(windowId);
            } catch (err: any) {
                addToast(`Failed to update: ${err.message}`, 'error');
                setContactLogs(originalLogs);
                setIsSubmitting(false);
            }
        } else {
            const tempId = submissionData['Log ID']!;
            setContactLogs(cur => cur ? [submissionData as ContactLog, ...cur] : [submissionData as ContactLog]);
            try {
                const created: ContactLog = await createRecord('Contact_Logs', submissionData);
                setContactLogs(cur => cur ? cur.map(l => l['Log ID'] === tempId ? created : l) : [created]);
                addToast('Contact log created!', 'success');
                closeWindow(windowId);
            } catch (err: any) {
                addToast(`Failed to create: ${err.message}`, 'error');
                setContactLogs(cur => cur ? cur.filter(l => l['Log ID'] !== tempId) : null);
                setIsSubmitting(false);
            }
        }
    }, [formData, isEditMode, existingData, contactLogs, setContactLogs, addToast, closeWindow, windowId]);

    const handleDelete = async () => {
        if (!existingData?.['Log ID']) return;
        const originalLogs = contactLogs ? [...contactLogs] : [];
        const id = existingData['Log ID'];
        setDeleteConfirmOpen(false);
        setContactLogs(cur => cur ? cur.filter(l => l['Log ID'] !== id) : null);
        try {
            await deleteRecord('Contact_Logs', id);
            addToast('Contact log deleted!', 'success');
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to delete: ${err.message}`, 'error');
            setContactLogs(originalLogs);
        }
    };

    const isContactDisabled = !formData['Company Name'];
    const contactPlaceholder = !formData['Company Name'] ? 'Select a company first' : (contactOptions.length === 0 ? 'No contacts found' : 'Select Contact');

    // Dynamic title & footer
    useEffect(() => {
        const title = isEditMode ? `Contact Log: ${logId}` : 'Create New Contact Log';
        const footer = isEditMode ? (
            <div className="flex justify-between items-center w-full">
                <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 font-semibold py-2 px-4 rounded-lg border border-rose-500/50 text-rose-500 hover:bg-rose-500/10 text-sm">
                    <Trash2 size={16} /> Delete
                </button>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => closeWindow(windowId)} className="font-semibold py-2 px-4 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-sm">Close</button>
                    <button type="submit" form={`contact-log-window-form-${windowId}`} disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                        Save Changes
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex justify-end gap-3 w-full">
                <button type="button" onClick={() => closeWindow(windowId)} className="bg-card hover:bg-muted text-foreground font-semibold py-2 px-4 rounded-md border border-border transition text-sm">Cancel</button>
                <button type="submit" form={`contact-log-window-form-${windowId}`} disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                    Save Log
                </button>
            </div>
        );
        updateWindow(windowId, { title, footer });
    }, [windowId, logId, isEditMode, isSubmitting, updateWindow, closeWindow]);

    return (
        <>
            <form id={`contact-log-window-form-${windowId}`} onSubmit={handleSubmit} className="space-y-6 max-h-full overflow-y-auto p-1 pr-2 custom-scrollbar">
                <FormSection title="Log Details">
                    <FormInput name="Log ID" label="Log ID" value={formData['Log ID']} onChange={() => {}} required readOnly />
                    <FormSelect name="Type" label="Type" value={formData.Type} onChange={handleChange} options={TYPE_OPTIONS} required />
                    <FormInput name="Contact Date" label="Contact Date" value={formData['Contact Date']} onChange={handleChange} type="date" required />
                    <SearchableSelect
                        name="Company Name" label="Company Name"
                        value={formData['Company Name'] || ''} onChange={handleCompanySelect}
                        options={companyOptions} required placeholder="Search companies..."
                        actionButton={<button type="button" onClick={() => setIsNewCompanyModalOpen(true)} className="text-sm font-semibold text-brand-600 hover:underline">+ New</button>}
                    />
                    <FormSelect
                        name="Contact Name" label="Contact Name"
                        value={formData['Contact Name']} onChange={handleContactChange}
                        options={contactOptions} disabled={isContactDisabled || contactOptions.length === 0}
                        disabledPlaceholder={contactPlaceholder} required
                        actionButton={!!formData['Company Name'] && <button type="button" onClick={() => setIsNewContactModalOpen(true)} className="text-sm font-semibold text-brand-600 hover:underline">+ New</button>}
                    />
                    <FormInput name="Position" label="Position" value={formData.Position} onChange={handleChange} />
                    <FormInput name="Phone Number" label="Phone Number" value={formData['Phone Number']} onChange={handleChange} />
                    <FormInput name="Email" label="Email" value={formData.Email} onChange={handleChange} />
                    <FormInput name="Responsible By" label="Responsible By" value={formData['Responsible By']} onChange={handleChange} required />
                </FormSection>
                <FormSection>
                    <FormTextarea name="Remarks" label="Remarks" value={formData.Remarks} onChange={handleChange} />
                </FormSection>
            </form>

            <NewCompanyModal
                isOpen={isNewCompanyModalOpen}
                onClose={() => setIsNewCompanyModalOpen(false)}
                onSaveSuccess={(newCompany: Company) => {
                    setFormData(prev => ({ ...prev, 'Company Name': newCompany['Company Name'], 'Contact Name': '', 'Position': '' }));
                    setIsNewCompanyModalOpen(false);
                }}
            />
            <NewContactModal
                isOpen={isNewContactModalOpen}
                onClose={() => setIsNewContactModalOpen(false)}
                initialCompany={formData['Company Name']}
                onSaveSuccess={(newContact: Contact) => {
                    setFormData(prev => ({
                        ...prev,
                        'Contact Name': newContact.Name,
                        'Position': newContact.Role,
                        'Phone Number': newContact['Tel (1)'],
                        'Email': newContact.Email,
                    }));
                    setIsNewContactModalOpen(false);
                }}
            />
            {isEditMode && (
                <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Contact Log" confirmText="Delete">
                    Are you sure you want to delete this log? This action cannot be undone.
                </ConfirmationModal>
            )}
        </>
    );
};

export default ContactLogWindowContent;
