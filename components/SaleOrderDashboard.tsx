import React, { useState, useMemo, useEffect } from 'react';
import { SaleOrder, Quotation } from '../types';
import { useData } from '../contexts/DataContext';
import DataTable, { ColumnDef } from './DataTable';
import { parseDate, formatDateAsMDY } from '../utils/time';
import SaleOrderCreator from './SaleOrderCreator';
import { useNavigation } from '../contexts/NavigationContext';
import { SALE_ORDER_SHEET_ID } from '../constants';
import MetricCard from './MetricCard';
import { parseSheetValue } from '../utils/formatters';
import { ShoppingCart, DollarSign, CheckCircle } from 'lucide-react';
import FileLinkCell from './FileLinkCell';
import SaleOrderDetailModal from './SaleOrderDetailModal';

interface SaleOrderDashboardProps {
    quotationForSO?: Quotation;
}

const StatusBadge: React.FC<{ status: SaleOrder['Status'] }> = ({ status }) => {
    const statusConfig: { [key in SaleOrder['Status'] | string]: { bg: string; text: string } } = {
      'Pending': { bg: 'bg-amber-100', text: 'text-slate-800' },
      'Completed': { bg: 'bg-emerald-100', text: 'text-slate-800' },
      'Cancel': { bg: 'bg-rose-100', text: 'text-slate-800' },
    };
  
    const config = statusConfig[status] || { bg: 'bg-slate-100', text: 'text-slate-800' };
  
    return (
      <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-md ${config.bg} ${config.text}`}>
        {status}
      </span>
    );
};

const SaleOrderDashboard: React.FC<SaleOrderDashboardProps> = ({ quotationForSO }) => {
    const { saleOrders, loading, error } = useData();
    const [isCreating, setIsCreating] = useState(false);
    const [selectedSaleOrder, setSelectedSaleOrder] = useState<SaleOrder | null>(null);
    const [viewedSaleOrder, setViewedSaleOrder] = useState<SaleOrder | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { handleNavigation } = useNavigation();

    useEffect(() => {
        if (quotationForSO) {
            const saleOrderFromQuote: Partial<SaleOrder> = {
                'Quote No.': quotationForSO['Quote No.'],
                'Company Name': quotationForSO['Company Name'],
                'Contact Name': quotationForSO['Contact Name'],
                'Phone Number': quotationForSO['Contact Number'],
                'Email': quotationForSO['Contact Email'],
                'Total Amount': quotationForSO.Amount,
                'Payment Term': quotationForSO['Payment Term'],
                'Status': 'Pending',
            };
            setSelectedSaleOrder(saleOrderFromQuote as SaleOrder);
            setIsCreating(true);
        }
    }, [quotationForSO]);

    const handleNewSaleOrder = () => {
        setSelectedSaleOrder(null);
        setIsCreating(true);
    };

    const handleEditSaleOrder = (saleOrder: SaleOrder) => {
        setViewedSaleOrder(null);
        setSelectedSaleOrder(saleOrder);
        setIsCreating(true);
    };

    const handleViewSaleOrder = (saleOrder: SaleOrder) => {
        setViewedSaleOrder(saleOrder);
    };
    
    const handleBackToDashboard = () => {
        setIsCreating(false);
        setSelectedSaleOrder(null);
        // If we came from another page, navigate back to dashboard default to avoid being stuck in SO creation.
        if (quotationForSO) {
            handleNavigation({ view: 'quotations' });
        }
    };

    const metrics = useMemo(() => {
        if (!saleOrders) return { total: 0, totalValue: 0, completionRate: 0 };
    
        const totalValue = saleOrders.reduce((sum, so) => sum + parseSheetValue(so['Total Amount']), 0);
        const completedCount = saleOrders.filter(so => so.Status === 'Completed').length;
        const totalConsidered = saleOrders.filter(so => ['Completed', 'Cancel'].includes(so.Status)).length;
        const completionRate = totalConsidered > 0 ? (completedCount / totalConsidered) * 100 : 0;
        
        return {
            total: saleOrders.length,
            totalValue,
            completionRate,
        };
    }, [saleOrders]);

    const filteredData = useMemo(() => {
        const dataToFilter = saleOrders || [];
        if (!searchQuery) return dataToFilter;
    
        return dataToFilter.filter(item =>
            ['SO No.', 'Company Name', 'Contact Name', 'Status', 'Quote No.'].some(key =>
                String(item[key as keyof SaleOrder] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
      }, [saleOrders, searchQuery]);

    const columns = useMemo<ColumnDef<SaleOrder>[]>(() => [
        {
          accessorKey: 'SO No.',
          header: 'SO No.',
          isSortable: true,
          cell: (value: string, row) => (
            <div className="font-semibold text-slate-800">
               <FileLinkCell
                  fileFormula={row.File}
                  sheetId={SALE_ORDER_SHEET_ID}
                  label={value}
                />
            </div>
          )
        },
        {
          accessorKey: 'SO Date',
          header: 'SO Date',
          isSortable: true,
          cell: (value: string) => formatDateAsMDY(parseDate(value)),
        },
        {
            accessorKey: 'Quote No.',
            header: 'Quote Ref.',
            isSortable: true,
        },
        {
          accessorKey: 'Company Name',
          header: 'Company Name',
          isSortable: true,
        },
        { 
          accessorKey: 'Total Amount', 
          header: 'Total Amount', 
          isSortable: true, 
          cell: (value: string) => {
            const num = parseSheetValue(value);
            return (
                <span className="text-sm font-medium text-slate-800 text-right block w-full">
                    {num > 0 ? num.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '-'}
                </span>
            )
        }},
        {
          accessorKey: 'Bill Invoice',
          header: 'Bill Invoice',
          isSortable: true,
          cell: (value: 'VAT' | 'NON-VAT' | undefined) => {
            if (!value) return null;
            const config = {
              'VAT': { bg: 'bg-sky-100', text: 'text-slate-800' },
              'NON-VAT': { bg: 'bg-slate-100', text: 'text-slate-800' },
            };
            const badgeConfig = config[value] || { bg: 'bg-slate-100', text: 'text-slate-800' };
            return (
              <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-md ${badgeConfig.bg} ${badgeConfig.text}`}>
                {value}
              </span>
            );
          }
        },
        { accessorKey: 'Status', header: 'Status', isSortable: true, cell: (value: SaleOrder['Status']) => <StatusBadge status={value} /> },
        {
          accessorKey: 'Created By',
          header: 'Created By',
          isSortable: true,
        },
    ], [SALE_ORDER_SHEET_ID]);

    if (isCreating) {
        return <SaleOrderCreator onBack={handleBackToDashboard} existingSaleOrder={selectedSaleOrder} />;
    }

    if (error) {
        return (
          <div className="p-6 md:p-8">
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
              <p className="font-bold">Error</p>
              <p>Could not load sale orders data: {error}</p>
            </div>
          </div>
        );
    }

    return (
        <div className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <MetricCard title="Total Sale Orders" value={metrics.total.toString()} change="" changeType="increase" icon={<ShoppingCart />} isCompact/>
            <MetricCard title="Total Order Value" value={metrics.totalValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })} change="" changeType="increase" icon={<DollarSign />} isCompact/>
            <MetricCard title="Completion Rate" value={`${metrics.completionRate.toFixed(0)}%`} change="" changeType="increase" icon={<CheckCircle />} isCompact/>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm">
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between sm:items-center flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold text-gray-900">All Sale Orders</h2>
                    <button
                        onClick={handleNewSaleOrder}
                        className="flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-3 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px"
                    >
                        <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        <span className="hidden sm:inline">New Sale Order</span>
                    </button>
                </div>
                 <div className="relative w-full sm:w-auto">
                    <label htmlFor="datatable-search" className="sr-only">Search</label>
                    <input
                      id="datatable-search"
                      type="text"
                      placeholder="Search sale orders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-white border border-gray-300 text-gray-800 placeholder-gray-400 text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 p-2.5 transition"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>
            <DataTable
              tableId="saleorder-table"
              data={filteredData}
              columns={columns}
              loading={loading}
              onRowClick={handleViewSaleOrder}
              initialSort={{ key: 'SO Date', direction: 'descending' }}
            />
          </div>
            <SaleOrderDetailModal
                saleOrder={viewedSaleOrder}
                onClose={() => setViewedSaleOrder(null)}
                onEditRequest={handleEditSaleOrder}
            />
        </div>
      );
}

export default SaleOrderDashboard;