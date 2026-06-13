'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { PipelineProject, Meeting, ContactLog, UnifiedActivity, Company, Contact } from "../../types";
import { insertRecord, updateRecord, deleteRecord } from "../../services/b2bDb";
import { FormSection, FormInput, FormSelect, FormTextarea, FormDisplay } from "../common/FormControls";
import { formatToInputDate, parseDate, formatDateAsMDY } from "../../utils/time";
import { useB2BData } from "../../hooks/useB2BData";
import { useB2B } from "../../contexts/B2BContext";
import ConfirmationModal from "./ConfirmationModal";
import EmptyState from "../common/EmptyState";
import NewCompanyModal from "./NewCompanyModal";
import NewContactModal from "./NewContactModal";
import { useToast } from "../../contexts/ToastContext";
import ResizableModal from "./ResizableModal";
import { Check, Pencil, Trash2, Calendar, MessageSquare, MapPin, Plus } from 'lucide-react';
import SearchableSelect from "../common/SearchableSelect";
import { useNavigation } from "../../contexts/NavigationContext";

const STATUS_OPTIONS: PipelineProject['Status'][] = [
    'New Deal',
    'Requirements',
    'Study Spec | Survey',
    'Price Request',
    'Proposal Submission',
    'Negotiation | Revision',
    'Contract | PO',
    'Order Processing',
    'Delivery Processing',
    'Closure (Win)',
    'Closure (Lose)',
];

const TAXABLE_OPTIONS: PipelineProject['Taxable'][] = ['VAT', 'NON-VAT'];
const CURRENCY_OPTIONS: ('USD' | 'KHR')[] = ['USD', 'KHR'];

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingData?: PipelineProject | null;
    initialReadOnly?: boolean;
    meetings: Meeting[];
    contactLogs: ContactLog[];
}

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, existingData, initialReadOnly = false, meetings, contactLogs }) => {
    const { projects, setProjects, companies, contacts, quotations, invoices, saleOrders, siteSurveys, productInquiries, fetchModule } = useB2BData();
    const { isB2B } = useB2B();
    const { addToast } = useToast();
    const [formData, setFormData] = useState<Partial<PipelineProject>>({});

    // Ensure product inquiries are loaded
    useEffect(() => {
        if (isOpen) {
            fetchModule('Product Inquiries');
        }
    }, [isOpen, fetchModule]);

    const quotationOptions = useMemo(() => {
        if (!quotations || !formData['Company Name']) return [];
        const selectedCompany = formData['Company Name'].trim().toLowerCase();
        return quotations
            .filter(q => q['Company Name']?.trim().toLowerCase() === selectedCompany)
            .map(q => q['Quote No']);
    }, [quotations, formData['Company Name']]);

    const invoiceOptions = useMemo(() => {
        if (!invoices || !formData['Company Name']) return [];
        const selectedCompany = formData['Company Name'].trim().toLowerCase();
        return invoices
            .filter(i => i['Company Name']?.trim().toLowerCase() === selectedCompany)
            .map(i => i['Inv No']);
    }, [invoices, formData['Company Name']]);

    const soOptions = useMemo(() => {
        if (!saleOrders || !formData['Company Name']) return [];
        const selectedCompany = formData['Company Name'].trim().toLowerCase();
        return saleOrders
            .filter(s => s['Company Name']?.trim().toLowerCase() === selectedCompany)
            .map(s => s['SO No']);
    }, [saleOrders, formData['Company Name']]);

    // Product Inquiry options — filtered by company if selected
    const inquiryOptions = useMemo(() => {
        if (!productInquiries) return [];
        if (formData['Company Name']) {
            const selectedCompany = formData['Company Name'].trim().toLowerCase();
            return productInquiries
                .filter(inq => inq.company_name?.trim().toLowerCase() === selectedCompany)
                .map(inq => inq.inquiry_no);
        }
        return productInquiries.map(inq => inq.inquiry_no);
    }, [productInquiries, formData['Company Name']]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
    const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
    const { handleNavigation } = useNavigation();

    const isEditMode = !!existingData;

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const filteredContacts = useMemo(() => contacts?.filter(c => c['Company Name'] === formData['Company Name']) || [], [contacts, formData]);
    const contactOptions = useMemo(() => filteredContacts.map(c => c.Name), [filteredContacts]);

    const getInitialState = useCallback(() => {
        const prefix = isB2B ? 'BPL' : 'PL';
        let nextPipelineNo = `${prefix}00000001`;

        if (projects && projects.length > 0) {
            const pipelineNumbers = projects
                .map(p => p['Pipeline No'])
                .filter(pNo => pNo && typeof pNo === 'string' && pNo.startsWith(prefix))
                .map(pNo => parseInt(pNo.substring(prefix.length), 10))
                .filter(num => !isNaN(num));

            if (pipelineNumbers.length > 0) {
                nextPipelineNo = `${prefix}${String(Math.max(...pipelineNumbers) + 1).padStart(8, '0')}`;
            }
        }
        const initialState: Partial<PipelineProject> = {
            'Pipeline No': nextPipelineNo,
            'Created Date': getTodayDateString(),
            'Status': 'New Deal',
            'Taxable': 'VAT',
            'Time Frame': '30',
            'Currency': 'USD',
            'Win Rate': null,
        };
        return initialState;
    }, [projects, isB2B]);

    const getFormDataForEdit = useCallback((p: PipelineProject) => ({
        ...p,
        'Due Date': formatToInputDate(p['Due Date']),
        'Created Date': formatToInputDate(p['Created Date']),
    }), []);

    useEffect(() => {
        if (isOpen) {
            setIsReadOnly(initialReadOnly);
            if (isEditMode) {
                setFormData(getFormDataForEdit(existingData));
            } else {
                setFormData(getInitialState());
            }
            setIsSubmitting(false);
            setDeleteConfirmOpen(false);
        }
    }, [isOpen, existingData, isEditMode, initialReadOnly, getInitialState, getFormDataForEdit]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleCompanySelect = (companyName: string) => {
        setFormData(prev => ({ ...prev, 'Company Name': companyName, 'Contact Name': '', 'Contact Number': '', 'Email': '', 'Quote No': '', 'Invoice No': '', 'SO No': '', 'Ref Inquiry No': '' }));
    };

    const handleQuoteSelect = (quoteNo: string) => {
        const quote = quotations?.find(q => q['Quote No'] === quoteNo);
        setFormData(prev => ({
            ...prev,
            'Quote No': quoteNo,
            'Total Amount': quote?.Amount || prev['Total Amount'],
            'Currency': (quote?.Currency as any) || prev.Currency
        }));
    };

    const handleInvoiceSelect = (invNo: string) => {
        const inv = invoices?.find(i => i['Inv No'] === invNo);
        setFormData(prev => ({
            ...prev,
            'Invoice No': invNo,
            'Total Amount': inv?.Amount || prev['Total Amount'],
            'Currency': (inv?.Currency as any) || prev.Currency
        }));
    };

    const handleSOSelect = (soNo: string) => {
        const so = saleOrders?.find(s => s['SO No'] === soNo);
        setFormData(prev => ({
            ...prev,
            'SO No': soNo,
            'Total Amount': so?.['Total Amount'] || prev['Total Amount'],
            'Currency': (so?.Currency as any) || prev.Currency
        }));
    };

    const handleInquirySelect = (inquiryNo: string) => {
        setFormData(prev => ({ ...prev, 'Ref Inquiry No': inquiryNo }));
    };

    const handleContactChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const contactName = e.target.value;
        const selectedContact = filteredContacts.find(c => c.Name === contactName);
        setFormData(prev => ({ ...prev, 'Contact Name': contactName, 'Contact Number': selectedContact?.['Tel (1)'] || '', 'Email': selectedContact?.Email || '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onClose(); // Close modal immediately for optimistic UI

        const { calculatedDueDate: _calculatedDueDate, ...dataToSubmit } = formData as any;

        const submissionData = {
            ...dataToSubmit,
            'Created Date': dataToSubmit['Created Date'] || null,
            'Due Date': dataToSubmit['Due Date'] || null,
            'Total Amount': dataToSubmit['Total Amount'] && dataToSubmit['Total Amount'] !== '' ? parseFloat(dataToSubmit['Total Amount']) : null,
            'Win Rate': dataToSubmit['Win Rate'] && dataToSubmit['Win Rate'] !== '' ? parseFloat(dataToSubmit['Win Rate']) : null,
        };

        if (isEditMode) {
            const originalProjects = projects ? [...projects] : [];
            const updatedId = existingData['Pipeline No'];
            // Optimistic update
            setProjects(current => current ? current.map(p => p['Pipeline No'] === updatedId ? { ...p, ...submissionData } as PipelineProject : p) : null);

            try {
                await updateRecord('pipelines', 'Pipeline No', updatedId, submissionData, isB2B);
                addToast('Pipeline updated!', 'success');
            } catch (err: any) {
                addToast(`Failed to update pipeline: ${err.message}`, 'error');
                setProjects(originalProjects); // Revert on failure
            }
        } else { // CREATE
            const tempId = submissionData['Pipeline No'];
            // Optimistic update
            setProjects(current => {
                const updated = current ? [submissionData as PipelineProject, ...current] : [submissionData as PipelineProject];
                return updated;
            });

            try {
                await insertRecord('pipelines', submissionData, isB2B);
                addToast('Pipeline created!', 'success');
            } catch (err: any) {
                addToast(`Failed to create pipeline: ${err.message}`, 'error');
                setProjects(current => current ? current.filter(p => p['Pipeline No'] !== tempId) : null);
            }
        }
    };

    const handleDelete = async () => {
        if (!existingData) return;

        const originalProjects = projects ? [...projects] : [];
        const projectToDeleteId = existingData['Pipeline No'];

        setDeleteConfirmOpen(false);
        onClose();

        setProjects(current => current ? current.filter(p => p['Pipeline No'] !== projectToDeleteId) : null);

        try {
            await deleteRecord('pipelines', 'Pipeline No', projectToDeleteId, isB2B);
            addToast('Pipeline deleted!', 'success');
        } catch (err: any) {
            addToast(`Failed to delete pipeline: ${err.message}`, 'error');
            setProjects(originalProjects); // Revert on failure
        }
    };

    const relatedActivities = useMemo<UnifiedActivity[]>(() => {
        if (!existingData) return [];
        const companyName = existingData['Company Name'];
        const pipelineId = existingData['Pipeline No'];
        const allActivities: UnifiedActivity[] = [];

        contactLogs.forEach(log => {
            if (log['Company Name'] === companyName) {
                const date = parseDate(log['Contact Date']);
                if (date) { allActivities.push({ type: 'log', date, isoDate: date.toISOString(), responsible: log['Responsible By'], summary: `Log: ${log.Type} with ${log['Contact Name']}`, details: log.Remarks, original: log }); }
            }
        });

        meetings.forEach(meeting => {
            if (meeting['Company Name'] === companyName || meeting.Pipeline_ID === pipelineId) {
                const date = parseDate(meeting['Meeting Date']);
                if (date) { allActivities.push({ type: 'meeting', date, isoDate: date.toISOString(), responsible: meeting['Responsible By'], summary: `Meeting: ${meeting.Type} with ${meeting.Participants}`, details: meeting.Remarks, original: meeting }); }
            }
        });

        siteSurveys?.forEach(survey => {
            if (survey['Company Name'] === companyName || survey['Pipeline_ID'] === pipelineId) {
                const date = parseDate(survey['Date']);
                if (date) { allActivities.push({ type: 'survey', date, isoDate: date.toISOString(), responsible: survey['Responsible By'], summary: `Site Survey: ${survey.Location}`, details: survey.Remark, original: survey as any }); }
            }
        });

        return allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [existingData, meetings, contactLogs]);

    const isContactDisabled = !formData['Company Name'];
    const contactPlaceholder = !formData['Company Name'] ? "Select a company first" : (contactOptions.length === 0 ? "No contacts found" : "Select Contact");
    const title = isEditMode ? (isReadOnly ? `Details: ${existingData['Pipeline No']}` : `Editing: ${existingData['Pipeline No']}`) : 'Create New Pipeline';
    const submitText = isEditMode ? 'Save Changes' : 'Save Pipeline';

    const handleCancelClick = () => {
        if (isEditMode) {
            setFormData(getFormDataForEdit(existingData));
            setIsReadOnly(true);
        } else {
            onClose();
        }
    }

    const modalFooter = (
        <div className="flex justify-between items-center w-full">
            {isReadOnly ? (
                <>
                    <button type="button" onClick={() => setDeleteConfirmOpen(true)} disabled={isSubmitting} className="flex items-center gap-2 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 border border-rose-500/50 text-rose-500 hover:bg-rose-500/10 disabled:opacity-50">
                        <Trash2 className="w-5 h-5" /> Delete
                    </button>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onClose} className="font-semibold py-2 px-4 rounded-lg transition-colors duration-200 border border-border bg-card text-foreground hover:bg-muted">Close</button>
                        <button type="button" onClick={() => setIsReadOnly(false)} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-lg transition shadow-sm flex items-center gap-2">
                            <Pencil className="w-5 h-5" /> Edit
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex justify-end gap-3 w-full">
                    <button type="button" onClick={handleCancelClick} className="bg-card hover:bg-muted text-foreground font-semibold py-2 px-4 rounded-md border border-border transition">Cancel</button>
                    <button type="submit" onClick={handleSubmit} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md transition shadow-sm flex items-center">
                        <Check className="w-5 h-5 -ml-1 mr-2" />
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
                <div className="space-y-6">
                    {/* ── Core Details ────────────────────────────────────────── */}
                    <FormSection title="Core Details">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                            {isReadOnly ? <FormDisplay label="Pipeline No" value={formData['Pipeline No']} /> : <FormInput name="Pipeline No" label="Pipeline No" value={formData['Pipeline No']} onChange={handleChange} required readOnly />}
                            {isReadOnly ? <FormDisplay label="Created Date" value={formatToInputDate(formData['Created Date'])} /> : <FormInput name="Created Date" label="Create Date" value={formData['Created Date']} onChange={handleChange} type="date" required readOnly />}
                            {isReadOnly ? <FormDisplay label="Taxable" value={formData.Taxable} /> : <FormSelect name="Taxable" label="Taxable" value={formData.Taxable} onChange={handleChange} options={TAXABLE_OPTIONS} required />}
                            {isReadOnly ? <FormDisplay label="Time Frame" value={formData['Time Frame'] ? `${formData['Time Frame']} days` : ''} /> : <FormInput name="Time Frame" label="Time Frame (days)" value={formData['Time Frame']} onChange={handleChange} type="number" required />}
                            {isReadOnly ? <FormDisplay label="Due Date" value={formatToInputDate(formData['Due Date'])} /> : <FormInput name="Due Date" label="Due Date" value={formData['Due Date']} onChange={handleChange} type="date" />}
                            {isReadOnly ? <FormDisplay label="Sale Responsible" value={formData['Responsible By']} /> : <FormInput name="Responsible By" label="Sale Responsible" value={formData['Responsible By']} onChange={handleChange} />}
                            {isReadOnly ? <FormDisplay label="Status" value={formData.Status} /> : <FormSelect name="Status" label="Status" value={formData.Status} onChange={handleChange} options={STATUS_OPTIONS} required />}
                        </div>
                    </FormSection>

                    {/* ── Company & Contact ───────────────────────────────────── */}
                    <FormSection title="Company & Contact">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                            <div className="sm:col-span-1">
                                {isReadOnly ? <FormDisplay label="Company Name" value={formData['Company Name']} /> :
                                    <SearchableSelect
                                        name="Company Name"
                                        label="Company Name"
                                        value={formData['Company Name'] || ''}
                                        onChange={handleCompanySelect}
                                        options={companyOptions}
                                        required
                                        placeholder="Search companies..."
                                        actionButton={!isReadOnly && <button type="button" onClick={() => setIsNewCompanyModalOpen(true)} className="text-sm font-semibold text-brand-600 hover:underline">+ New</button>}
                                    />}
                            </div>
                            <div className="sm:col-span-1">
                                {isReadOnly ? <FormDisplay label="Contact Name" value={formData['Contact Name']} /> :
                                    <FormSelect
                                        name="Contact Name"
                                        label="Contact Name"
                                        value={formData['Contact Name']}
                                        onChange={handleContactChange}
                                        options={contactOptions}
                                        required
                                        disabled={isContactDisabled || contactOptions.length === 0}
                                        disabledPlaceholder={contactPlaceholder}
                                        actionButton={!isReadOnly && !!formData['Company Name'] && <button type="button" onClick={() => setIsNewContactModalOpen(true)} className="text-sm font-semibold text-brand-600 hover:underline">+ New</button>}
                                    />}
                            </div>
                            {isReadOnly ? <FormDisplay label="Contact Number" value={formData['Contact Number']} /> : <FormInput name="Contact Number" label="Contact Number" value={formData['Contact Number']} onChange={handleChange} type="tel" readOnly />}
                            {isReadOnly ? <FormDisplay label="Email" value={formData.Email} /> : <FormInput name="Email" label="Email" value={formData.Email} onChange={handleChange} type="email" readOnly />}
                        </div>
                    </FormSection>

                    {/* ── Deal Financials & Documents ─────────────────────────── */}
                    <FormSection title="Deal Financials & Documents">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                            {isReadOnly ? <FormDisplay label="Total Amount" value={formData['Total Amount']} /> : <FormInput name="Total Amount" label="Total Amount" value={formData['Total Amount']} onChange={handleChange} type="text" placeholder="e.g., 5000" />}
                            {isReadOnly ? <FormDisplay label="Win Rate (%)" value={formData['Win Rate'] != null ? `${formData['Win Rate']}%` : ''} /> : <FormInput name="Win Rate" label="Win Rate (%)" value={formData['Win Rate'] ?? ''} onChange={handleChange} type="number" placeholder="0-100" />}
                            {isReadOnly ? <FormDisplay label="Currency" value={formData.Currency} /> : <FormSelect name="Currency" label="Currency" value={formData.Currency} onChange={handleChange} options={CURRENCY_OPTIONS} />}
                        </div>
                        <div className="mt-4">
                            {isReadOnly ? <FormDisplay label="Requirements" value={formData.Requirements} multiline /> : <FormTextarea name="Requirements" label="Requirements" value={formData.Requirements} onChange={handleChange} required />}
                        </div>

                        {/* Reference Links */}
                        <div className="mt-6 pt-4 border-t border-border/60">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-4">Reference Links</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                {/* Ref-Product Inquiries */}
                                {isReadOnly ? (
                                    <FormDisplay label="Ref-Product Inquiry">
                                        <span>{formData['Ref Inquiry No'] || <span className="text-muted-foreground italic">N/A</span>}</span>
                                    </FormDisplay>
                                ) : (
                                    <SearchableSelect
                                        name="Ref Inquiry No"
                                        label="Ref-Product Inquiry"
                                        value={formData['Ref Inquiry No'] || ''}
                                        onChange={handleInquirySelect}
                                        options={inquiryOptions}
                                        placeholder="Select from system..."
                                    />
                                )}

                                {/* Ref-Quote No. */}
                                {isReadOnly ? (
                                    <FormDisplay label="Ref-Quote No.">
                                        <div className="flex items-center justify-between">
                                            <span>{formData['Quote No'] || <span className="text-muted-foreground italic">N/A</span>}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleNavigation({
                                                    view: 'quotations',
                                                    payload: {
                                                        action: 'create',
                                                        initialData: {
                                                            'Company Name': formData['Company Name'],
                                                            'Contact Name': formData['Contact Name'],
                                                            'Pipeline No': formData['Pipeline No']
                                                        }
                                                    }
                                                })}
                                                className="text-xs flex items-center gap-1 text-brand-600 hover:text-brand-800 font-medium ml-2"
                                            >
                                                <Plus className="w-3 h-3" /> Create
                                            </button>
                                        </div>
                                    </FormDisplay>
                                ) : (
                                    <SearchableSelect
                                        name="Quote No"
                                        label="Ref-Quote No."
                                        value={formData['Quote No'] || ''}
                                        onChange={handleQuoteSelect}
                                        options={quotationOptions}
                                        placeholder="Select from system..."
                                        actionButton={<button type="button" onClick={() => handleNavigation({ view: 'quotations', payload: { action: 'create', initialData: { 'Company Name': formData['Company Name'], 'Pipeline No': formData['Pipeline No'] } } })} className="text-xs text-brand-600 font-semibold hover:underline">+ Create New</button>}
                                    />
                                )}

                                {/* Ref-Sale Order No. (Auto Link From Quote) */}
                                {isReadOnly ? (
                                    <FormDisplay label="Ref-Sale Order No.">
                                        <div className="flex items-center justify-between">
                                            <span>{formData['SO No'] || <span className="text-muted-foreground italic">N/A</span>}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleNavigation({
                                                    view: 'sale-orders',
                                                    payload: {
                                                        action: 'create',
                                                        initialData: {
                                                            'Company Name': formData['Company Name'],
                                                            'Quote No': formData['Quote No'] || '',
                                                            'Pipeline No': formData['Pipeline No']
                                                        }
                                                    }
                                                })}
                                                className="text-xs flex items-center gap-1 text-brand-600 hover:text-brand-800 font-medium ml-2"
                                            >
                                                <Plus className="w-3 h-3" /> Create
                                            </button>
                                        </div>
                                    </FormDisplay>
                                ) : (
                                    <SearchableSelect
                                        name="SO No"
                                        label="Ref-Sale Order No."
                                        value={formData['SO No'] || ''}
                                        onChange={handleSOSelect}
                                        options={soOptions}
                                        placeholder="Auto link from Quote..."
                                        actionButton={<button type="button" onClick={() => handleNavigation({ view: 'sale-orders', payload: { action: 'create', initialData: { 'Company Name': formData['Company Name'], 'Pipeline No': formData['Pipeline No'] } } })} className="text-xs text-brand-600 font-semibold hover:underline">+ Create New</button>}
                                    />
                                )}

                                {/* Ref-Invoice No. (Auto Link From Sale Order) */}
                                {isReadOnly ? (
                                    <FormDisplay label="Ref-Invoice No.">
                                        <div className="flex items-center justify-between">
                                            <span>{formData['Invoice No'] || <span className="text-muted-foreground italic">N/A</span>}</span>
                                        </div>
                                    </FormDisplay>
                                ) : (
                                    <SearchableSelect
                                        name="Invoice No"
                                        label="Ref-Invoice No."
                                        value={formData['Invoice No'] || ''}
                                        onChange={handleInvoiceSelect}
                                        options={invoiceOptions}
                                        placeholder="Auto link from Sale Order..."
                                    />
                                )}
                            </div>
                        </div>
                    </FormSection>

                    {/* ── Notes & Remarks ─────────────────────────────────────── */}
                    <FormSection title="Notes & Remarks">
                        {isReadOnly ? <FormDisplay label="Remarks" value={formData.Remarks} multiline /> : <FormTextarea name="Remarks" label="Remarks" value={formData.Remarks} onChange={handleChange} />}
                    </FormSection>

                    {/* ── Activities ──────────────────────────────────────────── */}
                    {isEditMode && (
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60 mb-6">{`Activities (${relatedActivities.length})`}</h3>
                            <div className="flow-root">
                                {relatedActivities.length > 0 ? (
                                    <div className="space-y-4 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                                        {relatedActivities.map((activity, index) => (
                                            <div key={`${activity.type}-${activity.isoDate}-${index}`} className="relative">
                                                <div className="absolute -left-[29px] top-0.5 w-8 h-8 rounded-full bg-card flex items-center justify-center ring-4 ring-card">
                                                    {activity.type === 'meeting' ? <Calendar className="w-5 h-5 text-sky-500" /> : activity.type === 'survey' ? <MapPin className="w-5 h-5 text-emerald-500" /> : <MessageSquare className="w-5 h-5 text-violet-500" />}
                                                </div>
                                                <div className="bg-muted p-4 rounded-lg border border-border">
                                                    <p className="font-semibold text-foreground">{activity.summary}</p>
                                                    <p className="text-sm text-muted-foreground mb-2">{formatDateAsMDY(activity.date)} by {activity.responsible}</p>
                                                    {activity.details && <p className="text-sm text-foreground whitespace-pre-wrap">{activity.details}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <EmptyState />}
                            </div>
                        </div>
                    )}
                </div>
            </ResizableModal>

            <NewCompanyModal
                isOpen={isNewCompanyModalOpen}
                onClose={() => setIsNewCompanyModalOpen(false)}
                onSaveSuccess={(newCompany: Company) => {
                    setFormData(prev => ({ ...prev, 'Company Name': newCompany['Company Name'], 'Contact Name': '', 'Contact Number': '', 'Email': '' }));
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
                        'Contact Number': newContact['Tel (1)'],
                        'Email': newContact.Email,
                    }));
                    setIsNewContactModalOpen(false);
                }}
            />
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Pipeline" confirmText="Delete">
                Are you sure you want to delete this pipeline? This action cannot be undone.
            </ConfirmationModal>
        </>
    );
};

export default NewProjectModal;
