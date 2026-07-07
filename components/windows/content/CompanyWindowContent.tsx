'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Company, SaleOrder } from '@/types';
import { COMPANY_HEADERS } from '@/schemas';
import { insertRecord, updateRecord, deleteRecord } from '@/services/b2bDb';
import { uploadFile } from '@/services/api';
import { FormSection, FormInput, FormTextarea } from '@/components/common/FormControls';
import { useAuth } from '@/contexts/AuthContext';
import { useB2BData } from '@/hooks/useB2BData';
import { useData } from '@/contexts/DataContext';
import { useB2B } from '@/contexts/B2BContext';
import { generateCustomerStatement } from '@/utils/statement';
import { useToast } from '@/contexts/ToastContext';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { formatToSheetDate, formatToInputDate, formatDisplayDate } from '@/utils/time';
import { Check, Trash2, Loader2, X, ExternalLink, FileText } from 'lucide-react';
import ConfirmationModal from '@/components/modals/ConfirmationModal';
import EmptyState from '@/components/common/EmptyState';
import Spinner from '@/components/common/Spinner';
import { parseSheetValue } from '@/utils/formatters';

const PAYMENT_TERM_PRESETS = ['COD', 'Credit 7days', 'Credit 14days', 'Credit 21days', 'Credit 30days'];

const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

interface CompanyWindowContentProps {
    windowId: string;
    companyId: string | null;
}

const CompanyWindowContent: React.FC<CompanyWindowContentProps> = ({ windowId, companyId }) => {
    const { currentUser } = useAuth();
    const { companies, setCompanies, projects, contacts, quotations, saleOrders } = useB2BData();
    const { invoices, receipts, fetchModule } = useData();
    const { isB2B } = useB2B();
    const { addToast } = useToast();
    const { closeWindow, updateWindow } = useWindowManager();
    const { handleNavigation } = useNavigation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isGeneratingStatement, setIsGeneratingStatement] = useState(false);

    const [formData, setFormData] = useState<Partial<Company>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const isEditMode = !!companyId;
    const existingData = useMemo(
        () => companies?.find(c => c['Company ID'] === companyId) || null,
        [companies, companyId],
    );

    const relatedProjects = useMemo(
        () => (isEditMode && existingData) ? (projects || []).filter(p => p['Company Name'] === existingData['Company Name']) : [],
        [projects, existingData, isEditMode],
    );
    const relatedContacts = useMemo(
        () => (isEditMode && existingData) ? (contacts || []).filter(c => c['Company Name'] === existingData['Company Name']) : [],
        [contacts, existingData, isEditMode],
    );
    const relatedQuotations = useMemo(
        () => (isEditMode && existingData) ? (quotations || []).filter(q => q['Company Name'] === existingData['Company Name']) : [],
        [quotations, existingData, isEditMode],
    );
    const relatedSaleOrders = useMemo(
        () => (isEditMode && existingData) ? (saleOrders || []).filter(so => so['Company Name'] === existingData['Company Name']) : [],
        [saleOrders, existingData, isEditMode],
    );

    const getInitialState = useCallback((): Partial<Company> => {
        const prefix = isB2B ? 'BCOM' : 'COM';
        let nextId = `${prefix}0000001`;
        if (companies && companies.length > 0) {
            const nums = companies
                .map(c => c['Company ID'])
                .filter(id => id?.startsWith(prefix))
                .map(id => parseInt(id!.substring(prefix.length), 10))
                .filter(n => !isNaN(n));
            if (nums.length > 0) nextId = `${prefix}${String(Math.max(...nums) + 1).padStart(7, '0')}`;
        }
        return { 'Company ID': nextId, 'Created Date': getTodayDateString(), 'Created By': currentUser?.Name || '' };
    }, [companies, currentUser, isB2B]);

    useEffect(() => {
        if (isEditMode && existingData) {
            setFormData({ ...existingData, 'Created Date': formatToInputDate(existingData['Created Date']) });
        } else if (!isEditMode) {
            setFormData(getInitialState());
        }
    }, [existingData, isEditMode, getInitialState]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const response = await uploadFile(file);
            setFormData(prev => ({ ...prev, 'Patent File': response.url }));
            addToast('File uploaded successfully!', 'success');
        } catch (err: any) {
            addToast(err.message || 'File upload failed.', 'error');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveFile = () => setFormData(prev => ({ ...prev, 'Patent File': '' }));

    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSubmitting(true);

        const raw = { ...formData, 'Created Date': formatToSheetDate(formData['Created Date']) };
        const submissionData: Partial<Company> = {};
        COMPANY_HEADERS.forEach(h => { if (h in raw) (submissionData as any)[h] = (raw as any)[h]; });

        if (isEditMode && existingData) {
            const original = companies ? [...companies] : [];
            const updatedId = existingData['Company ID'];
            setCompanies(cur => cur ? cur.map(c => c['Company ID'] === updatedId ? { ...c, ...submissionData } as Company : c) : null);
            try {
                await updateRecord('companies', 'Company ID', updatedId, submissionData, isB2B);
                addToast('Company updated!', 'success');
                closeWindow(windowId);
            } catch (err: any) {
                addToast(`Failed to update: ${err.message}`, 'error');
                setCompanies(original);
                setIsSubmitting(false);
            }
        } else {
            const tempId = submissionData['Company ID'];
            setCompanies(cur => cur ? [submissionData as Company, ...cur] : [submissionData as Company]);
            try {
                await insertRecord('companies', submissionData, isB2B);
                addToast('Company created!', 'success');
                closeWindow(windowId);
            } catch (err: any) {
                addToast(`Failed to create: ${err.message}`, 'error');
                setCompanies(cur => cur ? cur.filter(c => c['Company ID'] !== tempId) : null);
                setIsSubmitting(false);
            }
        }
    }, [formData, isEditMode, existingData, companies, setCompanies, isB2B, addToast, closeWindow, windowId]);

    // Load invoices + receipts so the statement button can build from live AR data.
    useEffect(() => {
        if (isEditMode) fetchModule('Invoices', 'Receipts');
    }, [isEditMode, fetchModule]);

    const handleGenerateStatement = useCallback(async () => {
        if (!existingData) return;
        setIsGeneratingStatement(true);
        try {
            const count = await generateCustomerStatement({ company: existingData, invoices, receipts, openOnly: true });
            if (count === 0) addToast('No outstanding invoices for this customer.', 'info');
            else addToast(`Statement generated (${count} open invoices).`, 'success');
        } catch (err: any) {
            addToast(`Failed to generate statement: ${err.message}`, 'error');
        } finally {
            setIsGeneratingStatement(false);
        }
    }, [existingData, invoices, receipts, addToast]);

    const handleDelete = async () => {
        if (!existingData) return;
        const original = companies ? [...companies] : [];
        const id = existingData['Company ID'];
        setDeleteConfirmOpen(false);
        setCompanies(cur => cur ? cur.filter(c => c['Company ID'] !== id) : null);
        try {
            await deleteRecord('companies', 'Company ID', id, isB2B);
            addToast('Company deleted!', 'success');
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to delete: ${err.message}`, 'error');
            setCompanies(original);
        }
    };

    useEffect(() => {
        const title = isEditMode
            ? (existingData ? `Company: ${existingData['Company Name']}` : 'Company')
            : 'Create New Company';
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
                    {isEditMode && (
                        <button type="button" onClick={handleGenerateStatement} disabled={isGeneratingStatement} className="flex items-center gap-2 font-semibold py-2 px-4 rounded-lg border border-brand-500/40 text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 text-sm disabled:opacity-50">
                            {isGeneratingStatement ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Statement
                        </button>
                    )}
                    <button type="button" onClick={() => closeWindow(windowId)} className="font-semibold py-2 px-4 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-sm">
                        {isEditMode ? 'Close' : 'Cancel'}
                    </button>
                    <button type="submit" form={`company-window-form-${windowId}`} disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                        {isEditMode ? 'Save Changes' : 'Save Company'}
                    </button>
                </div>
            </div>
        );
        updateWindow(windowId, { title, footer });
    }, [windowId, companyId, isEditMode, existingData, isSubmitting, isGeneratingStatement, handleGenerateStatement, updateWindow, closeWindow]);

    return (
        <>
            <form id={`company-window-form-${windowId}`} onSubmit={handleSubmit} className="space-y-6 max-h-full overflow-y-auto p-1 pr-2 custom-scrollbar">
                <FormSection title="Company Information">
                    <FormInput name="Company ID" label="Company ID" value={formData['Company ID']} onChange={() => {}} required readOnly />
                    <FormInput name="Company Name" label="Company Name" value={formData['Company Name']} onChange={handleChange} required />
                    <FormInput name="Company Name (Khmer)" label="Company Name (Khmer)" value={formData['Company Name (Khmer)']} onChange={handleChange} />
                    <FormInput name="Field" label="Field" value={formData.Field} onChange={handleChange} />
                </FormSection>
                <FormSection title="Contact Details">
                    <FormInput name="Phone Number" label="Phone Number" type="tel" value={formData['Phone Number']} onChange={handleChange} />
                    <FormInput name="Email" label="Email" type="email" value={formData.Email} onChange={handleChange} />
                    <FormInput name="Website" label="Website" type="url" value={formData.Website} onChange={handleChange} />
                </FormSection>
                <FormSection title="Address">
                    <FormTextarea name="Address (English)" label="Address (English)" value={formData['Address (English)']} onChange={handleChange} />
                    <FormTextarea name="Address (Khmer)" label="Address (Khmer)" value={formData['Address (Khmer)']} onChange={handleChange} />
                </FormSection>
                <FormSection title="Legal & Financial">
                    <FormInput name="Patent" label="Patent Number" value={formData.Patent} onChange={handleChange} />
                    <div className="flex flex-col">
                        <label htmlFor={`payment-term-${windowId}`} className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Payment Term</label>
                        <input
                            type="text" name="Payment Term" id={`payment-term-${windowId}`}
                            value={formData['Payment Term'] || ''} onChange={handleChange}
                            list={`payment-terms-${windowId}`} placeholder="Select or type a payment term"
                            className="block w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 hover:border-muted-foreground/40"
                        />
                        <datalist id={`payment-terms-${windowId}`}>
                            {PAYMENT_TERM_PRESETS.map(t => <option key={t} value={t} />)}
                        </datalist>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-muted-foreground/60 mb-1.5">Patent File</label>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                        {isUploading ? (
                            <div className="flex items-center gap-3 text-sm text-muted-foreground p-3 rounded-lg bg-muted border border-border">
                                <Spinner size="sm" />
                                <span>Uploading...</span>
                            </div>
                        ) : formData['Patent File'] ? (
                            <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <a href={formData['Patent File']} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-500 hover:underline truncate max-w-xs sm:max-w-md">
                                    View Uploaded File
                                </a>
                                <button type="button" onClick={handleRemoveFile} className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors ml-2 flex-shrink-0">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full text-center py-2.5 px-4 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg border-2 border-dashed border-border transition-colors">
                                Click to Upload File
                            </button>
                        )}
                    </div>
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
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60 mb-6">{`Contacts (${relatedContacts.length})`}</h3>
                            <div className="flow-root">
                                {relatedContacts.length > 0 ? (
                                    <ul className="-my-4 divide-y divide-border">
                                        {relatedContacts.map(contact => (
                                            <li key={contact['Customer ID']} className="flex items-center space-x-4 py-4">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-foreground truncate">{contact.Name}</p>
                                                    <p className="text-sm text-muted-foreground truncate">{contact.Role}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-foreground">{contact['Tel (1)']}</p>
                                                    <p className="text-xs text-muted-foreground">{contact.Email}</p>
                                                </div>
                                                <button type="button" onClick={() => handleNavigation({ view: 'contacts', filter: contact.Name })} className="text-brand-600 hover:text-brand-800 text-sm font-semibold">View</button>
                                            </li>
                                        ))}
                                    </ul>
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
                                                <li key={quote['Quote No']} className="flex items-center space-x-4 py-4">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-foreground truncate">{quote['Quote No']}</p>
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
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60 mb-6">{`Sale Orders (${relatedSaleOrders.length})`}</h3>
                            <div className="flow-root">
                                {relatedSaleOrders.length > 0 ? (
                                    <ul className="-my-4 divide-y divide-border">
                                        {relatedSaleOrders.map(so => {
                                            let url = '#';
                                            if (so.File) { const m = so.File.match(/=HYPERLINK\("([^"]+)"/i); if (m) url = m[1]; }
                                            return (
                                                <li key={so['SO No.']} className="flex items-center space-x-4 py-4">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-foreground truncate">{so['SO No.']}</p>
                                                        <p className="text-sm text-muted-foreground truncate">{formatDisplayDate(so['SO Date'])}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-medium text-foreground">{parseSheetValue(so['Total Amount']).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                                                        <p className="text-xs text-muted-foreground">{so.Status}</p>
                                                    </div>
                                                    {url !== '#' ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-800 text-sm font-semibold flex items-center gap-1">View <ExternalLink className="w-3 h-3" /></a> : <span className="text-muted-foreground text-sm">No file</span>}
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
                <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Company" confirmText="Delete">
                    Are you sure you want to delete this company? This action cannot be undone.
                </ConfirmationModal>
            )}
        </>
    );
};

export default CompanyWindowContent;
