'use client';

import React, { useState, useMemo } from 'react';
import { ServiceTicket } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef, CellWrapStyle } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { Wrench, Pencil, Trash2, Plus } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import ServiceTicketWindowContent from '../../windows/content/ServiceTicketWindowContent';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import ErrorState from '../../common/ErrorState';
import StatusFilterBar from '../../common/StatusFilterBar';
import IconButton from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const COLUMNS_VISIBILITY_KEY = 'limperial-service-ticket-columns-visibility';

const STATUS_STYLES: Record<string, string> = {
  'Open':          'bg-sky-500/10 text-sky-500',
  'In Progress':   'bg-blue-500/10 text-blue-500',
  'Pending Parts': 'bg-amber-500/10 text-amber-500',
  'Resolved':      'bg-emerald-500/10 text-emerald-500',
  'Closed':        'bg-muted-foreground/10 text-muted-foreground',
  'Cancelled':     'bg-rose-500/10 text-rose-500',
};

const PRIORITY_STYLES: Record<string, string> = {
  'Low':      'bg-muted-foreground/10 text-muted-foreground',
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
  const { serviceTickets, setServiceTickets, loading, error } = useData();
  const { addToast } = useToast();
  const { can } = usePermissions();
  const { openWindow } = useWindowManager();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string | null>(initialFilter ?? 'All');
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
  const [ticketToDelete, setTicketToDelete] = useState<ServiceTicket | null>(null);

  const openTicketWindow = (id: string | null, initialReadOnly: boolean) => {
    const windowId = `service-ticket-${id ?? 'new'}`;
    openWindow({
      id: windowId,
      title: id ? 'Service Ticket' : 'New Service Ticket',
      content: <ServiceTicketWindowContent windowId={windowId} ticketId={id} initialReadOnly={initialReadOnly} />,
      draggable: true,
      initialWidth: 900,
      initialHeight: 760,
      // Content area needs >=768px (minus 48px padding = ~816px window) to
      // stay above the @md container-query breakpoint that keeps the header
      // grid at 4 columns — below that it intentionally drops to 2 columns
      // rather than truncating. Floor is set above that line so the window
      // can never be resized small enough to trigger the narrower layout.
      minWidth: 880,
      minHeight: 480,
    });
  };

  const handleOpenNew = () => openTicketWindow(null, false);
  const handleViewTicket = (row: ServiceTicket) => openTicketWindow(row.id!, true);
  const handleEditTicket = (row: ServiceTicket) => openTicketWindow(row.id!, false);
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
    // `null` is what StatusFilterBar writes when the active chip is cleared —
    // it means the same thing as the 'All' chip: no status filter.
    if (statusFilter && statusFilter !== 'All') data = data.filter(t => t.status === statusFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter(t =>
        t.ticket_no?.toLowerCase().includes(q) ||
        t.company_name?.toLowerCase().includes(q) ||
        t.serial_number?.toLowerCase().includes(q) ||
        t.assigned_engineer?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [serviceTickets, statusFilter, debouncedSearch]);

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

  if (error) {
    return <ErrorState title="Could not load service tickets" message={error} />;
  }

  return (
    <div className="h-full flex flex-col">
      <DashboardHeader
        title="Service Tickets"
        icon={<Wrench />}
        subtitle={`${filteredData.length} tickets`}
      >
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search tickets..."
          label="Search tickets"
        />

        <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

        <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />

        <PermissionGate module="service_tickets" action="create">
          <Button variant="success" onClick={handleOpenNew} aria-label="New ticket">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New Ticket</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

      <div className="flex-1 overflow-hidden p-4">
        <DataTable
          tableId="service-ticket-table"
          data={filteredData}
          columns={displayedColumns}
          loading={loading}
          onRowClick={handleViewTicket}
          initialSort={{ key: 'ticket_date', direction: 'descending' }}
          cellWrapStyle={cellWrapStyle}
          mobilePrimaryColumns={['ticket_no', 'company_name', 'status', 'priority']}
          emptyState={{
            title: 'No service tickets yet',
            description: 'Tickets you raise for repairs and site visits will appear here.',
          }}
          renderRowActions={(row) => (
            <div className="flex items-center gap-1">
              <PermissionGate module="service_tickets" action="edit">
                <IconButton
                  label="Edit ticket"
                  tone="primary"
                  onClick={e => { e.stopPropagation(); handleEditTicket(row); }}
                >
                  <Pencil size={15} aria-hidden="true" />
                </IconButton>
              </PermissionGate>
              <PermissionGate module="service_tickets" action="delete">
                <IconButton
                  label="Delete ticket"
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
              onOpenWindow={() => openTicketWindow(row.id!, true)}
              onEdit={can('service_tickets', 'edit') ? () => handleEditTicket(row) : undefined}
              onDelete={can('service_tickets', 'delete') ? () => handleDeleteRequest(row) : undefined}
            />
          )}
        />
      </div>

      {/* Status filter tabs */}
      <StatusFilterBar
        options={STATUS_FILTERS}
        active={statusFilter}
        onChange={setStatusFilter}
        summary={`${filteredData.length} tickets`}
      />

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
