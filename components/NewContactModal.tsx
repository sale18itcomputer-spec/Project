import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Contact, PipelineProject, ContactLog, Meeting, UnifiedActivity, Quotation, Company } from '../types';
import { createRecord, updateRecord, deleteRecord } from '../services/api';
import { FormSection, FormInput, FormTextarea, FormSelect, FormDisplay } from './FormControls';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useNavigation } from '../contexts/NavigationContext';
import { formatToSheetDate, formatToInputDate, parseDate, formatDateAsMDY, formatDisplayDate } from '../utils/time';
import { Check, Pencil, Trash2, Calendar, MessageSquare } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import EmptyState from './EmptyState';
import { parseSheetValue } from '../utils/formatters';
import { useToast } from '../contexts/ToastContext';
import ResizableModal from './ResizableModal';

interface NewContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingData?: Contact | null;
  initialReadOnly?: boolean;
  projects?: PipelineProject[];
  contactLogs?: ContactLog[];
  meetings?: Meeting[];
  quotations?: Quotation[];
  initialCompany?: string;
  onSaveSuccess?: (newContact: Contact) => void;
}

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const DEPARTMENT_PRESETS = [
  "Information Technology",
  "Purchasing",
  "Management",
  "Human Resource",
  "Accounting",
  "Marketing",
  "Sales"
];

const NewContactModal: React.FC<NewContactModalProps> = ({ isOpen, onClose, existingData, initialReadOnly = false, projects = [], contactLogs = [], meetings = [], quotations = [], initialCompany, onSaveSuccess }) => {
    const { currentUser } = useAuth();
    const { companies, contacts, setContacts } = useData();
    const { addToast } = useToast();
    const { handleNavigation } = useNavigation();
    
    const [formData, setFormData] = useState<Partial<Contact>>({});
    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const isEditMode = !!existingData;

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);

    const relatedProjects = useMemo(() => (isEditMode && existingData) ? projects.filter(p => p['Contact Name'] === existingData.Name) : [], [projects, existingData, isEditMode]);
    const relatedActivities = useMemo<UnifiedActivity[]>(() => {
        if (!isEditMode || !existingData) return [];
        const contactName = existingData.Name;
        const companyName = existingData['Company Name'];
        const allActivities: UnifiedActivity[] = [];

        contactLogs.forEach(log => {
            if (log['Contact Name'] === contactName || log['Company Name'] === companyName) {
                const date = parseDate(log['Contact Date']);
                if (date) { allActivities.push({ type: 'log', date, isoDate: date.toISOString(), responsible: log['Responsible By'], summary: `Log: ${log.Type} with ${log['Contact Name']}`, details: log.Remarks, original: log }); }
            }
        });
        meetings.forEach(meeting => {
            if (meeting['Company Name'] === companyName || meeting.Participants.includes(contactName)) {
                const date = parseDate(meeting['Meeting Date']);
                if (date) { allActivities.push({ type: 'meeting', date, isoDate: date.toISOString(), responsible: meeting['Responsible By'], summary: `Meeting: ${meeting.Type} with ${meeting.Participants}`, details: meeting.Remarks, original: meeting }); }
            }
        });
        return allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [contactLogs, meetings, existingData, isEditMode]);
    const relatedQuotations = useMemo(() => (isEditMode && existingData) ? quotations.filter(q => q['Contact Name'] === existingData.Name) : [], [quotations, existingData, isEditMode]);


    const getInitialState = useCallback(() => {
        let nextCustomerId = 'CUS0000001';
        if (contacts && Array.isArray(contacts) && contacts.length > 0) {
            const customerNumbers = contacts
                .map(c => c['Customer ID'])
                .filter(id => id && typeof id === 'string' && id.startsWith('CUS'))
                .map(id => parseInt(id.substring(3), 10))
                .filter(num => !isNaN(num));

            if (customerNumbers.length > 0) {
                const maxNum = Math.max(...customerNumbers);
                nextCustomerId = `CUS${String(maxNum + 1).padStart(7, '0')}`;
            }
        }
        return {
            'Customer ID': nextCustomerId,
            'Created Date': getTodayDateString(),
            'Created By': currentUser?.Name || '',
            'Company Name': initialCompany || '',
        }
    }, [contacts, currentUser, initialCompany]);

    const getFormDataForEdit = useCallback((c: Contact) => ({
        ...c,
        'Created Date': formatToInputDate(c['Created Date']),
    }), []);

    useEffect(() => {
        if (isOpen) {
            setIsReadOnly(initialReadOnly);
            if (isEditMode) {
                setFormData(getFormDataForEdit(existingData));
            } else {
                setFormData(getInitialState());
            }
            setDeleteConfirmOpen(false);
        }
    }, [isOpen, existingData, isEditMode, initialReadOnly, getInitialState, getFormDataForEdit]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onClose();

        const submissionData = {
            ...formData,
            'Created Date': formatToSheetDate(formData['Created Date']),
        };

        if (isEditMode) {
            const originalContacts = contacts ? [...contacts] : [];
            const updatedId = existingData['Customer ID'];
            // Optimistic update
            setContacts(current => current ? current.map(c => c['Customer ID'] === updatedId ? { ...c, ...submissionData } as Contact : c) : null);

            try {
                const updatedRecord: Contact = await updateRecord('Contact_List', updatedId, submissionData);
                addToast('Contact updated!', 'success');
                 // Replace optimistic with server record
                setContacts(current => current ? current.map(c => c['Customer ID'] === updatedId ? updatedRecord : c) : [updatedRecord]);
            } catch (err: any) {
                addToast(`Failed to update contact: ${err.message}`, 'error');
                setContacts(originalContacts); // Revert
            }
        } else { // CREATE
            const tempId = submissionData['Customer ID'];
            // Optimistic update
            setContacts(current => current ? [submissionData as Contact, ...current] : [submissionData as Contact]);

            try {
                const createdRecord: Contact = await createRecord('Contact_List', submissionData);
                addToast('Contact created!', 'success');
                // Replace temp record with the one from the server.
                setContacts(current => {
                    if (!current) return [createdRecord];
                    return current.map(c => c['Customer ID'] === tempId ? createdRecord : c);
                });
                if (onSaveSuccess) onSaveSuccess(createdRecord);
            } catch (err: any) {
                addToast(`Failed to create contact: ${err.message}`, 'error');
                // Revert by removing the optimistic data.
                setContacts(current => current ? current.filter(c => c['Customer ID'] !== tempId) : null);
            }
        }
    };

    const handleDelete = async () => {
        if (!existingData) return;
        
        const originalContacts = contacts ? [...contacts] : [];
        const contactToDeleteId = existingData['Customer ID'];
        
        setDeleteConfirmOpen(false);
        onClose();

        setContacts(current => current ? current.filter(c => c['Customer ID'] !== contactToDeleteId) : null);

        try {
            const response: { deletedId: string } = await deleteRecord('Contact_List', contactToDeleteId);
            if (response.deletedId === contactToDeleteId) {
                addToast('Contact deleted!', 'success');
            } else {
                throw new Error("Backend did not confirm deletion.");
            }
        } catch (err: any) {
            addToast(`Failed to delete contact: ${err.message}`, 'error');
            setContacts(originalContacts); // Revert
        }
    };
    
    const navigateTo = (view: string, filter: string) => {
        onClose();
        handleNavigation({ view, filter });
    };

    const title = isEditMode ? (isReadOnly ? `Details: ${existingData.Name}` : `Editing: ${existingData.Name}`) : 'Create New Contact';
    const submitText = isEditMode ? 'Save Changes' : 'Save Contact';
    
    const handleCancelClick = () => {
        if (isEditMode) {
            setFormData(getFormDataForEdit(existingData));
            setIsReadOnly(true);
        } else {
            onClose();
        }
    };

    const formId = `contact-form-${existingData?.['Customer ID'] || 'new'}`;

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
                    <FormSection title="Contact Information">
                        {isReadOnly ? <FormDisplay label="Customer ID" value={formData['Customer ID']} /> : <FormInput name="Customer ID" label="Customer ID" value={formData['Customer ID']} onChange={handleChange} required readOnly />}
                        {isReadOnly ? <FormDisplay label="Name" value={formData.Name} /> : <FormInput name="Name" label="Name" value={formData.Name} onChange={handleChange} required />}
                        {isReadOnly ? <FormDisplay label="Name (Khmer)" value={formData['Name (Khmer)']} /> : <FormInput name="Name (Khmer)" label="Name (Khmer)" value={formData['Name (Khmer)']} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Company Name" value={formData['Company Name']} /> : <FormSelect name="Company Name" label="Company Name" value={formData['Company Name']} onChange={handleChange} options={companyOptions} required disabled={!!initialCompany} />}
                        {isReadOnly ? <FormDisplay label="Role" value={formData.Role} /> : <FormInput name="Role" label="Role" value={formData.Role} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Department" value={formData.Department} /> : <FormInput name="Department" label="Department" value={formData.Department} onChange={handleChange} list="department-presets" datalistOptions={DEPARTMENT_PRESETS} placeholder="Select or type a department" />}
                        {isReadOnly ? <FormDisplay label="Email" value={formData.Email} /> : <FormInput name="Email" label="Email" value={formData.Email} onChange={handleChange} type="email" />}
                        {isReadOnly ? <FormDisplay label="Phone (1)" value={formData['Tel (1)']} /> : <FormInput name="Tel (1)" label="Phone (1)" value={formData['Tel (1)']} onChange={handleChange} type="tel" />}
                        {isReadOnly ? <FormDisplay label="Phone (2)" value={formData['Tel (2)']} /> : <FormInput name="Tel (2)" label="Phone (2)" value={formData['Tel (2)']} onChange={handleChange} type="tel" />}
                    </FormSection>
                    <FormSection title="Address">
                        {isReadOnly ? <FormDisplay label="Address (English)" value={formData['Address (English)']} multiline /> : <FormTextarea name="Address (English)" label="Address (English)" value={formData['Address (English)']} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Address (Khmer)" value={formData['Address (Khmer)']} multiline /> : <FormTextarea name="Address (Khmer)" label="Address (Khmer)" value={formData['Address (Khmer)']} onChange={handleChange} />}
                    </FormSection>
                    <FormSection title="Remarks">
                        {isReadOnly ? <FormDisplay label="Remarks" value={formData.Remarks} multiline /> : <FormTextarea name="Remarks" label="Remarks" value={formData.Remarks} onChange={handleChange} />}
                    </FormSection>

                    {isEditMode && (
                        <>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-6">{`Projects (${relatedProjects.length})`}</h3>
                                <div className="flow-root">{relatedProjects.length > 0 ? (<ul className="-my-4 divide-y divide-gray-200">{relatedProjects.map(project => (<li key={project['Pipeline No.']} className="flex items-center space-x-4 py-4"><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{project['Pipeline No.']}</p><p className="text-sm text-gray-500 truncate">{project.Require}</p></div><div className="text-right"><span className="text-sm font-medium text-gray-700">{project['Bid Value']}</span><p className="text-xs text-gray-500">{project.Status}</p></div><button type="button" onClick={() => navigateTo('projects', project['Pipeline No.'])} className="text-brand-600 hover:text-brand-800 text-sm font-semibold">View</button></li>))}</ul>) : <EmptyState />}</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-6">{`Activities (${relatedActivities.length})`}</h3>
                                <div className="flow-root">{relatedActivities.length > 0 ? (<div className="space-y-4 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">{relatedActivities.map((activity, index) => (<div key={`${activity.type}-${activity.isoDate}-${index}`} className="relative"><div className="absolute -left-[29px] top-0.5 w-8 h-8 rounded-full bg-white flex items-center justify-center ring-4 ring-white">{activity.type === 'meeting' ? <Calendar className="w-5 h-5 text-sky-600" /> : <MessageSquare className="w-5 h-5 text-violet-600" />}</div><div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80"><p className="font-semibold text-gray-800">{activity.summary}</p><p className="text-sm text-gray-500 mb-2">{formatDateAsMDY(activity.date)} by {activity.responsible}</p>{activity.details && <p className="text-sm text-gray-700 whitespace-pre-wrap">{activity.details}</p>}</div></div>))}</div>) : <EmptyState />}</div>
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
                        </>
                    )}
                </form>
            </ResizableModal>
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Contact" confirmText="Delete">
                Are you sure you want to delete this contact? This action cannot be undone.
            </ConfirmationModal>
        </>
    );
};

export default NewContactModal;