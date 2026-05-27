'use client';

import React, { useState, useMemo } from 'react';
import { InventoryItem } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import DataTable, { ColumnDef } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { formatCurrencySmartly } from '../../../utils/formatters';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { usePermissions } from '../../../hooks/usePermissions';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { Badge } from '../../ui/badge';
import {
  Warehouse, Search, ArrowRightToLine, WrapText, Scissors, Trash2,
  Pencil, PackageCheck, PackageX, AlertTriangle,
} from 'lucide-react';

const INVENTORY_COLUMNS_KEY = 'limperial-inventory-columns-visibility';

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  if (!status) return null;
  let variant: 'outline' | 'secondary' | 'destructive' = 'outline';
  let cls = '';
  const s = status.toLowerCase();
  if (s === 'in stock') {
    cls = 'font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/80 bg-emerald-500/10';
  } else if (s === 'reserved') {
    cls = 'font-semibold text-amber-700 dark:text-amber-400 border-amber-500/80 bg-amber-500/10';
    variant = 'outline';
  } else if (s === 'out of stock') {
    variant = 'destructive';
  }
  return <Badge variant={variant} className={cls}>{status}</Badge>;
};

// ── Edit modal (inline quick-edit) ────────────────────────────────────────────
interface EditModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSave: (updated: Partial<InventoryItem>) => Promise<void>;
}

const EditInventoryModal: React.FC<EditModalProps> = ({ item, onClose, onSave }) => {
  const [form, setForm] = useState({
    qty: item.qty ?? 0,
    unit_price: item.unit_price ?? 0,
    status: item.status ?? 'In Stock',
    category: item.category ?? '',
    brand: item.brand ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const inputCls =
    'block w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-foreground text-lg">Edit Inventory Item</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Qty</label>
              <input type="number" className={inputCls} value={form.qty} min={0} step="0.01"
                onChange={e => setForm(p => ({ ...p, qty: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Unit Price</label>
              <input type="number" className={inputCls} value={form.unit_price} min={0} step="0.01"
                onChange={e => setForm(p => ({ ...p, unit_price: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Status</label>
            <select className={inputCls} value={form.status}
              onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              <option value="In Stock">In Stock</option>
              <option value="Reserved">Reserved</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Category</label>
            <input className={inputCls} value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g. Components & Parts" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Brand</label>
            <input className={inputCls} value={form.brand}
              onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} placeholder="e.g. ASUS" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-muted transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 text-sm font-bold rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────
const InventoryDashboard: React.FC = () => {
  const { inventoryItems, setInventoryItems, loading } = useData();
  const { addToast } = useToast();
  const { currentUser } = useAuth();
  const { showField, can, canView } = usePermissions();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('wrap');
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);

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
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
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
  }, [inventoryItems, searchQuery, statusFilter]);

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
          <p className="text-sm text-muted-foreground line-clamp-2 max-w-sm">{value || '—'}</p>
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

  // ── Edit ──────────────────────────────────────────────────────────────────────
  const handleSaveEdit = async (updated: Partial<InventoryItem>) => {
    if (!itemToEdit) return;
    const id = itemToEdit.id;
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ ...updated, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setInventoryItems(prev =>
        prev ? prev.map(i => i.id === id ? { ...i, ...updated } : i) : null
      );
      addToast('Inventory item updated.', 'success');
    } catch (err: any) {
      addToast(`Failed to update: ${err.message}`, 'error');
    } finally {
      setItemToEdit(null);
    }
  };

  // ── Access guard ─────────────────────────────────────────────────────────────
  if (!canView('inventory')) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-background">
        <Warehouse className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold mb-2 text-foreground">Access Restricted</h2>
        <p className="max-w-md">You don't have permission to view Inventory.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Warehouse className="text-brand-500" />
            Inventory
          </h2>
          <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {filteredData.length} items
          </span>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="relative w-full lg:w-64">
            <input
              type="text"
              placeholder="Search inventory…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-muted border-transparent text-sm rounded-lg focus:ring-2 focus:ring-brand-500 block w-full pl-10 p-2.5 transition"
            />
            <Search className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
          </div>

          {/* Wrap / Column controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
              <button onClick={() => setCellWrapStyle('overflow')} title="Overflow"
                className={`p-1.5 rounded ${cellWrapStyle === 'overflow' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}>
                <ArrowRightToLine size={16} />
              </button>
              <button onClick={() => setCellWrapStyle('wrap')} title="Wrap"
                className={`p-1.5 rounded ${cellWrapStyle === 'wrap' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}>
                <WrapText size={16} />
              </button>
              <button onClick={() => setCellWrapStyle('clip')} title="Clip"
                className={`p-1.5 rounded ${cellWrapStyle === 'clip' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}>
                <Scissors size={16} />
              </button>
            </div>
            <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />
          </div>
        </div>
      </header>

      {/* ── Metric cards ── */}
      <div className="flex-shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 lg:px-6 py-3 bg-muted/20 border-b border-border">
        <div className="bg-card rounded-lg border border-border px-4 py-3 flex items-center gap-3">
          <Warehouse className="w-8 h-8 text-brand-500/70 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Items</p>
            <p className="text-xl font-bold text-foreground">{metrics.total}</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border px-4 py-3 flex items-center gap-3">
          <PackageCheck className="w-8 h-8 text-emerald-500/70 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">In Stock</p>
            <p className="text-xl font-bold text-emerald-600">{metrics.inStock}</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-500/70 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">Reserved</p>
            <p className="text-xl font-bold text-amber-600">{metrics.reserved}</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border px-4 py-3 flex items-center gap-3">
          <PackageX className="w-8 h-8 text-rose-500/70 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">Out of Stock</p>
            <p className="text-xl font-bold text-rose-600">{metrics.outOfStock}</p>
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
          renderRowActions={(row) => (
            <div className="flex items-center gap-2">
              {can('inventory', 'edit') && (
                <button
                  onClick={e => { e.stopPropagation(); setItemToEdit(row); }}
                  className="p-2 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
              )}
              {can('inventory', 'delete') && (
                <button
                  onClick={e => { e.stopPropagation(); setItemToDelete(row); }}
                  className="p-2 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
        />
      </div>

      {/* ── Footer status filters ── */}
      <footer className="flex-shrink-0 bg-card border-t border-border p-3 flex items-center gap-3">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {[null, 'In Stock', 'Reserved', 'Out of Stock'].map(s => (
            <button
              key={s ?? 'all'}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              className={`whitespace-nowrap px-5 py-2 rounded-md border text-sm font-semibold transition
                ${statusFilter === s
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
            >
              {s ?? 'All'}
            </button>
          ))}
        </div>
      </footer>

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

      {itemToEdit && (
        <EditInventoryModal
          item={itemToEdit}
          onClose={() => setItemToEdit(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
};

export default InventoryDashboard;
