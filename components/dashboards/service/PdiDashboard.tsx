'use client';

import React, { useState, useMemo } from 'react';
import { PdiRecord } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { useNavigation } from '../../../contexts/NavigationContext';
import { ClipboardCheck, Search, Pencil, Trash2, ArrowRightToLine, WrapText, Scissors } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import PdiCreator from '../../features/service/PdiCreator';

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
  const { pdiRecords, setPdiRecords, loading } = useData();
  const { handleNavigation, navigation } = useNavigation();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter ?? 'All');
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('nowrap' as any);
  const [recordToDelete, setRecordToDelete] = useState<PdiRecord | null>(null);

  const isCreating = navigation.action === 'create' || navigation.action === 'edit' || navigation.action === 'view';

  const selectedRecord = useMemo(() => {
    if ((navigation.action === 'edit' || navigation.action === 'view') && navigation.id && pdiRecords) {
      return pdiRecords.find(r => r.id === navigation.id) ?? null;
    }
    return null;
  }, [navigation.action, navigation.id, pdiRecords]);

  const handleOpenNew = () => handleNavigation({ view: 'pdi-records', action: 'create' });
  const handleEdit = (row: PdiRecord) => handleNavigation({ view: 'pdi-records', action: 'edit', id: row.id });
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
    if (statusFilter !== 'All') data = data.filter(r => r.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(r =>
        r.pdi_no?.toLowerCase().includes(q) ||
        r.so_no?.toLowerCase().includes(q) ||
        r.company_name?.toLowerCase().includes(q) ||
        r.assigned_engineer?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [pdiRecords, statusFilter, searchQuery]);

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

  if (isCreating) {
    return (
      <PdiCreator
        existingRecord={selectedRecord}
        initialReadOnly={navigation.action === 'view'}
        onBack={() => handleNavigation({ view: 'pdi-records' })}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ClipboardCheck className="text-brand-500" size={20} />
              PDI Records
            </h2>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filteredData.length} records
            </span>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full lg:w-64">
              <input
                type="text"
                placeholder="Search PDI records..."
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
              <PermissionGate module="pdi_records" action="create">
                <button
                  onClick={handleOpenNew}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-md whitespace-nowrap text-sm"
                >
                  <span className="text-xl leading-none">+</span> New PDI
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
          tableId="pdi-table"
          data={filteredData}
          columns={displayedColumns}
          loading={loading}
          onRowClick={handleEdit}
          initialSort={{ key: 'pdi_date', direction: 'descending' }}
          cellWrapStyle={cellWrapStyle}
          mobilePrimaryColumns={['pdi_no', 'company_name', 'status']}
          renderRowActions={(row) => (
            <div className="flex items-center gap-1">
              <PermissionGate module="pdi_records" action="edit">
                <button
                  onClick={e => { e.stopPropagation(); handleEdit(row); }}
                  className="p-2 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
              </PermissionGate>
              <PermissionGate module="pdi_records" action="delete">
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteRequest(row); }}
                  className="p-2 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </PermissionGate>
            </div>
          )}
        />
      </div>

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
