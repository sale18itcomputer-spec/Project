'use client';

import React, { useState, useMemo } from 'react';
import { PdiRecord } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef, CellWrapStyle } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { ClipboardCheck, Pencil, Trash2, Plus } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import PdiWindowContent from '../../windows/content/PdiWindowContent';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import ErrorState from '../../common/ErrorState';
import StatusFilterBar from '../../common/StatusFilterBar';
import IconButton from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const COLUMNS_VISIBILITY_KEY = 'limperial-pdi-columns-visibility';

const STATUS_STYLES: Record<string, string> = {
  'Pending':   'bg-amber-500/10 text-amber-500',
  'In Progress':'bg-blue-500/10 text-blue-500',
  'Completed': 'bg-emerald-500/10 text-emerald-500',
  'Failed':    'bg-rose-500/10 text-rose-500',
};

const CONDITION_STYLES: Record<string, string> = {
  'New':     'bg-emerald-500/10 text-emerald-500',
  'Good':    'bg-sky-500/10 text-sky-500',
  'Fair':    'bg-amber-500/10 text-amber-500',
  'Poor':    'bg-orange-500/10 text-orange-500',
  'Damaged': 'bg-rose-500/10 text-rose-500',
};

const StatusBadge: React.FC<{ value: string; styleMap: Record<string, string> }> = ({ value, styleMap }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${styleMap[value] ?? 'bg-muted text-muted-foreground'}`}>
    {value}
  </span>
);

const PdiDashboard: React.FC<{ initialFilter?: string }> = ({ initialFilter }) => {
  const { pdiRecords, setPdiRecords, loading, error } = useData();
  const { addToast } = useToast();
  const { can } = usePermissions();
  const { openWindow } = useWindowManager();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string | null>(initialFilter ?? 'All');
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
  const [recordToDelete, setRecordToDelete] = useState<PdiRecord | null>(null);

  const openPdiWindow = (id: string | null, initialReadOnly: boolean) => {
    const windowId = `pdi-record-${id ?? 'new'}`;
    openWindow({
      id: windowId,
      title: id ? 'PDI Record' : 'New PDI Record',
      content: <PdiWindowContent windowId={windowId} pdiId={id} initialReadOnly={initialReadOnly} />,
      draggable: true,
      initialWidth: 900,
      initialHeight: 760,
      minWidth: 640,
      minHeight: 480,
    });
  };

  const handleOpenNew = () => openPdiWindow(null, false);
  const handleViewPdi = (row: PdiRecord) => openPdiWindow(row.id!, true);
  const handleEditPdi = (row: PdiRecord) => openPdiWindow(row.id!, false);
  const handleDeleteRequest = (row: PdiRecord) => setRecordToDelete(row);

  const handleConfirmDelete = async () => {
    if (!recordToDelete?.id) return;
    const id = recordToDelete.id;
    setPdiRecords(prev => prev ? prev.filter(r => r.id !== id) : null);
    setRecordToDelete(null);
    try {
      const { error } = await supabase.from('pdi_records').delete().eq('id', id);
      if (error) throw error;
      addToast('PDI record deleted.', 'success');
    } catch (err: any) {
      addToast(`Failed to delete: ${err.message}`, 'error');
      const { data } = await supabase.from('pdi_records').select('*').eq('id', id).single();
      if (data) setPdiRecords(prev => prev ? [data, ...prev] : [data]);
    }
  };

  const filteredData = useMemo(() => {
    let data = pdiRecords ?? [];
    // `null` is what StatusFilterBar writes when the active chip is cleared —
    // it means the same thing as the 'All' chip: no status filter.
    if (statusFilter && statusFilter !== 'All') data = data.filter(r => r.status === statusFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter(r =>
        r.pdi_no?.toLowerCase().includes(q) ||
        r.so_no?.toLowerCase().includes(q) ||
        r.company_name?.toLowerCase().includes(q) ||
        r.assigned_engineer?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [pdiRecords, statusFilter, debouncedSearch]);

  const allColumns = useMemo<ColumnDef<PdiRecord>[]>(() => [
    {
      accessorKey: 'pdi_no',
      header: 'PDI No',
      isSortable: true,
      cell: (v: string) => <span className="font-semibold text-muted-foreground/80">{v}</span>,
    },
    { accessorKey: 'pdi_date', header: 'Date', isSortable: true, cell: (v: string) => formatDisplayDate(v) },
    { accessorKey: 'so_no', header: 'SO No', isSortable: true },
    { accessorKey: 'company_name', header: 'Company', isSortable: true },
    { accessorKey: 'contact_name', header: 'Contact', isSortable: true },
    { accessorKey: 'assigned_engineer', header: 'Engineer', isSortable: true },
    {
      accessorKey: 'overall_condition',
      header: 'Condition',
      isSortable: true,
      cell: (v: string) => <StatusBadge value={v} styleMap={CONDITION_STYLES} />,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      isSortable: true,
      cell: (v: string) => <StatusBadge value={v} styleMap={STATUS_STYLES} />,
    },
  ], []);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorageGet(COLUMNS_VISIBILITY_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch { }
    return new Set(['pdi_no', 'pdi_date', 'so_no', 'company_name', 'assigned_engineer', 'overall_condition', 'status']);
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

  const STATUS_FILTERS = ['All', 'Pending', 'In Progress', 'Completed', 'Failed'];

  if (error) {
    return <ErrorState title="Could not load PDI records" message={error} />;
  }

  return (
    <div className="h-full flex flex-col">
      <DashboardHeader
        title="PDI Records"
        icon={<ClipboardCheck />}
        subtitle={`${filteredData.length} records`}
      >
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search PDI records..."
          label="Search PDI records"
        />

        <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

        <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />

        <PermissionGate module="pdi_records" action="create">
          <Button variant="success" onClick={handleOpenNew} aria-label="New PDI">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New PDI</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

      <div className="flex-1 overflow-hidden p-4">
        <DataTable
          tableId="pdi-table"
          data={filteredData}
          columns={displayedColumns}
          loading={loading}
          onRowClick={handleViewPdi}
          initialSort={{ key: 'pdi_date', direction: 'descending' }}
          cellWrapStyle={cellWrapStyle}
          mobilePrimaryColumns={['pdi_no', 'company_name', 'status']}
          emptyState={{
            title: 'No PDI records yet',
            description: 'Pre-delivery inspections you log for outgoing units will appear here.',
          }}
          renderRowActions={(row) => (
            <div className="flex items-center gap-1">
              <PermissionGate module="pdi_records" action="edit">
                <IconButton
                  label="Edit PDI record"
                  tone="primary"
                  onClick={e => { e.stopPropagation(); handleEditPdi(row); }}
                >
                  <Pencil size={15} aria-hidden="true" />
                </IconButton>
              </PermissionGate>
              <PermissionGate module="pdi_records" action="delete">
                <IconButton
                  label="Delete PDI record"
                  tone="danger"
                  onClick={e => { e.stopPropagation(); handleDeleteRequest(row); }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </IconButton>
              </PermissionGate>
            </div>
          )}
          renderRowContextMenu={(row) => (
            <RowActionMenuItems
              onOpenWindow={() => openPdiWindow(row.id!, true)}
              onEdit={can('pdi_records', 'edit') ? () => handleEditPdi(row) : undefined}
              onDelete={can('pdi_records', 'delete') ? () => handleDeleteRequest(row) : undefined}
            />
          )}
        />
      </div>

      {/* Status filter tabs */}
      <StatusFilterBar
        options={STATUS_FILTERS}
        active={statusFilter}
        onChange={setStatusFilter}
        summary={`${filteredData.length} records`}
      />

      <ConfirmationModal
        isOpen={!!recordToDelete}
        onClose={() => setRecordToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete PDI Record"
        variant="danger"
      >
        Are you sure you want to delete PDI record "{recordToDelete?.pdi_no}"? This cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

export default PdiDashboard;
