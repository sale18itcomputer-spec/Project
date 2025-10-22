import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ContactLog, Company, Contact } from '../types';
import { createRecord, updateRecord, deleteRecord } from '../services/api';
import { FormSection, FormInput, FormTextarea, FormSelect, FormDisplay } from './FormControls';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { formatToSheetDate, formatToInputDate } from '../utils/time';
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { Check, Pencil, Trash2 } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import NewCompanyModal from './NewCompanyModal';
import NewContactModal from './NewContactModal';
import { useToast } from '../contexts/ToastContext';
import ResizableModal from './ResizableModal';

interface NewContactLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingData?: ContactLog | null;
  initialReadOnly?: boolean;
}

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const TYPE_OPTIONS = ['Call', 'Message', 'Email', 'Meeting'];

const NewContactLogModal: React.FC<NewContactLogModalProps> = ({ isOpen, onClose, existingData, initialReadOnly = false }) => {
    const { currentUser } = useAuth();
    const { companies, contacts, contactLogs, setContactLogs } = useData();
    const { addToast } = useToast();
    const [formData, setFormData] = useState<Partial<ContactLog>>({});
    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
    const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
    
    const isEditMode = !!existingData;

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const contactOptions = useMemo(() => contacts?.filter(c => c['Company Name'] === formData['Company Name']).map(c => c.Name) || [], [contacts, formData]);

    const getInitialState = useCallback(() => {
        let nextLogId = 'CONTL00000001';
        if (contactLogs && Array.isArray(contactLogs) && contactLogs.length > 0) {
            const logNumbers = contactLogs
                .map(l => l['Log ID'])
                .filter(id => id && typeof id === 'string' && id.startsWith('CONTL'))
                .map(id => parseInt(id.substring(5), 10))
                .filter(num => !isNaN(num));
            
            if (logNumbers.length > 0) {
                const maxNum = Math.max(...logNumbers);
                nextLogId = `CONTL${String(maxNum + 1).padStart(8, '0')}`;
            }
        }
        return {
            'Log ID': nextLogId,
            'Contact Date': getTodayDateString(),
            'Responsible By': currentUser?.Name || '',
            'Type': 'Call'
        };
    }, [contactLogs, currentUser]);
    
    const getFormDataForEdit = useCallback((l: ContactLog) => ({
        ...l,
        'Contact Date': formatToInputDate(l['Contact Date']),
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
    
    const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const companyName = e.target.value;
        setFormData(prev => ({ ...prev, 'Company Name': companyName, 'Contact Name': '', 'Position': '' }));
    };

    const handleContactChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const contactName = e.target.value;
        const selectedContact = contacts?.find(c => c.Name === contactName && c['Company Name'] === formData['Company Name']);
        setFormData(prev => ({ ...prev, 'Contact Name': contactName, 'Position': selectedContact ? selectedContact.Role : '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onClose();

        const submissionData: Partial<ContactLog> = {
            ...formData,
            'Contact Date': formatToSheetDate(formData['Contact Date']),
        };

        if (isEditMode) {
            const originalLogs = contactLogs ? [...contactLogs] : [];
            const optimisticData = { ...existingData, ...submissionData } as ContactLog;

            setContactLogs(current => current ? current.map(l => l['Log ID'] === existingData['Log ID'] ? optimisticData : l) : [optimisticData]);

            try {
                await updateRecord('Contact_Logs', existingData['Log ID']!, submissionData);
                addToast('Contact log updated!', 'success');
            } catch (err) {
                addToast('Failed to update log.', 'error');
                setContactLogs(originalLogs);
            }
        } else {
            const optimisticData = submissionData as ContactLog;
            
            setContactLogs(current => current ? [optimisticData, ...current] : [optimisticData]);
            
            try {
                await createRecord('Contact_Logs', optimisticData);
                addToast('Contact log created!', 'success');
            } catch (err) {
                addToast('Failed to create log.', 'error');
                setContactLogs(current => current ? current.filter(l => l['Log ID'] !== optimisticData['Log ID']) : null);
            }
        }
    };

    const handleDelete = async () => {
        if (!existingData) return;
        
        const originalLogs = contactLogs ? [...contactLogs] : [];
        const logToDeleteId = existingData['Log ID']!;
        
        setDeleteConfirmOpen(false);
        onClose();

        setContactLogs(current => current ? current.filter(l => l['Log ID'] !== logToDeleteId) : null);

        try {
            await deleteRecord('Contact_Logs', logToDeleteId);
            addToast('Contact log deleted!', 'success');
        } catch (err) {
            addToast('Failed to delete log.', 'error');
            setContactLogs(originalLogs);
        }
    };

    const isContactDisabled = !formData['Company Name'];
    const contactPlaceholder = !formData['Company Name'] ? "Select a company first" : (contactOptions.length === 0 ? "No contacts found" : "Select Contact");
    const title = isEditMode ? (isReadOnly ? `Details: ${existingData['Log ID']}`: `Editing Log: ${existingData['Log ID']}`) : 'Create New Contact Log';
    const submitText = isEditMode ? 'Save Changes' : 'Save Log';

    const handleCancelClick = () => {
        if (isEditMode) {
            setFormData(getFormDataForEdit(existingData));
            setIsReadOnly(true);
        } else {
            onClose();
        }
    }
    
    const formId = `contact-log-form-${existingData?.['Log ID'] || 'new'}`;
    
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
                    <FormSection title="Log Details">
                        {isReadOnly 
                            ? <FormDisplay label="Log ID" value={formData['Log ID']} /> 
                            : <FormInput name="Log ID" label="Log ID" value={formData['Log ID']} onChange={()=>{}} required readOnly />
                        }
                        {isReadOnly ? <FormDisplay label="Type" value={formData.Type} /> : <FormSelect name="Type" label="Type" value={formData.Type} onChange={handleChange} options={TYPE_OPTIONS} required />}
                        {isReadOnly ? <FormDisplay label="Contact Date" value={formatToInputDate(formData['Contact Date'])} /> : <FormInput name="Contact Date" label="Contact Date" value={formData['Contact Date']} onChange={handleChange} type="date" required />}
                        {isReadOnly ? <FormDisplay label="Company Name" value={formData['Company Name']} /> : 
                            <FormSelect 
                                name="Company Name" 
                                label="Company Name" 
                                value={formData['Company Name']} 
                                onChange={handleCompanyChange} 
                                options={companyOptions} 
                                required 
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
                                required 
                                actionButton={!isReadOnly && !!formData['Company Name'] && <button type="button" onClick={() => setIsNewContactModalOpen(true)} className="text-sm font-semibold text-brand-600 hover:underline">+ New</button>}
                            />}
                        {isReadOnly ? <FormDisplay label="Position" value={formData.Position} /> : <FormInput name="Position" label="Position" value={formData.Position} onChange={handleChange} readOnly/>}
                        {isReadOnly ? <FormDisplay label="Responsible By" value={formData['Responsible By']} /> : <FormInput name="Responsible By" label="Responsible By" value={formData['Responsible By']} onChange={handleChange} required />}
                    </FormSection>
                    <FormSection>
                        {isReadOnly ? <FormDisplay label="Remarks" value={formData.Remarks} multiline /> : <FormTextarea name="Remarks" label="Remarks" value={formData.Remarks} onChange={handleChange} />}
                    </FormSection>
                </form>
            </ResizableModal>
            
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
                    }));
                    setIsNewContactModalOpen(false);
                }}
            />
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Contact Log" confirmText="Delete">
                Are you sure you want to delete this log? This action cannot be undone.
            </ConfirmationModal>
        </>
    );
};

export default NewContactLogModal;