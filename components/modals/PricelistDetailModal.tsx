'use client';

import React from 'react';
import { PricelistItem } from "../../types";
import { FormSection, FormDisplay } from "../common/FormControls";
import { parseSheetValue } from "../../utils/formatters";
import { useAuth } from "../../contexts/AuthContext";
import { useB2B } from "../../contexts/B2BContext";
import ResizableModal from "./ResizableModal";

interface PricelistDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: PricelistItem | null;
}

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (!status) return <span className="text-muted-foreground italic">N/A</span>;

    let colorClass = 'bg-muted text-muted-foreground'; // Default
    const lowerStatus = status.toLowerCase();

    if (lowerStatus.includes('available')) {
        colorClass = 'bg-emerald-500/10 text-emerald-500';
    } else if (lowerStatus.includes('pre-order')) {
        colorClass = 'bg-amber-500/10 text-amber-500';
    } else if (lowerStatus.includes('out of stock')) {
        colorClass = 'bg-rose-500/10 text-rose-500';
    }

    return (
        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
            {status}
        </span>
    );
};

const PricelistDetailModal: React.FC<PricelistDetailModalProps> = ({ isOpen, onClose, item }) => {
    const { currentUser } = useAuth();
    const { isB2B } = useB2B();

    const showDealerPrice = React.useMemo(() => {
        const role = currentUser?.Role?.toLowerCase();
        return role === 'admin' || role === 'b2b' || isB2B;
    }, [currentUser, isB2B]);

    if (!item) return null;

    const title = item.Code ? `${item.Code} - ${item.Model}` : 'Item Details';

    const modalFooter = (
        <div className="flex justify-end gap-3 w-full">
            <button
                type="button"
                onClick={onClose}
                className="bg-card hover:bg-muted text-foreground font-semibold py-2 px-6 rounded-lg border border-border transition-all duration-200 shadow-sm"
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
                    {showDealerPrice && (
                        <FormDisplay label="Dealer Price" value={renderPrice(item['Dealer Price'])} />
                    )}
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
