'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ContactLog } from "../../types";
import { useNavigation } from "../../contexts/NavigationContext";
import { formatDisplayDate } from "../../utils/time";
import { useData } from "../../contexts/DataContext";
import { deleteRecord } from "../../services/api";
import ModalActionFooter from "./ModalActionFooter";
import ConfirmationModal from "./ConfirmationModal";
import { useToast } from "../../contexts/ToastContext";
import { X } from 'lucide-react';

interface ContactLogDetailModalProps {
  log: ContactLog | null;
  onClose: () => void;
  onEditRequest: (log: ContactLog) => void;
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

const ContactLogDetailModal: React.FC<ContactLogDetailModalProps> = ({ log, onClose, onEditRequest }) => {
  const { handleNavigation } = useNavigation();
  const { contactLogs, setContactLogs } = useData();
  const { addToast } = useToast();
  const [isShowing, setIsShowing] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (log) {
      setDeleteConfirmOpen(false);
      const timer = setTimeout(() => setIsShowing(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsShowing(false);
    }
  }, [log]);
  
  const navigateTo = (view: string, filter: string) => {
    onClose();
    handleNavigation({ view, filter });
  };
  
  const handleDelete = async () => {
    if (!log || !log['Log ID']) return;
    
    const originalLogs = contactLogs ? [...contactLogs] : [];
    const logToDeleteId = log['Log ID'];

    setDeleteConfirmOpen(false);
    onClose();

    setContactLogs(current => current ? current.filter(l => l['Log ID'] !== logToDeleteId) : null);

    try {
        await deleteRecord('Contact_Logs', logToDeleteId);
        addToast('Contact log deleted!', 'success');
    } catch (err: any) {
        addToast('Failed to delete log.', 'error');
        setContactLogs(originalLogs);
    }
  };

  if (!log) return null;

  const title = log['Company Name'];
  
  const renderDetailView = () => (
     <div className="space-y-6">
        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
            <div className="flex flex-wrap items-center gap-3">
                <DetailItem label="Contact Name" value={<button onClick={() => navigateTo('contacts', log['Contact Name'])} className="font-medium text-brand-600 hover:underline text-left">{log['Contact Name']}</button>} />
                <DetailItem label="Position" value={log.Position} />
                <DetailItem label="Phone Number" value={log['Phone Number']} />
                <DetailItem label="Email" value={log.Email} />
                <DetailItem label="Type" value={log.Type} />
                <DetailItem label="Responsible By" value={log['Responsible By']} />
                <DetailItem label="Contact Date" value={formatDisplayDate(log['Contact Date'])} />
                <DetailItem label="Counter" value={log.Counter} />
            </div>
        </div>
        {log.Remarks && (
            <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
              <p className="text-sm font-semibold text-slate-600 mb-2">Remarks</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{log.Remarks}</p>
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
                <p className="text-sm text-gray-500 mt-1">Contact: {log['Contact Name']} on {formatDisplayDate(log['Contact Date'])}</p>
            </div>
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors" aria-label="Close log details"><X /></button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {renderDetailView()}
        </div>
        <ModalActionFooter
          onClose={onClose}
          onEdit={() => onEditRequest(log)}
        />
      </div>
    <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Contact Log"
        confirmText="Delete"
      >
        Are you sure you want to delete this contact log? This action cannot be undone.
      </ConfirmationModal>
    </>,
    document.body
  );
};

export default React.memo(ContactLogDetailModal);
