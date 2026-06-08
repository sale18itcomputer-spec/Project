'use client';

import React, { useState, useMemo } from 'react';
import { SerialNumber } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { Hash, Search, Pencil, Trash2, ArrowRightToLine, WrapText, Scissors, Plus } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import NewSerialNumberModal from '../../modals/NewSerialNumberModal';

const COLUMNS_VISIBILITY_KEY = 'limperial-serial-number-columns-visibility';

const STATUS_STYLES: Record<string, string> = {
  'Active':      'bg-emerald-500/10 text-emerald-500',
  'In Service':  'bg-blue-500/10 text-blue-500',
  'Returned':    'bg-amber-500/10 text-amber-500',
  'Written Off': 'bg-slate-500/10 text-slate-500',
  'Retired':     'bg-rose-500/10 text-rose-500',
};

const StatusBadge: React.FC<{ value: string }> = ({ value }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[value] ?? 'bg-muted text-muted-foreground'}`}>
    {value}
  </span>
);

const SerialNumberDashboard: React.FC<{ initialFilter?: string }> = ({ initialFilter }) => {
  const { serialNumbers, setSerialNumbers, loading } = useData();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter ?? 'All');
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('nowrap' as any);
  const [snToDelete, setSnToDelete] = useState<SerialNumber | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSN, setEditingSN] = useState<SerialNumber | null>(null);

  const handleOpenNew = () => { setEditingSN(null); setModalOpen(true); };
  const handleEdit = (row: SerialNumber) => { setEditingSN(row); setModalOpen(true); };

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

  const filteredData = useMemo(() => {
    let data = serialNumbers ?? [];
    if (statusFilter !== 'All') data = data.filter(s => s.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(s =>
        s.serial_number?.toLowerCase().includes(q) ||
        s.brand?.toLowerCase().includes(q) ||
        s.model_name?.toLowerCase().includes(q) ||
        s.company_name?.toLowerCase().includes(q) ||
        s.so_no?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [serialNumbers, statusFilter, searchQuery]);

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
    return new Set(['serial_number', 'brand', 'model_name', 'company_name', 'so_no', 'warranty_end_date', 'status']);
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

  const STATUS_FILTERS = ['All', 'Active', 'In Service', 'Returned', 'Written Off', 'Retired'];

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Hash className="text-brand-500" size={20} />
              Serial Numbers
            </h2>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filteredData.length} entries
            </span>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full lg:w-64">
              <input
                type="text"
                placeholder="Search serial numbers..."
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
              <PermissionGate module="serial_numbers" action="create">
                <button
                  onClick={handleOpenNew}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-md whitespace-nowrap text-sm"
                >
                  <Plus size={16} /> Add Serial
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
          tableId="serial-number-table"
          data={filteredData}
          columns={displayedColumns}
          loading={loading}
          onRowClick={handleEdit}
          initialSort={{ key: 'created_at', direction: 'descending' }}
          cellWrapStyle={cellWrapStyle}
          mobilePrimaryColumns={['serial_number', 'brand', 'model_name', 'status']}
          renderRowActions={(row) => (
            <div className="flex items-center gap-1">
              <PermissionGate module="serial_numbers" action="edit">
                <button
                  onClick={e => { e.stopPropagation(); handleEdit(row); }}
                  className="p-2 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
              </PermissionGate>
              <PermissionGate module="serial_numbers" action="delete">
                <button
                  onClick={e => { e.stopPropagation(); setSnToDelete(row); }}
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

      <NewSerialNumberModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        existingSN={editingSN}
      />

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

export default SerialNumberDashboard;
