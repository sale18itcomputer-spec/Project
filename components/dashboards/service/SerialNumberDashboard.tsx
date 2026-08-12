'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { SerialNumber } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef, CellWrapStyle, runBatched, BatchResult, BulkActionConfig } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { Hash, Pencil, Trash2, Plus, Package } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import SerialNumberWindowContent from '../../windows/content/SerialNumberWindowContent';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import ErrorState from '../../common/ErrorState';
import StatusFilterBar from '../../common/StatusFilterBar';
import IconButton from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const COLUMNS_VISIBILITY_KEY = 'limperial-serial-number-columns-visibility';

const STATUS_STYLES: Record<string, string> = {
  'Active':      'bg-emerald-500/10 text-emerald-500',
  'In Service':  'bg-blue-500/10 text-blue-500',
  'Returned':    'bg-amber-500/10 text-amber-500',
  'Written Off': 'bg-muted text-muted-foreground',
  'Retired':     'bg-rose-500/10 text-rose-500',
};

const StatusBadge: React.FC<{ value: string }> = ({ value }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[value] ?? 'bg-muted text-muted-foreground'}`}>
    {value}
  </span>
);

const STOCK_STATUS_STYLES: Record<string, string> = {
  'In Stock': 'bg-emerald-500/10 text-emerald-500',
  'Sold':     'bg-muted text-muted-foreground',
};

const StockStatusBadge: React.FC<{ value: string }> = ({ value }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${STOCK_STATUS_STYLES[value] ?? 'bg-muted text-muted-foreground'}`}>
    {value || 'In Stock'}
  </span>
);

const STATUS_FILTERS = ['All', 'Active', 'In Service', 'Returned', 'Written Off', 'Retired'];
const STOCK_STATUS_FILTERS = ['All', 'In Stock', 'Sold'];

interface SoldItem {
  _key: string;
  invNo: string;
  invDate: string;
  companyName: string;
  contactName: string;
  soNo: string;
  itemCode: string;
  modelName: string;
  description: string;
  qty: number;
  brand: string;
}

type ActiveTab = 'registered' | 'from-invoices';

const SerialNumberDashboard: React.FC<{ initialFilter?: string }> = ({ initialFilter }) => {
  const { serialNumbers, setSerialNumbers, invoices, pricelist, fetchModule, loading, error } = useData();
  const { addToast } = useToast();
  const { can } = usePermissions();
  const { openWindow } = useWindowManager();

  const [activeTab, setActiveTab] = useState<ActiveTab>('registered');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  // `null` is what StatusFilterBar writes when the active chip is cleared — it
  // means the same thing the 'All' chip always meant here: no status filter.
  const [statusFilter, setStatusFilter] = useState<string | null>(initialFilter ?? null);
  const [stockStatusFilter, setStockStatusFilter] = useState('All');
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
  const [snToDelete, setSnToDelete] = useState<SerialNumber | null>(null);

  useEffect(() => {
    if (activeTab === 'from-invoices') {
      fetchModule('Invoices', 'Raw');
    }
  }, [activeTab, fetchModule]);

  const openSerialNumberWindow = (id: string | null, prefillData?: Partial<SerialNumber>) => {
    const windowId = `serial-number-${id ?? 'new'}`;
    openWindow({
      id: windowId,
      title: id ? 'Serial Number' : 'Add Serial Number',
      content: <SerialNumberWindowContent windowId={windowId} snId={id} prefillData={prefillData} />,
      draggable: true,
    });
  };

  const handleOpenNew = () => openSerialNumberWindow(null);
  const handleEdit = (row: SerialNumber) => openSerialNumberWindow(row.id!);

  const handleRegisterFromInvoice = (item: SoldItem) => {
    openSerialNumberWindow(null, {
      company_name: item.companyName,
      contact_name: item.contactName,
      so_no: item.soNo,
      brand: item.brand,
      model_name: item.modelName,
      description: item.description,
      status: 'Active',
    });
  };

  const handleConfirmDelete = async () => {
    if (!snToDelete?.id) return;
    const id = snToDelete.id;
    setSerialNumbers(prev => prev ? prev.filter(s => s.id !== id) : null);
    setSnToDelete(null);
    try {
      const { error } = await supabase.from('serial_numbers').delete().eq('id', id);
      if (error) throw error;
      addToast('Serial number deleted.', 'success');
    } catch (err: any) {
      addToast(`Failed to delete: ${err.message}`, 'error');
      const { data } = await supabase.from('serial_numbers').select('*').eq('id', id).single();
      if (data) setSerialNumbers(prev => prev ? [data, ...prev] : [data]);
    }
  };

  const handleCellEdit = async (row: SerialNumber, columnKey: keyof SerialNumber, newValue: any) => {
    if (!row.id) return;
    const { error } = await supabase.from('serial_numbers').update({ [columnKey]: newValue }).eq('id', row.id);
    if (error) throw error;
    setSerialNumbers(prev => prev ? prev.map(s => s.id === row.id ? { ...s, [columnKey]: newValue } : s) : prev);
  };

  const canEditSerials = can('serial_numbers', 'edit');
  const canDeleteSerials = can('serial_numbers', 'delete');

  const bulkActions = useMemo<BulkActionConfig<SerialNumber>[]>(() => {
    const actions: BulkActionConfig<SerialNumber>[] = [];
    if (canEditSerials) {
      actions.push({
        label: 'Mark In Stock',
        confirmText: 'Mark In Stock',
        onClick: (rows) => runBatched(rows, async (row): Promise<BatchResult> => {
          try {
            await handleCellEdit(row, 'stock_status', 'In Stock');
            return { id: row.id!, success: true };
          } catch (err: any) {
            return { id: row.id!, success: false, error: err?.message || 'Failed' };
          }
        }),
      });
      actions.push({
        label: 'Mark Sold',
        confirmText: 'Mark Sold',
        onClick: (rows) => runBatched(rows, async (row): Promise<BatchResult> => {
          try {
            await handleCellEdit(row, 'stock_status', 'Sold');
            return { id: row.id!, success: true };
          } catch (err: any) {
            return { id: row.id!, success: false, error: err?.message || 'Failed' };
          }
        }),
      });
    }
    if (canDeleteSerials) {
      actions.push({
        label: 'Delete Selected',
        variant: 'danger',
        confirmText: 'Delete',
        onClick: (rows) => runBatched(rows, async (row): Promise<BatchResult> => {
          try {
            const { error } = await supabase.from('serial_numbers').delete().eq('id', row.id!);
            if (error) throw error;
            setSerialNumbers(prev => prev ? prev.filter(s => s.id !== row.id) : prev);
            return { id: row.id!, success: true };
          } catch (err: any) {
            return { id: row.id!, success: false, error: err?.message || 'Failed' };
          }
        }),
      });
    }
    return actions;
  }, [canEditSerials, canDeleteSerials, setSerialNumbers]);

  // Build a brand lookup map from pricelist
  const brandByCode = useMemo(() => {
    const map = new Map<string, string>();
    (pricelist ?? []).forEach(p => { if (p['Code']) map.set(p['Code'], p['Brand'] ?? ''); });
    return map;
  }, [pricelist]);

  // Derive sold items from invoices (Completed + Processing statuses)
  const soldItems = useMemo<SoldItem[]>(() => {
    if (!invoices) return [];
    const result: SoldItem[] = [];
    const eligible = invoices.filter(inv =>
      inv['Status'] === 'Completed' || inv['Status'] === 'Processing'
    );
    eligible.forEach(inv => {
      let items: any[] = [];
      try {
        items = typeof inv['ItemsJSON'] === 'string'
          ? JSON.parse(inv['ItemsJSON'])
          : (Array.isArray(inv['ItemsJSON']) ? inv['ItemsJSON'] : []);
      } catch { }
      items.forEach((item, i) => {
        if (!item?.modelName && !item?.itemCode) return;
        result.push({
          _key: `${inv['Inv No']}-${i}`,
          invNo: inv['Inv No'] ?? '',
          invDate: inv['Inv Date'] ?? '',
          companyName: inv['Company Name'] ?? '',
          contactName: inv['Contact Name'] ?? '',
          soNo: inv['SO No'] ?? '',
          itemCode: item.itemCode ?? '',
          modelName: item.modelName ?? '',
          description: item.description ?? '',
          qty: Number(item.qty) || 1,
          brand: brandByCode.get(item.itemCode ?? '') ?? '',
        });
      });
    });
    return result;
  }, [invoices, brandByCode]);

  // Track how many serials are already registered per SO No + model combo
  const registeredCounts = useMemo(() => {
    const map = new Map<string, number>();
    (serialNumbers ?? []).forEach(s => {
      const key = `${s.so_no ?? ''}|${s.model_name ?? ''}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [serialNumbers]);

  // Filtered sold items
  const filteredSoldItems = useMemo(() => {
    if (!debouncedSearch) return soldItems;
    const q = debouncedSearch.toLowerCase();
    return soldItems.filter(item =>
      item.invNo.toLowerCase().includes(q) ||
      item.modelName.toLowerCase().includes(q) ||
      item.companyName.toLowerCase().includes(q) ||
      item.soNo.toLowerCase().includes(q) ||
      item.itemCode.toLowerCase().includes(q)
    );
  }, [soldItems, debouncedSearch]);

  // ── Registered tab data ──────────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    let data = serialNumbers ?? [];
    if (statusFilter && statusFilter !== 'All') data = data.filter(s => s.status === statusFilter);
    if (stockStatusFilter !== 'All') data = data.filter(s => (s.stock_status || 'In Stock') === stockStatusFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter(s =>
        s.serial_number?.toLowerCase().includes(q) ||
        s.brand?.toLowerCase().includes(q) ||
        s.model_name?.toLowerCase().includes(q) ||
        s.company_name?.toLowerCase().includes(q) ||
        s.so_no?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [serialNumbers, statusFilter, stockStatusFilter, debouncedSearch]);

  const allColumns = useMemo<ColumnDef<SerialNumber>[]>(() => [
    {
      accessorKey: 'serial_number',
      header: 'Serial No',
      isSortable: true,
      cell: (v: string) => <span className="font-semibold text-muted-foreground/80">{v}</span>,
    },
    { accessorKey: 'brand', header: 'Brand', isSortable: true },
    { accessorKey: 'model_name', header: 'Model', isSortable: true },
    { accessorKey: 'company_name', header: 'Company', isSortable: true },
    { accessorKey: 'so_no', header: 'SO No', isSortable: true },
    { accessorKey: 'warranty_start_date', header: 'Warranty Start', isSortable: true, cell: (v: string) => formatDisplayDate(v) },
    { accessorKey: 'warranty_end_date', header: 'Warranty End', isSortable: true, cell: (v: string) => formatDisplayDate(v) },
    { accessorKey: 'warranty_period_months', header: 'Warranty (mo)', isSortable: true },
    {
      accessorKey: 'stock_status',
      header: 'Stock',
      isSortable: true,
      cell: (v: string) => <StockStatusBadge value={v} />,
      editable: true,
      editType: 'select',
      editOptions: STOCK_STATUS_FILTERS.slice(1),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      isSortable: true,
      cell: (v: string) => <StatusBadge value={v} />,
      editable: true,
      editType: 'select',
      editOptions: STATUS_FILTERS.slice(1),
    },
  ], []);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorageGet(COLUMNS_VISIBILITY_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch { }
    return new Set(['serial_number', 'brand', 'model_name', 'company_name', 'so_no', 'warranty_end_date', 'stock_status', 'status']);
  });

  const handleColumnToggle = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      localStorageSet(COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const displayedColumns = useMemo(
    () => allColumns.filter(c => c.accessorKey && visibleColumns.has(c.accessorKey as string)),
    [allColumns, visibleColumns]
  );

  if (error) {
    return <ErrorState title="Could not load serial numbers" message={error} />;
  }

  return (
    <div className="h-full flex flex-col">
      <DashboardHeader
        title="Serial Numbers"
        icon={<Hash />}
        subtitle={activeTab === 'registered' ? `${filteredData.length} registered` : `${filteredSoldItems.length} sold items`}
      >
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder={activeTab === 'registered' ? 'Search serial numbers...' : 'Search sold items...'}
          label={activeTab === 'registered' ? 'Search serial numbers' : 'Search sold items'}
        />

        {activeTab === 'registered' && (
          <>
            <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />
            <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />
          </>
        )}

        <PermissionGate module="serial_numbers" action="create">
          <Button variant="success" onClick={handleOpenNew} aria-label="Add serial">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Add Serial</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

      {/* Tab switcher */}
      <div role="tablist" aria-label="Serial number source" className="flex flex-shrink-0 gap-1 border-b border-border bg-card px-4 lg:px-6">
        <button
          role="tab"
          aria-selected={activeTab === 'registered'}
          aria-controls="serial-numbers-tabpanel"
          onClick={() => { setActiveTab('registered'); setSearchQuery(''); }}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
            activeTab === 'registered'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Registered
          <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded-full">
            {(serialNumbers ?? []).length}
          </span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'from-invoices'}
          aria-controls="serial-numbers-tabpanel"
          onClick={() => { setActiveTab('from-invoices'); setSearchQuery(''); setStatusFilter(null); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition ${
            activeTab === 'from-invoices'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package size={14} aria-hidden="true" />
          From Invoices
          <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
            {soldItems.length}
          </span>
        </button>
      </div>

      {/* Stock filters — only for registered tab. The status chips that used to
          sit beside these now live in the footer StatusFilterBar. */}
      {activeTab === 'registered' && (
        <div
          role="group"
          aria-label="Filter by stock status"
          className="no-scrollbar flex flex-shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2 lg:px-6"
        >
          <span className="flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Stock</span>
          {STOCK_STATUS_FILTERS.map(s => (
            <Button
              key={s}
              variant={stockStatusFilter === s ? 'default' : 'outline'}
              size="sm"
              aria-pressed={stockStatusFilter === s}
              onClick={() => setStockStatusFilter(s)}
              className={stockStatusFilter === s ? 'font-semibold' : 'font-semibold text-muted-foreground'}
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      <div id="serial-numbers-tabpanel" role="tabpanel" className="flex-1 overflow-hidden p-4">
        {activeTab === 'registered' ? (
          <DataTable
            tableId="serial-number-table"
            data={filteredData}
            columns={displayedColumns}
            loading={loading}
            onRowClick={handleEdit}
            initialSort={{ key: 'created_at', direction: 'descending' }}
            cellWrapStyle={cellWrapStyle}
            mobilePrimaryColumns={['serial_number', 'brand', 'model_name', 'status']}
            getRowId={(row) => row.id!}
            onCellEdit={handleCellEdit}
            onError={(msg) => addToast(msg, 'error')}
            enableRowSelection
            bulkActions={bulkActions}
            enableFindReplace
            emptyState={{
              title: 'No serial numbers yet',
              description: 'Serials registered against stock, sales and service jobs will appear here.',
            }}
            renderRowActions={(row) => (
              <div className="flex items-center gap-1">
                <PermissionGate module="serial_numbers" action="edit">
                  <IconButton
                    label="Edit serial number"
                    tone="primary"
                    onClick={e => { e.stopPropagation(); handleEdit(row); }}
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </IconButton>
                </PermissionGate>
                <PermissionGate module="serial_numbers" action="delete">
                  <IconButton
                    label="Delete serial number"
                    tone="danger"
                    onClick={e => { e.stopPropagation(); setSnToDelete(row); }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </IconButton>
                </PermissionGate>
              </div>
            )}
            renderRowContextMenu={(row) => (
              <RowActionMenuItems
                onOpenWindow={() => openSerialNumberWindow(row.id!)}
                onEdit={can('serial_numbers', 'edit') ? () => handleEdit(row) : undefined}
                onDelete={can('serial_numbers', 'delete') ? () => setSnToDelete(row) : undefined}
              />
            )}
          />
        ) : (
          <FromInvoicesTab
            items={filteredSoldItems}
            registeredCounts={registeredCounts}
            onRegister={handleRegisterFromInvoice}
            loading={!invoices && loading}
          />
        )}
      </div>

      {/* Status filter tabs — only for registered tab */}
      {activeTab === 'registered' && (
        <StatusFilterBar
          options={[{ value: null, label: 'All' }, ...STATUS_FILTERS.slice(1)]}
          active={statusFilter}
          onChange={setStatusFilter}
          summary={`${filteredData.length} registered`}
        />
      )}

      <ConfirmationModal
        isOpen={!!snToDelete}
        onClose={() => setSnToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Serial Number"
        variant="danger"
      >
        Are you sure you want to delete serial number "{snToDelete?.serial_number}"? This cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

// ── From Invoices sub-view ─────────────────────────────────────────────────────

const FromInvoicesTab: React.FC<{
  items: SoldItem[];
  registeredCounts: Map<string, number>;
  onRegister: (item: SoldItem) => void;
  loading: boolean;
}> = ({ items, registeredCounts, onRegister, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Loading invoices...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
        <Package size={32} className="opacity-30" />
        <p className="text-sm">No sold items found from completed invoices.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 sticky top-0 z-10">
          <tr>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Inv No</th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Date</th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Company</th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">SO No</th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Code</th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Model</th>
            <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Qty</th>
            <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Registered</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map(item => {
            const regKey = `${item.soNo}|${item.modelName}`;
            const regCount = registeredCounts.get(regKey) ?? 0;
            const isFull = regCount >= item.qty;
            return (
              <tr key={item._key} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">{item.invNo}</td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDisplayDate(item.invDate)}</td>
                <td className="px-3 py-2.5 max-w-[180px] truncate" title={item.companyName}>{item.companyName}</td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{item.soNo || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{item.itemCode || '—'}</td>
                <td className="px-3 py-2.5 max-w-[200px] truncate" title={item.modelName}>{item.modelName}</td>
                <td className="px-3 py-2.5 text-center">{item.qty}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    isFull
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : regCount > 0
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {regCount}/{item.qty}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <PermissionGate module="serial_numbers" action="create">
                    <Button
                      size="xs"
                      onClick={() => onRegister(item)}
                      aria-label={`Register a serial for ${item.modelName || item.itemCode}`}
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      Register
                    </Button>
                  </PermissionGate>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SerialNumberDashboard;
