import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Company, PipelineProject, Contact } from '../types';
import { useNavigation } from '../contexts/NavigationContext';
import EmptyState from './EmptyState';
import { formatDisplayDate } from '../utils/time';
import { useData } from '../contexts/DataContext';
import { deleteRecord } from '../services/api';
import ModalActionFooter from './ModalActionFooter';
import ConfirmationModal from './ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import { X } from 'lucide-react';

interface CompanyDetailModalProps {
  company: Company | null;
  onClose: () => void;
  onEditRequest: (company: Company) => void;
  projects: PipelineProject[];
  contacts: Contact[];
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

const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({ company, onClose, onEditRequest, projects, contacts }) => {
  const { handleNavigation } = useNavigation();
  const { refetchData } = useData();
  const { addToast } = useToast();
  const [isShowing, setIsShowing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  useEffect(() => {
    if (company) {
      setDeleteConfirmOpen(false);
      const timer = setTimeout(() => setIsShowing(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsShowing(false);
    }
  }, [company]);

  const companyName = company ? company['Company Name'] : null;

  const relatedProjects = useMemo(() => {
    if (!companyName) return [];
    return projects.filter(p => p['Company Name'] === companyName);
  }, [projects, companyName]);

  const relatedContacts = useMemo(() => {
    if (!companyName) return [];
    return contacts.filter(c => c['Company Name'] === companyName);
  }, [contacts, companyName]);

  const navigateTo = (view: string, filter: string) => {
    onClose();
    handleNavigation({ view, filter });
  };
  
  const handleDelete = async () => {
    if (!company || !company['Company ID']) return;
    setIsSubmitting(true);
    try {
        await deleteRecord('Company List', company['Company ID']);
        addToast('Company deleted successfully!', 'success');
        await refetchData();
        onClose();
    } catch (err: any) {
        addToast(err.message || 'Failed to delete company.', 'error');
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!company) return null;

  const title = company['Company Name'];

  const renderDetailView = () => (
    <div className="space-y-6">
        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
            <div className="flex flex-wrap items-center gap-3">
                <DetailItem label="Company ID" value={company['Company ID']} />
                <DetailItem label="Company Name (Khmer)" value={company['Company Name (Khmer)']} />
                <DetailItem label="Phone Number" value={company['Phone Number']} />
                <DetailItem label="Email" value={company['Email']} />
                <DetailItem label="Website" value={company.Website ? <a href={company.Website} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{company.Website}</a> : null} />
                <DetailItem label="Field" value={company.Field} />
                <DetailItem label="Payment Term" value={company['Payment Term']} />
                <DetailItem label="Patent" value={company.Patent} />
                <DetailItem label="Created Date" value={formatDisplayDate(company['Created Date'])} />
                <DetailItem label="Created By" value={company['Created By']} />
            </div>
        </div>
        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80 space-y-4">
           <div className="flex flex-wrap gap-3">
                <DetailItem label="Address (English)" value={company['Address (English)']} />
                <DetailItem label="Address (Khmer)" value={company['Address (Khmer)']} />
           </div>
        </div>
        {company['Patent File'] && (
            <div className="pt-2"><a href={company['Patent File']} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-brand-600 hover:text-brand-700 font-medium">View Patent File<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a></div>
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
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors" aria-label="Close company details"><X /></button>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto">
          {renderDetailView()}

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Pipelines ({relatedProjects.length})</h3>
            <div className="flow-root">{relatedProjects.length > 0 ? (<ul className="-my-4 divide-y divide-gray-200">{relatedProjects.map(project => (<li key={project['Pipeline No.']} className="flex items-center space-x-4 py-4"><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{project['Pipeline No.']}</p><p className="text-sm text-gray-500 truncate">{project.Require}</p></div><div className="text-right"><span className="text-sm font-medium text-gray-700">{project['Bid Value']}</span><p className="text-xs text-gray-500">{project.Status}</p></div><button onClick={() => navigateTo('projects', project['Pipeline No.'])} className="text-brand-600 hover:text-brand-800 text-sm font-semibold">View</button></li>))}</ul>) : <EmptyState />}</div>
          </div>
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Contacts ({relatedContacts.length})</h3>
            <div className="flow-root">{relatedContacts.length > 0 ? (<ul className="-my-4 divide-y divide-gray-200">{relatedContacts.map(contact => (<li key={contact['Customer ID']} className="py-3"><button onClick={() => navigateTo('contacts', contact.Name)} className="w-full text-left group"><div className="flex items-center justify-between"><div><p className="font-semibold text-slate-800 group-hover:text-brand-600">{contact.Name}</p><p className="text-sm text-slate-500">{contact.Role}</p></div><p className="text-sm text-slate-600">{contact['Tel (1)']}</p></div></button></li>))}</ul>) : <p className="text-sm text-slate-500">No contacts found for this company.</p>}</div>
          </div>
        </div>

        <ModalActionFooter
          onClose={onClose}
          onEdit={() => onEditRequest(company)}
        />
      </div>
    <ConfirmationModal
      isOpen={isDeleteConfirmOpen}
      onClose={() => setDeleteConfirmOpen(false)}
      onConfirm={handleDelete}
      title="Delete Company"
      confirmText="Delete"
    >
      Are you sure you want to delete this company? This action cannot be undone.
    </ConfirmationModal>
    </>,
    document.body
  );
};

export default React.memo(CompanyDetailModal);