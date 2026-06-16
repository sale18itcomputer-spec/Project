'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Meeting, Company } from '@/types';
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
import SearchableSelect from '@/components/common/SearchableSelect';

const TYPE_OPTIONS = ['Online', 'Onsite'];
const STATUS_OPTIONS = ['Open', 'Close', 'Cancelled'];

const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

interface MeetingWindowContentProps {
    windowId: string;
    meetingId: string | null;
}

const MeetingWindowContent: React.FC<MeetingWindowContentProps> = ({
    windowId,
    meetingId,
}) => {
    const { currentUser } = useAuth();
    const { companies, projects, meetings, setMeetings } = useData();
    const { addToast } = useToast();
    const { closeWindow, updateWindow } = useWindowManager();

    const [formData, setFormData] = useState<Partial<Meeting>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);

    const isEditMode = !!meetingId;
    const existingData = useMemo(() => meetings?.find(m => m['Meeting ID'] === meetingId) || null, [meetings, meetingId]);

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const pipelineOptions = useMemo(() => projects?.filter(p => p['Company Name'] === formData['Company Name']).map(p => p['Pipeline No']) || [], [projects, formData['Company Name']]);

    const getInitialState = useCallback((): Partial<Meeting> => {
        let nextId = 'M00000001';
        if (meetings && meetings.length > 0) {
            const nums = meetings.map(m => m['Meeting ID']).filter(id => id?.startsWith('M')).map(id => parseInt(id!.substring(1), 10)).filter(n => !isNaN(n));
            if (nums.length > 0) nextId = `M${String(Math.max(...nums) + 1).padStart(8, '0')}`;
        }
        return { 'Meeting ID': nextId, 'Meeting Date': getTodayDateString(), 'Responsible By': currentUser?.Name || '', 'Type': 'Online', 'Status': 'Open' };
    }, [meetings, currentUser]);

    useEffect(() => {
        if (isEditMode && existingData) {
            setFormData({ ...existingData, 'Meeting Date': formatToInputDate(existingData['Meeting Date']) });
        } else if (!isEditMode) {
            setFormData(getInitialState());
        }
    }, [existingData, isEditMode, getInitialState]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleCompanySelect = (companyName: string) => {
        setFormData(prev => ({ ...prev, 'Company Name': companyName, 'Pipeline_ID': '' }));
    };

    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSubmitting(true);
        const submissionData: Partial<Meeting> = { ...formData, 'Meeting Date': formatToSheetDate(formData['Meeting Date']) };

        if (isEditMode && existingData) {
            const originalMeetings = meetings ? [...meetings] : [];
            const updatedId = existingData['Meeting ID']!;
            setMeetings(cur => cur ? cur.map(m => m['Meeting ID'] === updatedId ? { ...m, ...submissionData } as Meeting : m) : null);
            try {
                const updated: Meeting = await updateRecord('Meeting_Logs', updatedId, submissionData);
                setMeetings(cur => cur ? cur.map(m => m['Meeting ID'] === updatedId ? updated : m) : [updated]);
                addToast('Meeting updated!', 'success');
                closeWindow(windowId);
            } catch (err: any) {
                addToast(`Failed to update: ${err.message}`, 'error');
                setMeetings(originalMeetings);
                setIsSubmitting(false);
            }
        } else {
            const tempId = submissionData['Meeting ID']!;
            setMeetings(cur => cur ? [submissionData as Meeting, ...cur] : [submissionData as Meeting]);
            try {
                const created: Meeting = await createRecord('Meeting_Logs', submissionData);
                setMeetings(cur => cur ? cur.map(m => m['Meeting ID'] === tempId ? created : m) : [created]);
                addToast('Meeting created!', 'success');
                closeWindow(windowId);
            } catch (err: any) {
                addToast(`Failed to create: ${err.message}`, 'error');
                setMeetings(cur => cur ? cur.filter(m => m['Meeting ID'] !== tempId) : null);
                setIsSubmitting(false);
            }
        }
    }, [formData, isEditMode, existingData, meetings, setMeetings, addToast, closeWindow, windowId]);

    const handleDelete = async () => {
        if (!existingData?.['Meeting ID']) return;
        const originalMeetings = meetings ? [...meetings] : [];
        const id = existingData['Meeting ID'];
        setDeleteConfirmOpen(false);
        setMeetings(cur => cur ? cur.filter(m => m['Meeting ID'] !== id) : null);
        try {
            await deleteRecord('Meeting_Logs', id);
            addToast('Meeting deleted!', 'success');
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to delete: ${err.message}`, 'error');
            setMeetings(originalMeetings);
        }
    };

    // Dynamic title & footer
    useEffect(() => {
        const title = isEditMode ? `Meeting: ${meetingId}` : 'Create New Meeting';
        const footer = isEditMode ? (
            <div className="flex justify-between items-center w-full">
                <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 font-semibold py-2 px-4 rounded-lg border border-rose-500/50 text-rose-500 hover:bg-rose-500/10 text-sm">
                    <Trash2 size={16} /> Delete
                </button>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => closeWindow(windowId)} className="font-semibold py-2 px-4 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-sm">Close</button>
                    <button type="submit" form={`meeting-window-form-${windowId}`} disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                        Save Changes
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex justify-end gap-3 w-full">
                <button type="button" onClick={() => closeWindow(windowId)} className="bg-card hover:bg-muted text-foreground font-semibold py-2 px-4 rounded-md border border-border transition text-sm">Cancel</button>
                <button type="submit" form={`meeting-window-form-${windowId}`} disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                    Save Meeting
                </button>
            </div>
        );
        updateWindow(windowId, { title, footer });
    }, [windowId, meetingId, isEditMode, isSubmitting, updateWindow, closeWindow]);

    return (
        <>
            <form id={`meeting-window-form-${windowId}`} onSubmit={handleSubmit} className="space-y-6 max-h-full overflow-y-auto p-1 pr-2 custom-scrollbar">
                <FormSection title="Meeting Details">
                    <FormInput name="Meeting ID" label="Meeting ID" value={formData['Meeting ID']} onChange={() => {}} required readOnly />
                    <SearchableSelect
                        name="Company Name" label="Company Name"
                        value={formData['Company Name'] || ''} onChange={handleCompanySelect}
                        options={companyOptions} required placeholder="Search companies..."
                        actionButton={<button type="button" onClick={() => setIsNewCompanyModalOpen(true)} className="text-sm font-semibold text-brand-600 hover:underline">+ New</button>}
                    />
                    <FormSelect name="Pipeline_ID" label="Pipeline ID" value={formData.Pipeline_ID} onChange={handleChange} options={pipelineOptions} disabled={!formData['Company Name'] || pipelineOptions.length === 0} disabledPlaceholder={!formData['Company Name'] ? 'Select a company first' : 'No pipelines found'} />
                    <FormSelect name="Type" label="Type" value={formData.Type} onChange={handleChange} options={TYPE_OPTIONS} required />
                    <FormSelect name="Status" label="Status" value={formData.Status} onChange={handleChange} options={STATUS_OPTIONS} required />
                    <FormInput name="Participants" label="Participants" value={formData.Participants} onChange={handleChange} required />
                    <FormInput name="Responsible By" label="Responsible By" value={formData['Responsible By']} onChange={handleChange} required />
                </FormSection>
                <FormSection title="Schedule">
                    <FormInput name="Meeting Date" label="Date" value={formData['Meeting Date']} onChange={handleChange} type="date" required />
                    <div />
                    <FormInput name="Start Time" label="Start Time" value={formData['Start Time']} onChange={handleChange} type="time" />
                    <FormInput name="End Time" label="End Time" value={formData['End Time']} onChange={handleChange} type="time" />
                </FormSection>
                <FormSection title="Remarks">
                    <FormTextarea name="Remarks" label="Remarks" value={formData.Remarks} onChange={handleChange} />
                </FormSection>
            </form>

            <NewCompanyModal
                isOpen={isNewCompanyModalOpen}
                onClose={() => setIsNewCompanyModalOpen(false)}
                onSaveSuccess={(newCompany: Company) => {
                    setFormData(prev => ({ ...prev, 'Company Name': newCompany['Company Name'], 'Pipeline_ID': '' }));
                    setIsNewCompanyModalOpen(false);
                }}
            />
            {isEditMode && (
                <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Meeting" confirmText="Delete">
                    Are you sure you want to delete this meeting? This action cannot be undone.
                </ConfirmationModal>
            )}
        </>
    );
};

export default MeetingWindowContent;
