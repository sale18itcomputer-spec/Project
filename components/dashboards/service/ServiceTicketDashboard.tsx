'use client';

import React, { useState, useMemo } from 'react';
import { ServiceTicket } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { useNavigation } from '../../../contexts/NavigationContext';
import { Wrench, Search, Pencil, Trash2, ArrowRightToLine, WrapText, Scissors } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import ServiceTicketCreator from '../../features/service/ServiceTicketCreator';

const COLUMNS_VISIBILITY_KEY = 'limperial-service-ticket-columns-visibility';

const STATUS_STYLES: Record<string, string> = {
  'Open':          'bg-sky-500/10 text-sky-500',
  'In Progress':   'bg-blue-500/10 text-blue-500',
  'Pending Parts': 'bg-amber-500/10 text-amber-500',
  'Resolved':      'bg-emerald-500/10 text-emerald-500',
  'Closed':        'bg-slate-500/10 text-slate-500',
  'Cancelled':     'bg-rose-500/10 text-rose-500',
};

const PRIORITY_STYLES: Record<string, string> = {
  'Low':      'bg-slate-500/10 text-slate-500',
  'Normal':   'bg-sky-500/10 text-sky-500',
  'High':     'bg-amber-500/10 text-amber-500',
  'Critical': 'bg-rose-500/10 text-rose-500',
};

const StatusBadge: React.FC<{ value: string; styleMap: Record<string, string> }> = ({ value, styleMap }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${styleMap[value] ?? 'bg-muted text-muted-foreground'}`}>
    {value}
  </span>
);

const ServiceTicketDashboard: React.FC<{ initialFilter?: string }> = ({ initialFilter }) => {
  const { serviceTickets, setServiceTickets, loading } = useData();
  const { handleNavigation, navigation } = useNavigation();
  const { addToast } = useToast();
  const { can } = usePermissions();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter ?? 'All');
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('nowrap' as any);
  const [ticketToDelete, setTicketToDelete] = useState<ServiceTicket | null>(null);

  const isCreating = navigation.action === 'create' || navigation.action === 'edit' || navigation.action === 'view';

  const selectedTicket = useMemo(() => {
    if ((navigation.action === 'edit' || navigation.action === 'view') && navigation.id && serviceTickets) {
      return serviceTickets.find(t => t.id === navigation.id) ?? null;
    }
    return null;
  }, [navigation.action, navigation.id, serviceTickets]);

  const handleOpenNew = () => handleNavigation({ view: 'service-tickets', action: 'create' });
  const handleEdit = (row: ServiceTicket) => handleNavigation({ view: 'service-tickets', action: 'edit', id: row.id });
  const handleDeleteRequest = (row: ServiceTicket) => setTicketToDelete(row);

  const handleConfirmDelete = async () => {
    if (!ticketToDelete?.id) return;
    const id = ticketToDelete.id;
    setServiceTickets(prev => prev ? prev.filter(t => t.id !== id) : null);
    setTicketToDelete(null);
    try {
      const { error } = await supabase.from('service_tickets').delete().eq('id', id);
      if (error) throw error;
      addToast('Ticket deleted.', 'success');
    } catch (err: any) {
      addToast(`Failed to delete: ${err.message}`, 'error');
      const { data } = await supabase.from('service_tickets').select('*').eq('id', id).single();
      if (data) setServiceTickets(prev => prev ? [data, ...prev] : [data]);
    }
  };

  const filteredData = useMemo(() => {
    let data = serviceTickets ?? [];
    if (statusFilter !== 'All') data = data.filter(t => t.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(t =>
        t.ticket_no?.toLowerCase().includes(q) ||
        t.company_name?.toLowerCase().includes(q) ||
        t.serial_number?.toLowerCase().includes(q) ||
        t.assigned_engineer?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [serviceTickets, statusFilter, searchQuery]);

  const allColumns = useMemo<ColumnDef<ServiceTicket>[]>(() => [
    {
      accessorKey: 'ticket_no',
      header: 'Ticket No',
      isSortable: true,
      cell: (value: string) => <span className="font-semibold text-muted-foreground/80">{value}</span>,
    },
    { accessorKey: 'ticket_date', header: 'Date', isSortable: true, cell: (v: string) => formatDisplayDate(v) },
    { accessorKey: 'ticket_type', header: 'Type', isSortable: true },
    { accessorKey: 'company_name', header: 'Company', isSortable: true },
    { accessorKey: 'serial_number', header: 'Serial No', isSortable: true },
    { accessorKey: 'brand', header: 'Brand', isSortable: true },
    { accessorKey: 'model_name', header: 'Model', isSortable: true },
    { accessorKey: 'assigned_engineer', header: 'Engineer', isSortable: true },
    {
      accessorKey: 'priority',
      header: 'Priority',
      isSortable: true,
      cell: (v: string) => <StatusBadge value={v} styleMap={PRIORITY_STYLES} />,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      isSortable: true,
      cell: (v: string) => <StatusBadge value={v} styleMap={STATUS_STYLES} />,
    },
    { accessorKey: 'warranty_status', header: 'Warranty', isSortable: true },
  ], []);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorageGet(COLUMNS_VISIBILITY_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch { }
    return new Set(['ticket_no', 'ticket_date', 'ticket_type', 'company_name', 'serial_number', 'assigned_engineer', 'priority', 'status']);
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

  const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Pending Parts', 'Resolved', 'Closed', 'Cancelled'];

  if (isCreating) {
    return (
      <ServiceTicketCreator
        existingTicket={selectedTicket}
        initialReadOnly={navigation.action === 'view'}
        onBack={() => handleNavigation({ view: 'service-tickets' })}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Wrench className="text-brand-500" size={20} />
              Service Tickets
            </h2>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filteredData.length} tickets
            </span>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full lg:w-64">
              <input
                type="text"
                placeholder="Search tickets..."
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
              <PermissionGate module="service_tickets" action="create">
                <button
                  onClick={handleOpenNew}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-md whitespace-nowrap text-sm"
                >
                  <span className="text-xl leading-none">+</span> New Ticket
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
          tableId="service-ticket-table"
          data={filteredData}
          columns={displayedColumns}
          loading={loading}
          onRowClick={handleEdit}
          initialSort={{ key: 'ticket_date', direction: 'descending' }}
          cellWrapStyle={cellWrapStyle}
          mobilePrimaryColumns={['ticket_no', 'company_name', 'status', 'priority']}
          renderRowActions={(row) => (
            <div className="flex items-center gap-1">
              <PermissionGate module="service_tickets" action="edit">
                <button
                  onClick={e => { e.stopPropagation(); handleEdit(row); }}
                  className="p-2 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
              </PermissionGate>
              <PermissionGate module="service_tickets" action="delete">
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
          renderRowContextMenu={(row) => (
            <RowActionMenuItems
              onEdit={can('service_tickets', 'edit') ? () => handleEdit(row) : undefined}
              onDelete={can('service_tickets', 'delete') ? () => handleDeleteRequest(row) : undefined}
            />
          )}
        />
      </div>

      <ConfirmationModal
        isOpen={!!ticketToDelete}
        onClose={() => setTicketToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Ticket"
        variant="danger"
      >
        Are you sure you want to delete ticket "{ticketToDelete?.ticket_no}"? This cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

export default ServiceTicketDashboard;
