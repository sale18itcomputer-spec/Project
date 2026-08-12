'use client';

import React, { useState, useMemo } from 'react';
import { SparePart } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef, CellWrapStyle } from '../../common/DataTable';
import { Boxes, Pencil, Trash2, Plus } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import SparePartWindowContent from '../../windows/content/SparePartWindowContent';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import ErrorState from '../../common/ErrorState';
import StatusFilterBar from '../../common/StatusFilterBar';
import IconButton from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const COLUMNS_VISIBILITY_KEY = 'limperial-spare-part-columns-visibility';

const STATUS_STYLES: Record<string, string> = {
  'In Stock':     'bg-emerald-500/10 text-emerald-500',
  'Low Stock':    'bg-amber-500/10 text-amber-500',
  'Out of Stock': 'bg-rose-500/10 text-rose-500',
  'Discontinued': 'bg-muted text-muted-foreground',
};

const StatusBadge: React.FC<{ value: string }> = ({ value }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[value] ?? 'bg-muted text-muted-foreground'}`}>
    {value}
  </span>
);

const SparePartDashboard: React.FC<{ initialFilter?: string }> = ({ initialFilter }) => {
  const { spareParts, setSpareParts, loading, error } = useData();
  const { addToast } = useToast();
  const { can } = usePermissions();
  const { openWindow } = useWindowManager();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string | null>(initialFilter ?? 'All');
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
  const [partToDelete, setPartToDelete] = useState<SparePart | null>(null);

  const openSparePartWindow = (id: string | null, initialReadOnly: boolean) => {
    const windowId = `spare-part-${id ?? 'new'}`;
    openWindow({
      id: windowId,
      title: id ? 'Spare Part' : 'Add Spare Part',
      content: <SparePartWindowContent windowId={windowId} partId={id} initialReadOnly={initialReadOnly} />,
      draggable: true,
    });
  };

  const handleOpenNew = () => openSparePartWindow(null, false);
  const handleEdit = (row: SparePart) => openSparePartWindow(row.id!, false);

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
    // `null` is what StatusFilterBar writes when the active chip is cleared —
    // it means the same thing as the 'All' chip: no status filter.
    if (statusFilter && statusFilter !== 'All') data = data.filter(p => p.status === statusFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter(p =>
        p.part_no?.toLowerCase().includes(q) ||
        p.part_name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.model_name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [spareParts, statusFilter, debouncedSearch]);

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

  if (error) {
    return <ErrorState title="Could not load spare parts" message={error} />;
  }

  return (
    <div className="h-full flex flex-col">
      <DashboardHeader
        title="Spare Parts"
        icon={<Boxes />}
        subtitle={`${filteredData.length} parts`}
      >
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search spare parts..."
          label="Search spare parts"
        />

        <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

        <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />

        <PermissionGate module="spare_parts" action="create">
          <Button variant="success" onClick={handleOpenNew} aria-label="Add part">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Add Part</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

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
          emptyState={{
            title: 'No spare parts yet',
            description: 'Parts you stock for repairs and replacements will appear here.',
          }}
          renderRowActions={(row) => (
            <div className="flex items-center gap-1">
              <PermissionGate module="spare_parts" action="edit">
                <IconButton
                  label="Edit spare part"
                  tone="primary"
                  onClick={e => { e.stopPropagation(); handleEdit(row); }}
                >
                  <Pencil size={15} aria-hidden="true" />
                </IconButton>
              </PermissionGate>
              <PermissionGate module="spare_parts" action="delete">
                <IconButton
                  label="Delete spare part"
                  tone="danger"
                  onClick={e => { e.stopPropagation(); setPartToDelete(row); }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </IconButton>
              </PermissionGate>
            </div>
          )}
          renderRowContextMenu={(row) => (
            <RowActionMenuItems
              onOpenWindow={() => openSparePartWindow(row.id!, false)}
              onEdit={can('spare_parts', 'edit') ? () => handleEdit(row) : undefined}
              onDelete={can('spare_parts', 'delete') ? () => setPartToDelete(row) : undefined}
            />
          )}
        />
      </div>

      {/* Status filter tabs */}
      <StatusFilterBar
        options={STATUS_FILTERS}
        active={statusFilter}
        onChange={setStatusFilter}
        summary={`${filteredData.length} parts`}
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
