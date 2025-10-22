import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Contact, PipelineProject, ContactLog, Meeting, UnifiedActivity } from '../types';
import { useNavigation } from '../contexts/NavigationContext';
import EmptyState from './EmptyState';
import { parseDate, formatDateAsMDY, formatDisplayDate } from '../utils/time';
import { useData } from '../contexts/DataContext';
import { deleteRecord } from '../services/api';
import ModalActionFooter from './ModalActionFooter';
import ConfirmationModal from './ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import { X, Calendar, MessageSquare } from 'lucide-react';

interface ContactDetailModalProps {
  contact: Contact | null;
  onClose: () => void;
  onEditRequest: (contact: Contact) => void;
  projects: PipelineProject[];
  contactLogs: ContactLog[];
  meetings: Meeting[];
}

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => {
    if (!value || (typeof value === 'string' && !value.trim())) return null;
    return (
        <div className="flex items-center bg-slate-100 border border-slate-200/90 rounded-md text-sm leading-none">
            <span className="px-2.5 py-1.5 text-slate-500 font-semibold">{label}</span>
            <span className="px-2.5 py-1.5 text-slate-800 font-medium bg-white rounded-r-md border-l border-slate-200/90 break-all">
                {value}
            </span>
        </div>
    );
};

const ContactDetailModal: React.FC<ContactDetailModalProps> = ({ contact, onClose, onEditRequest, projects, contactLogs, meetings }) => {
  const { handleNavigation } = useNavigation();
  const { contacts, setContacts } = useData();
  const { addToast } = useToast();
  const [isShowing, setIsShowing] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (contact) {
      setDeleteConfirmOpen(false);
      const timer = setTimeout(() => setIsShowing(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsShowing(false);
    }
  }, [contact]);


  const contactName = contact ? contact.Name : null;
  const companyName = contact ? contact['Company Name'] : null;

  const relatedProjects = useMemo(() => {
    if (!contactName) return [];
    return projects.filter(p => p['Contact Name'] === contactName);
  }, [projects, contactName]);
  
  const relatedActivities = useMemo<UnifiedActivity[]>(() => {
    if (!contact || !contactName || !companyName) return [];

    const allActivities: UnifiedActivity[] = [];

    contactLogs
      .filter(log => log['Contact Name'] === contactName || log['Company Name'] === companyName)
      .forEach(log => {
        const date = parseDate(log['Contact Date']);
        if (date) {
          allActivities.push({
            type: 'log', date, isoDate: date.toISOString(), responsible: log['Responsible By'],
            summary: `Log: ${log.Type} with ${log['Contact Name']}`, details: log.Remarks, original: log,
          });
        }
      });

    meetings
      .filter(meeting => meeting['Company Name'] === companyName || meeting.Participants.includes(contactName))
      .forEach(meeting => {
        const date = parseDate(meeting['Meeting Date']);
        if (date) {
          allActivities.push({
            type: 'meeting', date, isoDate: date.toISOString(), responsible: meeting['Responsible By'],
            summary: `Meeting: ${meeting.Type} with ${meeting.Participants}`, details: meeting.Remarks, original: meeting,
          });
        }
      });
    
    return allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [contact, contactLogs, meetings, companyName, contactName]);

  const navigateTo = (view: string, filter: string) => {
    onClose();
    handleNavigation({ view, filter });
  };
  
  const handleDelete = async () => {
    if (!contact || !contact['Customer ID']) return;
    
    const originalContacts = contacts ? [...contacts] : [];
    const contactToDeleteId = contact['Customer ID'];
    
    setDeleteConfirmOpen(false);
    onClose();

    setContacts(current => current ? current.filter(c => c['Customer ID'] !== contactToDeleteId) : null);

    try {
        await deleteRecord('Contact_List', contactToDeleteId);
        addToast('Contact deleted!', 'success');
    } catch (err: any) {
        addToast('Failed to delete contact.', 'error');
        setContacts(originalContacts);
    }
  };

  if (!contact) return null;

  const title = contact.Name;

  const renderDetailView = () => (
    <div className="space-y-6">
        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
            <div className="flex flex-wrap items-center gap-3">
                <DetailItem label="Customer ID" value={contact['Customer ID']} />
                <DetailItem label="Company Name" value={<button onClick={() => navigateTo('companies', contact['Company Name'])} className="font-medium text-brand-600 hover:underline text-left">{contact['Company Name']}</button>} />
                <DetailItem label="Role" value={contact.Role} />
                <DetailItem label="Department" value={contact.Department} />
                <DetailItem label="Tel (1)" value={contact['Tel (1)']} />
                <DetailItem label="Tel (2)" value={contact['Tel (2)']} />
                <DetailItem label="Email" value={contact.Email} />
                <DetailItem label="Created By" value={contact['Created By']} />
                <DetailItem label="Created Date" value={formatDisplayDate(contact['Created Date'])} />
            </div>
        </div>
        {contact.Remarks && (
           <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
              <p className="text-sm font-semibold text-slate-600 mb-2">Remarks</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{contact.Remarks}</p>
           </div>
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
                <button onClick={() => navigateTo('companies', contact['Company Name'])} className="text-sm text-gray-500 hover:text-brand-600 hover:underline transition-colors">{contact['Company Name']}</button>
            </div>
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors" aria-label="Close contact details"><X /></button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {renderDetailView()}

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Pipelines ({relatedProjects.length})</h3>
            <div className="flow-root">{relatedProjects.length > 0 ? (<ul className="-my-4 divide-y divide-gray-200">{relatedProjects.map(project => (<li key={project['Pipeline No.']} className="flex items-center space-x-4 py-4"><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{project['Pipeline No.']}</p><p className="text-sm text-gray-500 truncate">{project.Require}</p></div><div className="text-right"><span className="text-sm font-medium text-gray-700">{project['Bid Value']}</span><p className="text-xs text-gray-500">{project.Status}</p></div><button onClick={() => navigateTo('projects', project['Pipeline No.'])} className="text-brand-600 hover:text-brand-800 text-sm font-semibold">View</button></li>))}</ul>) : <EmptyState />}</div>
          </div>
          
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Activities ({relatedActivities.length})</h3>
            <div className="flow-root">{relatedActivities.length > 0 ? (<div className="space-y-4 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">{relatedActivities.map((activity, index) => (<div key={`${activity.type}-${activity.isoDate}-${index}`} className="relative"><div className="absolute -left-[29px] top-0.5 w-8 h-8 rounded-full bg-white flex items-center justify-center ring-4 ring-white">{activity.type === 'meeting' ? <Calendar className="w-5 h-5 text-sky-600" /> : <MessageSquare className="w-5 h-5 text-violet-600" />}</div><div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80"><p className="font-semibold text-gray-800">{activity.summary}</p><p className="text-sm text-gray-500 mb-2">{formatDateAsMDY(activity.date)} by {activity.responsible}</p>{activity.details && <p className="text-sm text-gray-700 whitespace-pre-wrap">{activity.details}</p>}</div></div>))}</div>) : <EmptyState />}</div>
          </div>
        </div>

         <ModalActionFooter
            onClose={onClose}
            onEdit={() => onEditRequest(contact)}
        />
      </div>
    <ConfirmationModal
      isOpen={isDeleteConfirmOpen}
      onClose={() => setDeleteConfirmOpen(false)}
      onConfirm={handleDelete}
      title="Delete Contact"
      confirmText="Delete"
    >
      Are you sure you want to delete this contact? This action cannot be undone.
    </ConfirmationModal>
    </>,
    document.body
  );
};

export default React.memo(ContactDetailModal);