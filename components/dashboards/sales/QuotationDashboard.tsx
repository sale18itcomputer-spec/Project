'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Quotation } from "../../../types";
import { useB2BData } from "../../../hooks/useB2BData";
import DataTable, { ColumnDef, CellWrapStyle } from "../../common/DataTable";
import { parseDate, formatDateAsMDY, formatDisplayDate } from "../../../utils/time";
import { useNavigation } from "../../../contexts/NavigationContext";
import { formatCurrencySmartly } from "../../../utils/formatters";
import { ShoppingCart, Table, Columns, Info, Pencil, Plus, FileText, Trash2, Copy, Loader2, Send } from 'lucide-react';
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { useToast } from "../../../contexts/ToastContext";
import { deleteRecord } from "../../../services/api";
import ConfirmationModal from "../../modals/ConfirmationModal";
import QuotationListContainer from "../lists/QuotationListContainer";
import Spinner from "../../common/Spinner";
import EmptyState from "../../common/EmptyState";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { readQuotationSheetData } from '../../../services/b2bDb';
import { getUserTelegramChatId } from '../../../utils/telegram';
import { sendPdfToTelegramChat } from '../../../lib/pdfClient';
import { useAuth } from '../../../contexts/AuthContext';
import RowActionMenuItems from "../../common/RowActionMenuItems";
import { DropdownMenuItem } from "../../ui/dropdown-menu";
import { StatusBadge } from "../../ui/status-badge";
import DashboardHeader from "../../common/DashboardHeader";
import SearchInput from "../../common/SearchInput";
import ViewToggle from "../../common/ViewToggle";
import CellWrapToggle from "../../common/CellWrapToggle";
import ErrorState from "../../common/ErrorState";
import StatusFilterBar from "../../common/StatusFilterBar";
import IconButton from "../../ui/icon-button";
import { Button } from "../../ui/button";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";

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
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string | null>('Quote Pending');
  const { handleNavigation, navigation } = useNavigation();
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  const selectedQuotationId = useMemo(() => {
    if (navigation.action === 'view') return navigation.id || null;
    if (initialPayload && (initialPayload as any).action === 'view' && (initialPayload as any).data) return (initialPayload as any).data['Quote No'];
    return null;
  }, [navigation.action, navigation.id, initialPayload]);

  useEffect(() => {
    if (navigation.action === 'view') setViewMode('detail');
  }, [navigation.action]);

  const openQuotationWindow = (quoteNo: string | null, initialData?: Partial<Quotation>) => {
    // Create/edit a quotation opens in its own browser tab (the standalone route),
    // not an in-app window.
    const base = quoteNo
      ? `/standalone/quotation/${encodeURIComponent(quoteNo)}`
      : '/standalone/quotation/new';
    let url = base;
    // Prefill/duplicate data is handed to the new tab via localStorage (shared
    // across same-origin tabs, unlike sessionStorage), under a one-time key the
    // tab reads and clears. handleDuplicateQuotation set the items in
    // sessionStorage just before calling us — fold those in too.
    if (!quoteNo && initialData) {
      let dupItems: unknown;
      try { const s = sessionStorage.getItem('duplicate_quotation_items'); if (s) dupItems = JSON.parse(s); } catch { /* ignore */ }
      const key = `quote-draft-${Date.now()}`;
      try {
        localStorage.setItem(key, JSON.stringify({ initialData, items: dupItems }));
        sessionStorage.removeItem('duplicate_quotation_items');
        url = `${base}?draft=${encodeURIComponent(key)}`;
      } catch { /* fall back to a plain new tab without prefill */ }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Auto-open window when navigated from another page with create/edit action
  const lastNavKeyRef = useRef('');
  useEffect(() => {
    // Reset the dedup key when the action clears so a repeat create/edit fires
    // (create's key is always "create:" with no id — otherwise it only opens once).
    if (!navigation.action || navigation.action === 'view') { lastNavKeyRef.current = ''; return; }
    const key = `${navigation.action}:${navigation.id ?? ''}`;
    if (lastNavKeyRef.current === key) return;
    lastNavKeyRef.current = key;

    if (navigation.action === 'create') {
      const creatorInitialData =
        navigation.payload?.initialData ||
        (initialPayload && (initialPayload as any).action === 'create' ? (initialPayload as any).initialData : undefined);
      openQuotationWindow(null, creatorInitialData);
    } else if (navigation.action === 'edit' && navigation.id) {
      openQuotationWindow(navigation.id);
    }
    handleNavigation({ view: 'quotations', filter: navigation.filter });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation.action, navigation.id]);

  const handleNewQuotation = () => openQuotationWindow(null);

  const handleEditQuotation = (quotation: Quotation) => openQuotationWindow(quotation['Quote No']);

  const handleViewQuotation = (quotation: Quotation) => openQuotationWindow(quotation['Quote No']);

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
    handleNavigation({ view: 'sale-orders', action: 'create', payload: quotation });
  };

  const handleDuplicateQuotation = async (quotation: Quotation) => {
    setIsDuplicating(true);
    try {
      const { items } = await readQuotationSheetData(quotation['Quote No'], isB2B);
      sessionStorage.setItem('duplicate_quotation_items', JSON.stringify(items));
      const initialData: Partial<Quotation> = {
        ...quotation,
        'Quote No': undefined as any,
        'Status': 'Open',
        'Quote Date': undefined as any,
        'Validity Date': undefined as any,
      };
      openQuotationWindow(null, initialData);
      addToast('Duplicating quotation...', 'info');
    } catch (err: any) {
      addToast(`Failed to duplicate: ${err.message}`, 'error');
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleSendToTelegram = async (quotation: Quotation) => {
    const chatId = getUserTelegramChatId(currentUser);
    if (!chatId) {
      addToast('No Telegram Chat ID on your user profile. Ask an admin to add it in User Management.', 'error');
      return;
    }
    setIsSendingTelegram(true);
    try {
      const { header, items } = await readQuotationSheetData(quotation['Quote No'], isB2B);
      const rows = (items || []).filter((it: any) => it.no > 0 || it.isPromotion);
      const subTotal = rows.reduce((sum: number, it: any) =>
        sum + (Number(it.amount) || (Number(it.qty) || 0) * (Number(it.unitPrice) || 0)), 0);
      const taxType = header?.['Tax Type'] || quotation['Tax Type'] || 'VAT';
      const vat = taxType === 'NON-VAT' ? 0 : subTotal * 0.1;

      await sendPdfToTelegramChat({
        type: 'Quotation',
        headerData: {
          ...header,
          'Quotation ID': quotation['Quote No'],
          'Contact Person': header?.['Contact Name'] || quotation['Contact Name'] || '',
          'Contact Tel': header?.['Contact Number'] || quotation['Contact Number'] || '',
        },
        items: rows,
        totals: { subTotal, tax: vat, vat, grandTotal: subTotal + vat },
        currency: (quotation.Currency as 'USD' | 'KHR') || 'USD',
        filename: `Quotation_${quotation['Quote No']}.pdf`,
        chatId,
        caption: `<b>Quotation ${quotation['Quote No']}</b>\n${quotation['Company Name'] || ''}`,
      });
      addToast('Quotation PDF sent to your Telegram!', 'success');
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

    if (!debouncedSearch) return dataToFilter;

    return dataToFilter.filter(item =>
      ['Quote No', 'Company Name', 'Contact Name', 'Status', 'Reason'].some(key =>
        String(item[key as keyof Quotation] ?? '').toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    );
  }, [quotations, debouncedSearch, statusFilter]);

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
    <div className="flex flex-col md:flex-row h-full">
      <aside className="w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col">
        <QuotationListContainer
          quotations={filteredData}
          selectedQuotationId={selectedQuotationForDetail?.['Quote No'] || null}
          onSelectQuotation={(id) => handleNavigation({ view: 'quotations', filter: navigation.filter, action: 'view', id })}
          loading={loading && !quotations}
        />
      </aside>
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
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
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => openQuotationWindow(selectedQuotationForDetail['Quote No'])}
                      className="h-auto gap-1.5 p-0 font-semibold"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" /> Edit
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleDuplicateQuotation(selectedQuotationForDetail)}
                      disabled={isDuplicating}
                      className="h-auto gap-1.5 p-0 font-semibold text-violet-500"
                    >
                      {isDuplicating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                      Duplicate
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleDeleteRequest(selectedQuotationForDetail)}
                      className="h-auto gap-1.5 p-0 font-semibold text-rose-500"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleSendToTelegram(selectedQuotationForDetail)}
                      disabled={isSendingTelegram}
                      className="h-auto gap-1.5 p-0 font-semibold text-sky-500"
                      title="Send to Telegram (admin)"
                    >
                      {isSendingTelegram ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                      Telegram
                    </Button>
                  </div>
                  {selectedQuotationForDetail.Status === 'Close (Win)' && (
                    <Button variant="success" size="sm" onClick={() => handleCreateSaleOrder(selectedQuotationForDetail)}>
                      <ShoppingCart className="w-4 h-4" aria-hidden="true" />
                      Create SO
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-muted-foreground/60">Total Amount</dt>
                  <dd className="mt-1 text-xl font-semibold text-primary">{formatCurrencySmartly(selectedQuotationForDetail.Amount, selectedQuotationForDetail.Currency)}</dd>
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

  const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'table', label: 'Table', icon: <Table /> },
    { id: 'detail', label: 'Detail', icon: <Columns /> },
  ];

  if (error) {
    return <ErrorState title="Could not load quotations" message={error} />;
  }

  return (
    <div className="h-full flex flex-col">
      <DashboardHeader title="Quotations" icon={<FileText />}>
        <SearchInput
          id="quotation-search"
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search quotations..."
          label="Search quotations"
        />

        {/* View Mode Toggle */}
        <ViewToggle<ViewMode>
          views={VIEW_OPTIONS}
          activeView={viewMode}
          onViewChange={setViewMode}
        />

        <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

        <DataTableColumnToggle
          allColumns={allColumns}
          visibleColumns={visibleColumns}
          onColumnToggle={handleColumnToggle}
        />

        {/* New Quotation Button */}
        <PermissionGate module="quotations" action="create">
          <Button onClick={handleNewQuotation} aria-label="New quotation">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

      <div className="flex-1 min-h-0 overflow-hidden p-0 md:p-4">
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
            emptyState={{
              title: 'No quotations yet',
              description: 'Quotations you create will appear here.',
            }}
            renderRowActions={(row) => (
              <div className="flex items-center justify-center gap-1">
                <IconButton
                  label="Edit quotation"
                  tone="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditQuotation(row);
                  }}
                >
                  <Pencil size={16} aria-hidden="true" />
                </IconButton>
                <IconButton
                  label="Duplicate quotation"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicateQuotation(row);
                  }}
                  disabled={isDuplicating}
                >
                  <Copy size={16} aria-hidden="true" />
                </IconButton>
                <IconButton
                  label="Delete quotation"
                  tone="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRequest(row);
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </IconButton>
                <IconButton
                  label="Send to Telegram"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendToTelegram(row);
                  }}
                  disabled={isSendingTelegram}
                >
                  {isSendingTelegram ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                </IconButton>
              </div>
            )}
            renderRowContextMenu={(row) => (
              <RowActionMenuItems
                onOpenWindow={() => openQuotationWindow(row['Quote No'])}
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

      <StatusFilterBar
        options={['Quote Pending', 'Quote (Win)', 'Quote (Lose)', 'Cancel']}
        active={statusFilter}
        onChange={setStatusFilter}
        summary={`${filteredData.length} records`}
      />

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
