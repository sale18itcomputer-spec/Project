import React, { useState, useMemo, useEffect } from 'react';
import { Quotation } from '../types';
import { useData } from '../contexts/DataContext';
import DataTable, { ColumnDef } from './DataTable';
import { parseDate, formatDateAsMDY, formatDisplayDate } from '../utils/time';
import QuotationCreator from './QuotationCreator';
import { useNavigation } from '../contexts/NavigationContext';
import { QUOTATION_SHEET_ID } from '../constants';
import MetricCard from './MetricCard';
import { parseSheetValue, formatCurrencySmartly, determineCurrency } from '../utils/formatters';
import { FileText, DollarSign, CheckCircle, ShoppingCart, LayoutGrid, Table, Columns, Info, Pencil } from 'lucide-react';
import FileLinkCell from './FileLinkCell';
import { DataTableColumnToggle } from './DataTableColumnToggle';
import ViewToggle from './ViewToggle';
import KanbanView, { KanbanColumn } from './KanbanView';
import { useToast } from '../contexts/ToastContext';
import { deleteRecord, updateRecord } from '../services/api';
import ConfirmationModal from './ConfirmationModal';
import ItemActionsMenu from './ItemActionsMenu';
import QuotationListContainer from './QuotationListContainer';
import Spinner from './Spinner';
import EmptyState from './EmptyState';

const StatusBadge: React.FC<{ status: Quotation['Status'] }> = ({ status }) => {
  const statusConfig: { [key in Quotation['Status'] | string]: { bg: string; text: string } } = {
    'Open': { bg: 'bg-brand-100', text: 'text-slate-800' },
    'Close (Win)': { bg: 'bg-emerald-100', text: 'text-slate-800' },
    'Close (Lose)': { bg: 'bg-rose-100', text: 'text-slate-800' },
    'Cancel': { bg: 'bg-red-100', text: 'text-slate-800' },
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

const QUOTATION_COLUMNS_VISIBILITY_KEY = 'limperial-quotation-columns-visibility';

type ViewMode = 'table' | 'board' | 'detail';

const QuotationDashboard: React.FC = () => {
  const { quotations, setQuotations, loading, error } = useData();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedQuotationToEdit, setSelectedQuotationToEdit] = useState<Quotation | null>(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { handleNavigation } = useNavigation();
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);

  const quotationSheetId = QUOTATION_SHEET_ID;

  const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
      { id: 'table', label: 'Table', icon: <Table /> },
      { id: 'board', label: 'Board', icon: <LayoutGrid /> },
      { id: 'detail', label: 'Detail', icon: <Columns /> },
  ];

  const handleNewQuotation = () => {
    setSelectedQuotationToEdit(null);
    setIsCreating(true);
  };

  const handleEditQuotation = (quotation: Quotation) => {
    setSelectedQuotationToEdit(quotation);
    setIsCreating(true);
  };
  
  const handleViewQuotation = (quotation: Quotation) => {
    setSelectedQuotationId(quotation['Quote No.']);
    setViewMode('detail');
  };

  const handleDeleteRequest = (quotation: Quotation) => {
    setQuotationToDelete(quotation);
  };

  const handleConfirmDelete = async () => {
    if (!quotationToDelete) return;
    
    const originalQuotations = quotations ? [...quotations] : [];
    const quoteToDeleteId = quotationToDelete['Quote No.'];
    
    setQuotationToDelete(null);

    setQuotations(current => current ? current.filter(q => q['Quote No.'] !== quoteToDeleteId) : null);
    
    try {
        await deleteRecord('Quotations', quoteToDeleteId);
        addToast('Quotation deleted!', 'success');
    } catch (err: any) {
        addToast('Failed to delete quotation.', 'error');
        setQuotations(originalQuotations);
    }
  };

  const handleItemMove = async (item: Quotation, newStatus: string) => {
    const quoteNo = item['Quote No.'];
    if (!quoteNo) return;

    const originalQuotations = quotations ? [...quotations] : [];

    // Optimistic UI Update
    setQuotations(current => {
        if (!current) return null;
        return current.map(q =>
            q['Quote No.'] === quoteNo ? { ...q, Status: newStatus as Quotation['Status'] } : q
        );
    });

    try {
        await updateRecord('Quotations', quoteNo, { 'Status': newStatus });
        addToast('Quotation moved successfully!', 'success');
    } catch (err) {
        console.error("Failed to update status:", err);
        addToast('Failed to move quotation. Reverting change.', 'error');
        setQuotations(originalQuotations); // Revert UI on error
    }
  };

  const handleCreateSaleOrder = (quotation: Quotation) => {
    handleNavigation({ view: 'sale-orders', payload: quotation });
  };

  const handleBackToDashboard = () => {
    setIsCreating(false);
    setSelectedQuotationToEdit(null);
  };

  const metrics = useMemo(() => {
    if (!quotations) return { total: 0, totalValueUSD: 0, totalValueKHR: 0, approvalRate: 0 };

    const { totalValueUSD, totalValueKHR } = quotations.reduce((acc, q) => {
        const value = parseSheetValue(q.Amount);
        const determinedCurrency = determineCurrency(value, q.Currency);
        if (determinedCurrency === 'KHR') {
            acc.totalValueKHR += value;
        } else {
            acc.totalValueUSD += value;
        }
        return acc;
    }, { totalValueUSD: 0, totalValueKHR: 0 });

    const approvedCount = quotations.filter(q => q.Status === 'Close (Win)').length;
    const consideredQuotes = quotations.filter(q => ['Close (Win)', 'Close (Lose)', 'Cancel'].includes(q.Status)).length;
    const approvalRate = consideredQuotes > 0 ? (approvedCount / consideredQuotes) * 100 : 0;
    
    return {
        total: quotations.length,
        totalValueUSD,
        totalValueKHR,
        approvalRate,
    };
  }, [quotations]);

  const filteredData = useMemo(() => {
    const dataToFilter = quotations || [];
    if (!searchQuery) return dataToFilter;

    return dataToFilter.filter(item =>
        ['Quote No.', 'Company Name', 'Contact Name', 'Status', 'Reason'].some(key =>
            String(item[key as keyof Quotation] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        )
    );
  }, [quotations, searchQuery]);

  const selectedQuotationForDetail = useMemo(() => {
      if (!selectedQuotationId) return null;
      return filteredData.find(q => q['Quote No.'] === selectedQuotationId) || null;
  }, [selectedQuotationId, filteredData]);
  
  useEffect(() => {
      if (viewMode === 'detail' && !selectedQuotationId && filteredData.length > 0) {
          setSelectedQuotationId(filteredData[0]['Quote No.']);
      }
  }, [viewMode, selectedQuotationId, filteredData]);

  const allColumns = useMemo<ColumnDef<Quotation>[]>(() => [
    {
      accessorKey: 'Quote No.',
      header: 'Quote No.',
      isSortable: true,
      cell: (value: string, row) => (
        <div className="font-semibold text-slate-800">
           <FileLinkCell
              fileFormula={row.File}
              sheetId={quotationSheetId}
              label={value}
            />
        </div>
      )
    },
    {
      accessorKey: 'Quote Date',
      header: 'Quote Date',
      isSortable: true,
      cell: (value: string) => {
        const date = parseDate(value);
        return date ? formatDateAsMDY(date) : <span className="text-slate-400 italic">N/A</span>;
      }
    },
    {
      accessorKey: 'Company Name',
      header: 'Company Name',
      isSortable: true,
      cell: (value: string) => (
         <button
          onClick={(e) => {
            e.stopPropagation();
            if(value) handleNavigation({ view: 'companies', filter: value });
          }}
          className="group font-semibold text-base text-slate-800 hover:underline transition-colors inline-flex items-center gap-1.5 text-left"
          aria-label={`View company: ${value}`}
        >
          {value}
        </button>
      )
    },
     {
      accessorKey: 'Contact Name',
      header: 'Contact Name',
      isSortable: true,
      cell: (value: string) => (
         <button
          onClick={(e) => {
            e.stopPropagation();
            if(value) handleNavigation({ view: 'contacts', filter: value });
          }}
          className="group font-medium text-slate-800 hover:underline transition-colors inline-flex items-center gap-1.5 text-left"
          aria-label={`View contact: ${value}`}
        >
          {value}
        </button>
      )
    },
    { 
      accessorKey: 'Amount', 
      header: 'Amount', 
      isSortable: true, 
      cell: (value: string, row: Quotation) => {
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
    { accessorKey: 'Status', header: 'Status', isSortable: true, cell: (value: Quotation['Status']) => <StatusBadge status={value} /> },
    {
      accessorKey: 'Created By',
      header: 'Created By',
      isSortable: true,
      cell: (value: string) => <span className="font-medium text-slate-800">{value}</span>
    },
  ], [handleNavigation, quotationSheetId]);
  
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem(QUOTATION_COLUMNS_VISIBILITY_KEY);
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
    const saved = localStorage.getItem(QUOTATION_COLUMNS_VISIBILITY_KEY);
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
        localStorage.setItem(QUOTATION_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
      } catch (e) {
        console.error("Failed to save visible columns to storage", e);
      }
      return newSet;
    });
  };

  const displayedColumns = useMemo(() => {
    return allColumns.filter(c => c.accessorKey && visibleColumns.has(c.accessorKey as string));
  }, [allColumns, visibleColumns]);

  const kanbanColumns = useMemo<KanbanColumn<Quotation>[]>(() => {
    const statuses: Quotation['Status'][] = ['Open', 'Close (Win)', 'Close (Lose)', 'Cancel'];
    const statusColors: { [key in Quotation['Status']]: 'sky' | 'emerald' | 'rose' | 'violet' } = {
        'Open': 'sky',
        'Close (Win)': 'emerald',
        'Close (Lose)': 'rose',
        'Cancel': 'violet',
    };

    return statuses.map(status => ({
        id: status,
        title: status,
        color: statusColors[status],
        items: filteredData.filter(q => q.Status === status),
        renderHeader: (items: Quotation[]) => {
             const { totalUSD, totalKHR } = items.reduce((acc, item) => {
                const value = parseSheetValue(item.Amount);
                const determinedCurrency = determineCurrency(value, item.Currency);
                if (determinedCurrency === 'KHR') {
                    acc.totalKHR += value;
                } else {
                    acc.totalUSD += value;
                }
                return acc;
            }, { totalUSD: 0, totalKHR: 0 });

            const formatOptions = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
            const usdStr = totalUSD > 0 ? totalUSD.toLocaleString('en-US', { style: 'currency', currency: 'USD', ...formatOptions }) : '';
            const khrStr = totalKHR > 0 ? `៛${totalKHR.toLocaleString('en-US', formatOptions)}` : '';

            if (usdStr && khrStr) {
                return (
                    <div>
                        <span className="text-lg font-bold text-slate-800 block">{usdStr}</span>
                        <span className="text-base font-bold text-slate-600 block">{khrStr}</span>
                    </div>
                );
            }
            
            const singleValue = usdStr || khrStr || '$0';

            return (
                <span className="text-xl font-bold text-slate-800">
                    {singleValue}
                </span>
            );
        }
    }));
  }, [filteredData]);

  const renderKanbanCard = (item: Quotation) => {
    const quoteDate = parseDate(item['Quote Date']);
    let ageText = '';
    if (quoteDate) {
        const diffTime = new Date().getTime() - quoteDate.getTime();
        const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        ageText = `${diffDays}d ago`;
    }
    
    const formattedValue = formatCurrencySmartly(item.Amount, item.Currency);

    return (
        <>
            <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <ItemActionsMenu
                    onView={() => handleViewQuotation(item)}
                    onEdit={() => handleEditQuotation(item)}
                    onDelete={() => handleDeleteRequest(item)}
                />
            </div>
            <h4 className="font-bold text-slate-900 pr-8 text-base group-hover:text-brand-700 transition-colors">{item['Company Name']}</h4>
            <p className="text-sm text-slate-500 font-mono">{item['Quote No.']}</p>
            
            <p className="text-lg font-semibold text-brand-800 mt-2">
                {formattedValue}
            </p>

            <p className="text-sm text-slate-600 mt-2.5 line-clamp-1">Contact: {item['Contact Name']}</p>
            
            <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500" title={`Created by ${item['Created By']}`}>
                    <span>By {item['Created By']}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500" title={`Created on ${quoteDate?.toLocaleDateString()}`}>
                    <span>{ageText}</span>
                </div>
            </div>
        </>
    );
  };
  
  const renderDetailView = () => (
    <div className="flex flex-col md:flex-row h-full bg-white">
        <aside className="w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col">
            <QuotationListContainer
                quotations={filteredData}
                selectedQuotationId={selectedQuotationId}
                onSelectQuotation={setSelectedQuotationId}
                loading={loading && !quotations}
            />
        </aside>
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto bg-slate-50">
            {loading && !selectedQuotationForDetail ? <Spinner /> : selectedQuotationForDetail ? (
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{selectedQuotationForDetail['Company Name']}</h1>
                        <p className="text-slate-600 font-mono mt-1">{selectedQuotationForDetail['Quote No.']}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button 
                            onClick={() => handleEditQuotation(selectedQuotationForDetail)}
                            className="text-sm font-semibold text-brand-600 hover:underline flex items-center gap-1.5"
                        >
                           <Pencil className="w-4 h-4" /> Edit
                        </button>
                        {selectedQuotationForDetail.Status === 'Close (Win)' && (
                            <button onClick={() => handleCreateSaleOrder(selectedQuotationForDetail)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-lg transition shadow-sm flex items-center gap-2 text-sm">
                                <ShoppingCart className="w-4 h-4" />
                                Create SO
                            </button>
                        )}
                    </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <dt className="text-sm font-medium text-gray-500">Total Amount</dt>
                            <dd className="mt-1 text-xl font-semibold text-gray-900">{formatCurrencySmartly(selectedQuotationForDetail.Amount, selectedQuotationForDetail.Currency)}</dd>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <dt className="text-sm font-medium text-gray-500">Status</dt>
                            <dd className="mt-1"><StatusBadge status={selectedQuotationForDetail.Status}/></dd>
                        </div>
                    </div>

                    <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <DetailItem label="Quote Date" value={formatDisplayDate(selectedQuotationForDetail['Quote Date'])} />
                        <DetailItem label="Validity Date" value={formatDisplayDate(selectedQuotationForDetail['Validity Date'])} />
                        <DetailItem label="Contact Person" value={selectedQuotationForDetail['Contact Name']} />
                        <DetailItem label="Contact Number" value={selectedQuotationForDetail['Contact Number']} />
                        <DetailItem label="Payment Term" value={selectedQuotationForDetail['Payment Term']} />
                        <DetailItem label="Stock Status" value={selectedQuotationForDetail['Stock Status']} />
                        <DetailItem label="Created By" value={selectedQuotationForDetail['Created By']} />
                        <DetailItem label="Reason" value={selectedQuotationForDetail.Reason} />
                    </dl>
                </div>
            </div>
            ) : (
            <div className="h-full flex items-center justify-center">
                <EmptyState illustration={<Info className="w-16 h-16 text-slate-300" />}>
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">Select a Quotation</h3>
                    <p className="mt-1 text-sm text-gray-500">Choose a quotation from the list to see its details.</p>
                </EmptyState>
            </div>
            )}
        </main>
    </div>
  );

  if (isCreating) {
    return <QuotationCreator onBack={handleBackToDashboard} existingQuotation={selectedQuotationToEdit} />;
  }

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
          <p className="font-bold">Error</p>
          <p>Could not load quotations data: {error}</p>
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

  return (
    <div className="h-full flex flex-col bg-slate-50">
        <div className="p-6 flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50 border-b border-slate-200">
            <MetricCard title="Total Quotations" value={metrics.total.toString()} change="" changeType="increase" icon={<FileText />} isCompact/>
            <MetricCard title="Total Quoted Value" value={mainValue} subValue={subValue} change="" changeType="increase" icon={<DollarSign />} isCompact/>
            <MetricCard title="Approval Rate" value={`${metrics.approvalRate.toFixed(0)}%`} change="" changeType="increase" icon={<CheckCircle />} isCompact/>
        </div>

        <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between sm:items-center flex-wrap gap-4 bg-white border-b border-slate-200">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-gray-900">All Quotations</h2>
                <button
                    onClick={handleNewQuotation}
                    className="flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-3 rounded-lg transition duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-px"
                >
                    <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    <span className="hidden sm:inline">New Quotation</span>
                </button>
            </div>
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                    <label htmlFor="datatable-search" className="sr-only">Search</label>
                    <input
                      id="datatable-search"
                      type="text"
                      placeholder="Search quotations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-white border border-gray-300 text-gray-800 placeholder-gray-400 text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 p-2.5 transition"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <ViewToggle<ViewMode> views={VIEW_OPTIONS} activeView={viewMode} onViewChange={setViewMode} />
                {viewMode === 'table' && (
                    <DataTableColumnToggle
                        allColumns={allColumns}
                        visibleColumns={visibleColumns}
                        onColumnToggle={handleColumnToggle}
                    />
                )}
            </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
             {viewMode === 'table' ? (
                <div className="bg-white h-full">
                    <DataTable
                        tableId="quotation-table"
                        data={filteredData}
                        columns={displayedColumns}
                        loading={loading}
                        onRowClick={handleViewQuotation}
                        initialSort={{ key: 'Quote Date', direction: 'descending' }}
                    />
                </div>
            ) : viewMode === 'board' ? (
                <KanbanView<Quotation>
                    columns={kanbanColumns}
                    onCardClick={handleViewQuotation}
                    renderCardContent={renderKanbanCard}
                    loading={loading}
                    onItemMove={handleItemMove}
                    getItemId={(item) => item['Quote No.']}
                />
            ) : (
                renderDetailView()
            )}
        </div>
        <ConfirmationModal 
            isOpen={!!quotationToDelete}
            onClose={() => setQuotationToDelete(null)}
            onConfirm={handleConfirmDelete}
            title="Delete Quotation"
            confirmText="Delete"
        >
           Are you sure you want to delete quotation "{quotationToDelete?.['Quote No.']}"? This action cannot be undone.
        </ConfirmationModal>
    </div>
  );
};

export default QuotationDashboard;
