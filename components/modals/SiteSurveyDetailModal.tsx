'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SiteSurveyLog } from "../../types";
import { formatDisplayDate, parseDateTime } from "../../utils/time";
import { useData } from "../../contexts/DataContext";
import { deleteRecord } from "../../services/api";
import ModalActionFooter from "./ModalActionFooter";
import ConfirmationModal from "./ConfirmationModal";
import { useNavigation } from "../../contexts/NavigationContext";
import { generateGoogleCalendarLink } from "../../utils/calendar";
import { useToast } from "../../contexts/ToastContext";
import { X, CalendarPlus } from 'lucide-react';

interface SiteSurveyDetailModalProps {
  survey: SiteSurveyLog | null;
  onClose: () => void;
  onEditRequest: (survey: SiteSurveyLog) => void;
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

const SiteSurveyDetailModal: React.FC<SiteSurveyDetailModalProps> = ({ survey, onClose, onEditRequest }) => {
  const { siteSurveys, setSiteSurveys } = useData();
  const { addToast } = useToast();
  const { handleNavigation } = useNavigation();
  const [isShowing, setIsShowing] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  useEffect(() => {
    if (survey) {
      setDeleteConfirmOpen(false);
      const timer = setTimeout(() => setIsShowing(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsShowing(false);
    }
  }, [survey]);
  
  const handleDelete = async () => {
    if (!survey || !survey['Site ID']) return;
    
    const originalSurveys = siteSurveys ? [...siteSurveys] : [];
    const surveyToDeleteId = survey['Site ID'];

    setDeleteConfirmOpen(false);
    onClose();

    setSiteSurveys(current => current ? current.filter(s => s['Site ID'] !== surveyToDeleteId) : null);

    try {
        await deleteRecord('Site_Survey_Logs', surveyToDeleteId);
        addToast('Survey deleted!', 'success');
    } catch (err: any) {
        addToast('Failed to delete survey.', 'error');
        setSiteSurveys(originalSurveys);
    }
  };

  const navigateTo = (view: string, filter: string) => {
    onClose();
    handleNavigation({ view, filter });
  };

  const calendarLink = useMemo(() => {
    if (!survey) return '';
    const start = parseDateTime(survey.Date, survey['Start Time']);
    const end = parseDateTime(survey.Date, survey['End Time']);
    if (!start) return '';
    
    return generateGoogleCalendarLink({
      title: `Site Survey: ${survey.Location}`,
      description: `\n\nRemark:\n${survey.Remark}`,
      location: survey.Location,
      start: start,
      end: end || undefined,
    });
  }, [survey]);

  if (!survey) return null;

  const title = survey.Location;

  const renderDetailView = () => (
    <div className="space-y-6">
      <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
          <div className="flex flex-wrap items-center gap-3">
              <DetailItem label="Location" value={survey.Location} />
              <DetailItem label="Responsible By" value={survey['Responsible By']} />
              <DetailItem label="Date" value={formatDisplayDate(survey.Date)} />
              <DetailItem label="Time" value={`${survey['Start Time']} - ${survey['End Time']}`} />
          </div>
      </div>
      {(survey.Remark) && (
        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
            <p className="text-sm font-semibold text-slate-600 mb-2">Remark</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{survey.Remark}</p>
        </div>
      )}
       {(survey['Next Action (If Any)']) && (
        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
            <p className="text-sm font-semibold text-slate-600 mb-2">Next Action (If Any)</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{survey['Next Action (If Any)']}</p>
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
                <p className="text-sm text-gray-500 mt-1">Survey on {formatDisplayDate(survey.Date)} by {survey['Responsible By']}</p>
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
            <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors" aria-label="Close survey details"><X /></button>
          </div>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {renderDetailView()}
        </div>
        <ModalActionFooter
          onClose={onClose}
          onEdit={() => onEditRequest(survey)}
        />
      </div>
    <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Site Survey"
        confirmText="Delete"
      >
        Are you sure you want to delete this site survey? This action cannot be undone.
      </ConfirmationModal>
    </>,
    document.body
  );
};

export default React.memo(SiteSurveyDetailModal);
