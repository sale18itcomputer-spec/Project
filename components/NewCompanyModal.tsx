import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Company, PipelineProject, Contact, Quotation, SaleOrder } from '../types';
import { createRecord, updateRecord, deleteRecord, uploadFile } from '../services/api';
import { FormSection, FormInput, FormTextarea, FormDisplay } from './FormControls';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useNavigation } from '../contexts/NavigationContext';
import { formatToSheetDate, formatToInputDate, formatDisplayDate } from '../utils/time';
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { Check, Pencil, Trash2, X, ExternalLink } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import EmptyState from './EmptyState';
import { parseSheetValue } from '../utils/formatters';
import { useToast } from '../contexts/ToastContext';
import ResizableModal from './ResizableModal';
import Spinner from './Spinner';

interface NewCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingData?: Company | null;
  initialReadOnly?: boolean;
  projects?: PipelineProject[];
  contacts?: Contact[];
  quotations?: Quotation[];
  saleOrders?: SaleOrder[];
  onSaveSuccess?: (newCompany: Company) => void;
}

const PAYMENT_TERM_PRESETS = [
  'COD',
  'Credit 7days',
  'Credit 14days',
  'Credit 21days',
  'Credit 30days',
];

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const NewCompanyModal: React.FC<NewCompanyModalProps> = ({ isOpen, onClose, existingData, initialReadOnly = false, projects = [], contacts = [], quotations = [], saleOrders = [], onSaveSuccess }) => {
    const { currentUser } = useAuth();
    const { companies, setCompanies } = useData();
    const { addToast } = useToast();
    const { handleNavigation } = useNavigation();

    const [formData, setFormData] = useState<Partial<Company>>({});
    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const isEditMode = !!existingData;

    const relatedProjects = useMemo(() => (isEditMode && existingData) ? projects.filter(p => p['Company Name'] === existingData['Company Name']) : [], [projects, existingData, isEditMode]);
    const relatedContacts = useMemo(() => (isEditMode && existingData) ? contacts.filter(c => c['Company Name'] === existingData['Company Name']) : [], [contacts, existingData, isEditMode]);
    const relatedQuotations = useMemo(() => (isEditMode && existingData) ? quotations.filter(q => q['Company Name'] === existingData['Company Name']) : [], [quotations, existingData, isEditMode]);
    const relatedSaleOrders = useMemo(() => (isEditMode && existingData) ? saleOrders.filter(so => so['Company Name'] === existingData['Company Name']) : [], [saleOrders, existingData, isEditMode]);


    const getInitialState = useCallback(() => {
        let nextCompanyId = 'COM0000001';
        if (companies && Array.isArray(companies) && companies.length > 0) {
            const companyNumbers = companies
                .map(c => c['Company ID'])
                .filter(id => id && typeof id === 'string' && id.startsWith('COM'))
                .map(id => parseInt(id.substring(3), 10))
                .filter(num => !isNaN(num));

            if (companyNumbers.length > 0) {
                const maxNum = Math.max(...companyNumbers);
                nextCompanyId = `COM${String(maxNum + 1).padStart(7, '0')}`;
            }
        }
        return {
            'Company ID': nextCompanyId,
            'Created Date': getTodayDateString(),
            'Created By': currentUser?.Name || '',
        };
    }, [companies, currentUser]);

    const getFormDataForEdit = useCallback((c: Company) => ({
        ...c,
        'Created Date': formatToInputDate(c['Created Date']),
    }), []);

    useEffect(() => {
        if (isOpen) {
             setIsReadOnly(initialReadOnly);
             if (isEditMode) {
                const initialData = getFormDataForEdit(existingData);
                setFormData(initialData);
            } else {
                setFormData(getInitialState());
            }
            setDeleteConfirmOpen(false);
        }
    }, [isOpen, existingData, isEditMode, initialReadOnly, getInitialState, getFormDataForEdit]);

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
        }
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveFile = () => {
        setFormData(prev => ({ ...prev, 'Patent File': '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onClose(); // Close modal immediately

        const submissionData = {
            ...formData,
            'Created Date': formatToSheetDate(formData['Created Date']),
        };

        if (isEditMode) {
            const originalCompanies = companies ? [...companies] : [];
            const optimisticData = { ...existingData, ...submissionData } as Company;
            
            setCompanies(current => current ? current.map(c => c['Company ID'] === existingData['Company ID'] ? optimisticData : c) : [optimisticData]);
            
            try {
                await updateRecord('Company List', existingData['Company ID'], submissionData);
                addToast('Company updated!', 'success');
            } catch (err) {
                addToast('Failed to update company.', 'error');
                setCompanies(originalCompanies);
            }
        } else { // CREATE
            const optimisticData = submissionData as Company;
            setCompanies(current => current ? [optimisticData, ...current] : [optimisticData]);

            try {
                await createRecord('Company List', submissionData);
                addToast('Company created!', 'success');
                if (onSaveSuccess) onSaveSuccess(optimisticData);
            } catch (err) {
                addToast('Failed to create company.', 'error');
                setCompanies(current => current ? current.filter(c => c['Company ID'] !== optimisticData['Company ID']) : null);
            }
        }
    };

    const handleDelete = async () => {
        if (!existingData) return;
        
        const originalCompanies = companies ? [...companies] : [];
        const companyToDeleteId = existingData['Company ID'];
        
        setDeleteConfirmOpen(false);
        onClose();

        setCompanies(current => current ? current.filter(c => c['Company ID'] !== companyToDeleteId) : null);

        try {
            await deleteRecord('Company List', companyToDeleteId);
            addToast('Company deleted!', 'success');
        } catch (err) {
            addToast('Failed to delete company.', 'error');
            setCompanies(originalCompanies);
        }
    };
    
    const navigateTo = (view: string, filter: string) => {
        onClose();
        handleNavigation({ view, filter });
    };

    const title = isEditMode ? (isReadOnly ? `Details: ${existingData['Company Name']}` : `Editing: ${existingData['Company Name']}`) : 'Create New Company';
    const submitText = isEditMode ? 'Save Changes' : 'Save Company';
    
    const handleCancelClick = () => {
        if (isEditMode) {
            setFormData(getFormDataForEdit(existingData));
            setIsReadOnly(true);
        } else {
            onClose();
        }
    }
    
    const formId = `company-form-${existingData?.['Company ID'] || 'new'}`;

    const modalFooter = (
      <div className="flex justify-between items-center w-full">
          {isReadOnly ? (
              <>
                  <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 border border-rose-500 text-rose-500 hover:bg-rose-50 disabled:opacity-50">
                      <Trash2 className="w-5 h-5" /> Delete
                  </button>
                  <div className="flex items-center gap-3">
                      <button type="button" onClick={onClose} className="font-semibold py-2 px-4 rounded-lg transition-colors duration-200 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Close</button>
                      <button type="button" onClick={() => setIsReadOnly(false)} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-lg transition shadow-sm flex items-center gap-2">
                          <Pencil className="w-5 h-5" /> Edit
                      </button>
                  </div>
              </>
          ) : (
              <div className="flex justify-end gap-3 w-full">
                  <button type="button" onClick={handleCancelClick} className="bg-white hover:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-md border border-gray-300 transition">Cancel</button>
                  <button type="submit" form={formId} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md transition shadow-sm flex items-center">
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
                <form id={formId} onSubmit={handleSubmit} className="space-y-6">
                     <FormSection title="Company Information">
                        {isReadOnly ? <FormDisplay label="Company ID" value={formData['Company ID']} /> : <FormInput name="Company ID" label="Company ID" value={formData['Company ID']} onChange={handleChange} required readOnly />}
                        {isReadOnly ? <FormDisplay label="Company Name" value={formData['Company Name']} /> : <FormInput name="Company Name" label="Company Name" value={formData['Company Name']} onChange={handleChange} required />}
                        {isReadOnly ? <FormDisplay label="Company Name (Khmer)" value={formData['Company Name (Khmer)']} /> : <FormInput name="Company Name (Khmer)" label="Company Name (Khmer)" value={formData['Company Name (Khmer)']} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Field" value={formData.Field} /> : <FormInput name="Field" label="Field" value={formData.Field} onChange={handleChange} />}
                    </FormSection>
                    <FormSection title="Contact Details">
                        {isReadOnly ? <FormDisplay label="Phone Number" value={formData['Phone Number']} /> : <FormInput name="Phone Number" label="Phone Number" value={formData['Phone Number']} onChange={handleChange} type="tel"/>}
                        {isReadOnly ? <FormDisplay label="Email" value={formData.Email} /> : <FormInput name="Email" label="Email" value={formData.Email} onChange={handleChange} type="email"/>}
                        {isReadOnly ? <FormDisplay label="Website" value={formData.Website} /> : <FormInput name="Website" label="Website" value={formData.Website} onChange={handleChange} type="url"/>}
                    </FormSection>
                    <FormSection title="Address">
                        {isReadOnly ? <FormDisplay label="Address (English)" value={formData['Address (English)']} multiline /> : <FormTextarea name="Address (English)" label="Address (English)" value={formData['Address (English)']} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Address (Khmer)" value={formData['Address (Khmer)']} multiline /> : <FormTextarea name="Address (Khmer)" label="Address (Khmer)" value={formData['Address (Khmer)']} onChange={handleChange} />}
                    </FormSection>
                     <FormSection title="Legal & Financial">
                        {isReadOnly ? <FormDisplay label="Patent Number" value={formData.Patent} /> : <FormInput name="Patent" label="Patent Number" value={formData.Patent} onChange={handleChange} />}
                        
                        {isReadOnly ? (
                            <FormDisplay label="Payment Term" value={formData['Payment Term']} />
                        ) : (
                            <div className="flex flex-col">
                                <label htmlFor="Payment Term" className="block text-sm font-medium text-slate-600 mb-1.5">Payment Term</label>
                                <input
                                    type="text"
                                    name="Payment Term"
                                    id="Payment Term"
                                    value={formData['Payment Term'] || ''}
                                    onChange={handleChange}
                                    list="payment-terms-list"
                                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 hover:border-slate-300"
                                    placeholder="Select or type a payment term"
                                />
                                <datalist id="payment-terms-list">
                                    {PAYMENT_TERM_PRESETS.map(term => <option key={term} value={term} />)}
                                </datalist>
                            </div>
                        )}
                        
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Patent File</label>
                            {isReadOnly ? (
                                formData['Patent File'] ? (
                                    <div className="block w-full px-3.5 py-2.5 bg-slate-50 border-transparent rounded-lg sm:text-sm text-slate-800 min-h-[42px] flex items-center">
                                        <a href={formData['Patent File']} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
                                            View Patent File
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                ) : <div className="block w-full px-3.5 py-2.5 bg-slate-50 border-transparent rounded-lg sm:text-sm text-slate-400 italic min-h-[42px] flex items-center">N/A</div>
                            ) : (
                                <>
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"/>
                                    {isUploading ? (
                                        <div className="flex items-center gap-3 text-sm text-slate-600 p-3 rounded-lg bg-slate-100 border border-slate-200">
                                            <Spinner size="sm" />
                                            <span>Uploading...</span>
                                        </div>
                                    ) : formData['Patent File'] ? (
                                        <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                                            <a href={formData['Patent File']} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 hover:underline truncate max-w-xs sm:max-w-md">
                                                View Uploaded File
                                            </a>
                                            <button type="button" onClick={handleRemoveFile} className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-100 rounded-full transition-colors ml-2 flex-shrink-0">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full text-center py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors">
                                            Click to Upload File
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </FormSection>

                    {isEditMode && (
                        <>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-6">{`Projects (${relatedProjects.length})`}</h3>
                                <div className="flow-root">{relatedProjects.length > 0 ? (<ul className="-my-4 divide-y divide-gray-200">{relatedProjects.map(project => (<li key={project['Pipeline No.']} className="flex items-center space-x-4 py-4"><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{project['Pipeline No.']}</p><p className="text-sm text-gray-500 truncate">{project.Require}</p></div><div className="text-right"><span className="text-sm font-medium text-gray-700">{project['Bid Value']}</span><p className="text-xs text-gray-500">{project.Status}</p></div><button type="button" onClick={() => navigateTo('projects', project['Pipeline No.'])} className="text-brand-600 hover:text-brand-800 text-sm font-semibold">View</button></li>))}</ul>) : <EmptyState />}</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-6">{`Contacts (${relatedContacts.length})`}</h3>
                                <div className="flow-root">{relatedContacts.length > 0 ? (<ul className="-my-4 divide-y divide-gray-200">{relatedContacts.map(contact => (<li key={contact['Customer ID']} className="flex items-center space-x-4 py-4"><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{contact.Name}</p><p className="text-sm text-gray-500 truncate">{contact.Role}</p></div><div className="text-right"><p className="text-sm text-gray-700">{contact['Tel (1)']}</p><p className="text-xs text-gray-500">{contact.Email}</p></div><button type="button" onClick={() => navigateTo('contacts', contact.Name)} className="text-brand-600 hover:text-brand-800 text-sm font-semibold">View</button></li>))}</ul>) : <EmptyState />}</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-6">{`Quotations (${relatedQuotations.length})`}</h3>
                                <div className="flow-root">{relatedQuotations.length > 0 ? (<ul className="-my-4 divide-y divide-gray-200">{relatedQuotations.map(quote => {
                                    let url = '#';
                                    if (quote.File) {
                                        const match = quote.File.match(/=HYPERLINK\("([^"]+)"/i);
                                        if (match && match[1]) url = match[1];
                                    }
                                    return (<li key={quote['Quote No.']} className="flex items-center space-x-4 py-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{quote['Quote No.']}</p>
                                            <p className="text-sm text-gray-500 truncate">{formatDisplayDate(quote['Quote Date'])}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-medium text-gray-700">{parseSheetValue(quote.Amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                                            <p className="text-xs text-gray-500">{quote.Status}</p>
                                        </div>
                                        {url !== '#' ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-800 text-sm font-semibold">View</a> : <span className="text-gray-400 text-sm">No file</span>}
                                    </li>)
                                })}</ul>) : <EmptyState />}</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-6">{`Sale Orders (${relatedSaleOrders.length})`}</h3>
                                <div className="flow-root">{relatedSaleOrders.length > 0 ? (<ul className="-my-4 divide-y divide-gray-200">{relatedSaleOrders.map(so => {
                                    let url = '#';
                                    if (so.File) {
                                        const match = so.File.match(/=HYPERLINK\("([^"]+)"/i);
                                        if (match && match[1]) url = match[1];
                                    }
                                    return (<li key={so['SO No.']} className="flex items-center space-x-4 py-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{so['SO No.']}</p>
                                            <p className="text-sm text-gray-500 truncate">{formatDisplayDate(so['SO Date'])}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-medium text-gray-700">{parseSheetValue(so['Total Amount']).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                                            <p className="text-xs text-gray-500">{so.Status}</p>
                                        </div>
                                        {url !== '#' ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-800 text-sm font-semibold">View</a> : <span className="text-gray-400 text-sm">No file</span>}
                                    </li>)
                                })}</ul>) : <EmptyState />}</div>
                            </div>
                        </>
                    )}
                </form>
            </ResizableModal>

            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Company" confirmText="Delete">
                Are you sure you want to delete this company? This action cannot be undone.
            </ConfirmationModal>
        </>
    );
};

export default NewCompanyModal;