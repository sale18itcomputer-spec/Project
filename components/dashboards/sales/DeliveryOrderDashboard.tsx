'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { DeliveryOrder, Invoice, SaleOrder } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { useNavigation } from '../../../contexts/NavigationContext';
import { Truck, Table, Columns, Info, Pencil, LayoutGrid, Search, Trash2, WrapText, ArrowRightToLine, Scissors, Plus } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import KanbanView, { KanbanColumn } from '../views/KanbanView';
import Spinner from '../../common/Spinner';
import DeliveryOrderCreator from '../../features/sales/DeliveryOrderCreator';
import { useWindowSize } from '../../../hooks/useWindowSize';
import { deleteRecord, updateRecord } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { useToast } from '../../../contexts/ToastContext';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';

const DO_COLUMNS_KEY = 'limperial-do-columns-visibility';
type ViewMode = 'table' | 'board' | 'detail';

const StatusBadge: React.FC<{ status: DeliveryOrder['Status'] }> = ({ status }) => {
    const cfg: Record<string, { bg: string; text: string }> = {
        'Pending':   { bg: 'bg-amber-500/10',   text: 'text-amber-500' },
        'Delivered': { bg: 'bg-emerald-500/10',  text: 'text-emerald-500' },
        'Cancelled': { bg: 'bg-rose-500/10',     text: 'text-rose-500' },
    };
    const { bg, text } = cfg[status] ?? { bg: 'bg-muted', text: 'text-muted-foreground' };
    return (
        <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-md ${bg} ${text}`}>
            {status}
        </span>
    );
};

interface Props { initialPayload?: any; }

const DeliveryOrderDashboard: React.FC<Props> = ({ initialPayload }) => {
    const { currentUser } = useAuth();
    const { deliveryOrders = [], setDeliveryOrders, invoices, saleOrders, loading, error } = useData();
    const { addToast } = useToast();
    const [toDelete, setToDelete] = useState<DeliveryOrder | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>('Pending');
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('wrap');
    const { handleNavigation, navigation } = useNavigation();
    const { width } = useWindowSize();
    const isMobile = width < 768;

    const isCreating = navigation.action === 'create' || navigation.action === 'edit'
        || (!!initialPayload && !navigation.action);

    const selectedId = useMemo(() => {
        if (navigation.action === 'view') return navigation.id || null;
        return null;
    }, [navigation.action, navigation.id]);

    const selectedToEdit = useMemo(() => {
        if (navigation.action === 'edit' && navigation.id && deliveryOrders) {
            return deliveryOrders.find(d => d['DO No'] === navigation.id) || null;
        }
        return null;
    }, [navigation.action, navigation.id, deliveryOrders]);

    useEffect(() => {
        if (navigation.action === 'view') setViewMode('detail');
    }, [navigation.action]);

    const handleNew = () => handleNavigation({ view: 'delivery-orders', action: 'create' });
    const handleEdit = (row: DeliveryOrder) => handleNavigation({ view: 'delivery-orders', action: 'edit', id: row['DO No'] });
    const handleView = (row: DeliveryOrder) => {
        if (isMobile) { handleEdit(row); return; }
        handleNavigation({ view: 'delivery-orders', action: 'view', id: row['DO No'] });
    };
    const handleBack = () => handleNavigation({ view: 'delivery-orders' });

    const handleConfirmDelete = async () => {
        if (!toDelete) return;
        const id = toDelete['DO No'];
        setToDelete(null);
        const original = deliveryOrders ? [...deliveryOrders] : [];
        setDeliveryOrders(prev => prev ? prev.filter(d => d['DO No'] !== id) : null);
        try {
            await deleteRecord('Delivery Orders', id);
            addToast('Delivery Order deleted!', 'success');
        } catch {
            addToast('Failed to delete.', 'error');
            setDeliveryOrders(original);
        }
    };

    const handleStatusChange = async (row: DeliveryOrder, newStatus: DeliveryOrder['Status']) => {
        const id = row['DO No'];
        const original = deliveryOrders ? [...deliveryOrders] : [];
        const newRemark = `Status changed to ${newStatus} on ${new Date().toISOString().split('T')[0]} by ${currentUser?.Name || 'User'}\n${row.Remark || ''}`.trim();
        
        setDeliveryOrders(prev => prev ? prev.map(d => d['DO No'] === id ? { ...d, Status: newStatus, Remark: newRemark } : d) : null);
        try {
            await updateRecord('Delivery Orders', id, { Status: newStatus, Remark: newRemark });
            addToast(`DO status updated to ${newStatus}`, 'success');
            
            // Notify customer if Dispatched/Delivered
            if (newStatus === 'Delivered') {
                // Ideally trigger bot notification here
            }
        } catch {
            addToast('Failed to update status', 'error');
            setDeliveryOrders(original);
        }
    };

    const filteredData = useMemo(() => {
        let data = deliveryOrders || [];
        if (statusFilter) data = data.filter(d => d['Status'] === statusFilter);
        if (!searchQuery) return data;
        const q = searchQuery.toLowerCase();
        return data.filter(d =>
            ['DO No', 'Inv No', 'SO No', 'Company Name', 'Contact Name', 'Status', 'Created By'].some(
                k => String(d[k] ?? '').toLowerCase().includes(q)
            )
        );
    }, [deliveryOrders, searchQuery, statusFilter]);

    const allColumns = useMemo<ColumnDef<DeliveryOrder>[]>(() => [
        {
            accessorKey: 'DO No', header: 'DO No', isSortable: true,
            cell: (v: string) => <div className="font-semibold text-muted-foreground/80">{v}</div>
        },
        {
            accessorKey: 'DO Date', header: 'DO Date', isSortable: true,
            cell: (v: string) => formatDisplayDate(v),
        },
        { accessorKey: 'Inv No', header: 'Inv No', isSortable: true },
        { accessorKey: 'SO No', header: 'SO No', isSortable: true },
        { accessorKey: 'Company Name', header: 'Company Name', isSortable: true },
        { accessorKey: 'Contact Name', header: 'Contact Name', isSortable: true },
        {
            accessorKey: 'Delivery Date', header: 'Delivery Date', isSortable: true,
            cell: (v: string) => v ? formatDisplayDate(v) : <span className="text-muted-foreground/30">-</span>,
        },
        { accessorKey: 'Created By', header: 'Created By', isSortable: true },
        {
            accessorKey: 'Status', header: 'Status', isSortable: true,
            cell: (v: DeliveryOrder['Status'], row: DeliveryOrder) => (
                <div onClick={e => e.stopPropagation()}>
                    <select
                        value={v}
                        onChange={e => handleStatusChange(row, e.target.value as DeliveryOrder['Status'])}
                        className={`bg-transparent border border-border rounded-md px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer
                            ${v === 'Pending' ? 'text-amber-500 bg-amber-500/10' : v === 'Delivered' ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}
                    >
                        <option className="text-foreground bg-card" value="Pending">Pending</option>
                        <option className="text-foreground bg-card" value="Delivered">Delivered</option>
                        <option className="text-foreground bg-card" value="Cancelled">Cancelled</option>
                    </select>
                </div>
            ),
        },
    ], []);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorageGet(DO_COLUMNS_KEY);
            if (saved) return new Set(JSON.parse(saved));
        } catch { }
        return new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean));
    });

    const handleColumnToggle = (key: string) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) { if (next.size > 1) next.delete(key); }
            else next.add(key);
            localStorageSet(DO_COLUMNS_KEY, JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const displayedColumns = useMemo(
        () => allColumns.filter(c => c.accessorKey && visibleColumns.has(c.accessorKey as string)),
        [allColumns, visibleColumns]
    );

    const kanbanColumns = useMemo<KanbanColumn<DeliveryOrder>[]>(() => {
        const statuses: DeliveryOrder['Status'][] = ['Pending', 'Delivered', 'Cancelled'];
        const colors: Record<string, 'amber' | 'emerald' | 'rose'> = {
            Pending: 'amber', Delivered: 'emerald', Cancelled: 'rose',
        };
        return statuses.map(s => ({
            id: s, title: s, color: colors[s],
            items: filteredData.filter(d => d['Status'] === s),
        }));
    }, [filteredData]);

    const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
        { id: 'table', label: 'Table', icon: <Table /> },
        { id: 'board', label: 'Board', icon: <LayoutGrid /> },
        { id: 'detail', label: 'Detail', icon: <Columns /> },
    ];

    if (error) return (
        <div className="p-8">
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg">
                <p className="font-bold">Error</p><p>Could not load delivery orders: {error}</p>
            </div>
        </div>
    );

    if (isCreating) return (
        <DeliveryOrderCreator
            onBack={handleBack}
            existingDO={selectedToEdit}
            initialData={initialPayload}
        />
    );

    const selectedDO = selectedId ? (deliveryOrders || []).find(d => d['DO No'] === selectedId) : null;

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-brand-500" />
                    <h1 className="text-xl font-bold text-foreground">Delivery Orders</h1>
                </div>
                <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
                    <div className="relative w-full lg:w-64">
                        <input
                            type="text" placeholder="Search delivery orders..."
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-muted border border-border text-foreground placeholder-muted-foreground/40 text-sm rounded-md pl-10 pr-4 py-2 focus:ring-2 focus:ring-brand-500 transition shadow-sm"
                        />
                        <Search className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border flex-shrink-0">
                            {VIEW_OPTIONS.map(v => (
                                <button key={v.id} onClick={() => setViewMode(v.id)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === v.id ? 'bg-background text-brand-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {v.icon}<span className="hidden xl:inline">{v.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center bg-card border border-border rounded-md shadow-sm flex-shrink-0">
                            <button onClick={() => setCellWrapStyle('overflow')} className={`p-2 rounded-l-md ${cellWrapStyle === 'overflow' ? 'text-brand-500 bg-brand-500/10' : 'text-muted-foreground'}`}><ArrowRightToLine size={16} /></button>
                            <button onClick={() => setCellWrapStyle('wrap')} className={`p-2 border-x border-border ${cellWrapStyle === 'wrap' ? 'text-brand-500 bg-brand-500/10' : 'text-muted-foreground'}`}><WrapText size={16} /></button>
                            <button onClick={() => setCellWrapStyle('clip')} className={`p-2 rounded-r-md ${cellWrapStyle === 'clip' ? 'text-brand-500 bg-brand-500/10' : 'text-muted-foreground'}`}><Scissors size={16} /></button>
                        </div>
                        <DataTableColumnToggle
                            allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle}
                            trigger={
                                <button className="flex items-center gap-2 bg-card border border-border text-foreground font-semibold py-2 px-4 rounded-md hover:bg-muted transition shadow-sm text-sm flex-shrink-0">
                                    <LayoutGrid className="w-4 h-4" /> View
                                </button>
                            }
                        />
                        <PermissionGate module="delivery_orders" action="create">
                          <button onClick={handleNew}
                            className="flex-shrink-0 flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-md transition shadow-md whitespace-nowrap text-sm ml-auto lg:ml-0">
                            <Plus size={16} /> New DO
                          </button>
                        </PermissionGate>
                    </div>
                </div>
            </header>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-hidden bg-background p-4">
                {loading ? <Spinner /> : viewMode === 'table' ? (
                    <DataTable
                        tableId="do-table" data={filteredData} columns={displayedColumns}
                        loading={loading} onRowClick={handleView}
                        initialSort={{ key: 'DO Date', direction: 'descending' }}
                        mobilePrimaryColumns={['DO No', 'Company Name', 'Status']}
                        cellWrapStyle={cellWrapStyle}
                        renderRowActions={row => (
                            <div className="flex items-center justify-center gap-3">
                                <button onClick={e => { e.stopPropagation(); handleView(row); }} className="p-2.5 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full" title="View"><Info size={16} /></button>
                                <button onClick={e => { e.stopPropagation(); handleEdit(row); }} className="p-2.5 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full" title="Edit"><Pencil size={16} /></button>
                                <button onClick={e => { e.stopPropagation(); setToDelete(row); }} className="p-2.5 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full" title="Delete"><Trash2 size={16} /></button>
                            </div>
                        )}
                    />
                ) : viewMode === 'board' ? (
                    <KanbanView<DeliveryOrder>
                        columns={kanbanColumns} onCardClick={handleEdit}
                        renderCardContent={item => (
                            <>
                                <h4 className="font-bold text-foreground">{item['Company Name']}</h4>
                                <p className="text-sm text-muted-foreground font-mono">{item['DO No']}</p>
                                {item['Inv No'] && <p className="text-xs text-muted-foreground mt-1">Inv: {item['Inv No']}</p>}
                                <p className="text-xs text-muted-foreground mt-2">By {item['Created By']}</p>
                            </>
                        )}
                        loading={loading} getItemId={item => item['DO No']}
                    />
                ) : (
                    <div className="h-full flex divide-x divide-border">
                        {/* List */}
                        <div className="w-80 flex-shrink-0 bg-card overflow-y-auto">
                            {filteredData.map(d => (
                                <button key={d['DO No']}
                                    onClick={() => handleNavigation({ view: 'delivery-orders', action: 'view', id: d['DO No'] })}
                                    className={`w-full text-left p-4 border-b hover:bg-muted transition-colors ${selectedId === d['DO No'] ? 'bg-brand-500/10 border-r-4 border-r-brand-500' : 'border-border'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-foreground">{d['DO No']}</span>
                                        <StatusBadge status={d['Status']} />
                                    </div>
                                    <div className="text-sm font-medium text-foreground/80 truncate">{d['Company Name']}</div>
                                    {d['Inv No'] && <div className="text-xs text-muted-foreground mt-1">Inv: {d['Inv No']}</div>}
                                </button>
                            ))}
                            {filteredData.length === 0 && <div className="p-8 text-center text-muted-foreground">No records found</div>}
                        </div>
                        {/* Detail */}
                        <div className="flex-1 overflow-y-auto p-8">
                            {selectedDO ? (
                                <div className="max-w-3xl mx-auto space-y-6">
                                    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                                        <div className="px-6 py-4 bg-muted border-b border-border flex justify-between items-center">
                                            <h2 className="text-lg font-bold text-foreground">Delivery Order Details</h2>
                                            <div className="flex gap-4">
                                                <button onClick={() => handleEdit(selectedDO)} className="flex items-center gap-2 text-brand-500 font-semibold hover:underline"><Pencil size={16} /> Edit</button>
                                                <button onClick={() => setToDelete(selectedDO)} className="flex items-center gap-2 text-rose-500 font-semibold hover:underline"><Trash2 size={16} /> Delete</button>
                                            </div>
                                        </div>
                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Document Info</label>
                                                    <div className="mt-2 grid grid-cols-2 gap-3">
                                                        {[['DO No', selectedDO['DO No']], ['DO Date', formatDisplayDate(selectedDO['DO Date'])], ['Invoice Ref', selectedDO['Inv No'] || '–'], ['SO Ref', selectedDO['SO No'] || '–']].map(([label, val]) => (
                                                            <div key={label}>
                                                                <p className="text-xs text-muted-foreground">{label}</p>
                                                                <p className="font-semibold text-foreground/80">{val}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Delivery</label>
                                                    <div className="mt-2 space-y-1">
                                                        <p className="text-sm"><span className="text-muted-foreground">Date: </span><span className="font-medium">{selectedDO['Delivery Date'] ? formatDisplayDate(selectedDO['Delivery Date']) : '–'}</span></p>
                                                        <p className="text-sm"><span className="text-muted-foreground">Payment Term: </span><span className="font-medium">{selectedDO['Payment Term'] || '–'}</span></p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Customer</label>
                                                    <p className="mt-1 font-bold text-foreground text-lg">{selectedDO['Company Name']}</p>
                                                    <p className="text-sm text-muted-foreground">{selectedDO['Company Address']}</p>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Contact</label>
                                                    <div className="mt-1 space-y-1">
                                                        <p className="text-sm font-semibold text-foreground/80">{selectedDO['Contact Name']}</p>
                                                        <p className="text-sm text-muted-foreground">{selectedDO['Phone Number']}</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Status</label>
                                                    <div className="mt-2"><StatusBadge status={selectedDO['Status']} /></div>
                                                </div>
                                            </div>
                                        </div>
                                        {selectedDO['Remark'] && (
                                            <div className="px-6 pb-6">
                                                <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Remark</label>
                                                <p className="mt-1 text-sm text-foreground/80">{selectedDO['Remark']}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30">
                                    <Truck size={48} className="mb-4 opacity-20" />
                                    <p className="text-lg">Select a delivery order to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer filters */}
            <footer className="flex-shrink-0 bg-card border-t border-border p-3 flex items-center gap-3">
                {(['Pending', 'Delivered', 'Cancelled'] as const).map(s => (
                    <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                        className={`px-5 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-border text-muted-foreground bg-muted hover:bg-muted/80'}`}>
                        {s}
                    </button>
                ))}
                <span className="ml-auto text-xs text-muted-foreground">{filteredData.length} records</span>
            </footer>

            <ConfirmationModal
                isOpen={!!toDelete} onClose={() => setToDelete(null)} onConfirm={handleConfirmDelete}
                title="Delete Delivery Order" confirmText="Delete" variant="danger">
                Are you sure you want to delete {toDelete?.['DO No']}? This action cannot be undone.
            </ConfirmationModal>
        </div>
    );
};

export default DeliveryOrderDashboard;
