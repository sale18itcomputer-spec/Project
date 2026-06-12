'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { SerialNumber } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { Hash, Search, Pencil, Trash2, ArrowRightToLine, WrapText, Scissors, Plus, Package } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
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

interface SoldItem {
  _key: string;
  invNo: string;
  invDate: string;
  companyName: string;
  contactName: string;
  soNo: string;
  itemCode: string;
  modelName: string;
  description: string;
  qty: number;
  brand: string;
}

type ActiveTab = 'registered' | 'from-invoices';

const SerialNumberDashboard: React.FC<{ initialFilter?: string }> = ({ initialFilter }) => {
  const { serialNumbers, setSerialNumbers, invoices, pricelist, fetchModule, loading } = useData();
  const { addToast } = useToast();
  const { can } = usePermissions();

  const [activeTab, setActiveTab] = useState<ActiveTab>('registered');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter ?? 'All');
  const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('nowrap' as any);
  const [snToDelete, setSnToDelete] = useState<SerialNumber | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSN, setEditingSN] = useState<SerialNumber | null>(null);
  const [prefillForModal, setPrefillForModal] = useState<Partial<SerialNumber> | undefined>(undefined);

  useEffect(() => {
    if (activeTab === 'from-invoices') {
      fetchModule('Invoices', 'Raw');
    }
  }, [activeTab, fetchModule]);

  const handleOpenNew = () => { setEditingSN(null); setPrefillForModal(undefined); setModalOpen(true); };
  const handleEdit = (row: SerialNumber) => { setEditingSN(row); setPrefillForModal(undefined); setModalOpen(true); };

  const handleRegisterFromInvoice = (item: SoldItem) => {
    setEditingSN(null);
    setPrefillForModal({
      company_name: item.companyName,
      contact_name: item.contactName,
      so_no: item.soNo,
      brand: item.brand,
      model_name: item.modelName,
      description: item.description,
      status: 'Active',
    });
    setModalOpen(true);
  };

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

  // Build a brand lookup map from pricelist
  const brandByCode = useMemo(() => {
    const map = new Map<string, string>();
    (pricelist ?? []).forEach(p => { if (p['Code']) map.set(p['Code'], p['Brand'] ?? ''); });
    return map;
  }, [pricelist]);

  // Derive sold items from invoices (Completed + Processing statuses)
  const soldItems = useMemo<SoldItem[]>(() => {
    if (!invoices) return [];
    const result: SoldItem[] = [];
    const eligible = invoices.filter(inv =>
      inv['Status'] === 'Completed' || inv['Status'] === 'Processing'
    );
    eligible.forEach(inv => {
      let items: any[] = [];
      try {
        items = typeof inv['ItemsJSON'] === 'string'
          ? JSON.parse(inv['ItemsJSON'])
          : (Array.isArray(inv['ItemsJSON']) ? inv['ItemsJSON'] : []);
      } catch { }
      items.forEach((item, i) => {
        if (!item?.modelName && !item?.itemCode) return;
        result.push({
          _key: `${inv['Inv No']}-${i}`,
          invNo: inv['Inv No'] ?? '',
          invDate: inv['Inv Date'] ?? '',
          companyName: inv['Company Name'] ?? '',
          contactName: inv['Contact Name'] ?? '',
          soNo: inv['SO No'] ?? '',
          itemCode: item.itemCode ?? '',
          modelName: item.modelName ?? '',
          description: item.description ?? '',
          qty: Number(item.qty) || 1,
          brand: brandByCode.get(item.itemCode ?? '') ?? '',
        });
      });
    });
    return result;
  }, [invoices, brandByCode]);

  // Track how many serials are already registered per SO No + model combo
  const registeredCounts = useMemo(() => {
    const map = new Map<string, number>();
    (serialNumbers ?? []).forEach(s => {
      const key = `${s.so_no ?? ''}|${s.model_name ?? ''}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [serialNumbers]);

  // Filtered sold items
  const filteredSoldItems = useMemo(() => {
    if (!searchQuery) return soldItems;
    const q = searchQuery.toLowerCase();
    return soldItems.filter(item =>
      item.invNo.toLowerCase().includes(q) ||
      item.modelName.toLowerCase().includes(q) ||
      item.companyName.toLowerCase().includes(q) ||
      item.soNo.toLowerCase().includes(q) ||
      item.itemCode.toLowerCase().includes(q)
    );
  }, [soldItems, searchQuery]);

  // ── Registered tab data ──────────────────────────────────────────────────────

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
              {activeTab === 'registered' ? `${filteredData.length} registered` : `${filteredSoldItems.length} sold items`}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full lg:w-64">
              <input
                type="text"
                placeholder={activeTab === 'registered' ? 'Search serial numbers...' : 'Search sold items...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-muted border-transparent text-sm rounded-lg focus:ring-2 focus:ring-brand-500 block w-full pl-10 p-2.5 transition"
              />
              <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'registered' && (
                <>
                  <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
                    <button onClick={() => setCellWrapStyle('overflow')} className={`p-1.5 rounded ${cellWrapStyle === 'overflow' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><ArrowRightToLine size={16} /></button>
                    <button onClick={() => setCellWrapStyle('wrap')} className={`p-1.5 rounded ${cellWrapStyle === 'wrap' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><WrapText size={16} /></button>
                    <button onClick={() => setCellWrapStyle('clip')} className={`p-1.5 rounded ${cellWrapStyle === 'clip' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><Scissors size={16} /></button>
                  </div>
                  <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />
                </>
              )}
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

        {/* Tab switcher */}
        <div className="flex gap-1 border-b border-border -mb-4 pb-0">
          <button
            onClick={() => { setActiveTab('registered'); setSearchQuery(''); }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              activeTab === 'registered'
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Registered
            <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded-full">
              {(serialNumbers ?? []).length}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('from-invoices'); setSearchQuery(''); setStatusFilter('All'); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition ${
              activeTab === 'from-invoices'
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Package size={14} />
            From Invoices
            <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
              {soldItems.length}
            </span>
          </button>
        </div>

        {/* Status filters — only for registered tab */}
        {activeTab === 'registered' && (
          <div className="flex gap-1 flex-wrap pt-3">
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
        )}
      </header>

      <div className="flex-1 overflow-hidden p-4">
        {activeTab === 'registered' ? (
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
            renderRowContextMenu={(row) => (
              <RowActionMenuItems
                onEdit={can('serial_numbers', 'edit') ? () => handleEdit(row) : undefined}
                onDelete={can('serial_numbers', 'delete') ? () => setSnToDelete(row) : undefined}
              />
            )}
          />
        ) : (
          <FromInvoicesTab
            items={filteredSoldItems}
            registeredCounts={registeredCounts}
            onRegister={handleRegisterFromInvoice}
            loading={!invoices && loading}
          />
        )}
      </div>

      <NewSerialNumberModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setPrefillForModal(undefined); }}
        existingSN={editingSN}
        prefillData={prefillForModal}
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

// ── From Invoices sub-view ─────────────────────────────────────────────────────

const FromInvoicesTab: React.FC<{
  items: SoldItem[];
  registeredCounts: Map<string, number>;
  onRegister: (item: SoldItem) => void;
  loading: boolean;
}> = ({ items, registeredCounts, onRegister, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Loading invoices...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
        <Package size={32} className="opacity-30" />
        <p className="text-sm">No sold items found from completed invoices.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 sticky top-0 z-10">
          <tr>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Inv No</th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Date</th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Company</th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">SO No</th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Code</th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Model</th>
            <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Qty</th>
            <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Registered</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map(item => {
            const regKey = `${item.soNo}|${item.modelName}`;
            const regCount = registeredCounts.get(regKey) ?? 0;
            const isFull = regCount >= item.qty;
            return (
              <tr key={item._key} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">{item.invNo}</td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDisplayDate(item.invDate)}</td>
                <td className="px-3 py-2.5 max-w-[180px] truncate" title={item.companyName}>{item.companyName}</td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{item.soNo || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{item.itemCode || '—'}</td>
                <td className="px-3 py-2.5 max-w-[200px] truncate" title={item.modelName}>{item.modelName}</td>
                <td className="px-3 py-2.5 text-center">{item.qty}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    isFull
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : regCount > 0
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {regCount}/{item.qty}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <PermissionGate module="serial_numbers" action="create">
                    <button
                      onClick={() => onRegister(item)}
                      className="text-xs font-semibold text-brand-500 hover:text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 px-3 py-1 rounded transition whitespace-nowrap"
                    >
                      + Register
                    </button>
                  </PermissionGate>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SerialNumberDashboard;
