import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Quotation } from '../types';
import { formatDisplayDate } from '../utils/time';
import { useData } from '../contexts/DataContext';
import { deleteRecord } from '../services/api';
import ConfirmationModal from './ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import { X, Trash2, Pencil, ShoppingCart } from 'lucide-react';
import { formatCurrencySmartly } from '../utils/formatters';

interface QuotationDetailModalProps {
  quotation: Quotation | null;
  onClose: () => void;
  onEditRequest: (quotation: Quotation) => void;
  onCreateSaleOrder: (quotation: Quotation) => void;
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

import { useB2B } from '../contexts/B2BContext';

const QuotationDetailModal: React.FC<QuotationDetailModalProps> = ({ quotation, onClose, onEditRequest, onCreateSaleOrder }) => {
  const { quotations: b2cQuotations, setQuotations } = useData();
  const { isB2B, setQuotations: setB2bQuotations, quotations: b2bQuotations } = useB2B();

  const quotations = isB2B ? b2bQuotations : b2cQuotations;

  const { addToast } = useToast();
  const [isShowing, setIsShowing] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (quotation) {
      setDeleteConfirmOpen(false);
      const timer = setTimeout(() => setIsShowing(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsShowing(false);
    }
  }, [quotation]);

  const handleDelete = async () => {
    if (!quotation) return;
    const originalQuotations = quotations ? [...quotations] : [];
    const quoteToDeleteId = quotation['Quote No.'];

    setDeleteConfirmOpen(false);
    onClose();

    // Optimistic update
    if (isB2B) {
      setB2bQuotations(current => current ? current.filter(q => q['Quote No.'] !== quoteToDeleteId) : null);
    } else {
      setQuotations(current => current ? current.filter(q => q['Quote No.'] !== quoteToDeleteId) : null);
    }

    try {
      const tableName = isB2B ? 'b2b_quotations' : 'Quotations';
      await deleteRecord(tableName, quoteToDeleteId);
      addToast('Quotation deleted!', 'success');
    } catch (err: any) {
      addToast('Failed to delete quotation.', 'error');
      // Revert on error
      if (isB2B) {
        setB2bQuotations(originalQuotations);
      } else {
        setQuotations(originalQuotations);
      }
    }
  };

  if (!quotation) return null;

  const title = `Quotation: ${quotation['Quote No.']}`;

  const renderDetailView = () => (
    <div className="space-y-6">
      <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-3">
          <DetailItem label="Quote No." value={quotation['Quote No.']} />
          <DetailItem label="Quote Date" value={formatDisplayDate(quotation['Quote Date'])} />
          <DetailItem label="Validity Date" value={formatDisplayDate(quotation['Validity Date'])} />
          <DetailItem label="Status" value={quotation.Status} />
          <DetailItem label="Created By" value={quotation['Created By']} />
        </div>
      </div>
      <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-3">
          <DetailItem label="Company Name" value={quotation['Company Name']} />
          <DetailItem label="Contact Name" value={quotation['Contact Name']} />
          <DetailItem label="Contact Number" value={quotation['Contact Number']} />
          <DetailItem label="Contact Email" value={quotation['Contact Email']} />
        </div>
      </div>
      <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-3">
          <DetailItem label="Amount" value={formatCurrencySmartly(quotation.Amount, quotation.Currency)} />
          <DetailItem label="CM" value={quotation.CM} />
          <DetailItem label="Payment Term" value={quotation['Payment Term']} />
          <DetailItem label="Stock Status" value={quotation['Stock Status']} />
          <DetailItem label="Prepared By" value={quotation['Prepared By']} />
          <DetailItem label="Prepared By Position" value={quotation['Prepared By Position']} />
          <DetailItem label="Approved By" value={quotation['Approved By']} />
          <DetailItem label="Approved By Position" value={quotation['Approved By Position']} />
        </div>
      </div>
      {quotation.Reason && (
        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
          <p className="text-sm font-semibold text-slate-600 mb-2">Reason for Status</p>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{quotation.Reason}</p>
        </div>
      )}
      {quotation.Remark && (
        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
          <p className="text-sm font-semibold text-slate-600 mb-2">Remark</p>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{quotation.Remark}</p>
        </div>
      )}
      {quotation['Terms and Conditions'] && (
        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
          <p className="text-sm font-semibold text-slate-600 mb-2">Terms and Conditions</p>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{quotation['Terms and Conditions']}</p>
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
        className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${isShowing ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm p-6 border-b border-gray-200 flex justify-between items-center z-10">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors" aria-label="Close"><X /></button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {renderDetailView()}
        </div>
        <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm pt-4 pb-4 border-t border-gray-200 flex justify-between items-center z-10 px-6 gap-3">
          <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 border border-rose-500 text-rose-500 hover:bg-rose-50">
            <Trash2 className="w-5 h-5" /> Delete
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="font-semibold py-2 px-4 rounded-lg transition-colors duration-200 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Close</button>
            {quotation.Status === 'Close (Win)' && (
              <button onClick={() => onCreateSaleOrder(quotation)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition shadow-sm flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Create Sale Order
              </button>
            )}
            <button onClick={() => onEditRequest(quotation)} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-lg transition shadow-sm flex items-center gap-2">
              <Pencil className="w-5 h-5" /> Edit
            </button>
          </div>
        </div>
      </div>
      <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Quotation" confirmText="Delete">
        Are you sure you want to delete this quotation? This action cannot be undone.
      </ConfirmationModal>
    </>,
    document.body
  );
};
export default React.memo(QuotationDetailModal);
