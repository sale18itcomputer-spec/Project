import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { PipelineProject, Meeting, ContactLog, UnifiedActivity, Company, Contact } from '../types';
import { createRecord, updateRecord, deleteRecord } from '../services/api';
import { FormSection, FormInput, FormSelect, FormTextarea, FormDisplay } from './FormControls';
import { formatToSheetDate, formatToInputDate, parseDate, formatDateAsMDY } from '../utils/time';
import { useData } from '../contexts/DataContext';
import ConfirmationModal from './ConfirmationModal';
import EmptyState from './EmptyState';
import NewCompanyModal from './NewCompanyModal';
import NewContactModal from './NewContactModal';
import { useToast } from '../contexts/ToastContext';
import ResizableModal from './ResizableModal';
import { Check, Pencil, Trash2, Calendar, MessageSquare } from 'lucide-react';

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
const TAXABLE_OPTIONS: PipelineProject['Taxable'][] = ['Yes', 'No'];

const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, existingData, initialReadOnly = false, meetings, contactLogs }) => {
    const { projects, setProjects, companies, contacts } = useData();
    const { addToast } = useToast();
    const [formData, setFormData] = useState<Partial<PipelineProject>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
    const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
    
    const isEditMode = !!existingData;

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const filteredContacts = useMemo(() => contacts?.filter(c => c['Company Name'] === formData['Company Name']) || [], [contacts, formData]);
    const contactOptions = useMemo(() => filteredContacts.map(c => c.Name), [filteredContacts]);

    const getInitialState = useCallback(() => {
        let nextPipelineNo = 'PL00000001';
        if (projects && projects.length > 0) {
            const pipelineNumbers = projects.map(p => p['Pipeline No.']).filter(pNo => pNo && typeof pNo === 'string' && pNo.startsWith('PL')).map(pNo => parseInt(pNo.substring(2), 10)).filter(num => !isNaN(num));
            if (pipelineNumbers.length > 0) {
                nextPipelineNo = `PL${String(Math.max(...pipelineNumbers) + 1).padStart(8, '0')}`;
            }
        }
        const initialState: Partial<PipelineProject> = {
            'Pipeline No.': nextPipelineNo, 'Created Date': getTodayDateString(), 'Status': 'Quote Submitted',
            'Taxable': 'Yes', 'Type': 'Project',
        };
        return initialState;
    }, [projects]);

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

    const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const companyName = e.target.value;
        setFormData(prev => ({ ...prev, 'Company Name': companyName, 'Contact Name': '', 'Contact Number': '', 'Email': '' }));
    };

    const handleContactChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const contactName = e.target.value;
        const selectedContact = filteredContacts.find(c => c.Name === contactName);
        setFormData(prev => ({ ...prev, 'Contact Name': contactName, 'Contact Number': selectedContact?.['Tel (1)'] || '', 'Email': selectedContact?.Email || '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onClose(); // Close modal immediately for optimistic UI

        const submissionData = {
            ...formData,
            'Created Date': formatToSheetDate(formData['Created Date']),
            'Due Date': formatToSheetDate(formData['Due Date']),
            'Inv Date': formatToSheetDate(formData['Inv Date']),
            'Quote': ensureHyperlink(formData.Quote),
            'Attach Invoice': ensureHyperlink(formData['Attach Invoice']),
            'Attach D.O': ensureHyperlink(formData['Attach D.O']),
        };

        if (isEditMode) {
            const originalProjects = projects ? [...projects] : [];
            const optimisticData = { ...existingData, ...submissionData } as PipelineProject;

            setProjects(current => current ? current.map(p => p['Pipeline No.'] === existingData['Pipeline No.'] ? optimisticData : p) : [optimisticData]);
            
            try {
                await updateRecord('Pipelines', existingData['Pipeline No.'], submissionData);
                addToast('Pipeline updated!', 'success');
            } catch (err) {
                addToast('Failed to update pipeline.', 'error');
                setProjects(originalProjects);
            }
        } else { // CREATE
            const optimisticData = submissionData as PipelineProject;
            setProjects(current => current ? [optimisticData, ...current] : [optimisticData]);

            try {
                await createRecord('Pipelines', submissionData);
                addToast('Pipeline created!', 'success');
            } catch (err) {
                addToast('Failed to create pipeline.', 'error');
                setProjects(current => current ? current.filter(p => p['Pipeline No.'] !== optimisticData['Pipeline No.']) : null);
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
            await deleteRecord('Pipelines', projectToDeleteId);
            addToast('Pipeline deleted!', 'success');
        } catch (err) {
            addToast('Failed to delete pipeline.', 'error');
            setProjects(originalProjects);
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
                  <button type="button" onClick={() => setDeleteConfirmOpen(true)} disabled={isSubmitting} className="flex items-center gap-2 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 border border-rose-500 text-rose-500 hover:bg-rose-50 disabled:opacity-50">
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
                        {isReadOnly ? <FormDisplay label="Quote Link">{formData.Quote && <a href={formData.Quote} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{formData.Quote}</a>}</FormDisplay> : <FormInput name="Quote" label="Quote Link" value={formData.Quote} onChange={handleChange} type="url" placeholder="Paste a shareable link here" />}
                        {isReadOnly ? <FormDisplay label="Invoice No." value={formData['Invoice No.']} /> : <FormInput name="Invoice No." label="Invoice No." value={formData['Invoice No.']} onChange={handleChange} />}
                        {isReadOnly ? <FormDisplay label="Invoice Date" value={formatToInputDate(formData['Inv Date'])} /> : <FormInput name="Inv Date" label="Invoice Date" value={formData['Inv Date']} onChange={handleChange} type="date" />}
                        {isReadOnly ? <FormDisplay label="Invoice Link">{formData['Attach Invoice'] && <a href={formData['Attach Invoice']} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{formData['Attach Invoice']}</a>}</FormDisplay> : <FormInput name="Attach Invoice" label="Invoice Link" value={formData['Attach Invoice']} onChange={handleChange} type="url" placeholder="Paste a shareable link here" />}
                        {isReadOnly ? <FormDisplay label="D.O Link">{formData['Attach D.O'] && <a href={formData['Attach D.O']} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{formData['Attach D.O']}</a>}</FormDisplay> : <FormInput name="Attach D.O" label="D.O Link" value={formData['Attach D.O']} onChange={handleChange} type="url" placeholder="Paste a shareable link here" />}
                    </FormSection>
                    {isEditMode && (
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-6">{`Activities (${relatedActivities.length})`}</h3>
                            <div className="flow-root">
                                {relatedActivities.length > 0 ? (
                                    <div className="space-y-4 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                                        {relatedActivities.map((activity, index) => (
                                            <div key={`${activity.type}-${activity.isoDate}-${index}`} className="relative">
                                                <div className="absolute -left-[29px] top-0.5 w-8 h-8 rounded-full bg-white flex items-center justify-center ring-4 ring-white">
                                                    {activity.type === 'meeting' ? <Calendar className="w-5 h-5 text-sky-600" /> : <MessageSquare className="w-5 h-5 text-violet-600" />}
                                                </div>
                                                <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
                                                    <p className="font-semibold text-gray-800">{activity.summary}</p>
                                                    <p className="text-sm text-gray-500 mb-2">{formatDateAsMDY(activity.date)} by {activity.responsible}</p>
                                                    {activity.details && <p className="text-sm text-gray-700 whitespace-pre-wrap">{activity.details}</p>}
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