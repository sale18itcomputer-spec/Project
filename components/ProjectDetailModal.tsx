import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
// Import UnifiedActivity, EmptyState and other types for the new Activities tab.
import { PipelineProject, Meeting, ContactLog, UnifiedActivity } from '../types';
import { useNavigation } from '../contexts/NavigationContext';
import { deleteRecord } from '../services/api';
import { useData } from '../contexts/DataContext';
// Import parseDate to handle date parsing for activities.
import { formatDateAsMDY, formatDisplayDate, parseDate } from '../utils/time';
import ModalActionFooter from './ModalActionFooter';
import { formatCurrencySmartly } from '../utils/formatters';
import ConfirmationModal from './ConfirmationModal';
import EmptyState from './EmptyState';
import { generateGoogleCalendarLink } from '../utils/calendar';
import { useToast } from '../contexts/ToastContext';
import { X, Calendar, MessageSquare, Tag, DollarSign, CalendarPlus } from 'lucide-react';

// Add the calculatedDueDate to the project type for this component
type ProjectWithCalculatedDate = PipelineProject & { calculatedDueDate?: Date | null };

interface ProjectDetailModalProps {
  project: ProjectWithCalculatedDate | null;
  onClose: () => void;
  onEditRequest: (project: ProjectWithCalculatedDate) => void;
  meetings: Meeting[];
  contactLogs: ContactLog[];
}

const extractUrlFromFormula = (value?: string): string => {
    if (!value || typeof value !== 'string') return '';
    const match = value.match(/^=HYPERLINK\("([^"]+)"/i);
    return match ? match[1] : value;
};

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => {
    if (!value || (typeof value === 'string' && !value.trim())) return null;
    return (
        <div className="flex items-center bg-slate-100 border border-slate-200/90 rounded-md text-sm leading-none">
            <span className="px-2.5 py-1.5 text-slate-500 font-semibold">{label}</span>
            <span className="px-2.5 py-1.5 text-slate-800 font-medium bg-white rounded-r-md border-l border-slate-200/90">
                {value}
            </span>
        </div>
    );
};

const StatusBadge: React.FC<{ status: PipelineProject['Status'] }> = ({ status }) => {
  const statusColors: { [key: string]: string } = {
    'Quote Submitted': 'bg-sky-100 text-sky-800',
    'Close (win)': 'bg-emerald-100 text-emerald-800',
    'Close (lose)': 'bg-rose-100 text-rose-800',
  };

  return (
    <span className={`px-2.5 py-1 text-sm font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ project, onClose, onEditRequest, meetings, contactLogs }) => {
  const { handleNavigation } = useNavigation();
  const { projects, setProjects } = useData();
  const { addToast } = useToast();
  const [isShowing, setIsShowing] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  useEffect(() => {
    if (project) {
      setDeleteConfirmOpen(false);
      const timer = setTimeout(() => setIsShowing(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsShowing(false);
    }
  }, [project]);

  const relatedActivities = useMemo<UnifiedActivity[]>(() => {
    if (!project) return [];

    const companyName = project['Company Name'];
    const pipelineId = project['Pipeline No.'];
    const allActivities: UnifiedActivity[] = [];

    contactLogs
      .filter(log => log['Company Name'] === companyName)
      .forEach(log => {
        const date = parseDate(log['Contact Date']);
        if (date) {
          allActivities.push({
            type: 'log',
            date,
            isoDate: date.toISOString(),
            responsible: log['Responsible By'],
            summary: `Log: ${log.Type} with ${log['Contact Name']}`,
            details: log.Remarks,
            original: log,
          });
        }
      });

    meetings
      .filter(meeting => meeting['Company Name'] === companyName || meeting.Pipeline_ID === pipelineId)
      .forEach(meeting => {
        const date = parseDate(meeting['Meeting Date']);
        if (date) {
          allActivities.push({
            type: 'meeting',
            date,
            isoDate: date.toISOString(),
            responsible: meeting['Responsible By'],
            summary: `Meeting: ${meeting.Type} with ${meeting.Participants}`,
            details: meeting.Remarks,
            original: meeting,
          });
        }
      });
    
    return allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [project, meetings, contactLogs]);

  const navigateTo = (view: string, filter: string) => {
    onClose();
    handleNavigation({ view, filter });
  };
  
  const handleDelete = async () => {
    if (!project) return;
    
    const originalProjects = projects ? [...projects] : [];
    const projectToDeleteId = project['Pipeline No.'];
    
    setDeleteConfirmOpen(false);
    onClose();

    setProjects(current => current ? current.filter(p => p['Pipeline No.'] !== projectToDeleteId) : null);

    try {
        await deleteRecord('Pipelines', projectToDeleteId);
        addToast('Pipeline deleted!', 'success');
    } catch (err: any) {
        addToast('Failed to delete pipeline.', 'error');
        setProjects(originalProjects);
    }
  };

  const calendarLink = useMemo(() => {
    if (!project?.calculatedDueDate) return '';
    return generateGoogleCalendarLink({
      title: `Due: ${project.Require || 'Project'} for ${project['Company Name']}`,
      description: `Pipeline No: ${project['Pipeline No.']}\nStatus: ${project.Status}`,
      start: project.calculatedDueDate,
      allDay: true,
    });
  }, [project]);

  if (!project) return null;
  
  const displayDueDate = project.calculatedDueDate ? formatDateAsMDY(project.calculatedDueDate) : formatDisplayDate(project['Due Date']);
  const title = project['Company Name'];
  
  const renderDetailView = () => (
     <div className="space-y-8">
        {/* Key Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center"><Tag className="w-5 h-5" /></div>
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</p>
                    <div className="text-lg font-bold text-slate-800 mt-1"><StatusBadge status={project.Status} /></div>
                </div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center"><DollarSign className="w-5 h-5" /></div>
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bid Value</p>
                    <div className="text-lg font-bold text-slate-800 mt-1">
                        {(() => {
                            const formattedValue = formatCurrencySmartly(project['Bid Value'], project.Currency);
                            return formattedValue === '-'
                                ? <span className="text-gray-400 italic text-base">N/A</span>
                                : formattedValue;
                        })()}
                    </div>
                </div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center"><Calendar className="w-5 h-5" /></div>
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</p>
                    <div className="text-lg font-bold text-slate-800 mt-1">{displayDueDate || <span className="text-gray-400 italic text-base">N/A</span>}</div>
                </div>
            </div>
        </div>
        {/* Main Details Grid */}
        <div className="space-y-6">
            <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
                <h3 className="text-base font-semibold text-gray-800 mb-4 border-b pb-2">Contact & Responsibility</h3>
                <div className="flex flex-wrap items-center gap-3">
                    <DetailItem label="Company Name" value={<button onClick={() => navigateTo('companies', project['Company Name'])} className="font-medium text-brand-600 hover:underline text-left">{project['Company Name']}</button>} />
                    <DetailItem label="Contact Name" value={<button onClick={() => navigateTo('contacts', project['Contact Name'])} className="font-medium text-brand-600 hover:underline text-left">{project['Contact Name']}</button>} />
                    <DetailItem label="Contact Number" value={project['Contact Number']} />
                    <DetailItem label="Email" value={project['Email']} />
                    <DetailItem label="Responsible By" value={project['Responsible By']} />
                </div>
            </div>
            <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
                <h3 className="text-base font-semibold text-gray-800 mb-4 border-b pb-2">Project Details</h3>
                <div className="flex flex-wrap items-center gap-3">
                    <DetailItem label="Require" value={project['Require']} />
                    <DetailItem label="Type" value={project['Type']} />
                    <DetailItem label="Brand" value={project['Brand 1']} />
                    <DetailItem label="Taxable" value={project['Taxable']} />
                    <DetailItem label="Currency" value={project.Currency} />
                </div>
            </div>
             <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
                <h3 className="text-base font-semibold text-gray-800 mb-4 border-b pb-2">Dates & Timeline</h3>
                <div className="flex flex-wrap items-center gap-3">
                    <DetailItem label="Created Date" value={formatDisplayDate(project['Created Date'])} />
                    <DetailItem label="Time Frame" value={project['Time Frame']} />
                    <DetailItem label="Invoice Date" value={formatDisplayDate(project['Inv Date'])} />
                </div>
            </div>
            {(project.Remarks || project.Conditional) && (
                <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
                    <h3 className="text-base font-semibold text-gray-800 mb-4 border-b pb-2">Notes</h3>
                    <div className="space-y-4 text-sm">
                        {project.Remarks && <div><p className="font-semibold text-slate-600">Remarks:</p><p className="whitespace-pre-wrap text-slate-800 pl-2">{project.Remarks}</p></div>}
                        {project.Conditional && <div><p className="font-semibold text-slate-600">Conditional:</p><p className="whitespace-pre-wrap text-slate-800 pl-2">{project.Conditional}</p></div>}
                    </div>
                </div>
            )}
             {(project.Quote || project['Attach Invoice'] || project['Attach D.O']) && (
                <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
                    <h3 className="text-base font-semibold text-gray-800 mb-4 border-b pb-2">Documents</h3>
                    <div className="flex flex-wrap items-center gap-3">
                        <DetailItem label="Quote" value={project.Quote && <a href={extractUrlFromFormula(project.Quote)} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:text-brand-800 hover:underline">View File</a>} />
                        <DetailItem label="Invoice" value={project['Attach Invoice'] && <a href={extractUrlFromFormula(project['Attach Invoice'])} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:text-brand-800 hover:underline">View File</a>} />
                        <DetailItem label="D.O" value={project['Attach D.O'] && <a href={extractUrlFromFormula(project['Attach D.O'])} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:text-brand-800 hover:underline">View File</a>} />
                    </div>
                </div>
            )}
        </div>
    </div>
  );
  
  const renderActivitiesView = () => (
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
      ) : (
        <EmptyState />
      )}
    </div>
  );

  return createPortal(
    <>
      <div
        className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${isShowing ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm p-6 border-b border-gray-200 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">Pipeline No: {project['Pipeline No.']}</p>
          </div>
          <div className="flex items-center gap-2">
            {calendarLink && (
              <a 
                href={calendarLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={(e) => e.stopPropagation()}
                title="Add to Google Calendar"
                className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
                aria-label="Add to Google Calendar"
              >
                <CalendarPlus />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
              aria-label="Close project details"
            >
              <X />
            </button>
          </div>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {renderDetailView()}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Activities ({relatedActivities.length})</h3>
            {renderActivitiesView()}
          </div>
        </div>
        <ModalActionFooter
          onClose={onClose}
          onEdit={() => onEditRequest(project)}
        />
      </div>
      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Pipeline"
        confirmText="Delete"
      >
        Are you sure you want to delete this pipeline? This action cannot be undone.
      </ConfirmationModal>
    </>,
    document.body
  );
};

export default React.memo(ProjectDetailModal);