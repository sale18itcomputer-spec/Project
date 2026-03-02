'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SaleOrder } from "../../types";
import { formatDisplayDate } from "../../utils/time";
import { useData } from "../../contexts/DataContext";
import { deleteRecord } from "../../services/api";
import ConfirmationModal from "./ConfirmationModal";
import { useToast } from "../../contexts/ToastContext";
import { X, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { formatCurrencySmartly } from "../../utils/formatters";

interface SaleOrderDetailModalProps {
  saleOrder: SaleOrder | null;
  onClose: () => void;
  onEditRequest: (saleOrder: SaleOrder) => void;
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

const SaleOrderDetailModal: React.FC<SaleOrderDetailModalProps> = ({ saleOrder, onClose, onEditRequest }) => {
  const { saleOrders, setSaleOrders } = useData();
  const { addToast } = useToast();
  const [isShowing, setIsShowing] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (saleOrder) {
      setDeleteConfirmOpen(false);
      const timer = setTimeout(() => setIsShowing(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsShowing(false);
    }
  }, [saleOrder]);

  const handleDelete = async () => {
    if (!saleOrder) return;
    const originalSaleOrders = saleOrders ? [...saleOrders] : [];
    const soToDeleteId = saleOrder['SO No.'];
    
    setDeleteConfirmOpen(false);
    onClose();

    setSaleOrders(current => current ? current.filter(so => so['SO No.'] !== soToDeleteId) : null);
    
    try {
        await deleteRecord('Sale Orders', soToDeleteId);
        addToast('Sale Order deleted!', 'success');
    } catch (err: any) {
        addToast('Failed to delete Sale Order.', 'error');
        setSaleOrders(originalSaleOrders);
    }
  };

  if (!saleOrder) return null;

  const title = `Sale Order: ${saleOrder['SO No.']}`;
  
  const renderDetailView = () => (
    <div className="space-y-6">
      <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-3">
            <DetailItem label="SO No." value={saleOrder['SO No.']} />
            <DetailItem label="SO Date" value={formatDisplayDate(saleOrder['SO Date'])} />
            <DetailItem label="Quote No." value={saleOrder['Quote No.']} />
            <DetailItem label="Status" value={saleOrder.Status} />
            <DetailItem label="Created By" value={saleOrder['Created By']} />
        </div>
      </div>
      <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-3">
            <DetailItem label="Company Name" value={saleOrder['Company Name']} />
            <DetailItem label="Contact Name" value={saleOrder['Contact Name']} />
            <DetailItem label="Phone Number" value={saleOrder['Phone Number']} />
            <DetailItem label="Email" value={saleOrder.Email} />
        </div>
      </div>
       <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-3">
            <DetailItem label="Total Amount" value={formatCurrencySmartly(saleOrder['Total Amount'], saleOrder.Currency)} />
            <DetailItem label="Tax" value={formatCurrencySmartly(saleOrder.Tax, saleOrder.Currency)} />
            <DetailItem label="Commission" value={formatCurrencySmartly(saleOrder.Commission, saleOrder.Currency)} />
            <DetailItem label="Payment Term" value={saleOrder['Payment Term']} />
            <DetailItem label="Delivery Date" value={formatDisplayDate(saleOrder['Delivery Date'])} />
            <DetailItem label="Bill Invoice" value={saleOrder['Bill Invoice']} />
        </div>
      </div>
       {saleOrder['Install Software'] && (
        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
            <p className="text-sm font-semibold text-slate-600 mb-2">Software to Install</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{saleOrder['Install Software']}</p>
        </div>
       )}
        {saleOrder['Attachment'] && (
            <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
                <p className="text-sm font-semibold text-slate-600 mb-2">Attachment</p>
                <a href={saleOrder['Attachment']} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
                    View Attached File
                    <ExternalLink className="w-4 h-4" />
                </a>
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
                <button onClick={() => onEditRequest(saleOrder)} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-lg transition shadow-sm flex items-center gap-2">
                    <Pencil className="w-5 h-5" /> Edit
                </button>
            </div>
        </div>
      </div>
      <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Sale Order" confirmText="Delete">
        Are you sure you want to delete this Sale Order? This action cannot be undone.
      </ConfirmationModal>
    </>,
    document.body
  );
};
export default React.memo(SaleOrderDetailModal);

