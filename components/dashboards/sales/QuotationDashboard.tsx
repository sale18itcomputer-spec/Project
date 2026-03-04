'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Quotation } from "../../../types";
import { useB2BData } from "../../../hooks/useB2BData";
import DataTable, { ColumnDef } from "../../common/DataTable";
import { parseDate, formatDateAsMDY, formatDisplayDate } from "../../../utils/time";
import QuotationCreator from "../../features/sales/QuotationCreator";
import { useNavigation } from "../../../contexts/NavigationContext";
import { parseSheetValue, formatCurrencySmartly, determineCurrency } from "../../../utils/formatters";
import { ShoppingCart, LayoutGrid, Table, Columns, Info, Pencil, Search, ArrowRightToLine, WrapText, Scissors, Trash2 } from 'lucide-react';
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import KanbanView, { KanbanColumn } from "../views/KanbanView";
import { useToast } from "../../../contexts/ToastContext";
import { deleteRecord, updateRecord } from "../../../services/api";
import ConfirmationModal from "../../modals/ConfirmationModal";
import ItemActionsMenu from "../../common/ItemActionsMenu";
import QuotationListContainer from "../lists/QuotationListContainer";
import Spinner from "../../common/Spinner";
import EmptyState from "../../common/EmptyState";
import { useWindowSize } from "../../../hooks/useWindowSize";
import { localStorageGet, localStorageSet } from '../../../utils/storage';

const StatusBadge: React.FC<{ status: Quotation['Status'] }> = ({ status }) => {
  const statusConfig: { [key in Quotation['Status'] | string]: { bg: string; text: string } } = {
    'Open': { bg: 'bg-sky-500/10', text: 'text-sky-500' },
    'Close (Win)': { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
    'Close (Lose)': { bg: 'bg-rose-500/10', text: 'text-rose-500' },
    'Cancel': { bg: 'bg-violet-500/10', text: 'text-violet-500' },
  };

  const config = statusConfig[status] || { bg: 'bg-muted', text: 'text-muted-foreground' };

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
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
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
          <span className="mobile-card-value">{formatDisplayDate(quotation['Quote Date'])}</span>
        </div>
      </div>
    </div>
  );
};

interface QuotationDashboardProps {
  initialPayload?: {
    action: 'create' | 'edit' | 'view';
    initialData?: Partial<Quotation>;
    data?: Quotation;
  } | Quotation; // Also support direct Quotation object for backward compatibility
}

const QuotationDashboard: React.FC<QuotationDashboardProps> = ({ initialPayload }) => {
  const { quotations, setQuotations, loading, error, isB2B } = useB2BData();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>('Quote Pending');
  const { handleNavigation, navigation } = useNavigation();
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('wrap');
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const { width } = useWindowSize();
  const isMobile = width < 1024; // lg breakpoint

  const isCreating = navigation.action === 'create' || navigation.action === 'edit';

  const selectedQuotationId = useMemo(() => {
    if (navigation.action === 'view') return navigation.id || null;
    if (initialPayload && (initialPayload as any).action === 'view' && (initialPayload as any).data) return (initialPayload as any).data['Quote No.'];
    return null;
  }, [navigation.action, navigation.id, initialPayload]);

  const selectedQuotationToEdit = useMemo(() => {
    if (navigation.action === 'edit' && navigation.id && quotations) {
      return quotations.find(q => q['Quote No.'] === navigation.id) || null;
    }
    if (initialPayload && 'Quote No.' in (initialPayload as any)) {
      return initialPayload as Quotation; // backward compatibility
    }
    if (initialPayload && (initialPayload as any).action === 'edit' && (initialPayload as any).data) {
      return (initialPayload as any).data;
    }
    return null;
  }, [navigation.action, navigation.id, quotations, initialPayload]);

  useEffect(() => {
    if (navigation.action === 'view') {
      setViewMode('detail');
    }
  }, [navigation.action]);


  const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'table', label: 'Table', icon: <Table /> },
    { id: 'board', label: 'Board', icon: <LayoutGrid /> },
    { id: 'detail', label: 'Detail', icon: <Columns /> },
  ];

  const handleNewQuotation = () => {
    handleNavigation({ view: 'quotations', filter: navigation.filter, action: 'create' });
  };

  const handleEditQuotation = (quotation: Quotation) => {
    handleNavigation({ view: 'quotations', filter: navigation.filter, action: 'edit', id: quotation['Quote No.'] });
  };

  const handleViewQuotation = (quotation: Quotation) => {
    if (isMobile) {
      handleEditQuotation(quotation); // On mobile, viewing is editing
    } else {
      handleNavigation({ view: 'quotations', filter: navigation.filter, action: 'view', id: quotation['Quote No.'] });
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
      const tableName = isB2B ? 'b2b_quotations' : 'Quotations';
      await deleteRecord(tableName, quoteToDeleteId);
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

    setQuotations(current => {
      if (!current) return null;
      return current.map(q =>
        q['Quote No.'] === quoteNo ? { ...q, Status: newStatus as Quotation['Status'] } : q
      );
    });

    try {
      const tableName = isB2B ? 'b2b_quotations' : 'Quotations';
      await updateRecord(tableName, quoteNo, { 'Status': newStatus });
      addToast('Quotation moved successfully!', 'success');
    } catch (err) {
      console.error("Failed to update status:", err);
      addToast('Failed to move quotation. Reverting change.', 'error');
      setQuotations(originalQuotations);
    }
  };

  const handleCreateSaleOrder = (quotation: Quotation) => {
    handleNavigation({ view: 'sale-orders', payload: { action: 'create', initialData: { 'Company Name': quotation['Company Name'] }, quote: quotation } });
  };

  const handleBackToDashboard = () => {
    handleNavigation({ view: 'quotations', filter: navigation.filter });
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
    let targetId = selectedQuotationId;
    if (viewMode === 'detail' && !targetId && filteredData.length > 0) {
      targetId = filteredData[0]['Quote No.'];
    }
    if (!targetId) return null;
    return filteredData.find(q => q['Quote No.'] === targetId) || null;
  }, [selectedQuotationId, filteredData, viewMode]);

  const allColumns = useMemo<ColumnDef<Quotation>[]>(() => [
    {
      accessorKey: 'Quote No.',
      header: 'Quote No.',
      isSortable: true,
      cell: (value: string, row) => (
        <div className="font-semibold text-muted-foreground/80">
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
        return date ? formatDateAsMDY(date) : <span className="text-muted-foreground italic">N/A</span>;
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
          className="group font-semibold text-base text-foreground hover:underline transition-colors inline-flex items-center gap-1.5 text-left"
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
          className="group font-medium text-foreground hover:underline transition-colors inline-flex items-center gap-1.5 text-left"
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
          return <span className="text-muted-foreground text-right block w-full">-</span>;
        }
        return (
          <span className="text-sm font-medium text-foreground text-right block w-full">
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
        if (!value) return <span className="text-muted-foreground">-</span>;
        return <span className="font-medium text-foreground">{value}</span>;
      }
    },
    { accessorKey: 'Status', header: 'Status', isSortable: true, cell: (value: Quotation['Status']) => <StatusBadge status={value} /> },
    {
      accessorKey: 'Created By',
      header: 'Created By',
      isSortable: true,
      cell: (value: string) => <span className="font-medium text-foreground">{value}</span>
    },
  ], [handleNavigation]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorageGet(QUOTATION_COLUMNS_VISIBILITY_KEY);
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
    const saved = localStorageGet(QUOTATION_COLUMNS_VISIBILITY_KEY);
    if (!saved && allColumns.length > 0) {
      setVisibleColumns(new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean)));
    }
  }, [allColumns]);

  const handleColumnToggle = (columnKey: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnKey)) {
        if (newSet.size > 1) {
          newSet.delete(columnKey);
        }
      } else {
        newSet.add(columnKey);
      }
      try {
        localStorageSet(QUOTATION_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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
              <span className="text-lg font-bold text-foreground block">{usdStr}</span>
              <span className="text-base font-bold text-muted-foreground block">{khrStr}</span>
            </div>
          );
        }

        const singleValue = usdStr || khrStr || '$0';

        return (
          <span className="text-xl font-bold text-foreground">
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
        <h4 className="font-bold text-foreground pr-8 text-base group-hover:text-brand-600 transition-colors">{item['Company Name']}</h4>
        <p className="text-sm text-muted-foreground font-mono">{item['Quote No.']}</p>

        <p className="text-lg font-semibold text-brand-600 dark:text-brand-400 mt-2">
          {formattedValue}
        </p>

        <p className="text-sm text-muted-foreground mt-2.5 line-clamp-1">Contact: {item['Contact Name']}</p>

        <div className="flex justify-between items-end mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title={`Created by ${item['Created By']}`}>
            <span>By {item['Created By']}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title={`Created on ${quoteDate?.toLocaleDateString()}`}>
            <span>{ageText}</span>
          </div>
        </div>
      </>
    );
  };

  const renderDetailView = () => (
    <div className="flex flex-col md:flex-row h-full bg-background">
      <aside className="w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col">
        <QuotationListContainer
          quotations={filteredData}
          selectedQuotationId={selectedQuotationForDetail?.['Quote No.'] || null}
          onSelectQuotation={(id) => handleNavigation({ view: 'quotations', filter: navigation.filter, action: 'view', id })}
          loading={loading && !quotations}
        />
      </aside>
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto bg-background">
        {loading && !selectedQuotationForDetail ? <Spinner /> : selectedQuotationForDetail ? (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{selectedQuotationForDetail['Company Name']}</h1>
                  <p className="text-muted-foreground font-mono mt-1">{selectedQuotationForDetail['Quote No.']}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleEditQuotation(selectedQuotationForDetail)}
                      className="text-sm font-semibold text-brand-500 hover:underline flex items-center gap-1.5"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(selectedQuotationForDetail)}
                      className="text-sm font-semibold text-rose-500 hover:underline flex items-center gap-1.5"
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
                <div className="bg-muted/50 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-muted-foreground/60">Total Amount</dt>
                  <dd className="mt-1 text-xl font-semibold text-brand-500">{formatCurrencySmartly(selectedQuotationForDetail.Amount, selectedQuotationForDetail.Currency)}</dd>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-muted-foreground/60">Status</dt>
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
            <EmptyState illustration={<Info className="w-16 h-16 text-muted-foreground/20" />}>
              <h3 className="mt-2 text-sm font-semibold text-foreground">Select a Quotation</h3>
              <p className="mt-1 text-sm text-muted-foreground">Choose a quotation from the list to see its details.</p>
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
        initialData={initialPayload?.action === 'create' ? (initialPayload as any).initialData : undefined}
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



  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center justify-between lg:justify-start gap-4">
          <div className="flex items-center">
            <span className="text-lg font-semibold text-foreground">{filteredData.length}</span>
            <span className="ml-2 text-sm text-muted-foreground">quotations</span>
          </div>
          <div className="lg:hidden">
            {/* Spacer or mobile specific header action if needed */}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto mt-2 lg:mt-0">
          <div className="relative w-full lg:w-64 flex-shrink-0">
            <label htmlFor="quotation-search" className="sr-only">Search</label>
            <input
              id="quotation-search"
              type="text"
              placeholder="Search quotations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-muted border-transparent text-foreground placeholder-muted-foreground text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 p-2.5 transition"
            />
            <Search className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border flex-shrink-0">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === 'table' ? 'bg-background text-brand-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Table className="w-4 h-4" />
                <span className="hidden xl:inline">Table</span>
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === 'board' ? 'bg-background text-brand-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden xl:inline">Board</span>
              </button>
              <button
                onClick={() => setViewMode('detail')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === 'detail' ? 'bg-background text-brand-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Columns className="w-4 h-4" />
                <span className="hidden xl:inline">Detail</span>
              </button>
            </div>

            {/* Alignment/Wrap Icons */}
            <div className="flex items-center bg-card border border-border rounded-md shadow-sm flex-shrink-0">
              <button onClick={() => setCellWrapStyle('overflow')} className={`p-2 rounded-l-md hover:bg-muted transition ${cellWrapStyle === 'overflow' ? 'text-brand-600 bg-brand-500/10' : 'text-muted-foreground'}`}>
                <ArrowRightToLine className="w-4 h-4" />
              </button>
              <button onClick={() => setCellWrapStyle('wrap')} className={`p-2 hover:bg-muted transition border-x border-border ${cellWrapStyle === 'wrap' ? 'text-brand-600 bg-brand-500/10' : 'text-muted-foreground'}`}>
                <WrapText className="w-4 h-4" />
              </button>
              <button onClick={() => setCellWrapStyle('clip')} className={`p-2 rounded-r-md hover:bg-muted transition ${cellWrapStyle === 'clip' ? 'text-brand-600 bg-brand-500/10' : 'text-muted-foreground'}`}>
                <Scissors className="w-4 h-4" />
              </button>
            </div>

            {/* Column Toggle */}
            <div className="flex-shrink-0">
              <DataTableColumnToggle
                allColumns={allColumns}
                visibleColumns={visibleColumns}
                onColumnToggle={handleColumnToggle}
              />
            </div>

            {/* New Quotation Button */}
            <button
              onClick={handleNewQuotation}
              className="flex-shrink-0 flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-md whitespace-nowrap text-sm ml-auto lg:ml-0"
            >
              <span className="text-xl leading-none">+</span> New
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden bg-background p-4">
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
                  className="p-2.5 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRequest(row);
                  }}
                  className="p-2.5 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full"
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

      <footer className="flex-shrink-0 bg-card border-t border-border p-3">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar w-full custom-scrollbar-hide">
          <button
            onClick={() => setStatusFilter(statusFilter === 'Quote Pending' ? null : 'Quote Pending')}
            className={`flex-shrink-0 whitespace-nowrap px-4 lg:px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Quote Pending' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Quote Pending
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Quote (Win)' ? null : 'Quote (Win)')}
            className={`flex-shrink-0 whitespace-nowrap px-4 lg:px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Quote (Win)' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Quote (Win)
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Quote (Lose)' ? null : 'Quote (Lose)')}
            className={`flex-shrink-0 whitespace-nowrap px-4 lg:px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Quote (Lose)' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
          >
            Quote (Lose)
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'Cancel' ? null : 'Cancel')}
            className={`flex-shrink-0 whitespace-nowrap px-4 lg:px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Cancel' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
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
        variant="danger"
      >
        Are you sure you want to delete quotation "{quotationToDelete?.['Quote No.']}"? This action cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

export default React.memo(QuotationDashboard);
