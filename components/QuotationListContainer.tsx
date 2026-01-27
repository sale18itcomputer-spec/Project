import React from 'react';
import { Quotation } from '../types';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import { FileText } from 'lucide-react';
import { formatCurrencySmartly } from '../utils/formatters';

interface QuotationListContainerProps {
    quotations: Quotation[];
    selectedQuotationId: string | null;
    onSelectQuotation: (id: string) => void;
    loading: boolean;
}

const QuotationListContainer: React.FC<QuotationListContainerProps> = ({ quotations, selectedQuotationId, onSelectQuotation, loading }) => {

    const renderContent = () => {
        if (loading) {
            return <Spinner />;
        }

        if (quotations.length === 0) {
            return (
                <div className="p-8 h-full flex items-center justify-center">
                    <EmptyState illustration={<FileText className="w-16 h-16 text-muted-foreground/20" />}>
                        <h3 className="mt-2 text-sm font-semibold text-foreground">No Quotations Found</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search query.</p>
                    </EmptyState>
                </div>
            );
        }

        return (
            <ul>
                {quotations.map(q => (
                    <li key={q['Quote No.']}>
                        <button
                            onClick={() => onSelectQuotation(q['Quote No.'])}
                            className={`w-full text-left px-4 py-3.5 border-b border-border border-l-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 z-10 relative ${selectedQuotationId === q['Quote No.']
                                ? 'bg-brand-500/10 border-brand-500'
                                : 'border-transparent hover:bg-muted'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <h3 className={`truncate text-base ${selectedQuotationId === q['Quote No.']
                                        ? 'font-bold text-brand-500'
                                        : 'font-semibold text-foreground'
                                        }`}>
                                        {q['Company Name']}
                                    </h3>
                                    <p className="text-sm text-muted-foreground truncate mt-0.5 font-mono">{q['Quote No.']}</p>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                    <p className={`text-sm font-semibold ${selectedQuotationId === q['Quote No.'] ? 'text-brand-500' : 'text-foreground'
                                        }`}>
                                        {formatCurrencySmartly(q.Amount, q.Currency)}
                                    </p>
                                </div>
                            </div>
                        </button>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto vertical-scroll">
            {renderContent()}
        </div>
    );
};

export default QuotationListContainer;
