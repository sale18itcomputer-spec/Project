'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Contact, UnifiedActivity } from '@/types';
import { CONTACT_HEADERS } from '@/schemas';
import { createRecord, updateRecord, deleteRecord } from '@/services/api';
import { FormSection, FormInput, FormTextarea } from '@/components/common/FormControls';
import SearchableSelect from '@/components/common/SearchableSelect';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/contexts/ToastContext';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { formatToSheetDate, formatToInputDate, parseDate, formatDateAsMDY, formatDisplayDate } from '@/utils/time';
import { Check, Trash2, Loader2, Calendar, MessageSquare } from 'lucide-react';
import ConfirmationModal from '@/components/modals/ConfirmationModal';
import EmptyState from '@/components/common/EmptyState';
import { parseSheetValue } from '@/utils/formatters';

const DEPARTMENT_PRESETS = [
    'Information Technology', 'Purchasing', 'Management',
    'Human Resource', 'Accounting', 'Marketing', 'Sales',
];

const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

interface ContactWindowContentProps {
    windowId: string;
    contactId: string | null;
}

const ContactWindowContent: React.FC<ContactWindowContentProps> = ({ windowId, contactId }) => {
    const { currentUser } = useAuth();
    const { contacts, setContacts, companies, projects, contactLogs, meetings, quotations } = useData();
    const { addToast } = useToast();
    const { closeWindow, updateWindow } = useWindowManager();
    const { handleNavigation } = useNavigation();

    const [formData, setFormData] = useState<Partial<Contact>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const isEditMode = !!contactId;
    const existingData = useMemo(
        () => contacts?.find(c => c['Customer ID'] === contactId) || null,
        [contacts, contactId],
    );

    const companyOptions = useMemo(
        () => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [],
        [companies],
    );

    const relatedProjects = useMemo(
        () => (isEditMode && existingData) ? (projects || []).filter(p => p['Contact Name'] === existingData.Name) : [],
        [projects, existingData, isEditMode],
    );

    const relatedActivities = useMemo<UnifiedActivity[]>(() => {
        if (!isEditMode || !existingData) return [];
        const contactName = existingData.Name;
        const companyName = existingData['Company Name'];
        const all: UnifiedActivity[] = [];
        (contactLogs || []).forEach(log => {
            if (log['Contact Name'] === contactName || log['Company Name'] === companyName) {
                const date = parseDate(log['Contact Date']);
                if (date) all.push({ type: 'log', date, isoDate: date.toISOString(), responsible: log['Responsible By'], summary: `Log: ${log.Type} with ${log['Contact Name']}`, details: log.Remarks, original: log });
            }
        });
        (meetings || []).forEach(meeting => {
            if (meeting['Company Name'] === companyName || meeting.Participants.includes(contactName)) {
                const date = parseDate(meeting['Meeting Date']);
                if (date) all.push({ type: 'meeting', date, isoDate: date.toISOString(), responsible: meeting['Responsible By'], summary: `Meeting: ${meeting.Type} with ${meeting.Participants}`, details: meeting.Remarks, original: meeting });
            }
        });
        return all.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [contactLogs, meetings, existingData, isEditMode]);

    const relatedQuotations = useMemo(
        () => (isEditMode && existingData) ? (quotations || []).filter(q => q['Contact Name'] === existingData.Name) : [],
        [quotations, existingData, isEditMode],
    );

    const getInitialState = useCallback((): Partial<Contact> => {
        let nextId = 'CUS0000001';
        if (contacts && contacts.length > 0) {
            const nums = contacts
                .map(c => c['Customer ID'])
                .filter(id => id?.startsWith('CUS'))
                .map(id => parseInt(id!.substring(3), 10))
                .filter(n => !isNaN(n));
            if (nums.length > 0) nextId = `CUS${String(Math.max(...nums) + 1).padStart(7, '0')}`;
        }
        return { 'Customer ID': nextId, 'Created Date': getTodayDateString(), 'Created By': currentUser?.Name || '' };
    }, [contacts, currentUser]);

    useEffect(() => {
        if (isEditMode && existingData) {
            setFormData({ ...existingData, 'Created Date': formatToInputDate(existingData['Created Date']) });
        } else if (!isEditMode) {
            setFormData(getInitialState());
        }
    }, [existingData, isEditMode, getInitialState]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSubmitting(true);

        const raw = { ...formData, 'Created Date': formatToSheetDate(formData['Created Date']) };
        const submissionData: Partial<Contact> = {};
        CONTACT_HEADERS.forEach(h => { if (h in raw) (submissionData as any)[h] = (raw as any)[h]; });

        if (isEditMode && existingData) {
            const original = contacts ? [...contacts] : [];
            const updatedId = existingData['Customer ID'];
            setContacts(cur => cur ? cur.map(c => c['Customer ID'] === updatedId ? { ...c, ...submissionData } as Contact : c) : null);
            try {
                const updated: Contact = await updateRecord('Contact_List', updatedId, submissionData);
                setContacts(cur => cur ? cur.map(c => c['Customer ID'] === updatedId ? updated : c) : [updated]);
                addToast('Contact updated!', 'success');
                closeWindow(windowId);
            } catch (err: any) {
                addToast(`Failed to update: ${err.message}`, 'error');
                setContacts(original);
                setIsSubmitting(false);
            }
        } else {
            const tempId = submissionData['Customer ID'];
            setContacts(cur => cur ? [submissionData as Contact, ...cur] : [submissionData as Contact]);
            try {
                const created: Contact = await createRecord('Contact_List', submissionData);
                setContacts(cur => cur ? cur.map(c => c['Customer ID'] === tempId ? created : c) : [created]);
                addToast('Contact created!', 'success');
                closeWindow(windowId);
            } catch (err: any) {
                addToast(`Failed to create: ${err.message}`, 'error');
                setContacts(cur => cur ? cur.filter(c => c['Customer ID'] !== tempId) : null);
                setIsSubmitting(false);
            }
        }
    }, [formData, isEditMode, existingData, contacts, setContacts, addToast, closeWindow, windowId]);

    const handleDelete = async () => {
        if (!existingData) return;
        const original = contacts ? [...contacts] : [];
        const id = existingData['Customer ID'];
        setDeleteConfirmOpen(false);
        setContacts(cur => cur ? cur.filter(c => c['Customer ID'] !== id) : null);
        try {
            await deleteRecord('Contact_List', id);
            addToast('Contact deleted!', 'success');
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to delete: ${err.message}`, 'error');
            setContacts(original);
        }
    };

    useEffect(() => {
        const title = isEditMode
            ? (existingData ? `Contact: ${existingData.Name}` : 'Contact')
            : 'Create New Contact';
        const footer = (
            <div className="flex justify-between items-center w-full">
                <div>
                    {isEditMode && (
                        <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 font-semibold py-2 px-4 rounded-lg border border-rose-500/50 text-rose-500 hover:bg-rose-500/10 text-sm">
                            <Trash2 size={16} /> Delete
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => closeWindow(windowId)} className="font-semibold py-2 px-4 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-sm">
                        {isEditMode ? 'Close' : 'Cancel'}
                    </button>
                    <button type="submit" form={`contact-window-form-${windowId}`} disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                        {isEditMode ? 'Save Changes' : 'Save Contact'}
                    </button>
                </div>
            </div>
        );
        updateWindow(windowId, { title, footer });
    }, [windowId, contactId, isEditMode, existingData, isSubmitting, updateWindow, closeWindow]);

    return (
        <>
            <form id={`contact-window-form-${windowId}`} onSubmit={handleSubmit} className="space-y-6 max-h-full overflow-y-auto p-1 pr-2 custom-scrollbar">
                <FormSection title="Contact Information">
                    <FormInput name="Customer ID" label="Customer ID" value={formData['Customer ID']} onChange={() => {}} required readOnly />
                    <FormInput name="Name" label="Name" value={formData.Name} onChange={handleChange} required />
                    <FormInput name="Name (Khmer)" label="Name (Khmer)" value={formData['Name (Khmer)']} onChange={handleChange} />
                    <SearchableSelect
                        name="Company Name" label="Company Name"
                        value={formData['Company Name'] || ''} onChange={v => setFormData(prev => ({ ...prev, 'Company Name': v }))}
                        options={companyOptions} required placeholder="Search companies..."
                    />
                    <FormInput name="Role" label="Role" value={formData.Role} onChange={handleChange} />
                    <div className="flex flex-col">
                        <label htmlFor={`dept-${windowId}`} className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Department</label>
                        <input
                            type="text" name="Department" id={`dept-${windowId}`}
                            value={formData.Department || ''} onChange={handleChange}
                            list={`dept-presets-${windowId}`} placeholder="Select or type a department"
                            className="block w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 hover:border-muted-foreground/40"
                        />
                        <datalist id={`dept-presets-${windowId}`}>
                            {DEPARTMENT_PRESETS.map(d => <option key={d} value={d} />)}
                        </datalist>
                    </div>
                    <FormInput name="Email" label="Email" type="email" value={formData.Email} onChange={handleChange} />
                    <FormInput name="Tel (1)" label="Phone (1)" type="tel" value={formData['Tel (1)']} onChange={handleChange} />
                    <FormInput name="Tel (2)" label="Phone (2)" type="tel" value={formData['Tel (2)']} onChange={handleChange} />
                </FormSection>
                <FormSection title="Address">
                    <FormTextarea name="Address (English)" label="Address (English)" value={formData['Address (English)']} onChange={handleChange} />
                    <FormTextarea name="Address (Khmer)" label="Address (Khmer)" value={formData['Address (Khmer)']} onChange={handleChange} />
                </FormSection>
                <FormSection title="Remarks">
                    <FormTextarea name="Remarks" label="Remarks" value={formData.Remarks} onChange={handleChange} />
                </FormSection>

                {isEditMode && (
                    <>
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60 mb-6">{`Projects (${relatedProjects.length})`}</h3>
                            <div className="flow-root">
                                {relatedProjects.length > 0 ? (
                                    <ul className="-my-4 divide-y divide-border">
                                        {relatedProjects.map(project => (
                                            <li key={project['Pipeline No']} className="flex items-center space-x-4 py-4">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-foreground truncate">{project['Pipeline No']}</p>
                                                    <p className="text-sm text-muted-foreground truncate">{project.Requirements}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-sm font-medium text-foreground">{project['Total Amount']}</span>
                                                    <p className="text-xs text-muted-foreground">{project.Status}</p>
                                                </div>
                                                <button type="button" onClick={() => handleNavigation({ view: 'projects', filter: project['Pipeline No'] })} className="text-brand-600 hover:text-brand-800 text-sm font-semibold">View</button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <EmptyState />}
                            </div>
                        </div>
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60 mb-6">{`Activities (${relatedActivities.length})`}</h3>
                            <div className="flow-root">
                                {relatedActivities.length > 0 ? (
                                    <div className="space-y-4 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                                        {relatedActivities.map((activity, index) => (
                                            <div key={`${activity.type}-${activity.isoDate}-${index}`} className="relative">
                                                <div className="absolute -left-[29px] top-0.5 w-8 h-8 rounded-full bg-card flex items-center justify-center ring-4 ring-card">
                                                    {activity.type === 'meeting'
                                                        ? <Calendar className="w-5 h-5 text-sky-500" />
                                                        : <MessageSquare className="w-5 h-5 text-violet-500" />}
                                                </div>
                                                <div className="bg-muted p-4 rounded-lg border border-border">
                                                    <p className="font-semibold text-foreground">{activity.summary}</p>
                                                    <p className="text-sm text-muted-foreground mb-2">{formatDateAsMDY(activity.date)} by {activity.responsible}</p>
                                                    {activity.details && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activity.details}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <EmptyState />}
                            </div>
                        </div>
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60 mb-6">{`Quotations (${relatedQuotations.length})`}</h3>
                            <div className="flow-root">
                                {relatedQuotations.length > 0 ? (
                                    <ul className="-my-4 divide-y divide-border">
                                        {relatedQuotations.map(quote => {
                                            let url = '#';
                                            if (quote.File) { const m = quote.File.match(/=HYPERLINK\("([^"]+)"/i); if (m) url = m[1]; }
                                            return (
                                                <li key={quote['Quote No.']} className="flex items-center space-x-4 py-4">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-foreground truncate">{quote['Quote No.']}</p>
                                                        <p className="text-sm text-muted-foreground truncate">{formatDisplayDate(quote['Quote Date'])}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-medium text-foreground">{parseSheetValue(quote.Amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                                                        <p className="text-xs text-muted-foreground">{quote.Status}</p>
                                                    </div>
                                                    {url !== '#' ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-800 text-sm font-semibold">View</a> : <span className="text-muted-foreground text-sm">No file</span>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : <EmptyState />}
                            </div>
                        </div>
                    </>
                )}
            </form>

            {isEditMode && (
                <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Contact" confirmText="Delete">
                    Are you sure you want to delete this contact? This action cannot be undone.
                </ConfirmationModal>
            )}
        </>
    );
};

export default ContactWindowContent;
