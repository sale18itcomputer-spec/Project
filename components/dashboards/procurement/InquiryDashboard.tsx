'use client';

import React, { useState, useMemo } from 'react';
import { ProductInquiry } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef, CellWrapStyle } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { Search, Pencil, Trash2, Plus } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import InquiryWindowContent from '../../windows/content/InquiryWindowContent';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import ErrorState from '../../common/ErrorState';
import StatusFilterBar from '../../common/StatusFilterBar';
import IconButton from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const COLUMNS_VISIBILITY_KEY = 'limperial-inquiry-columns-visibility';

const STATUS_STYLES: Record<string, string> = {
  'Draft':       'bg-sky-500/10 text-sky-500',
  'Pending':     'bg-amber-500/10 text-amber-500',
  'In Progress': 'bg-blue-500/10 text-blue-500',
  'Quoted':      'bg-emerald-500/10 text-emerald-500',
  'Cancelled':   'bg-rose-500/10 text-rose-500',
};

const PRIORITY_STYLES: Record<string, string> = {
  'Low':    'bg-muted-foreground/10 text-muted-foreground',
  'Normal': 'bg-sky-500/10 text-sky-500',
  'High':   'bg-amber-500/10 text-amber-500',
  'Urgent': 'bg-rose-500/10 text-rose-500',
};

const StatusBadge: React.FC<{ value: string; styleMap: Record<string, string> }> = ({ value, styleMap }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${styleMap[value] ?? 'bg-muted text-muted-foreground'}`}>
    {value}
  </span>
);

const InquiryDashboard: React.FC<{ initialFilter?: string }> = ({ initialFilter }) => {
  const { productInquiries, setProductInquiries, loading, error } = useData();
  const { addToast } = useToast();
  const { can } = usePermissions();
  const { openWindow } = useWindowManager();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string | null>(initialFilter ?? 'All');
  const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
  const [inquiryToDelete, setInquiryToDelete] = useState<ProductInquiry | null>(null);

  const openInquiryWindow = (inquiryId: string | null, initialReadOnly: boolean) => {
    const id = `inquiry-${inquiryId ?? 'new'}`;
    openWindow({
      id,
      title: inquiryId ? 'Product Inquiry' : 'New Product Inquiry',
      content: <InquiryWindowContent windowId={id} inquiryId={inquiryId} initialReadOnly={initialReadOnly} />,
      draggable: true,
      initialWidth: 1100,
      initialHeight: 720,
      minWidth: 800,
      minHeight: 500,
    });
  };

  const handleOpenNew = () => openInquiryWindow(null, false);
  const handleEdit = (row: ProductInquiry) => openInquiryWindow(row.id!, false);
  const handleDeleteRequest = (row: ProductInquiry) => setInquiryToDelete(row);

  const handleConfirmDelete = async () => {
    if (!inquiryToDelete?.id) return;
    const id = inquiryToDelete.id;
    setProductInquiries(prev => prev ? prev.filter(i => i.id !== id) : null);
    setInquiryToDelete(null);
    try {
      const { error } = await supabase.from('product_inquiries').delete().eq('id', id);
      if (error) throw error;
      addToast('Inquiry deleted.', 'success');
    } catch (err: any) {
      addToast(`Failed to delete: ${err.message}`, 'error');
      // Revert optimistic delete on failure
      const { data } = await supabase.from('product_inquiries').select('*').eq('id', id).single();
      if (data) setProductInquiries(prev => prev ? [data, ...prev] : [data]);
    }
  };

  const filteredData = useMemo(() => {
    let data = productInquiries ?? [];
    // `null` is what StatusFilterBar writes when the active chip is cleared —
    // it means the same thing as the 'All' chip: no status filter.
    if (statusFilter && statusFilter !== 'All') {
      data = data.filter(i => i.status === statusFilter);
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter(i =>
        i.inquiry_no?.toLowerCase().includes(q) ||
        i.company_name?.toLowerCase().includes(q) ||
        i.contact_name?.toLowerCase().includes(q) ||
        i.responsible_by?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [productInquiries, statusFilter, debouncedSearch]);

  const allColumns = useMemo<ColumnDef<ProductInquiry>[]>(() => [
    {
      accessorKey: 'inquiry_no',
      header: 'Inquiry No',
      isSortable: true,
      cell: (value: string) => (
        <span className="font-semibold text-muted-foreground/80">{value}</span>
      ),
    },
    {
      accessorKey: 'inquiry_date',
      header: 'Date',
      isSortable: true,
      cell: (value: string) => formatDisplayDate(value),
    },
    {
      accessorKey: 'company_name',
      header: 'Company',
      isSortable: true,
    },
    {
      accessorKey: 'contact_name',
      header: 'Contact',
      isSortable: true,
    },
    {
      accessorKey: 'responsible_by',
      header: 'Sales Rep',
      isSortable: true,
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      isSortable: true,
      cell: (value: string) => <StatusBadge value={value} styleMap={PRIORITY_STYLES} />,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      isSortable: true,
      cell: (value: string) => <StatusBadge value={value} styleMap={STATUS_STYLES} />,
    },
    {
      accessorKey: 'remarks',
      header: 'Remarks',
      isSortable: true,
      cell: (value: string) => (
        <span className="truncate block max-w-[200px]" title={value}>{value}</span>
      ),
    },
  ], []);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorageGet(COLUMNS_VISIBILITY_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch { }
    return new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean));
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

  const STATUS_FILTERS = ['All', 'Draft', 'Pending', 'In Progress', 'Quoted', 'Cancelled'];

  if (error) {
    return <ErrorState title="Could not load product inquiries" message={error} />;
  }

  return (
    <div className="h-full flex flex-col">
      <DashboardHeader
        title="Product Inquiries"
        icon={<Search />}
        subtitle={`${filteredData.length} inquiries`}
      >
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search inquiries..."
          label="Search inquiries"
        />

        <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

        <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />

        <PermissionGate module="product_inquiries" action="create">
          <Button variant="success" onClick={handleOpenNew} aria-label="New inquiry">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New Inquiry</span>
          </Button>
        </PermissionGate>
      </DashboardHeader>

      <div className="flex-1 overflow-hidden p-4">
        <DataTable
          tableId="inquiry-table"
          data={filteredData}
          columns={displayedColumns}
          loading={loading}
          onRowClick={handleEdit}
          initialSort={{ key: 'inquiry_date', direction: 'descending' }}
          cellWrapStyle={cellWrapStyle}
          mobilePrimaryColumns={['inquiry_no', 'company_name', 'status', 'priority']}
          emptyState={{
            title: 'No product inquiries yet',
            description: 'Inquiries you record will appear here.',
          }}
          renderRowActions={(row) => (
            <div className="flex items-center gap-1">
              <PermissionGate module="product_inquiries" action="edit">
                <IconButton
                  label="Edit inquiry"
                  tone="primary"
                  onClick={e => { e.stopPropagation(); handleEdit(row); }}
                >
                  <Pencil size={15} aria-hidden="true" />
                </IconButton>
              </PermissionGate>
              <PermissionGate module="product_inquiries" action="delete">
                <IconButton
                  label="Delete inquiry"
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
              onOpenWindow={() => openInquiryWindow(row.id!, false)}
              onEdit={can('product_inquiries', 'edit') ? () => handleEdit(row) : undefined}
              onDelete={can('product_inquiries', 'delete') ? () => handleDeleteRequest(row) : undefined}
            />
          )}
        />
      </div>

      {/* Status filter tabs */}
      <StatusFilterBar
        options={STATUS_FILTERS}
        active={statusFilter}
        onChange={setStatusFilter}
        summary={`${filteredData.length} inquiries`}
      />

      <ConfirmationModal
        isOpen={!!inquiryToDelete}
        onClose={() => setInquiryToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Inquiry"
        variant="danger"
      >
        Are you sure you want to delete inquiry "{inquiryToDelete?.inquiry_no}"? This cannot be undone.
      </ConfirmationModal>
    </div>
  );
};

export default InquiryDashboard;
