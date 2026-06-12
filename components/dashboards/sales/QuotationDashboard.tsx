'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Quotation } from "../../../types";
import { useB2BData } from "../../../hooks/useB2BData";
import DataTable, { ColumnDef } from "../../common/DataTable";
import { parseDate, formatDateAsMDY, formatDisplayDate } from "../../../utils/time";
import QuotationCreator from "../../features/sales/QuotationCreator";
import { useNavigation } from "../../../contexts/NavigationContext";
import { formatCurrencySmartly } from "../../../utils/formatters";
import { ShoppingCart, Table, Columns, Info, Pencil, Search, ArrowRightToLine, WrapText, Scissors, Trash2, Copy, Loader2, Send } from 'lucide-react';
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { useToast } from "../../../contexts/ToastContext";
import { deleteRecord } from "../../../services/api";
import ConfirmationModal from "../../modals/ConfirmationModal";
import QuotationListContainer from "../lists/QuotationListContainer";
import Spinner from "../../common/Spinner";
import EmptyState from "../../common/EmptyState";
import { useWindowSize } from "../../../hooks/useWindowSize";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { readQuotationSheetData } from '../../../services/b2bDb';
import { sendQuotationToTelegram } from '../../../utils/telegram';
import RowActionMenuItems from "../../common/RowActionMenuItems";
import { DropdownMenuItem } from "../../ui/dropdown-menu";

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

type ViewMode = 'table' | 'detail';


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
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('nowrap' as any);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width < 1024; // lg breakpoint

  const isCreating = navigation.action === 'create' || navigation.action === 'edit';

  const selectedQuotationId = useMemo(() => {
    if (navigation.action === 'view') return navigation.id || null;
    if (initialPayload && (initialPayload as any).action === 'view' && (initialPayload as any).data) return (initialPayload as any).data['Quote No'];
    return null;
  }, [navigation.action, navigation.id, initialPayload]);

  const selectedQuotationToEdit = useMemo(() => {
    if (navigation.action === 'edit' && navigation.id && quotations) {
      return quotations.find(q => q['Quote No'] === navigation.id) || null;
    }
    if (initialPayload && 'Quote No' in (initialPayload as any)) {
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


  const handleNewQuotation = () => {
    handleNavigation({ view: 'quotations', filter: navigation.filter, action: 'create' });
  };

  const handleEditQuotation = (quotation: Quotation) => {
    handleNavigation({ view: 'quotations', filter: navigation.filter, action: 'edit', id: quotation['Quote No'] });
  };

  const handleViewQuotation = (quotation: Quotation) => {
    if (isMobile) {
      handleEditQuotation(quotation); // On mobile, viewing is editing
    } else {
      handleNavigation({ view: 'quotations', filter: navigation.filter, action: 'view', id: quotation['Quote No'] });
    }
  };

  const handleDeleteRequest = (quotation: Quotation) => {
    setQuotationToDelete(quotation);
  };

  const handleConfirmDelete = async () => {
    if (!quotationToDelete) return;

    const originalQuotations = quotations ? [...quotations] : [];
    const quoteToDeleteId = quotationToDelete['Quote No'];
    setQuotationToDelete(null);
    setQuotations(current => current ? current.filter(q => q['Quote No'] !== quoteToDeleteId) : null);

    try {
      await deleteRecord('Quotations', quoteToDeleteId, isB2B);
      addToast('Quotation deleted!', 'success');
    } catch {
      addToast('Failed to delete quotation.', 'error');
      setQuotations(originalQuotations);
    }
  };

  const handleCreateSaleOrder = (quotation: Quotation) => {
    // Pass action at the top-level so navigation.action === 'create' in the URL.
    // Pass the quotation directly as payload so SaleOrderDashboard's Case 1
    // field mapping (initialPayload['Quote No']) resolves correctly.
    handleNavigation({ view: 'sale-orders', action: 'create', payload: quotation });
  };

  const handleDuplicateQuotation = async (quotation: Quotation) => {
    setIsDuplicating(true);
    try {
      // Fetch full quotation data (including items) from DB
      const { items } = await readQuotationSheetData(quotation['Quote No'], isB2B);
      // Store items in sessionStorage to pass to creator without URL length limits
      sessionStorage.setItem('duplicate_quotation_items', JSON.stringify(items));
      // Navigate to create with header fields as initialData (Quote No. will be auto-generated)
      const initialData: Partial<Quotation> = {
        ...quotation,
        'Quote No': undefined as any,   // Will be auto-generated
        'Status': 'Open',
        'Quote Date': undefined as any,   // Reset to today in creator
        'Validity Date': undefined as any,
      };
      handleNavigation({
        view: 'quotations',
        filter: navigation.filter,
        action: 'create',
        payload: { isDuplicate: true, initialData },
      });
      addToast('Duplicating quotation...', 'info');
    } catch (err: any) {
      addToast(`Failed to duplicate: ${err.message}`, 'error');
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleBackToDashboard = () => {
    handleNavigation({ view: 'quotations', filter: navigation.filter });
  };

  const handleSendToTelegram = async (quotation: Quotation) => {
    setIsSendingTelegram(true);
    try {
      const { items } = await readQuotationSheetData(quotation['Quote No'], isB2B);
      await sendQuotationToTelegram({
        quoteNo:         quotation['Quote No'],
        customerName:    quotation['Company Name']   || '',
        customerContact: quotation['Contact Number'] || quotation['Contact Name'] || '',
        currency:        (quotation.Currency as 'USD' | 'KHR') || 'USD',
        taxType:         (quotation['Tax Type'] as 'VAT' | 'NON-VAT') || 'VAT',
        note:            quotation.Remark || '',
        items,
      });
      addToast('Quotation sent to Telegram!', 'success');
    } catch (err: any) {
      addToast(`Telegram send failed: ${err.message}`, 'error');
    } finally {
      setIsSendingTelegram(false);
    }
  };

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
      ['Quote No', 'Company Name', 'Contact Name', 'Status', 'Reason'].some(key =>
        String(item[key as keyof Quotation] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [quotations, searchQuery, statusFilter]);

  // Note: accessorKey uses 'Quote No' (no dot) to match DB column name
  const selectedQuotationForDetail = useMemo(() => {
    let targetId = selectedQuotationId;
    if (viewMode === 'detail' && !targetId && filteredData.length > 0) {
      targetId = filteredData[0]['Quote No'];
    }
    if (!targetId) return null;
    return filteredData.find(q => q['Quote No'] === targetId) || null;
  }, [selectedQuotationId, filteredData, viewMode]);

  const allColumns = useMemo<ColumnDef<Quotation>[]>(() => [
    {
      accessorKey: 'Quote No',
      header: 'Quote No.',
      isSortable: true,
      cell: (value: string) => (
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

  const renderDetailView = () => (
    <div className="flex flex-col md:flex-row h-full bg-background">
      <aside className="w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col">
        <QuotationListContainer
          quotations={filteredData}
          selectedQuotationId={selectedQuotationForDetail?.['Quote No'] || null}
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
                  <p className="text-muted-foreground font-mono mt-1">{selectedQuotationForDetail['Quote No']}</p>
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
                      onClick={() => handleDuplicateQuotation(selectedQuotationForDetail)}
                      disabled={isDuplicating}
                      className="text-sm font-semibold text-violet-500 hover:underline flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isDuplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(selectedQuotationForDetail)}
                      className="text-sm font-semibold text-rose-500 hover:underline flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                    <button
                      onClick={() => handleSendToTelegram(selectedQuotationForDetail)}
                      disabled={isSendingTelegram}
                      className="text-sm font-semibold text-sky-500 hover:underline flex items-center gap-1.5 disabled:opacity-50"
                      title="Send to Telegram (admin)"
                    >
                      {isSendingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Telegram
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
    // Resolve initialData: prefer navigation.payload.initialData (duplicate flow), then initialPayload prop
    const creatorInitialData =
      navigation.payload?.initialData ||
      (initialPayload?.action === 'create' ? (initialPayload as any).initialData : undefined);

    return (
      <QuotationCreator
        onBack={handleBackToDashboard}
        existingQuotation={selectedQuotationToEdit}
        initialData={creatorInitialData}
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
                onClick={() => setViewMode('detail')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === 'detail' ? 'bg-background text-brand-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Columns className="w-4 h-4" />
                <span className="hidden xl:inline">Detail</span>
              </button>
            </div>

            {/* Alignment/Wrap Icons — desktop only */}
            <div className="hidden lg:flex items-center bg-card border border-border rounded-md shadow-sm flex-shrink-0">
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

            {/* Column Toggle — desktop only */}
            <div className="hidden lg:block flex-shrink-0">
              <DataTableColumnToggle
                allColumns={allColumns}
                visibleColumns={visibleColumns}
                onColumnToggle={handleColumnToggle}
              />
            </div>

            {/* New Quotation Button */}
            <PermissionGate module="quotations" action="create">
              <button
                onClick={handleNewQuotation}
                className="flex-shrink-0 flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-md whitespace-nowrap text-sm ml-auto lg:ml-0"
              >
                <span className="text-xl leading-none">+</span> New
              </button>
            </PermissionGate>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden bg-background p-0 md:p-4">
        {viewMode === 'table' ? (
          <DataTable
            tableId="quotation-table"
            data={filteredData}
            columns={displayedColumns}
            loading={loading}
            onRowClick={handleViewQuotation}
            initialSort={{ key: 'Quote Date', direction: 'descending' }}
            mobilePrimaryColumns={['Quote No', 'Company Name', 'Amount', 'Status']}
            cellWrapStyle={cellWrapStyle}
            renderRowActions={(row) => (
              <div className="flex items-center justify-center gap-1 md:gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditQuotation(row);
                  }}
                  className="p-1.5 md:p-2.5 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicateQuotation(row);
                  }}
                  disabled={isDuplicating}
                  className="p-1.5 md:p-2.5 text-muted-foreground hover:text-violet-500 transition hover:bg-violet-500/10 rounded-full disabled:opacity-50"
                  title="Duplicate"
                >
                  <Copy size={15} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRequest(row);
                  }}
                  className="p-1.5 md:p-2.5 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendToTelegram(row);
                  }}
                  disabled={isSendingTelegram}
                  className="p-1.5 md:p-2.5 text-muted-foreground hover:text-sky-500 transition hover:bg-sky-500/10 rounded-full disabled:opacity-50"
                  title="Send to Telegram"
                >
                  {isSendingTelegram ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            )}
            renderRowContextMenu={(row) => (
              <RowActionMenuItems
                onView={() => handleViewQuotation(row)}
                onEdit={() => handleEditQuotation(row)}
                onDelete={() => handleDeleteRequest(row)}
              >
                {row.Status === 'Close (Win)' && (
                  <DropdownMenuItem onClick={() => handleCreateSaleOrder(row)}>
                    <ShoppingCart className="mr-2 h-4 w-4" /> Create Sale Order
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled={isDuplicating} onClick={() => handleDuplicateQuotation(row)}>
                  <Copy className="mr-2 h-4 w-4" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isSendingTelegram} onClick={() => handleSendToTelegram(row)}>
                  <Send className="mr-2 h-4 w-4" /> Send to Telegram
                </DropdownMenuItem>
              </RowActionMenuItems>
            )}
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
        Are you sure you want to delete quotation "{quotationToDelete?.['Quote No']}"? This action cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

export default React.memo(QuotationDashboard);
