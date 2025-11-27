import React, { useState, useMemo, useEffect } from 'react';
import { SaleOrder, Quotation } from '../types';
import { useData } from '../contexts/DataContext';
import DataTable, { ColumnDef } from './DataTable';
import { parseDate, formatDateAsMDY, formatDisplayDate } from '../utils/time';
import SaleOrderCreator from './SaleOrderCreator';
import { useNavigation } from '../contexts/NavigationContext';
import { SALE_ORDER_SHEET_ID } from '../constants';
import MetricCard from './MetricCard';
import { parseSheetValue, formatCurrencySmartly, determineCurrency } from '../utils/formatters';
import { ShoppingCart, DollarSign, CheckCircle, Table, Columns, Info, Pencil, ArrowRightToLine, WrapText, Scissors } from 'lucide-react';
import FileLinkCell from './FileLinkCell';
import { DataTableColumnToggle } from './DataTableColumnToggle';
import ViewToggle from './ViewToggle';
import SaleOrderListContainer from './SaleOrderListContainer';
import Spinner from './Spinner';
import EmptyState from './EmptyState';

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

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => {
    if (!value || (typeof value === 'string' && !value.trim())) return null;
    return (
        <div>
            <dt className="text-sm font-medium text-gray-500">{label}</dt>
            <dd className="mt-1 text-sm text-gray-900">{value}</dd>
        </div>
    );
};


const SALE_ORDER_COLUMNS_VISIBILITY_KEY = 'limperial-sale-order-columns-visibility';

type ViewMode = 'table' | 'detail';

const SaleOrderDashboard: React.FC<SaleOrderDashboardProps> = ({ quotationForSO }) => {
    const { saleOrders, loading, error } = useData();
    const [isCreating, setIsCreating] = useState(!!quotationForSO);
    // FIX: Replaced the incorrect direct type assertion with a lazy state initializer that correctly maps properties from the `Quotation` prop to a new `SaleOrder` object. This resolves the TypeScript error and makes the component's logic more robust.
    const [selectedSaleOrderToEdit, setSelectedSaleOrderToEdit] = useState<SaleOrder | null>(() => {
        if (!quotationForSO) return null;
        
        const saleOrderFromQuote: Partial<SaleOrder> = {
            'Quote No.': quotationForSO['Quote No.'],
            'Company Name': quotationForSO['Company Name'],
            'Contact Name': quotationForSO['Contact Name'],
            'Phone Number': quotationForSO['Contact Number'],
            'Email': quotationForSO['Contact Email'],
            'Total Amount': quotationForSO.Amount,
            'Payment Term': quotationForSO['Payment Term'],
            'Status': 'Pending',
            'Currency': quotationForSO.Currency,
        };
        // This cast is intentional, as SaleOrderCreator handles this partial data for new SOs from quotes.
        return saleOrderFromQuote as unknown as SaleOrder;
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('overflow');
    const [selectedSaleOrderId, setSelectedSaleOrderId] = useState<string | null>(null);
    const { handleNavigation } = useNavigation();

    const handleNewSaleOrder = () => {
        setSelectedSaleOrderToEdit(null);
        setIsCreating(true);
    };

    const handleEditSaleOrder = (saleOrder: SaleOrder) => {
        setSelectedSaleOrderToEdit(saleOrder);
        setIsCreating(true);
    };

    const handleViewSaleOrder = (saleOrder: SaleOrder) => {
        setViewMode('detail');
        setSelectedSaleOrderId(saleOrder['SO No.']);
    };
    
    const handleBackToDashboard = () => {
        setIsCreating(false);
        setSelectedSaleOrderToEdit(null);
        if (quotationForSO) {
            handleNavigation({ view: 'quotations' });
        }
    };

    const metrics = useMemo(() => {
        if (!saleOrders) return { total: 0, totalValueUSD: 0, totalValueKHR: 0, completionRate: 0 };
    
        const { totalValueUSD, totalValueKHR } = saleOrders.reduce((acc, so) => {
            const value = parseSheetValue(so['Total Amount']);
            const determinedCurrency = determineCurrency(value, so.Currency);
            if (determinedCurrency === 'KHR') {
                acc.totalValueKHR += value;
            } else {
                acc.totalValueUSD += value;
            }
            return acc;
        }, { totalValueUSD: 0, totalValueKHR: 0 });

        const completedCount = saleOrders.filter(so => so.Status === 'Completed').length;
        const totalConsidered = saleOrders.filter(so => ['Completed', 'Cancel'].includes(so.Status)).length;
        const completionRate = totalConsidered > 0 ? (completedCount / totalConsidered) * 100 : 0;
        
        return {
            total: saleOrders.length,
            totalValueUSD,
            totalValueKHR,
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

    const selectedSaleOrder = useMemo(() => {
        if (!selectedSaleOrderId) return null;
        return filteredData.find(so => so['SO No.'] === selectedSaleOrderId) || null;
    }, [selectedSaleOrderId, filteredData]);
    
    useEffect(() => {
        if (viewMode === 'detail' && !selectedSaleOrderId && filteredData.length > 0) {
            setSelectedSaleOrderId(filteredData[0]['SO No.']);
        }
    }, [viewMode, selectedSaleOrderId, filteredData]);

    const allColumns = useMemo<ColumnDef<SaleOrder>[]>(() => [
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
          cell: (value: string, row: SaleOrder) => {
            const formattedValue = formatCurrencySmartly(value, row.Currency);
            if (formattedValue === '-') {
                return <span className="text-slate-400 text-right block w-full">-</span>;
            }
            return (
                <span className="text-sm font-medium text-slate-800 text-right block w-full">
                    {formattedValue}
                </span>
            );
          }
        },
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

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(SALE_ORDER_COLUMNS_VISIBILITY_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                    return new Set(parsed);
                }
            }
        } catch (e) {
            console.error("Failed to load visible columns from storage", e);
        }
        return new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean));
    });
    
    useEffect(() => {
        const saved = localStorage.getItem(SALE_ORDER_COLUMNS_VISIBILITY_KEY);
        if (!saved && allColumns.length > 0) {
          setVisibleColumns(new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean)));
        }
    }, [allColumns]);
    
    const handleColumnToggle = (columnKey: string) => {
        setVisibleColumns(prev => {
          const newSet = new Set(prev);
          if (newSet.has(columnKey)) {
            if (newSet.size > 1) { // Prevent hiding the last column
              newSet.delete(columnKey);
            }
          } else {
            newSet.add(columnKey);
          }
          try {
            localStorage.setItem(SALE_ORDER_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
          } catch (e) {
            console.error("Failed to save visible columns to storage", e);
          }
          return newSet;
        });
    };
    
    const displayedColumns = useMemo(() => {
        return allColumns.filter(c => c.accessorKey && visibleColumns.has(c.accessorKey as string));
    }, [allColumns, visibleColumns]);
    
    const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
        { id: 'table', label: 'Table', icon: <Table /> },
        { id: 'detail', label: 'Detail', icon: <Columns /> },
    ];


    if (isCreating) {
        return <SaleOrderCreator onBack={handleBackToDashboard} existingSaleOrder={selectedSaleOrderToEdit} />;
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
    
    const usdStr = metrics.totalValueUSD > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(metrics.totalValueUSD) : '';
    const khrStr = metrics.totalValueKHR > 0 ? `៛${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(metrics.totalValueKHR)}` : '';
    
    let mainValue: string;
    let subValue: string | undefined;

    if (usdStr && khrStr) {
        mainValue = usdStr;
        subValue = khrStr;
    } else if (usdStr) {
        mainValue = usdStr;
    } else if (khrStr) {
        mainValue = khrStr;
    } else {
        mainValue = '$0';
    }
    
    const renderDetailView = () => (
        <div className="flex flex-col md:flex-row h-full">
            <aside className="w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col">
                <SaleOrderListContainer
                    saleOrders={filteredData}
                    selectedSaleOrderId={selectedSaleOrderId}
                    onSelectSaleOrder={setSelectedSaleOrderId}
                    loading={loading && !saleOrders}
                />
            </aside>
            <main className="flex-1 p-6 sm:p-8 overflow-y-auto bg-slate-50">
                {loading && !selectedSaleOrder ? <Spinner /> : selectedSaleOrder ? (
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{selectedSaleOrder['Company Name']}</h1>
                            <p className="text-slate-600 font-mono mt-1">{selectedSaleOrder['SO No.']}</p>
                        </div>
                        <button 
                            onClick={() => handleEditSaleOrder(selectedSaleOrder)}
                            className="text-sm font-semibold text-brand-600 hover:underline flex items-center gap-1.5"
                        >
                           <Pencil className="w-4 h-4" /> Edit
                        </button>
                        </div>

                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <dt className="text-sm font-medium text-gray-500">Total Amount</dt>
                                <dd className="mt-1 text-xl font-semibold text-gray-900">{formatCurrencySmartly(selectedSaleOrder['Total Amount'], selectedSaleOrder.Currency)}</dd>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <dt className="text-sm font-medium text-gray-500">Status</dt>
                                <dd className="mt-1"><StatusBadge status={selectedSaleOrder.Status}/></dd>
                            </div>
                        </div>

                        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                            <DetailItem label="SO Date" value={formatDisplayDate(selectedSaleOrder['SO Date'])} />
                            <DetailItem label="Delivery Date" value={formatDisplayDate(selectedSaleOrder['Delivery Date'])} />
                            <DetailItem label="Quote Ref." value={selectedSaleOrder['Quote No.']} />
                            <DetailItem label="Payment Term" value={selectedSaleOrder['Payment Term']} />
                            <DetailItem label="Contact Person" value={selectedSaleOrder['Contact Name']} />
                            <DetailItem label="Phone Number" value={selectedSaleOrder['Phone Number']} />
                             <DetailItem label="Bill Invoice" value={selectedSaleOrder['Bill Invoice']} />
                        </dl>
                    </div>
                </div>
                ) : (
                <div className="h-full flex items-center justify-center">
                    <EmptyState illustration={<Info className="w-16 h-16 text-slate-300" />}>
                        <h3 className="mt-2 text-sm font-semibold text-gray-900">Select a Sale Order</h3>
                        <p className="mt-1 text-sm text-gray-500">Choose an order from the list to see its details.</p>
                    </EmptyState>
                </div>
                )}
            </main>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50">
          <div className="p-6 flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50 border-b border-slate-200">
            <MetricCard title="Total Sale Orders" value={metrics.total.toString()} change="" changeType="increase" icon={<ShoppingCart />} isCompact/>
            <MetricCard title="Total Order Value" value={mainValue} subValue={subValue} change="" changeType="increase" icon={<DollarSign />} isCompact/>
            <MetricCard title="Completion Rate" value={`${metrics.completionRate.toFixed(0)}%`} change="" changeType="increase" icon={<CheckCircle />} isCompact/>
          </div>
          <div className="p-4 sm:px-6 flex flex-col sm:flex-row justify-between sm:items-center flex-wrap gap-4 bg-white border-b border-slate-200">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold text-gray-900">All Sale Orders</h2>
                </div>
                 <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
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
                    <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />
                    {viewMode === 'table' && (
                       <>
                        <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
                            <button onClick={() => setCellWrapStyle('overflow')} title="Overflow" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${ cellWrapStyle === 'overflow' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700' }`} aria-pressed={cellWrapStyle === 'overflow'} >
                                <ArrowRightToLine className="w-4 h-4" />
                            </button>
                            <button onClick={() => setCellWrapStyle('wrap')} title="Wrap" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${ cellWrapStyle === 'wrap' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700' }`} aria-pressed={cellWrapStyle === 'wrap'} >
                                <WrapText className="w-4 h-4" />
                            </button>
                            <button onClick={() => setCellWrapStyle('clip')} title="Clip" className={`flex items-center justify-center p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-1 ${ cellWrapStyle === 'clip' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700' }`} aria-pressed={cellWrapStyle === 'clip'} >
                                <Scissors className="w-4 h-4" />
                            </button>
                        </div>
                        <DataTableColumnToggle
                            allColumns={allColumns}
                            visibleColumns={visibleColumns}
                            onColumnToggle={handleColumnToggle}
                        />
                       </>
                    )}
                     <button
                        onClick={handleNewSaleOrder}
                        className="flex-shrink-0 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px"
                    >
                        <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        <span className="hidden sm:inline">New</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                 {viewMode === 'table' ? (
                     <div className="h-full overflow-auto bg-white">
                        <DataTable
                          tableId="saleorder-table"
                          data={filteredData}
                          columns={displayedColumns}
                          loading={loading}
                          onRowClick={handleViewSaleOrder}
                          initialSort={{ key: 'SO Date', direction: 'descending' }}
                          mobilePrimaryColumns={['SO No.', 'Company Name', 'Total Amount', 'Status']}
                          cellWrapStyle={cellWrapStyle}
                        />
                    </div>
                 ) : (
                    renderDetailView()
                 )}
            </div>
        </div>
      );
}

export default SaleOrderDashboard;