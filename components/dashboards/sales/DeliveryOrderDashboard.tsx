'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DeliveryOrder } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef, CellWrapStyle } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { useNavigation } from '../../../contexts/NavigationContext';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import DeliveryOrderWindowContent from '../../windows/content/DeliveryOrderWindowContent';
import { Truck, Table, Columns, Info, Pencil, Trash2, Plus } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import Spinner from '../../common/Spinner';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { deleteRecord, updateRecord } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { useToast } from '../../../contexts/ToastContext';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import RowActionMenuItems from "../../common/RowActionMenuItems";
import { StatusBadge } from '../../ui/status-badge';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import ViewToggle from '../../common/ViewToggle';
import CellWrapToggle from '../../common/CellWrapToggle';
import ErrorState from '../../common/ErrorState';
import StatusFilterBar from '../../common/StatusFilterBar';
import IconButton from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const DO_COLUMNS_KEY = 'limperial-do-columns-visibility';
type ViewMode = 'table' | 'detail';

interface Props { initialPayload?: any; }

const DeliveryOrderDashboard: React.FC<Props> = ({ initialPayload }) => {
    const { currentUser } = useAuth();
    const { deliveryOrders = [], setDeliveryOrders, invoices, saleOrders, loading, error } = useData();
    const { addToast } = useToast();
    const [toDelete, setToDelete] = useState<DeliveryOrder | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebouncedValue(searchQuery);
    const [statusFilter, setStatusFilter] = useState<string | null>('Pending');
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
    const { handleNavigation, navigation } = useNavigation();
    const { openWindow } = useWindowManager();
    const isMobile = useIsMobile();

    const selectedId = useMemo(() => {
        if (navigation.action === 'view') return navigation.id || null;
        return null;
    }, [navigation.action, navigation.id]);

    useEffect(() => {
        if (navigation.action === 'view') setViewMode('detail');
    }, [navigation.action]);

    const openDOWindow = (doNo: string | null, initialData?: { action?: string; invoiceData?: any; soData?: any }) => {
        const id = doNo ? `delivery-order-${doNo}` : `delivery-order-new-${Date.now()}`;
        openWindow({
            id,
            title: doNo ? `Delivery Order: ${doNo}` : 'New Delivery Order',
            content: <DeliveryOrderWindowContent windowId={id} doNo={doNo} initialData={initialData} />,
            noPadding: true,
            initialWidth: 1200,
            initialHeight: 820,
            minWidth: 900,
            minHeight: 600,
            detachUrl: doNo ? `/standalone/delivery-order/${encodeURIComponent(doNo)}` : undefined,
        });
    };

    // Auto-open window when navigated from another page with create/edit action
    const lastNavKeyRef = useRef('');
    useEffect(() => {
        // Reset the dedup key when the action clears so a repeat create/edit fires
        // (create's key is always "create:" with no id — otherwise it only opens once).
        if (!navigation.action || navigation.action === 'view') { lastNavKeyRef.current = ''; return; }
        const key = `${navigation.action}:${navigation.id ?? ''}`;
        if (lastNavKeyRef.current === key) return;
        lastNavKeyRef.current = key;

        if (navigation.action === 'create') {
            const payload = navigation.payload;
            const initData = payload?.invoiceData
                ? { action: 'create', invoiceData: payload.invoiceData }
                : payload?.soData
                ? { action: 'create', soData: payload.soData }
                : undefined;
            openDOWindow(null, initData);
        } else if (navigation.action === 'edit' && navigation.id) {
            openDOWindow(navigation.id);
        }
        handleNavigation({ view: 'delivery-orders' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigation.action, navigation.id]);

    const handleNew = () => openDOWindow(null);
    const handleEdit = (row: DeliveryOrder) => openDOWindow(row['DO No']);
    const handleView = (row: DeliveryOrder) => openDOWindow(row['DO No']);

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
        if (!debouncedSearch) return data;
        const q = debouncedSearch.toLowerCase();
        return data.filter(d =>
            ['DO No', 'Inv No', 'SO No', 'Company Name', 'Contact Name', 'Status', 'Created By'].some(
                k => String(d[k] ?? '').toLowerCase().includes(q)
            )
        );
    }, [deliveryOrders, debouncedSearch, statusFilter]);

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
                        className={`bg-transparent border border-border rounded-md px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer
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

    const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
        { id: 'table', label: 'Table', icon: <Table /> },
        { id: 'detail', label: 'Detail', icon: <Columns /> },
    ];

    if (error) return <ErrorState title="Could not load delivery orders" message={error} />;


    const selectedDO = selectedId ? (deliveryOrders || []).find(d => d['DO No'] === selectedId) : null;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <DashboardHeader title="Delivery Orders" icon={<Truck />}>
                <SearchInput
                    id="delivery-order-search"
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Search delivery orders..."
                    label="Search delivery orders"
                />

                <ViewToggle<ViewMode>
                    views={VIEW_OPTIONS}
                    activeView={viewMode}
                    onViewChange={setViewMode}
                />

                <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

                <DataTableColumnToggle
                    allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle}
                />

                <PermissionGate module="delivery_orders" action="create">
                  <Button onClick={handleNew} aria-label="New delivery order">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">New DO</span>
                  </Button>
                </PermissionGate>
            </DashboardHeader>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-hidden p-4">
                {loading ? <Spinner /> : viewMode === 'table' ? (
                    <DataTable
                        tableId="do-table" data={filteredData} columns={displayedColumns}
                        loading={loading} onRowClick={handleView}
                        initialSort={{ key: 'DO Date', direction: 'descending' }}
                        mobilePrimaryColumns={['DO No', 'Company Name', 'Status']}
                        cellWrapStyle={cellWrapStyle}
                        emptyState={{
                            title: 'No delivery orders yet',
                            description: 'Delivery orders you create will appear here.',
                        }}
                        renderRowActions={row => (
                            <div className="flex items-center justify-center gap-1">
                                <IconButton label="View delivery order" tone="primary" onClick={e => { e.stopPropagation(); handleView(row); }}><Info size={16} aria-hidden="true" /></IconButton>
                                <IconButton label="Edit delivery order" tone="primary" onClick={e => { e.stopPropagation(); handleEdit(row); }}><Pencil size={16} aria-hidden="true" /></IconButton>
                                <IconButton label="Delete delivery order" tone="danger" onClick={e => { e.stopPropagation(); setToDelete(row); }}><Trash2 size={16} aria-hidden="true" /></IconButton>
                            </div>
                        )}
                        renderRowContextMenu={row => (
                            <RowActionMenuItems
                                onOpenWindow={() => openDOWindow(row['DO No'])}
                                onView={() => handleView(row)}
                                onEdit={() => handleEdit(row)}
                                onDelete={() => setToDelete(row)}
                            />
                        )}
                    />
                ) : (
                    <div className="h-full flex divide-x divide-border">
                        {/* List */}
                        <div className="w-80 flex-shrink-0 bg-card overflow-y-auto">
                            {filteredData.map(d => (
                                <button key={d['DO No']}
                                    onClick={() => handleNavigation({ view: 'delivery-orders', action: 'view', id: d['DO No'] })}
                                    className={`w-full text-left p-4 border-b border-border hover:bg-muted transition-colors ${selectedId === d['DO No'] ? 'bg-primary/10 border-r-4 border-r-primary' : ''}`}>
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
                                            <div className="flex gap-2">
                                                <Button variant="link" size="sm" onClick={() => handleEdit(selectedDO)} className="font-semibold"><Pencil size={16} aria-hidden="true" /> Edit</Button>
                                                <Button variant="link" size="sm" onClick={() => setToDelete(selectedDO)} className="font-semibold text-rose-500"><Trash2 size={16} aria-hidden="true" /> Delete</Button>
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
            <StatusFilterBar
                options={['Pending', 'Delivered', 'Cancelled']}
                active={statusFilter}
                onChange={setStatusFilter}
                summary={`${filteredData.length} records`}
            />

            <ConfirmationModal
                isOpen={!!toDelete} onClose={() => setToDelete(null)} onConfirm={handleConfirmDelete}
                title="Delete Delivery Order" confirmText="Delete" variant="danger">
                Are you sure you want to delete {toDelete?.['DO No']}? This action cannot be undone.
            </ConfirmationModal>
        </div>
    );
};

export default DeliveryOrderDashboard;
