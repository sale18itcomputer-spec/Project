import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Meeting } from '../types';
import { useNavigation } from '../contexts/NavigationContext';
import { formatDisplayDate, parseDateTime } from '../utils/time';
import { useData } from '../contexts/DataContext';
import { deleteRecord } from '../services/api';
import ModalActionFooter from './ModalActionFooter';
import ConfirmationModal from './ConfirmationModal';
import { generateGoogleCalendarLink } from '../utils/calendar';
import { useToast } from '../contexts/ToastContext';
import { X, CalendarPlus } from 'lucide-react';

interface MeetingDetailModalProps {
  meeting: Meeting | null;
  onClose: () => void;
  onEditRequest: (meeting: Meeting) => void;
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

const MeetingDetailModal: React.FC<MeetingDetailModalProps> = ({ meeting, onClose, onEditRequest }) => {
  const { handleNavigation } = useNavigation();
  const { meetings, setMeetings } = useData();
  const { addToast } = useToast();
  const [isShowing, setIsShowing] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (meeting) {
      setDeleteConfirmOpen(false);
      const timer = setTimeout(() => setIsShowing(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsShowing(false);
    }
  }, [meeting]);
  
  const navigateTo = (view: string, filter: string) => {
    onClose();
    handleNavigation({ view, filter });
  };
  
  const handleDelete = async () => {
    if (!meeting || !meeting['Meeting ID']) return;
    
    const originalMeetings = meetings ? [...meetings] : [];
    const meetingToDeleteId = meeting['Meeting ID'];

    setDeleteConfirmOpen(false);
    onClose();

    setMeetings(current => current ? current.filter(m => m['Meeting ID'] !== meetingToDeleteId) : null);

    try {
        await deleteRecord('Meeting_Logs', meetingToDeleteId);
        addToast('Meeting deleted!', 'success');
    } catch (err: any) {
        addToast('Failed to delete meeting.', 'error');
        setMeetings(originalMeetings);
    }
  };

  const calendarLink = useMemo(() => {
    if (!meeting) return '';
    const start = parseDateTime(meeting['Meeting Date'], meeting['Start Time']);
    const end = parseDateTime(meeting['Meeting Date'], meeting['End Time']);
    if (!start) return '';
    
    return generateGoogleCalendarLink({
      title: `Meeting: ${meeting.Type} with ${meeting['Company Name']}`,
      description: `Participants: ${meeting.Participants}\nPipeline ID: ${meeting.Pipeline_ID}\n\nRemarks:\n${meeting.Remarks}`,
      location: meeting.Type === 'Onsite' ? meeting['Company Name'] : 'Online',
      start: start,
      end: end || undefined,
    });
  }, [meeting]);

  if (!meeting) return null;
  const title = meeting['Company Name'];
  
  const renderDetailView = () => (
    <div className="space-y-6">
      <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
          <div className="flex flex-wrap items-center gap-3">
               <DetailItem label="Company Name" value={<button onClick={() => navigateTo('companies', meeting['Company Name'])} className="font-medium text-brand-600 hover:underline text-left">{meeting['Company Name']}</button>} />
              <DetailItem label="Pipeline ID" value={meeting.Pipeline_ID ? <button onClick={() => navigateTo('projects', meeting.Pipeline_ID)} className="font-medium text-brand-600 hover:underline text-left">{meeting.Pipeline_ID}</button> : null} />
              <DetailItem label="Type" value={meeting.Type} />
              <DetailItem label="Participants" value={meeting.Participants} />
              <DetailItem label="Responsible By" value={meeting['Responsible By']} />
              <DetailItem label="Date" value={formatDisplayDate(meeting['Meeting Date'])} />
              <DetailItem label="Time" value={`${meeting['Start Time']} - ${meeting['End Time']}`} />
              <DetailItem label="Status" value={meeting.Status} />
          </div>
      </div>
      {meeting.Remarks && (
        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
            <p className="text-sm font-semibold text-slate-600 mb-2">Remarks</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{meeting.Remarks}</p>
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
                <p className="text-sm text-gray-500 mt-1">Meeting on {formatDisplayDate(meeting['Meeting Date'])}</p>
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
              <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors" aria-label="Close meeting details"><X /></button>
            </div>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {renderDetailView()}
        </div>
        <ModalActionFooter
          onClose={onClose}
          onEdit={() => onEditRequest(meeting)}
        />
      </div>
    <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Meeting"
        confirmText="Delete"
      >
        Are you sure you want to delete this meeting? This action cannot be undone.
      </ConfirmationModal>
    </>,
    document.body
  );
};

export default React.memo(MeetingDetailModal);