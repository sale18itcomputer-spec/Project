'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Meeting, Company } from "../../types";
import { createRecord, updateRecord, deleteRecord } from "../../services/api";
import { FormSection, FormInput, FormTextarea, FormSelect, FormDisplay } from "../common/FormControls";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { formatToSheetDate, formatToInputDate } from "../../utils/time";
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { Check, Pencil, Trash2 } from 'lucide-react';
import ConfirmationModal from "./ConfirmationModal";
import NewCompanyModal from "./NewCompanyModal";
import { useToast } from "../../contexts/ToastContext";
import ResizableModal from "./ResizableModal";
import SearchableSelect from "../common/SearchableSelect";


interface NewMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingData?: Meeting | null;
    initialReadOnly?: boolean;
}

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const TYPE_OPTIONS = ['Online', 'Onsite'];
const STATUS_OPTIONS = ['Open', 'Close', 'Cancelled'];

const NewMeetingModal: React.FC<NewMeetingModalProps> = ({ isOpen, onClose, existingData, initialReadOnly = false }) => {
    const { currentUser } = useAuth();
    const { companies, projects, meetings, setMeetings } = useData();
    const { addToast } = useToast();
    const [formData, setFormData] = useState<Partial<Meeting>>({});
    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);

    const isEditMode = !!existingData;

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const pipelineOptions = useMemo(() => projects?.filter(p => p['Company Name'] === formData['Company Name']).map(p => p['Pipeline No.']) || [], [projects, formData]);

    const getInitialState = useCallback(() => {
        let nextMeetingId = 'M00000001';
        if (meetings && Array.isArray(meetings) && meetings.length > 0) {
            const meetingNumbers = meetings
                .map(m => m['Meeting ID'])
                .filter(id => id && typeof id === 'string' && id.startsWith('M'))
                .map(id => parseInt(id.substring(1), 10))
                .filter(num => !isNaN(num));

            if (meetingNumbers.length > 0) {
                const maxNum = Math.max(...meetingNumbers);
                nextMeetingId = `M${String(maxNum + 1).padStart(8, '0')}`;
            }
        }
        return {
            'Meeting ID': nextMeetingId,
            'Meeting Date': getTodayDateString(),
            'Responsible By': currentUser?.Name || '',
            'Type': 'Online',
            'Status': 'Open' as const
        } as Partial<Meeting>;
    }, [meetings, currentUser]);

    const getFormDataForEdit = useCallback((m: Meeting) => ({
        ...m,
        'Meeting Date': formatToInputDate(m['Meeting Date']),
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

    const handleCompanySelect = (companyName: string) => {
        setFormData(prev => ({ ...prev, 'Company Name': companyName, 'Pipeline_ID': '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onClose();

        const submissionData: Partial<Meeting> = {
            ...formData,
            'Meeting Date': formatToSheetDate(formData['Meeting Date']),
        };

        if (isEditMode) {
            const originalMeetings = meetings ? [...meetings] : [];
            const updatedId = existingData['Meeting ID']!;
            // Optimistic update
            setMeetings(current => current ? current.map(m => m['Meeting ID'] === updatedId ? { ...m, ...submissionData } as Meeting : m) : null);

            try {
                const updatedRecord: Meeting = await updateRecord('Meeting_Logs', updatedId, submissionData);
                addToast('Meeting updated!', 'success');
                // Replace optimistic with server record
                setMeetings(current => current ? current.map(m => m['Meeting ID'] === updatedId ? updatedRecord : m) : [updatedRecord]);
            } catch (err: any) {
                addToast(`Failed to update meeting: ${err.message}`, 'error');
                setMeetings(originalMeetings); // Revert
            }
        } else { // CREATE
            const tempId = submissionData['Meeting ID']!;
            // Optimistic update
            setMeetings(current => current ? [submissionData as Meeting, ...current] : [submissionData as Meeting]);

            try {
                const createdRecord: Meeting = await createRecord('Meeting_Logs', submissionData);
                addToast('Meeting created!', 'success');
                // Replace temp record with the one from the server.
                setMeetings(current => {
                    if (!current) return [createdRecord];
                    return current.map(m => m['Meeting ID'] === tempId ? createdRecord : m);
                });
            } catch (err: any) {
                addToast(`Failed to create meeting: ${err.message}`, 'error');
                // Revert by removing the optimistic data.
                setMeetings(current => current ? current.filter(m => m['Meeting ID'] !== tempId) : null);
            }
        }
    };

    const handleDelete = async () => {
        if (!existingData || !existingData['Meeting ID']) return;

        const originalMeetings = meetings ? [...meetings] : [];
        const meetingToDeleteId = existingData['Meeting ID'];

        setDeleteConfirmOpen(false);
        onClose();

        setMeetings(current => current ? current.filter(m => m['Meeting ID'] !== meetingToDeleteId) : null);

        try {
            const response: { deletedId: string } = await deleteRecord('Meeting_Logs', meetingToDeleteId);
            if (response.deletedId === meetingToDeleteId) {
                addToast('Meeting deleted!', 'success');
            } else {
                throw new Error("Backend did not confirm deletion.");
            }
        } catch (err: any) {
            addToast(`Failed to delete meeting: ${err.message}`, 'error');
            setMeetings(originalMeetings); // Revert
        }
    };

    const isPipelineDisabled = !formData['Company Name'];
    const pipelinePlaceholder = !formData['Company Name'] ? "Select a company first" : (pipelineOptions.length === 0 ? "No pipelines found" : "Select Pipeline ID");
    const title = isEditMode ? (isReadOnly ? `Details: ${existingData['Meeting ID']}` : `Editing Meeting: ${existingData['Meeting ID']}`) : 'Create New Meeting';
    const submitText = isEditMode ? 'Save Changes' : 'Save Meeting';

    const handleCancelClick = () => {
        if (isEditMode) {
            setFormData(getFormDataForEdit(existingData));
            setIsReadOnly(true);
        } else {
            onClose();
        }
    };

    const formId = `meeting-form-${existingData?.['Meeting ID'] || 'new'}`;

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
                    <FormSection title="Meeting Details">
                        {isReadOnly
                            ? <FormDisplay label="Meeting ID" value={formData['Meeting ID']} />
                            : <FormInput name="Meeting ID" label="Meeting ID" value={formData['Meeting ID']} onChange={() => { }} required readOnly />
                        }
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
                        {isReadOnly ? <FormDisplay label="Pipeline ID" value={formData.Pipeline_ID} /> : <FormSelect name="Pipeline_ID" label="Pipeline ID" value={formData.Pipeline_ID} onChange={handleChange} options={pipelineOptions} disabled={isPipelineDisabled || pipelineOptions.length === 0} disabledPlaceholder={pipelinePlaceholder} />}
                        {isReadOnly ? <FormDisplay label="Type" value={formData.Type} /> : <FormSelect name="Type" label="Type" value={formData.Type} onChange={handleChange} options={TYPE_OPTIONS} required />}
                        {isReadOnly ? <FormDisplay label="Status" value={formData.Status} /> : <FormSelect name="Status" label="Status" value={formData.Status} onChange={handleChange} options={STATUS_OPTIONS} required />}
                        {isReadOnly ? <FormDisplay label="Participants" value={formData.Participants} /> : <FormInput name="Participants" label="Participants" value={formData.Participants} onChange={handleChange} required />}
                        {isReadOnly ? <FormDisplay label="Responsible By" value={formData['Responsible By']} /> : <FormInput name="Responsible By" label="Responsible By" value={formData['Responsible By']} onChange={handleChange} required />}
                    </FormSection>
                    <FormSection title="Schedule">
                        {isReadOnly ? <FormDisplay label="Date" value={formatToInputDate(formData['Meeting Date'])} /> : <FormInput name="Meeting Date" label="Date" value={formData['Meeting Date']} onChange={handleChange} type="date" required />}
                        <div />
                        {isReadOnly ? <FormDisplay label="Start Time" value={formData['Start Time']} /> : <FormInput name="Start Time" label="Start Time" value={formData['Start Time']} onChange={handleChange} type="time" />}
                        {isReadOnly ? <FormDisplay label="End Time" value={formData['End Time']} /> : <FormInput name="End Time" label="End Time" value={formData['End Time']} onChange={handleChange} type="time" />}
                    </FormSection>
                    <FormSection title="Remarks">
                        {isReadOnly ? <FormDisplay label="Remarks" value={formData.Remarks} multiline /> : <FormTextarea name="Remarks" label="Remarks" value={formData.Remarks} onChange={handleChange} />}
                    </FormSection>
                </form>
            </ResizableModal>

            <NewCompanyModal
                isOpen={isNewCompanyModalOpen}
                onClose={() => setIsNewCompanyModalOpen(false)}
                onSaveSuccess={(newCompany: Company) => {
                    setFormData(prev => ({ ...prev, 'Company Name': newCompany['Company Name'], 'Pipeline_ID': '' }));
                    setIsNewCompanyModalOpen(false);
                }}
            />
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Meeting" confirmText="Delete">
                Are you sure you want to delete this meeting? This action cannot be undone.
            </ConfirmationModal>
        </>
    );
};

export default NewMeetingModal;
