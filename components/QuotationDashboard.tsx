
import React, { useState, useMemo, useEffect } from 'react';
import { Quotation } from '../types';
import { useB2BData } from '../hooks/useB2BData';
import DataTable, { ColumnDef } from './DataTable';
import { parseDate, formatDateAsMDY, formatDisplayDate } from '../utils/time';
import QuotationCreator from './QuotationCreator';
import { useNavigation } from '../contexts/NavigationContext';
import { QUOTATION_SHEET_ID } from '../constants';
import MetricCard from './MetricCard';
import { parseSheetValue, formatCurrencySmartly, determineCurrency } from '../utils/formatters';
import { FileText, DollarSign, CheckCircle, ShoppingCart, LayoutGrid, Table, Columns, Info, Pencil, Search, ArrowRightToLine, WrapText, Scissors, Trash2 } from 'lucide-react';
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
import { useWindowSize } from '../hooks/useWindowSize';
import { ScrollArea } from './ui/scroll-area';

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

const QuotationMobileCard: React.FC<{ quotation: Quotation, onView: () => void }> = ({ quotation, onView }) => {
  let statusClass = 'mobile-status-default';
  if (quotation.Status === 'Open') statusClass = 'mobile-status-info';
  if (quotation.Status === 'Close (Win)') statusClass = 'mobile-status-success';
  if (quotation.Status === 'Close (Lose)') statusClass = 'mobile-status-danger';
  if (quotation.Status === 'Cancel') statusClass = 'mobile-status-default';

  return (
    <div className="mobile-card" onClick={onView} role="button" tabIndex={0}>
      <div className="mobile-card-header">
        <div>
          <div className="mobile-card-title">{quotation['Company Name']}</div>
          <div className="mobile-card-subtitle">{quotation['Quote No.']}</div>
        </div>
        <span className={`mobile-status ${statusClass}`}>
          <span className="mobile-status-dot"></span>
          {quotation.Status.replace('(Win)', '').replace('(Lose)', '')}
        </span>
      </div>
      <div className="mobile-card-body">
        <div className="mobile-card-row">
          <span className="mobile-card-label">Amount</span>
          <span className="mobile-card-value">{formatCurrencySmartly(quotation.Amount, quotation.Currency)}</span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-label">Date</span>
          <span className="mobile-card-value">{formatDateAsMDY(parseDate(quotation['Quote Date'])!)}</span>
        </div>
      </div>
    </div>
  );
};

interface QuotationDashboardProps {
  initialPayload?: {
    action: 'create';
    initialData: Partial<Quotation>;
  };
}

const QuotationDashboard: React.FC<QuotationDashboardProps> = ({ initialPayload }) => {
  const { quotations, setQuotations, loading, error } = useB2BData();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedQuotationToEdit, setSelectedQuotationToEdit] = useState<Quotation | null>(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>('Quote Pending');
  const { handleNavigation } = useNavigation();
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('overflow');
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const { width } = useWindowSize();
  const isMobile = width < 1024; // lg breakpoint

  useEffect(() => {
    if (initialPayload?.action === 'create') {
      setIsCreating(true);
      setSelectedQuotationToEdit(null);
    }
  }, [initialPayload]);

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
    if (isMobile) {
      handleEditQuotation(quotation); // On mobile, viewing is editing
    } else {
      setSelectedQuotationId(quotation['Quote No.']);
      setViewMode('detail');
    }
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
    if (initialPayload) {
      handleNavigation({ view: 'quotations' });
    }
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
    let dataToFilter = quotations || [];

    if (statusFilter) {
      dataToFilter = dataToFilter.filter(item => {
        if (statusFilter === 'Quote Pending') return item.Status === 'Open';
        if (statusFilter === 'Quote (Win)') return item.Status === 'Close (Win)';
        if (statusFilter === 'Quote (Lose)') return item.Status === 'Close (Lose)';
        if (statusFilter === 'Cancel') return item.Status === 'Cancel';
        return true;
      });
    }

    if (!searchQuery) return dataToFilter;

    return dataToFilter.filter(item =>
      ['Quote No.', 'Company Name', 'Contact Name', 'Status', 'Reason'].some(key =>
        String(item[key as keyof Quotation] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [quotations, searchQuery, statusFilter]);

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
          {value}
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
            if (value) handleNavigation({ view: 'companies', filter: value });
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
            if (value) handleNavigation({ view: 'contacts', filter: value });
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
    {
      accessorKey: 'Tax Type',
      header: 'Taxable',
      isSortable: true,
      cell: (value: string | undefined) => {
        if (!value) return <span className="text-slate-400">-</span>;
        return <span className="font-medium text-slate-600">{value}</span>;
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
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleEditQuotation(selectedQuotationForDetail)}
                      className="text-sm font-semibold text-brand-600 hover:underline flex items-center gap-1.5"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(selectedQuotationForDetail)}
                      className="text-sm font-semibold text-rose-600 hover:underline flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
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
                  <dd className="mt-1"><StatusBadge status={selectedQuotationForDetail.Status} /></dd>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <DetailItem label="Quote Date" value={formatDisplayDate(selectedQuotationForDetail['Quote Date'])} />
                <DetailItem label="Validity Date" value={formatDisplayDate(selectedQuotationForDetail['Validity Date'])} />
                <DetailItem label="Contact Person" value={selectedQuotationForDetail['Contact Name']} />
                <DetailItem label="Contact Number" value={selectedQuotationForDetail['Contact Number']} />
                <DetailItem label="Payment Term" value={selectedQuotationForDetail['Payment Term']} />
                <DetailItem label="Stock Status" value={selectedQuotationForDetail['Stock Status']} />
                <DetailItem label="Taxable" value={selectedQuotationForDetail['Tax Type']} />
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
    return (
      <QuotationCreator
        onBack={handleBackToDashboard}
        existingQuotation={selectedQuotationToEdit}
        initialData={initialPayload?.action === 'create' ? initialPayload.initialData : undefined}
      />
    );
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

  if (isMobile) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 space-y-4">
          <div className="mobile-search">
            <Search className="mobile-search-icon w-5 h-5" />
            <input
              type="text"
              className="mobile-search-input"
              placeholder="Search quotations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={handleNewQuotation}
            className="w-full flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 shadow-sm"
          >
            + New Quotation
          </button>
        </div>
        <ScrollArea className="flex-1 px-4">
          {loading ? <Spinner /> : filteredData.length > 0 ? (
            filteredData.map(quotation => (
              <QuotationMobileCard key={quotation['Quote No.']} quotation={quotation} onView={() => handleViewQuotation(quotation)} />
            ))
          ) : (
            <EmptyState>No quotations found.</EmptyState>
          )}
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-900">Quote Record</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search quotations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-700 placeholder-slate-400 text-sm rounded-md pl-10 pr-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition shadow-sm"
            />
            <Search className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === 'table' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Table className="w-4 h-4" />
              <span className="hidden lg:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === 'board' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden lg:inline">Board</span>
            </button>
            <button
              onClick={() => setViewMode('detail')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === 'detail' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Columns className="w-4 h-4" />
              <span className="hidden lg:inline">Detail</span>
            </button>
          </div>

          {/* Alignment/Wrap Icons */}
          <div className="flex items-center bg-white border border-slate-200 rounded-md shadow-sm">
            <button onClick={() => setCellWrapStyle('overflow')} className={`p-2 rounded-l-md hover:bg-slate-50 transition ${cellWrapStyle === 'overflow' ? 'text-brand-600 bg-brand-50' : 'text-slate-500'}`}>
              <ArrowRightToLine className="w-4 h-4" />
            </button>
            <button onClick={() => setCellWrapStyle('wrap')} className={`p-2 hover:bg-slate-50 transition border-x border-slate-200 ${cellWrapStyle === 'wrap' ? 'text-brand-600 bg-brand-50' : 'text-slate-500'}`}>
              <WrapText className="w-4 h-4" />
            </button>
            <button onClick={() => setCellWrapStyle('clip')} className={`p-2 rounded-r-md hover:bg-slate-50 transition ${cellWrapStyle === 'clip' ? 'text-brand-600 bg-brand-50' : 'text-slate-500'}`}>
              <Scissors className="w-4 h-4" />
            </button>
          </div>

          {/* Column Toggle / View Options */}
          <DataTableColumnToggle
            allColumns={allColumns}
            visibleColumns={visibleColumns}
            onColumnToggle={handleColumnToggle}
            trigger={
              <button className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-md hover:bg-slate-50 transition shadow-sm text-sm">
                <LayoutGrid className="w-4 h-4" />
                View
              </button>
            }
          />

          {/* New Quotation Button */}
          <button
            onClick={handleNewQuotation}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-md transition shadow-md whitespace-nowrap text-sm"
          >
            <span className="text-xl leading-none">+</span> New Quotation
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-white">
        {viewMode === 'table' ? (
          <DataTable
            tableId="quotation-table"
            data={filteredData}
            columns={displayedColumns}
            loading={loading}
            onRowClick={handleViewQuotation}
            initialSort={{ key: 'Quote Date', direction: 'descending' }}
            mobilePrimaryColumns={['Quote No.', 'Company Name', 'Amount', 'Status']}
            cellWrapStyle={cellWrapStyle}
            renderRowActions={(row) => (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditQuotation(row);
                  }}
                  className="p-2.5 text-slate-400 hover:text-brand-600 transition hover:bg-brand-50 rounded-full"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRequest(row);
                  }}
                  className="p-2.5 text-slate-400 hover:text-rose-600 transition hover:bg-rose-50 rounded-full"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          />
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

      <footer className="flex-shrink-0 bg-white border-t border-slate-200 p-3 flex items-center gap-3">


        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setStatusFilter(statusFilter === 'Quote Pending' ? null : 'Quote Pending')}
            className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Quote Pending' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            Quote Pending
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Quote (Win)' ? null : 'Quote (Win)')}
            className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Quote (Win)' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            Quote (Win)
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Quote (Lose)' ? null : 'Quote (Lose)')}
            className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Quote (Lose)' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            Quote (Lose)
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Cancel' ? null : 'Cancel')}
            className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Cancel' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            Cancel
          </button>
        </div>
      </footer>

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

export default React.memo(QuotationDashboard);