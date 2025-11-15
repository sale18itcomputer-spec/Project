import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SiteSurveyLog } from '../types';
import { createRecord, updateRecord, deleteRecord } from '../services/api';
import { FormSection, FormInput, FormTextarea, FormDisplay, FormSelect } from './FormControls';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { formatToSheetDate, formatToInputDate } from '../utils/time';
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { Trash2, Check, Pencil } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import ResizableModal from './ResizableModal';

interface NewSiteSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingData?: SiteSurveyLog | null;
  initialReadOnly?: boolean;
}

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const NewSiteSurveyModal: React.FC<NewSiteSurveyModalProps> = ({ isOpen, onClose, existingData, initialReadOnly = false }) => {
    const { currentUser } = useAuth();
    const { siteSurveys, setSiteSurveys } = useData();
    const { addToast } = useToast();
    const [formData, setFormData] = useState<Partial<SiteSurveyLog>>({});
    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    
    const isEditMode = !!existingData;

    const getInitialState = useCallback(() => {
        let nextSiteId = 'S00000001';
        if (siteSurveys && Array.isArray(siteSurveys) && siteSurveys.length > 0) {
            const surveyNumbers = siteSurveys
                .map(s => s['Site ID'])
                .filter(id => id && typeof id === 'string' && id.startsWith('S'))
                .map(id => parseInt(id.substring(1), 10))
                .filter(num => !isNaN(num));
            
            if (surveyNumbers.length > 0) {
                const maxNum = Math.max(...surveyNumbers);
                nextSiteId = `S${String(maxNum + 1).padStart(8, '0')}`;
            }
        }
        return {
            'Site ID': nextSiteId,
            'Date': getTodayDateString(),
            'Responsible By': currentUser?.Name || '',
        };
    }, [siteSurveys, currentUser]);

    const getFormDataForEdit = useCallback((s: SiteSurveyLog) => ({
        ...s,
        'Date': formatToInputDate(s.Date),
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

        const submissionData: Partial<SiteSurveyLog> = {
            ...formData,
            'Date': formatToSheetDate(formData.Date),
            'Remark': formData.Remark || '',
        };

        if (isEditMode) {
            const originalSurveys = siteSurveys ? [...siteSurveys] : [];
            const updatedId = existingData['Site ID']!;
            // Optimistic update
            setSiteSurveys(current => current ? current.map(s => s['Site ID'] === updatedId ? { ...s, ...submissionData } as SiteSurveyLog : s) : null);

            try {
                const updatedRecord: SiteSurveyLog = await updateRecord('Site_Survey_Logs', updatedId, submissionData);
                addToast('Survey updated!', 'success');
                // Replace optimistic with server record
                setSiteSurveys(current => current ? current.map(s => s['Site ID'] === updatedId ? updatedRecord : s) : [updatedRecord]);
            } catch (err: any) {
                addToast(`Failed to update survey: ${err.message}`, 'error');
                setSiteSurveys(originalSurveys); // Revert
            }
        } else { // CREATE
            const tempId = submissionData['Site ID']!;
            // Optimistic update
            setSiteSurveys(current => current ? [submissionData as SiteSurveyLog, ...current] : [submissionData as SiteSurveyLog]);
            
            try {
                const createdRecord: SiteSurveyLog = await createRecord('Site_Survey_Logs', submissionData);
                addToast('Survey created!', 'success');
                // Replace temp record with the one from the server.
                setSiteSurveys(current => {
                    if (!current) return [createdRecord];
                    return current.map(s => s['Site ID'] === tempId ? createdRecord : s);
                });
            } catch (err: any) {
                addToast(`Failed to create survey: ${err.message}`, 'error');
                // Revert by removing the optimistic data.
                setSiteSurveys(current => current ? current.filter(s => s['Site ID'] !== tempId) : null);
            }
        }
    };

    const handleDelete = async () => {
        if (!existingData || !existingData['Site ID']) return;
        
        const originalSurveys = siteSurveys ? [...siteSurveys] : [];
        const surveyToDeleteId = existingData['Site ID'];
        
        setDeleteConfirmOpen(false);
        onClose();

        setSiteSurveys(current => current ? current.filter(s => s['Site ID'] !== surveyToDeleteId) : null);

        try {
            const response: { deletedId: string } = await deleteRecord('Site_Survey_Logs', surveyToDeleteId);
            if (response.deletedId === surveyToDeleteId) {
                addToast('Survey deleted!', 'success');
            } else {
                throw new Error("Backend did not confirm deletion.");
            }
        } catch (err: any) {
            addToast(`Failed to delete survey: ${err.message}`, 'error');
            setSiteSurveys(originalSurveys); // Revert
        }
    };

    const title = isEditMode ? (isReadOnly ? `Details: ${existingData['Site ID']}` : `Editing Survey: ${existingData['Site ID']}`) : 'Create New Site Survey';
    const submitText = isEditMode ? 'Save Changes' : 'Save Survey';

    const handleCancelClick = () => {
        if (isEditMode) {
            setFormData(getFormDataForEdit(existingData));
            setIsReadOnly(true);
        } else {
            onClose();
        }
    }
    
    const formId = `site-survey-form-${existingData?.['Site ID'] || 'new'}`;
    
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
                    <FormSection title="Survey Details">
                        {isReadOnly 
                            ? <FormDisplay label="Site ID" value={formData['Site ID']} /> 
                            : <FormInput name="Site ID" label="Site ID" value={formData['Site ID']} onChange={()=>{}} required readOnly />
                        }
                        {isReadOnly ? <FormDisplay label="Responsible By" value={formData['Responsible By']} /> : <FormInput name="Responsible By" label="Responsible By" value={formData['Responsible By']} onChange={handleChange} required />}
                        {isReadOnly ? <FormDisplay label="Date" value={formatToInputDate(formData.Date)} /> : <FormInput name="Date" label="Date" value={formData.Date} onChange={handleChange} type="date" required/>}
                        {isReadOnly ? <FormDisplay label="Start Time" value={formData['Start Time']} /> : <FormInput name="Start Time" label="Start Time" value={formData['Start Time']} onChange={handleChange} type="time" />}
                        {isReadOnly ? <FormDisplay label="End Time" value={formData['End Time']} /> : <FormInput name="End Time" label="End Time" value={formData['End Time']} onChange={handleChange} type="time" />}
                    </FormSection>
                    <FormSection title="Location">
                        <div className="md:col-span-2">
                            {isReadOnly ? <FormDisplay label="Location Area / District" value={formData.Location} /> : <FormInput name="Location" label="Location Area / District" value={formData.Location} onChange={handleChange} required />}
                        </div>
                    </FormSection>
                    <FormSection title="Remark">
                        {isReadOnly 
                            ? <FormDisplay label="" value={formData.Remark} multiline />
                            : <FormTextarea name="Remark" label="" value={formData.Remark} onChange={handleChange} />
                        }
                    </FormSection>
                    <FormSection title="Next Action">
                        {isReadOnly ? <FormDisplay label="Next Action (If Any)" value={formData['Next Action (If Any)']} multiline /> : <FormTextarea name="Next Action (If Any)" label="Next Action (If Any)" value={formData['Next Action (If Any)']} onChange={handleChange} />}
                    </FormSection>
                </form>
            </ResizableModal>
             <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Site Survey" confirmText="Delete">
                Are you sure you want to delete this survey? This action cannot be undone.
            </ConfirmationModal>
        </>
    );
};

export default NewSiteSurveyModal;