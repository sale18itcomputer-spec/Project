'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SiteSurveyLog } from '@/types';
import { createRecord, updateRecord, deleteRecord } from '@/services/api';
import { FormSection, FormInput, FormTextarea, FormSelect } from '@/components/common/FormControls';
import SearchableSelect from '@/components/common/SearchableSelect';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/contexts/ToastContext';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { formatToSheetDate, formatToInputDate } from '@/utils/time';
import { Trash2, Check, Loader2 } from 'lucide-react';
import ConfirmationModal from '@/components/modals/ConfirmationModal';

const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

interface SiteSurveyWindowContentProps {
    windowId: string;
    siteId: string | null;
}

const SiteSurveyWindowContent: React.FC<SiteSurveyWindowContentProps> = ({
    windowId,
    siteId,
}) => {
    const { currentUser } = useAuth();
    const { siteSurveys, setSiteSurveys, companies, projects } = useData();
    const { addToast } = useToast();
    const { closeWindow, updateWindow } = useWindowManager();

    const [formData, setFormData] = useState<Partial<SiteSurveyLog>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const isEditMode = !!siteId;
    const existingData = useMemo(() => siteSurveys?.find(s => s['Site ID'] === siteId) || null, [siteSurveys, siteId]);

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const pipelineOptions = useMemo(() => projects?.filter(p => p['Company Name'] === formData['Company Name']).map(p => p['Pipeline No']) || [], [projects, formData['Company Name']]);

    const getInitialState = useCallback((): Partial<SiteSurveyLog> => {
        let nextId = 'S00000001';
        if (siteSurveys && siteSurveys.length > 0) {
            const nums = siteSurveys.map(s => s['Site ID']).filter(id => id?.startsWith('S')).map(id => parseInt(id!.substring(1), 10)).filter(n => !isNaN(n));
            if (nums.length > 0) nextId = `S${String(Math.max(...nums) + 1).padStart(8, '0')}`;
        }
        return { 'Site ID': nextId, 'Date': getTodayDateString(), 'Responsible By': currentUser?.Name || '' };
    }, [siteSurveys, currentUser]);

    useEffect(() => {
        if (isEditMode && existingData) {
            setFormData({ ...existingData, 'Date': formatToInputDate(existingData.Date) });
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
        const submissionData: Partial<SiteSurveyLog> = {
            ...formData,
            'Date': formatToSheetDate(formData.Date),
            'Remark': formData.Remark || '',
        };

        if (isEditMode && existingData) {
            const originalSurveys = siteSurveys ? [...siteSurveys] : [];
            const updatedId = existingData['Site ID']!;
            setSiteSurveys(cur => cur ? cur.map(s => s['Site ID'] === updatedId ? { ...s, ...submissionData } as SiteSurveyLog : s) : null);
            try {
                const updated: SiteSurveyLog = await updateRecord('Site_Survey_Logs', updatedId, submissionData);
                setSiteSurveys(cur => cur ? cur.map(s => s['Site ID'] === updatedId ? updated : s) : [updated]);
                addToast('Survey updated!', 'success');
                closeWindow(windowId);
            } catch (err: any) {
                addToast(`Failed to update: ${err.message}`, 'error');
                setSiteSurveys(originalSurveys);
                setIsSubmitting(false);
            }
        } else {
            const tempId = submissionData['Site ID']!;
            setSiteSurveys(cur => cur ? [submissionData as SiteSurveyLog, ...cur] : [submissionData as SiteSurveyLog]);
            try {
                const created: SiteSurveyLog = await createRecord('Site_Survey_Logs', submissionData);
                setSiteSurveys(cur => cur ? cur.map(s => s['Site ID'] === tempId ? created : s) : [created]);
                addToast('Survey created!', 'success');
                closeWindow(windowId);
            } catch (err: any) {
                addToast(`Failed to create: ${err.message}`, 'error');
                setSiteSurveys(cur => cur ? cur.filter(s => s['Site ID'] !== tempId) : null);
                setIsSubmitting(false);
            }
        }
    }, [formData, isEditMode, existingData, siteSurveys, setSiteSurveys, addToast, closeWindow, windowId]);

    const handleDelete = async () => {
        if (!existingData?.['Site ID']) return;
        const originalSurveys = siteSurveys ? [...siteSurveys] : [];
        const id = existingData['Site ID'];
        setDeleteConfirmOpen(false);
        setSiteSurveys(cur => cur ? cur.filter(s => s['Site ID'] !== id) : null);
        try {
            await deleteRecord('Site_Survey_Logs', id);
            addToast('Survey deleted!', 'success');
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to delete: ${err.message}`, 'error');
            setSiteSurveys(originalSurveys);
        }
    };

    // Dynamic title & footer
    useEffect(() => {
        const title = isEditMode ? `Site Survey: ${siteId}` : 'Create New Site Survey';
        const footer = isEditMode ? (
            <div className="flex justify-between items-center w-full">
                <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 font-semibold py-2 px-4 rounded-lg border border-rose-500/50 text-rose-500 hover:bg-rose-500/10 text-sm">
                    <Trash2 size={16} /> Delete
                </button>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => closeWindow(windowId)} className="font-semibold py-2 px-4 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-sm">Close</button>
                    <button type="submit" form={`site-survey-window-form-${windowId}`} disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                        Save Changes
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex justify-end gap-3 w-full">
                <button type="button" onClick={() => closeWindow(windowId)} className="bg-card hover:bg-muted text-foreground font-semibold py-2 px-4 rounded-md border border-border transition text-sm">Cancel</button>
                <button type="submit" form={`site-survey-window-form-${windowId}`} disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                    Save Survey
                </button>
            </div>
        );
        updateWindow(windowId, { title, footer });
    }, [windowId, siteId, isEditMode, isSubmitting, updateWindow, closeWindow]);

    return (
        <>
            <form id={`site-survey-window-form-${windowId}`} onSubmit={handleSubmit} className="space-y-6 max-h-full overflow-y-auto p-1 pr-2 custom-scrollbar">
                <FormSection title="Survey Details">
                    <FormInput name="Site ID" label="Site ID" value={formData['Site ID']} onChange={() => {}} required readOnly />
                    <SearchableSelect
                        name="Company Name" label="Company Name"
                        value={formData['Company Name'] || ''} onChange={handleCompanySelect}
                        options={companyOptions} placeholder="Search companies..."
                    />
                    <FormSelect name="Pipeline_ID" label="Pipeline ID" value={formData['Pipeline_ID']} onChange={handleChange} options={pipelineOptions} disabled={!formData['Company Name'] || pipelineOptions.length === 0} disabledPlaceholder={!formData['Company Name'] ? 'Select a company first' : 'No pipelines found'} />
                    <FormInput name="Responsible By" label="Responsible By" value={formData['Responsible By']} onChange={handleChange} required />
                    <FormInput name="Date" label="Date" value={formData.Date} onChange={handleChange} type="date" required />
                    <FormInput name="Start Time" label="Start Time" value={formData['Start Time']} onChange={handleChange} type="time" />
                    <FormInput name="End Time" label="End Time" value={formData['End Time']} onChange={handleChange} type="time" />
                </FormSection>
                <FormSection title="Location">
                    <div className="md:col-span-2">
                        <FormInput name="Location" label="Location Area / District" value={formData.Location} onChange={handleChange} required />
                    </div>
                </FormSection>
                <FormSection title="Remark">
                    <FormTextarea name="Remark" label="" value={formData.Remark} onChange={handleChange} />
                </FormSection>
                <FormSection title="Next Action">
                    <FormTextarea name="Next Action (If Any)" label="Next Action (If Any)" value={formData['Next Action (If Any)']} onChange={handleChange} />
                </FormSection>
            </form>

            {isEditMode && (
                <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Site Survey" confirmText="Delete">
                    Are you sure you want to delete this survey? This action cannot be undone.
                </ConfirmationModal>
            )}
        </>
    );
};

export default SiteSurveyWindowContent;
