import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { PipelineProject, Meeting, ContactLog, UnifiedActivity, Company, Contact } from '../types';
import { insertRecord, updateRecord, deleteRecord } from '../utils/b2bDb';
import { FormSection, FormInput, FormSelect, FormTextarea, FormDisplay } from './FormControls';
import { formatToSheetDate, formatToInputDate, parseDate, formatDateAsMDY } from '../utils/time';
import { useB2BData } from '../hooks/useB2BData';
import { useB2B } from '../contexts/B2BContext';
import ConfirmationModal from './ConfirmationModal';
import EmptyState from './EmptyState';
import NewCompanyModal from './NewCompanyModal';
import NewContactModal from './NewContactModal';
import { useToast } from '../contexts/ToastContext';
import ResizableModal from './ResizableModal';
import { Check, Pencil, Trash2, Calendar, MessageSquare, Plus } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { useNavigation } from '../contexts/NavigationContext';

const ensureHyperlink = (url?: string): string => {
    if (!url || typeof url !== 'string' || url.trim() === '') return '';
    const trimmedUrl = url.trim();
    if (trimmedUrl.toUpperCase().startsWith('=HYPERLINK(')) return trimmedUrl;
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        const escapedUrl = trimmedUrl.replace(/"/g, '""');
        return `=HYPERLINK("${escapedUrl}", "${escapedUrl}")`;
    }
    return trimmedUrl;
};

const extractUrlFromFormula = (value?: string): string => {
    if (!value || typeof value !== 'string') return '';
    const match = value.match(/^=HYPERLINK\("([^"]+)"/i);
    return match ? match[1] : value;
};

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

const STATUS_OPTIONS: PipelineProject['Status'][] = ['Quote Submitted', 'Close (win)', 'Close (lose)'];
const TYPE_OPTIONS = ['Project', 'Maintenance', 'Consultant'];
const TAXABLE_OPTIONS: PipelineProject['Taxable'][] = ['VAT', 'NON-VAT'];
const CURRENCY_OPTIONS: ('USD' | 'KHR')[] = ['USD', 'KHR'];

const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, existingData, initialReadOnly = false, meetings, contactLogs }) => {
    const { projects, setProjects, companies, contacts, quotations, invoices, saleOrders } = useB2BData();
    const { isB2B } = useB2B();
    const { addToast } = useToast();
    const [formData, setFormData] = useState<Partial<PipelineProject>>({});

    const quotationOptions = useMemo(() => {
        if (!quotations || !formData['Company Name']) return [];
        const selectedCompany = formData['Company Name'].trim().toLowerCase();
        return quotations
            .filter(q => q['Company Name']?.trim().toLowerCase() === selectedCompany)
            .map(q => q['Quote No.']);
    }, [quotations, formData['Company Name']]);

    const invoiceOptions = useMemo(() => {
        if (!invoices || !formData['Company Name']) return [];
        const selectedCompany = formData['Company Name'].trim().toLowerCase();
        return invoices
            .filter(i => i['Company Name']?.trim().toLowerCase() === selectedCompany)
            .map(i => i['Inv No.']);
    }, [invoices, formData['Company Name']]);

    const soOptions = useMemo(() => {
        if (!saleOrders || !formData['Company Name']) return [];
        const selectedCompany = formData['Company Name'].trim().toLowerCase();
        return saleOrders
            .filter(s => s['Company Name']?.trim().toLowerCase() === selectedCompany)
            .map(s => s['SO No.']);
    }, [saleOrders, formData['Company Name']]);
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
                .map(p => p['Pipeline No.'])
                .filter(pNo => pNo && typeof pNo === 'string' && pNo.startsWith(prefix))
                .map(pNo => parseInt(pNo.substring(prefix.length), 10))
                .filter(num => !isNaN(num));

            if (pipelineNumbers.length > 0) {
                nextPipelineNo = `${prefix}${String(Math.max(...pipelineNumbers) + 1).padStart(8, '0')}`;
            }
        }
        const initialState: Partial<PipelineProject> = {
            'Pipeline No.': nextPipelineNo,
            'Created Date': getTodayDateString(),
            'Status': 'Quote Submitted',
            'Taxable': 'VAT',
            'Type': 'Project',
            'Currency': 'USD',
        };
        return initialState;
    }, [projects, isB2B]);

    const getFormDataForEdit = useCallback((p: PipelineProject) => ({
        ...p,
        'Due Date': formatToInputDate(p['Due Date']),
        'Inv Date': formatToInputDate(p['Inv Date']),
        'Created Date': formatToInputDate(p['Created Date']),
        'Quote': extractUrlFromFormula(p.Quote),
        'Attach Invoice': extractUrlFromFormula(p['Attach Invoice']),
        'Attach D.O': extractUrlFromFormula(p['Attach D.O']),
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
        setFormData(prev => ({ ...prev, 'Company Name': companyName, 'Contact Name': '', 'Contact Number': '', 'Email': '', 'Quote': '', 'Quote No.': '', 'Invoice No.': '', 'SO No.': '', 'Inv Date': '' }));
    };

    const handleQuoteSelect = (quoteNo: string) => {
        const quote = quotations?.find(q => q['Quote No.'] === quoteNo);
        setFormData(prev => ({
            ...prev,
            'Quote No.': quoteNo,
            'Quote': extractUrlFromFormula(quote?.File) || prev.Quote,
            'Bid Value': quote?.Amount || prev['Bid Value'],
            'Currency': (quote?.Currency as any) || prev.Currency
        }));
    };

    const handleInvoiceSelect = (invNo: string) => {
        const inv = invoices?.find(i => i['Inv No.'] === invNo);
        setFormData(prev => ({
            ...prev,
            'Invoice No.': invNo,
            'Inv Date': inv?.['Inv Date'] ? formatToInputDate(inv['Inv Date']) : prev['Inv Date'],
            'Bid Value': inv?.Amount || prev['Bid Value'],
            'Currency': (inv?.Currency as any) || prev.Currency
        }));
    };

    const handleSOSelect = (soNo: string) => {
        const so = saleOrders?.find(s => s['SO No.'] === soNo);
        setFormData(prev => ({
            ...prev,
            'SO No.': soNo,
            'Bid Value': so?.['Total Amount'] || prev['Bid Value'],
            'Currency': (so?.Currency as any) || prev.Currency
        }));
    };

    const handleContactChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const contactName = e.target.value;
        const selectedContact = filteredContacts.find(c => c.Name === contactName);
        setFormData(prev => ({ ...prev, 'Contact Name': contactName, 'Contact Number': selectedContact?.['Tel (1)'] || '', 'Email': selectedContact?.Email || '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onClose(); // Close modal immediately for optimistic UI

        // Exclude UI-only fields and dropped columns from database submission
        const { calculatedDueDate, 'Attach Invoice': _ai, 'Attach D.O': _ado, ...dataToSubmit } = formData as any;

        const submissionData = {
            ...dataToSubmit,
            'Created Date': dataToSubmit['Created Date'] || null,
            'Due Date': dataToSubmit['Due Date'] || null,
            'Inv Date': dataToSubmit['Inv Date'] || null,
            'Quote': ensureHyperlink(dataToSubmit.Quote),
            'Bid Value': dataToSubmit['Bid Value'] && dataToSubmit['Bid Value'] !== '' ? parseFloat(dataToSubmit['Bid Value']) : null,
        };

        if (isEditMode) {
            const originalProjects = projects ? [...projects] : [];
            const updatedId = existingData['Pipeline No.'];
            // Optimistic update
            setProjects(current => current ? current.map(p => p['Pipeline No.'] === updatedId ? { ...p, ...submissionData } as PipelineProject : p) : null);

            try {
                await updateRecord('pipelines', 'Pipeline No.', updatedId, submissionData, isB2B);
                addToast('Pipeline updated!', 'success');
                // The real-time subscription will update the data
            } catch (err: any) {
                addToast(`Failed to update pipeline: ${err.message}`, 'error');
                setProjects(originalProjects); // Revert on failure
            }
        } else { // CREATE
            const tempId = submissionData['Pipeline No.'];
            console.log('🚀 Creating pipeline optimistically:', submissionData);
            // Optimistic update
            setProjects(current => {
                console.log('📊 Current pipelines:', current?.length || 0);
                const updated = current ? [submissionData as PipelineProject, ...current] : [submissionData as PipelineProject];
                console.log('📊 Updated pipelines:', updated.length);
                return updated;
            });

            try {
                await insertRecord('pipelines', submissionData, isB2B);
                addToast('Pipeline created!', 'success');
                // The real-time subscription will update the data
            } catch (err: any) {
                addToast(`Failed to create pipeline: ${err.message}`, 'error');
                // Revert by removing the optimistic data.
                setProjects(current => current ? current.filter(p => p['Pipeline No.'] !== tempId) : null);
            }
        }
    };

    const handleDelete = async () => {
        if (!existingData) return;

        const originalProjects = projects ? [...projects] : [];
        const projectToDeleteId = existingData['Pipeline No.'];

        setDeleteConfirmOpen(false);
        onClose();

        setProjects(current => current ? current.filter(p => p['Pipeline No.'] !== projectToDeleteId) : null);

        try {
            await deleteRecord('pipelines', 'Pipeline No.', projectToDeleteId, isB2B);
            addToast('Pipeline deleted!', 'success');
        } catch (err: any) {
            addToast(`Failed to delete pipeline: ${err.message}`, 'error');
            setProjects(originalProjects); // Revert on failure
        }
    };

    const relatedActivities = useMemo<UnifiedActivity[]>(() => {
        if (!existingData) return [];
        const companyName = existingData['Company Name'];
        const pipelineId = existingData['Pipeline No.'];
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

        return allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [existingData, meetings, contactLogs]);

    const isContactDisabled = !formData['Company Name'];
    const contactPlaceholder = !formData['Company Name'] ? "Select a company first" : (contactOptions.length === 0 ? "No contacts found" : "Select Contact");
    const title = isEditMode ? (isReadOnly ? `Details: ${existingData['Pipeline No.']}` : `Editing: ${existingData['Pipeline No.']}`) : 'Create New Pipeline';
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
                    <FormSection title="Core Details">
                        {isReadOnly ? <FormDisplay label="Pipeline No." value={formData['Pipeline No.']} /> : <FormInput name="Pipeline No." label="Pipeline No." value={formData['Pipeline No.']} onChange={handleChange} required readOnly />}
                        {isReadOnly ? <FormDisplay label="Status" value={formData.Status} /> : <FormSelect name="Status" label="Status" value={formData.Status} onChange={handleChange} options={STATUS_OPTIONS} required />}
                        {isReadOnly ? <FormDisplay label="Responsible By" value={formData['Responsible By']} /> : <FormInput name="Responsible By" label="Responsible By" value={formData['Responsible By']} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Due Date" value={formatToInputDate(formData['Due Date'])} /> : <FormInput name="Due Date" label="Due Date" value={formData['Due Date']} onChange={handleChange} type="date" />}
                        {isReadOnly ? <FormDisplay label="Requirement" value={formData.Require} multiline /> : <FormTextarea name="Require" label="Requirement" value={formData.Require} onChange={handleChange} />}
                    </FormSection>
                    <FormSection title="Company & Contact">
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
                        {isReadOnly ? <FormDisplay label="Contact Name" value={formData['Contact Name']} /> :
                            <FormSelect
                                name="Contact Name"
                                label="Contact Name"
                                value={formData['Contact Name']}
                                onChange={handleContactChange}
                                options={contactOptions}
                                disabled={isContactDisabled || contactOptions.length === 0}
                                disabledPlaceholder={contactPlaceholder}
                                actionButton={!isReadOnly && !!formData['Company Name'] && <button type="button" onClick={() => setIsNewContactModalOpen(true)} className="text-sm font-semibold text-brand-600 hover:underline">+ New</button>}
                            />}
                        {isReadOnly ? <FormDisplay label="Contact Number" value={formData['Contact Number']} /> : <FormInput name="Contact Number" label="Contact Number" value={formData['Contact Number']} onChange={handleChange} type="tel" readOnly />}
                        {isReadOnly ? <FormDisplay label="Email" value={formData.Email} /> : <FormInput name="Email" label="Email" value={formData.Email} onChange={handleChange} type="email" readOnly />}
                    </FormSection>
                    <FormSection title="Project Specifics">
                        {isReadOnly ? <FormDisplay label="Type" value={formData.Type} /> : <FormSelect name="Type" label="Type" value={formData.Type} onChange={handleChange} options={TYPE_OPTIONS} required />}
                        {isReadOnly ? <FormDisplay label="Brand" value={formData['Brand 1']} /> : <FormInput name="Brand 1" label="Brand" value={formData['Brand 1']} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Taxable" value={formData.Taxable} /> : <FormSelect name="Taxable" label="Taxable" value={formData.Taxable} onChange={handleChange} options={TAXABLE_OPTIONS} required />}
                        {isReadOnly ? <FormDisplay label="Time Frame" value={formData['Time Frame']} /> : <FormInput name="Time Frame" label="Time Frame" value={formData['Time Frame']} onChange={handleChange} />}
                    </FormSection>
                    <FormSection title="Notes & Remarks">
                        {isReadOnly ? <FormDisplay label="Remarks" value={formData.Remarks} multiline /> : <FormTextarea name="Remarks" label="Remarks" value={formData.Remarks} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Conditional" value={formData.Conditional} multiline /> : <FormTextarea name="Conditional" label="Conditional" value={formData.Conditional} onChange={handleChange} />}
                    </FormSection>
                    <FormSection title="Financials & Documents">
                        {isReadOnly ? <FormDisplay label="Bid Value" value={formData['Bid Value']} /> : <FormInput name="Bid Value" label="Bid Value" value={formData['Bid Value']} onChange={handleChange} type="text" placeholder="e.g., 5000 or =5000*0.7" />}
                        {isReadOnly ? <FormDisplay label="Currency" value={formData.Currency} /> : <FormSelect name="Currency" label="Currency" value={formData.Currency} onChange={handleChange} options={CURRENCY_OPTIONS} />}
                        {isReadOnly ? (
                            <FormDisplay label="Quote Link">
                                <div className="flex items-center justify-between">
                                    {formData.Quote ? <a href={formData.Quote} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline truncate max-w-[200px]">{formData.Quote}</a> : <span className="text-muted-foreground italic">N/A</span>}
                                    <button
                                        type="button"
                                        onClick={() => handleNavigation({
                                            view: 'quotations',
                                            payload: {
                                                action: 'create',
                                                initialData: {
                                                    'Company Name': formData['Company Name'],
                                                    'Contact Name': formData['Contact Name'],
                                                    'Pipeline No.': formData['Pipeline No.']
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
                                name="Quote"
                                label="Quote No. (from System)"
                                value={formData['Quote No.'] || ''}
                                onChange={handleQuoteSelect}
                                options={quotationOptions}
                                placeholder="Select Quotation..."
                                actionButton={<button type="button" onClick={() => handleNavigation({ view: 'quotations', payload: { action: 'create', initialData: { 'Company Name': formData['Company Name'], 'Pipeline No.': formData['Pipeline No.'] } } })} className="text-xs text-brand-600 font-semibold hover:underline">+ Create New</button>}
                            />
                        )}

                        {isReadOnly ? (
                            <FormDisplay label="SO No.">
                                <div className="flex items-center justify-between">
                                    <span>{formData['SO No.'] || <span className="text-muted-foreground italic">N/A</span>}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleNavigation({
                                            view: 'sale-orders',
                                            payload: {
                                                action: 'create',
                                                initialData: {
                                                    'Company Name': formData['Company Name'],
                                                    'Quote No.': quotations?.find(q => q.File === formData.Quote)?.['Quote No.'] || '',
                                                    'Pipeline No.': formData['Pipeline No.']
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
                                name="SO No."
                                label="Sale Order No. (Select from System)"
                                value={formData['SO No.'] || ''}
                                onChange={handleSOSelect}
                                options={soOptions}
                                placeholder="Select Sale Order..."
                                actionButton={<button type="button" onClick={() => handleNavigation({ view: 'sale-orders', payload: { action: 'create', initialData: { 'Company Name': formData['Company Name'], 'Pipeline No.': formData['Pipeline No.'] } } })} className="text-xs text-brand-600 font-semibold hover:underline">+ Create New</button>}
                            />
                        )}

                        {isReadOnly ? (
                            <FormDisplay label="Invoice No.">
                                <div className="flex items-center justify-between">
                                    <span>{formData['Invoice No.'] || <span className="text-muted-foreground italic">N/A</span>}</span>
                                    {!formData['Invoice No.'] && (
                                        <button
                                            type="button"
                                            onClick={() => handleNavigation({
                                                view: 'sale-orders',
                                                payload: {
                                                    isPipeline: true,
                                                    'Company Name': formData['Company Name'],
                                                    'Contact Name': formData['Contact Name'],
                                                    'Quote No.': quotations?.find(q => q.File === formData.Quote)?.['Quote No.'] || '',
                                                    'Pipeline No.': formData['Pipeline No.']
                                                }
                                            })}
                                            className="text-xs flex items-center gap-1 text-brand-600 hover:text-brand-800 font-medium ml-2"
                                        >
                                            <Plus className="w-3 h-3" /> Create SO
                                        </button>
                                    )}
                                </div>
                            </FormDisplay>
                        ) : (
                            <SearchableSelect
                                name="Invoice No."
                                label="Invoice No. (Select from System)"
                                value={formData['Invoice No.'] || ''}
                                onChange={handleInvoiceSelect}
                                options={invoiceOptions}
                                placeholder="Select Invoice..."
                            />
                        )}

                        {isReadOnly ? <FormDisplay label="Invoice Date" value={formatToInputDate(formData['Inv Date'])} /> : <FormInput name="Inv Date" label="Invoice Date" value={formData['Inv Date']} onChange={handleChange} type="date" />}
                    </FormSection>
                    {isEditMode && (
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60 mb-6">{`Activities (${relatedActivities.length})`}</h3>
                            <div className="flow-root">
                                {relatedActivities.length > 0 ? (
                                    <div className="space-y-4 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                                        {relatedActivities.map((activity, index) => (
                                            <div key={`${activity.type}-${activity.isoDate}-${index}`} className="relative">
                                                <div className="absolute -left-[29px] top-0.5 w-8 h-8 rounded-full bg-card flex items-center justify-center ring-4 ring-card">
                                                    {activity.type === 'meeting' ? <Calendar className="w-5 h-5 text-sky-500" /> : <MessageSquare className="w-5 h-5 text-violet-500" />}
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