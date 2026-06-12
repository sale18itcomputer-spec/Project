'use client';

import React, { useState, useMemo } from 'react';
import { SparePart } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef } from '../../common/DataTable';
import { Boxes, Search, Pencil, Trash2, ArrowRightToLine, WrapText, Scissors, Plus } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import NewSparePartModal from '../../modals/NewSparePartModal';

const COLUMNS_VISIBILITY_KEY = 'limperial-spare-part-columns-visibility';

const STATUS_STYLES: Record<string, string> = {
  'In Stock':     'bg-emerald-500/10 text-emerald-500',
  'Low Stock':    'bg-amber-500/10 text-amber-500',
  'Out of Stock': 'bg-rose-500/10 text-rose-500',
  'Discontinued': 'bg-slate-500/10 text-slate-500',
};

const StatusBadge: React.FC<{ value: string }> = ({ value }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[value] ?? 'bg-muted text-muted-foreground'}`}>
    {value}
  </span>
);

const SparePartDashboard: React.FC<{ initialFilter?: string }> = ({ initialFilter }) => {
  const { spareParts, setSpareParts, loading } = useData();
  const { addToast } = useToast();
  const { can } = usePermissions();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter ?? 'All');
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('nowrap' as any);
  const [partToDelete, setPartToDelete] = useState<SparePart | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);

  const handleOpenNew = () => { setEditingPart(null); setModalOpen(true); };
  const handleEdit = (row: SparePart) => { setEditingPart(row); setModalOpen(true); };

  const handleConfirmDelete = async () => {
    if (!partToDelete?.id) return;
    const id = partToDelete.id;
    setSpareParts(prev => prev ? prev.filter(p => p.id !== id) : null);
    setPartToDelete(null);
    try {
      const { error } = await supabase.from('spare_parts').delete().eq('id', id);
      if (error) throw error;
      addToast('Spare part deleted.', 'success');
    } catch (err: any) {
      addToast(`Failed to delete: ${err.message}`, 'error');
      const { data } = await supabase.from('spare_parts').select('*').eq('id', id).single();
      if (data) setSpareParts(prev => prev ? [data, ...prev] : [data]);
    }
  };

  const filteredData = useMemo(() => {
    let data = spareParts ?? [];
    if (statusFilter !== 'All') data = data.filter(p => p.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(p =>
        p.part_no?.toLowerCase().includes(q) ||
        p.part_name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.model_name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [spareParts, statusFilter, searchQuery]);

  const allColumns = useMemo<ColumnDef<SparePart>[]>(() => [
    {
      accessorKey: 'part_no',
      header: 'Part No',
      isSortable: true,
      cell: (v: string) => <span className="font-semibold text-muted-foreground/80">{v}</span>,
    },
    { accessorKey: 'part_name', header: 'Part Name', isSortable: true },
    { accessorKey: 'brand', header: 'Brand', isSortable: true },
    { accessorKey: 'model_name', header: 'Model', isSortable: true },
    { accessorKey: 'category', header: 'Category', isSortable: true },
    {
      accessorKey: 'qty',
      header: 'Qty',
      isSortable: true,
      cell: (v: number, row: SparePart) => (
        <span className={v <= (row.min_qty ?? 1) ? 'text-amber-500 font-semibold' : ''}>
          {v} {row.unit}
        </span>
      ),
    },
    { accessorKey: 'unit_cost', header: 'Unit Cost', isSortable: true, cell: (v: number, row: SparePart) => `${row.currency} ${v?.toFixed(2)}` },
    { accessorKey: 'supplier_name', header: 'Supplier', isSortable: true },
    { accessorKey: 'location', header: 'Location', isSortable: true },
    {
      accessorKey: 'status',
      header: 'Status',
      isSortable: true,
      cell: (v: string) => <StatusBadge value={v} />,
    },
  ], []);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorageGet(COLUMNS_VISIBILITY_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch { }
    return new Set(['part_no', 'part_name', 'brand', 'category', 'qty', 'unit_cost', 'status']);
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

  const STATUS_FILTERS = ['All', 'In Stock', 'Low Stock', 'Out of Stock', 'Discontinued'];

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Boxes className="text-brand-500" size={20} />
              Spare Parts
            </h2>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filteredData.length} parts
            </span>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full lg:w-64">
              <input
                type="text"
                placeholder="Search spare parts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-muted border-transparent text-sm rounded-lg focus:ring-2 focus:ring-brand-500 block w-full pl-10 p-2.5 transition"
              />
              <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
                <button onClick={() => setCellWrapStyle('overflow')} className={`p-1.5 rounded ${cellWrapStyle === 'overflow' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><ArrowRightToLine size={16} /></button>
                <button onClick={() => setCellWrapStyle('wrap')} className={`p-1.5 rounded ${cellWrapStyle === 'wrap' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><WrapText size={16} /></button>
                <button onClick={() => setCellWrapStyle('clip')} className={`p-1.5 rounded ${cellWrapStyle === 'clip' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><Scissors size={16} /></button>
              </div>
              <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />
              <PermissionGate module="spare_parts" action="create">
                <button
                  onClick={handleOpenNew}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-md whitespace-nowrap text-sm"
                >
                  <Plus size={16} /> Add Part
                </button>
              </PermissionGate>
            </div>
          </div>
        </div>

        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md border text-sm font-semibold transition ${
                statusFilter === s
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-4">
        <DataTable
          tableId="spare-part-table"
          data={filteredData}
          columns={displayedColumns}
          loading={loading}
          onRowClick={handleEdit}
          initialSort={{ key: 'part_no', direction: 'ascending' }}
          cellWrapStyle={cellWrapStyle}
          mobilePrimaryColumns={['part_no', 'part_name', 'qty', 'status']}
          renderRowActions={(row) => (
            <div className="flex items-center gap-1">
              <PermissionGate module="spare_parts" action="edit">
                <button
                  onClick={e => { e.stopPropagation(); handleEdit(row); }}
                  className="p-2 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
              </PermissionGate>
              <PermissionGate module="spare_parts" action="delete">
                <button
                  onClick={e => { e.stopPropagation(); setPartToDelete(row); }}
                  className="p-2 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </PermissionGate>
            </div>
          )}
          renderRowContextMenu={(row) => (
            <RowActionMenuItems
              onEdit={can('spare_parts', 'edit') ? () => handleEdit(row) : undefined}
              onDelete={can('spare_parts', 'delete') ? () => setPartToDelete(row) : undefined}
            />
          )}
        />
      </div>

      <NewSparePartModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        existingPart={editingPart}
      />

      <ConfirmationModal
        isOpen={!!partToDelete}
        onClose={() => setPartToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Spare Part"
        variant="danger"
      >
        Are you sure you want to delete spare part "{partToDelete?.part_no}"? This cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

export default SparePartDashboard;
