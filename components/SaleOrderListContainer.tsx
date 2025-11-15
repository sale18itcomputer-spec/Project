import React from 'react';
import { SaleOrder } from '../types';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import { ShoppingCart } from 'lucide-react';
import { formatCurrencySmartly } from '../utils/formatters';

interface SaleOrderListContainerProps {
    saleOrders: SaleOrder[];
    selectedSaleOrderId: string | null;
    onSelectSaleOrder: (id: string) => void;
    loading: boolean;
}

const SaleOrderListContainer: React.FC<SaleOrderListContainerProps> = ({ saleOrders, selectedSaleOrderId, onSelectSaleOrder, loading }) => {
    
    const renderContent = () => {
        if (loading) {
            return <Spinner />;
        }
        
        if (saleOrders.length === 0) {
            return (
                <div className="p-8 h-full flex items-center justify-center">
                    <EmptyState illustration={<ShoppingCart className="w-16 h-16 text-slate-300" />}>
                        <h3 className="mt-2 text-sm font-semibold text-gray-900">No Sale Orders Found</h3>
                        <p className="mt-1 text-sm text-gray-500">Try adjusting your search query.</p>
                    </EmptyState>
                </div>
            );
        }
        
        return (
            <ul>
                {saleOrders.map(so => (
                  <li key={so['SO No.']}>
                    <button
                      onClick={() => onSelectSaleOrder(so['SO No.'])}
                      className={`w-full text-left px-4 py-3.5 border-b border-slate-100 border-l-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 z-10 relative ${
                        selectedSaleOrderId === so['SO No.']
                          ? 'bg-brand-50 border-brand-500'
                          : 'border-transparent hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                            <h3 className={`truncate text-base ${
                                selectedSaleOrderId === so['SO No.']
                                ? 'font-bold text-brand-800'
                                : 'font-semibold text-slate-800'
                            }`}>
                                {so['Company Name']}
                            </h3>
                            <p className="text-sm text-slate-600 truncate mt-0.5 font-mono">{so['SO No.']}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                             <p className={`text-sm font-semibold ${
                                selectedSaleOrderId === so['SO No.'] ? 'text-brand-900' : 'text-slate-800'
                             }`}>
                                {formatCurrencySmartly(so['Total Amount'], so.Currency)}
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

export default SaleOrderListContainer;
