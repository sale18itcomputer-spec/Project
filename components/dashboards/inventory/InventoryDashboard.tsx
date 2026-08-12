'use client';

import React, { useState, useMemo } from 'react';
import { InventoryItem, SerialNumber } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import { supabase } from '../../../lib/supabase';
import DataTable, { ColumnDef, CellWrapStyle } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { formatCurrencySmartly } from '../../../utils/formatters';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { usePermissions } from '../../../hooks/usePermissions';
import ConfirmationModal from '../../modals/ConfirmationModal';
import ResizableModal from '../../modals/ResizableModal';
import InventoryWindowContent from '../../windows/content/InventoryWindowContent';
import { Badge } from '../../ui/badge';
import { DropdownMenuItem } from '../../ui/dropdown-menu';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import StatusFilterBar from '../../common/StatusFilterBar';
import IconButton from '../../ui/icon-button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import {
  Warehouse, Trash2,
  Pencil, PackageCheck, PackageX, AlertTriangle, Hash,
} from 'lucide-react';

const INVENTORY_COLUMNS_KEY = 'limperial-inventory-columns-visibility';

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  if (!status) return null;
  const s = status.toLowerCase();
  let cls = 'font-semibold border ';
  if (s === 'in stock') {
    cls += 'text-emerald-700 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  } else if (s === 'reserved') {
    cls += 'text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/10';
  } else if (s === 'out of stock') {
    cls += 'text-rose-700 dark:text-rose-400 border-rose-500/40 bg-rose-500/10';
  } else {
    cls += 'text-muted-foreground border-border bg-muted';
  }
  return <Badge variant="outline" className={cls}>{status}</Badge>;
};

// ── View Serials modal ────────────────────────────────────────────────────────
const SN_STATUS_STYLES: Record<string, string> = {
  'Active':      'bg-emerald-500/10 text-emerald-500',
  'In Service':  'bg-blue-500/10 text-blue-500',
  'Returned':    'bg-amber-500/10 text-amber-500',
  'Written Off': 'bg-muted-foreground/10 text-muted-foreground',
  'Retired':     'bg-rose-500/10 text-rose-500',
};

interface ViewSerialsModalProps {
  item: InventoryItem;
  serials: SerialNumber[];
  onClose: () => void;
}

const ViewSerialsModal: React.FC<ViewSerialsModalProps> = ({ item, serials, onClose }) => {
  return (
    <ResizableModal isOpen onClose={onClose} title={`Serial Numbers — ${item.model_name || item.code || 'Inventory Item'}`} draggable initialWidth={680} initialHeight={480}>
      {serials.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
          <Hash size={32} className="opacity-30" />
          <p className="text-sm">No serial numbers recorded for this item.</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Serial No</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Status</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">SO No</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Company</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Warranty End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {serials.map(sn => (
                <tr key={sn.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap">{sn.serial_number}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${SN_STATUS_STYLES[sn.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {sn.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{sn.so_no || '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[180px] truncate" title={sn.company_name}>{sn.company_name || '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDisplayDate(sn.warranty_end_date ?? undefined) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ResizableModal>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────
const InventoryDashboard: React.FC = () => {
  const { inventoryItems, setInventoryItems, serialNumbers, loading } = useData();
  const { addToast } = useToast();
  const { currentUser } = useAuth();
  const { showField, can, canView } = usePermissions();
  const { openWindow } = useWindowManager();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [itemToViewSerials, setItemToViewSerials] = useState<InventoryItem | null>(null);

  const openInventoryEditWindow = (item: InventoryItem) => {
    const id = `inventory-${item.id}`;
    openWindow({
      id,
      title: `Editing: ${item.model_name || item.code || 'Inventory Item'}`,
      content: <InventoryWindowContent windowId={id} itemId={item.id} />,
      draggable: true,
      initialWidth: 720,
      initialHeight: 620,
    });
  };

  // ── Metrics ──────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const items = inventoryItems ?? [];
    const total = items.length;
    const inStock = items.filter(i => (i.status ?? 'In Stock') === 'In Stock').length;
    const reserved = items.filter(i => i.status === 'Reserved').length;
    const outOfStock = items.filter(i => i.status === 'Out of Stock').length;
    return { total, inStock, reserved, outOfStock };
  }, [inventoryItems]);

  // ── Filtered data ─────────────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let data = inventoryItems ?? [];
    if (statusFilter) data = data.filter(i => i.status === statusFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter(i =>
        (i.code ?? '').toLowerCase().includes(q) ||
        (i.model_name ?? '').toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        (i.brand ?? '').toLowerCase().includes(q) ||
        (i.vendor_name ?? '').toLowerCase().includes(q) ||
        (i.po_number ?? '').toLowerCase().includes(q) ||
        (i.category ?? '').toLowerCase().includes(q)
      );
    }
    return data;
  }, [inventoryItems, debouncedSearch, statusFilter]);

  // ── Serial numbers linked to each inventory lot ──────────────────────────────
  const serialsByInventoryId = useMemo(() => {
    const map = new Map<string, SerialNumber[]>();
    (serialNumbers ?? []).forEach(sn => {
      if (!sn.inventory_id) return;
      const list = map.get(sn.inventory_id);
      if (list) list.push(sn); else map.set(sn.inventory_id, [sn]);
    });
    return map;
  }, [serialNumbers]);

  // ── Columns ───────────────────────────────────────────────────────────────────
  const allColumns = useMemo<ColumnDef<InventoryItem>[]>(() => {
    const canSeeCosts = showField('showPurchaseCosts');
    return [
      {
        accessorKey: 'po_number',
        header: 'Source PO',
        isSortable: true,
        cell: (value: string) => (
          <span className="text-xs font-mono text-muted-foreground">{value || '—'}</span>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        isSortable: true,
      },
      {
        accessorKey: 'code',
        header: 'Code',
        isSortable: true,
        cell: (value: string) => (
          <span className="font-semibold text-foreground">{value || '—'}</span>
        ),
      },
      {
        accessorKey: 'brand',
        header: 'Brand',
        isSortable: true,
      },
      {
        accessorKey: 'model_name',
        header: 'Model',
        isSortable: true,
        cell: (value: string) => (
          <span className="font-medium text-foreground">{value || '—'}</span>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        isSortable: false,
        cell: (value: string) => (
          <p className="text-sm text-muted-foreground">{value || '—'}</p>
        ),
      },
      {
        accessorKey: 'qty',
        header: 'Qty',
        isSortable: true,
        cell: (value: number, row) => {
          const qty = Number(value) || 0;
          const cls = qty === 0 ? 'text-rose-500 font-bold' : qty <= 3 ? 'text-amber-500 font-semibold' : 'text-emerald-600 font-semibold';
          return <span className={`${cls} text-right block w-full`}>{qty}</span>;
        },
      },
      ...(canSeeCosts ? [{
        accessorKey: 'unit_price',
        header: 'Unit Price',
        isSortable: true,
        cell: (value: number, row: InventoryItem) => (
          <span className="font-semibold text-right block w-full">
            {formatCurrencySmartly(value, row.currency)}
          </span>
        ),
      } as ColumnDef<InventoryItem>] : []),
      {
        accessorKey: 'vendor_name',
        header: 'Vendor',
        isSortable: true,
        cell: (value: string) => <span className="text-muted-foreground">{value || '—'}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        isSortable: true,
        cell: (value: string) => <StatusBadge status={value} />,
      },
      {
        accessorKey: 'created_at',
        header: 'Received Date',
        isSortable: true,
        cell: (value: string) => formatDisplayDate(value),
      },
    ];
  }, [showField]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorageGet(INVENTORY_COLUMNS_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch { }
    // Default: hide description & received_date to keep it tidy
    return new Set(['po_number', 'category', 'code', 'brand', 'model_name', 'qty', 'unit_price', 'vendor_name', 'status']);
  });

  const handleColumnToggle = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      localStorageSet(INVENTORY_COLUMNS_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const displayedColumns = useMemo(
    () => allColumns.filter(c => c.accessorKey && visibleColumns.has(c.accessorKey as string)),
    [allColumns, visibleColumns]
  );

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const id = itemToDelete.id;
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
      setInventoryItems(prev => prev ? prev.filter(i => i.id !== id) : null);
      addToast('Inventory item deleted.', 'success');
    } catch (err: any) {
      addToast(`Failed to delete: ${err.message}`, 'error');
    } finally {
      setItemToDelete(null);
    }
  };

  // ── Access guard ─────────────────────────────────────────────────────────────
  if (!canView('inventory')) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Warehouse className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold mb-2 text-foreground">Access Restricted</h2>
        <p className="max-w-md">You don't have permission to view Inventory.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">

      {/* ── Header ── */}
      <DashboardHeader
        title="Inventory"
        icon={<Warehouse />}
        subtitle={`${filteredData.length} items`}
      >
        {/* Search */}
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search inventory…"
          label="Search inventory"
        />

        {/* Wrap / Column controls */}
        <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />
        <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />
      </DashboardHeader>

      {/* ── Metric cards ── */}
      <div className="flex-shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 lg:px-6 py-3 bg-muted/20 border-b border-border">
        <div className="bg-card rounded-lg border border-border border-l-4 border-l-primary px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Warehouse className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-foreground leading-tight">{metrics.total}</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border border-l-4 border-l-emerald-500 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <PackageCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">In Stock</p>
            <p className="text-2xl font-bold text-emerald-600 leading-tight">{metrics.inStock}</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border border-l-4 border-l-amber-500 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Reserved</p>
            <p className="text-2xl font-bold text-amber-600 leading-tight">{metrics.reserved}</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border border-l-4 border-l-rose-500 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
            <PackageX className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Out of Stock</p>
            <p className="text-2xl font-bold text-rose-600 leading-tight">{metrics.outOfStock}</p>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-hidden p-4">
        <DataTable
          tableId="inventory-table"
          data={filteredData}
          columns={displayedColumns}
          loading={loading}
          initialSort={{ key: 'created_at', direction: 'descending' }}
          cellWrapStyle={cellWrapStyle}
          mobilePrimaryColumns={['code', 'model_name', 'qty', 'status']}
          emptyState={{
            title: 'No inventory yet',
            description: 'Items received against a purchase order will appear here.',
          }}
          renderRowActions={(row) => {
            const serials = serialsByInventoryId.get(row.id);
            return (
              <div className="flex items-center gap-1">
                {!!serials?.length && (
                  <IconButton
                    label={`View Serial Numbers (${serials.length})`}
                    tone="primary"
                    onClick={e => { e.stopPropagation(); setItemToViewSerials(row); }}
                  >
                    <Hash size={16} aria-hidden="true" />
                  </IconButton>
                )}
                {can('inventory', 'edit') && (
                  <IconButton
                    label="Edit"
                    tone="primary"
                    onClick={e => { e.stopPropagation(); openInventoryEditWindow(row); }}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </IconButton>
                )}
                {can('inventory', 'delete') && (
                  <IconButton
                    label="Delete"
                    tone="danger"
                    onClick={e => { e.stopPropagation(); setItemToDelete(row); }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </IconButton>
                )}
              </div>
            );
          }}
          renderRowContextMenu={(row) => {
            const serials = serialsByInventoryId.get(row.id);
            return (
              <RowActionMenuItems
                onOpenWindow={() => openInventoryEditWindow(row)}
                onEdit={can('inventory', 'edit') ? () => openInventoryEditWindow(row) : undefined}
                onDelete={can('inventory', 'delete') ? () => setItemToDelete(row) : undefined}
              >
                {!!serials?.length && (
                  <DropdownMenuItem onClick={() => setItemToViewSerials(row)}>
                    <Hash className="mr-2 h-4 w-4" /> View Serials ({serials.length})
                  </DropdownMenuItem>
                )}
              </RowActionMenuItems>
            );
          }}
        />
      </div>

      {/* ── Footer status filters ── */}
      <StatusFilterBar
        options={[{ value: null, label: 'All' }, 'In Stock', 'Reserved', 'Out of Stock']}
        active={statusFilter}
        onChange={setStatusFilter}
        summary={`${filteredData.length} items`}
      />

      {/* ── Modals ── */}
      <ConfirmationModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Inventory Item"
        variant="danger"
      >
        Are you sure you want to delete <strong>{itemToDelete?.model_name || itemToDelete?.code || 'this item'}</strong>? This cannot be undone.
      </ConfirmationModal>

      {itemToViewSerials && (
        <ViewSerialsModal
          item={itemToViewSerials}
          serials={serialsByInventoryId.get(itemToViewSerials.id) ?? []}
          onClose={() => setItemToViewSerials(null)}
        />
      )}
    </div>
  );
};

export default InventoryDashboard;
