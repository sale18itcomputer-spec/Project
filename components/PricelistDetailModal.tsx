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

    const title = item['Item Code'] ? `${item['Item Code']} - ${item.Model}` : 'Item Details';

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
                    <FormDisplay label="Item Code" value={item['Item Code']} />
                    <FormDisplay label="Brand" value={item.Brand} />
                    <FormDisplay label="Model" value={item.Model} />
                    <FormDisplay label="Item Description" value={item['Item Description']} multiline />
                </FormSection>

                <FormSection title="Pricing">
                    <FormDisplay label="SRP" value={renderPrice(item.SRP)} />
                    <FormDisplay label="SRP (B)" value={renderPrice(item['SRP (B)'])} />
                </FormSection>

                <FormSection title="Inventory">
                    <FormDisplay label="Stock (Qty)" value={item.Qty} />
                    <FormDisplay label="On The Way (OTW)" value={item.OTW} />
                    <FormDisplay label="Status">
                        <StatusBadge status={item.Status} />
                    </FormDisplay>
                </FormSection>
                
                <FormSection title="Detailed Specifications">
                    <div className="md:col-span-2">
                         <FormDisplay label="" multiline>
                            <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans">{item['Detail Spec'] || 'N/A'}</pre>
                         </FormDisplay>
                    </div>
                </FormSection>
            </div>
        </ResizableModal>
    );
};

export default PricelistDetailModal;