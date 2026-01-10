import React from 'react';
import { PricelistItem } from '../types';
import { FormSection, FormDisplay } from './FormControls';
import { parseSheetValue } from '../utils/formatters';
import ResizableModal from './ResizableModal';

interface PricelistDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: PricelistItem | null;
}

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (!status) return <span className="text-slate-400 italic">N/A</span>;

    let colorClass = 'bg-slate-100 text-slate-800'; // Default
    const lowerStatus = status.toLowerCase();

    if (lowerStatus.includes('available')) {
        colorClass = 'bg-emerald-100 text-emerald-800';
    } else if (lowerStatus.includes('pre-order')) {
        colorClass = 'bg-amber-100 text-amber-800';
    } else if (lowerStatus.includes('out of stock')) {
        colorClass = 'bg-rose-100 text-rose-800';
    }

    return (
        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
            {status}
        </span>
    );
};

const PricelistDetailModal: React.FC<PricelistDetailModalProps> = ({ isOpen, onClose, item }) => {
    if (!item) return null;

    const title = item.Code ? `${item.Code} - ${item.Model}` : 'Item Details';

    const modalFooter = (
        <div className="flex justify-end gap-3 w-full">
            <button
                type="button"
                onClick={onClose}
                className="bg-white hover:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-md border border-gray-300 transition"
            >
                Close
            </button>
        </div>
    );

    const renderPrice = (value: string) => {
        const num = parseSheetValue(value);
        if (num === 0 && String(value || '').trim() === '') return null;
        return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    return (
        <ResizableModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={modalFooter}
        >
            <div className="space-y-6">
                <FormSection title="General Information">
                    <FormDisplay label="Category" value={item.Category} />
                    <FormDisplay label="Code" value={item.Code} />
                    <FormDisplay label="Brand" value={item.Brand} />
                    <FormDisplay label="Model" value={item.Model} />
                    <FormDisplay label="Description" value={item.Description} multiline />
                    <FormDisplay label="Promotion" value={item.Promotion || '-'} />
                </FormSection>

                <FormSection title="Pricing & Status">
                    <FormDisplay label="Unit Price" value={renderPrice(item['End User Price'])} />
                    <FormDisplay label="Status">
                        <StatusBadge status={item.Status} />
                    </FormDisplay>
                </FormSection>
            </div>
        </ResizableModal>
    );
};

export default PricelistDetailModal;