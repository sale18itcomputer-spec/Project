'use client';


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SaleOrder, Quotation } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import DataTable, { ColumnDef } from "../../common/DataTable";
import { formatDisplayDate } from "../../../utils/time";
import { useWindowManager } from "../../../contexts/WindowManagerContext";
import SaleOrderWindowContent from "../../windows/content/SaleOrderWindowContent";
import { useNavigation } from "../../../contexts/NavigationContext";
import { formatCurrencySmartly } from "../../../utils/formatters";
import { Table, Columns, Info, Pencil, ArrowRightToLine, WrapText, Scissors, LayoutGrid, Search, Trash2, FileText, Copy } from 'lucide-react';
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import SaleOrderListContainer from "../lists/SaleOrderListContainer";
import Spinner from "../../common/Spinner";
import EmptyState from "../../common/EmptyState";
import { useToast } from "../../../contexts/ToastContext";
import { deleteRecord, updateRecord } from "../../../services/api";
import { useAuth } from "../../../contexts/AuthContext";
import ConfirmationModal from "../../modals/ConfirmationModal";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import RowActionMenuItems from "../../common/RowActionMenuItems";
import { DropdownMenuItem } from "../../ui/dropdown-menu";


interface SaleOrderDashboardProps {
    initialPayload?: any; // Can be Quotation or a pipeline data object
}

const StatusBadge: React.FC<{ status: SaleOrder['Status'] }> = ({ status }) => {
    const statusConfig: { [key in SaleOrder['Status'] | string]: { bg: string; text: string } } = {
        'Pending': { bg: 'bg-amber-500/10', text: 'text-amber-500' },
        'Completed': { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
        'Cancel': { bg: 'bg-rose-500/10', text: 'text-rose-500' },
    };

    const config = statusConfig[status] || { bg: 'bg-muted', text: 'text-muted-foreground' };

    return (
        <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-md ${config.bg} ${config.text}`}>
            {status}
        </span>
    );
};

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => {
    if (!value || (typeof value === 'string' && !value.trim())) return null;
    return (
        <div>
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm text-foreground">{value}</dd>
        </div>
    );
};


const SALE_ORDER_COLUMNS_VISIBILITY_KEY = 'limperial-sale-order-columns-visibility';

type ViewMode = 'table' | 'detail';

const SaleOrderDashboard: React.FC<SaleOrderDashboardProps> = ({ initialPayload }) => {
    const { currentUser } = useAuth();
    const { saleOrders, setSaleOrders, loading, error } = useData();
    const { addToast } = useToast();
    const [saleOrderToDelete, setSaleOrderToDelete] = useState<SaleOrder | null>(null);
    const { handleNavigation, navigation } = useNavigation();
    const { openWindow } = useWindowManager();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>('Pending');
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('nowrap' as any);

    const selectedSaleOrderId = useMemo(() => {
        if (navigation.action === 'view') return navigation.id || null;
        if (initialPayload?.action === 'view' && initialPayload?.data?.['SO No']) return initialPayload.data['SO No'];
        return null;
    }, [navigation.action, navigation.id, initialPayload]);

    useEffect(() => {
        if (navigation.action === 'view') setViewMode('detail');
    }, [navigation.action]);

    const openSOWindow = (soNo: string | null, initialData?: Partial<SaleOrder>) => {
        const id = soNo ? `sale-order-${soNo}` : `sale-order-new-${Date.now()}`;
        openWindow({
            id,
            title: soNo ? `Sale Order: ${soNo}` : 'New Sale Order',
            content: <SaleOrderWindowContent windowId={id} soNo={soNo} initialData={initialData} />,
            noPadding: true,
            initialWidth: 1200,
            initialHeight: 820,
            minWidth: 900,
            minHeight: 600,
            detachUrl: soNo ? `/standalone/sale-order/${encodeURIComponent(soNo)}` : undefined,
        });
    };

    // Auto-open window when navigated from another page with create/edit action
    const lastNavKeyRef = useRef('');
    useEffect(() => {
        if (!navigation.action || navigation.action === 'view') return;
        const key = `${navigation.action}:${navigation.id ?? ''}`;
        if (lastNavKeyRef.current === key) return;
        lastNavKeyRef.current = key;

        if (navigation.action === 'create') {
            const payload = navigation.payload;
            let initData: Partial<SaleOrder> | undefined;

            if (payload?.isDuplicate) {
                initData = payload.initialData;
            } else if (payload?.['Quote No'] && !payload?.isPipeline) {
                // From Quotation
                const q = payload as Quotation;
                initData = {
                    'Quote No': q['Quote No'],
                    'Company Name': q['Company Name'],
                    'Contact Name': q['Contact Name'],
                    'Phone Number': q['Contact Number'],
                    'Email': q['Contact Email'],
                    'Total Amount': String(q.Amount ?? ''),
                    'Payment Term': q['Payment Term'],
                    'Status': 'Pending',
                    'Currency': q.Currency,
                    'Bill Invoice': q['Tax Type'] === 'NON-VAT' ? 'NON-VAT' : 'VAT',
                    'ItemsJSON': q.ItemsJSON,
                };
            } else if (payload?.isPipeline) {
                initData = {
                    'Quote No': payload['Quote No'] || '',
                    'Company Name': payload['Company Name'] || '',
                    'Contact Name': payload['Contact Name'] || '',
                    'Status': 'Pending',
                    'Currency': 'USD',
                    'Bill Invoice': 'VAT',
                };
            }
            openSOWindow(null, initData);
        } else if (navigation.action === 'edit' && navigation.id) {
            openSOWindow(navigation.id);
        }
        handleNavigation({ view: 'sale-orders', filter: navigation.filter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigation.action, navigation.id]);

    const handleNewSaleOrder = () => openSOWindow(null);

    const handleEditSaleOrder = (saleOrder: SaleOrder) => openSOWindow(saleOrder['SO No']);

    const handleViewSaleOrder = (saleOrder: SaleOrder) => openSOWindow(saleOrder['SO No']);

    const handleDeleteRequest = (saleOrder: SaleOrder) => {
        setSaleOrderToDelete(saleOrder);
    };

    const handleConfirmDelete = async () => {
        if (!saleOrderToDelete) return;
        const originalOrders = saleOrders ? [...saleOrders] : [];
        const orderId = saleOrderToDelete['SO No'];
        setSaleOrderToDelete(null);
        setSaleOrders(prev => prev ? prev.filter(so => so['SO No'] !== orderId) : null);
        try {
            await deleteRecord('Sale Orders', orderId);
            addToast('Sale Order deleted!', 'success');
        } catch {
            addToast('Failed to delete sale order.', 'error');
            setSaleOrders(originalOrders);
        }
    };

    const handleStatusChange = async (row: SaleOrder, newStatus: SaleOrder['Status']) => {
        const id = row['SO No'];
        const original = saleOrders ? [...saleOrders] : [];
        const newRemark = `Status changed to ${newStatus} on ${new Date().toISOString().split('T')[0]} by ${currentUser?.Name || 'User'}\n${row.Remark || ''}`.trim();
        
        setSaleOrders(prev => prev ? prev.map(so => so['SO No'] === id ? { ...so, Status: newStatus, Remark: newRemark } : so) : null);
        try {
            await updateRecord('Sale Orders', id, { Status: newStatus, Remark: newRemark });
            addToast(`SO status updated to ${newStatus}`, 'success');
        } catch {
            addToast('Failed to update status', 'error');
            setSaleOrders(original);
        }
    };

    const handleDuplicateSaleOrder = (so: SaleOrder) => {
        try {
            const items = typeof so.ItemsJSON === 'string' ? JSON.parse(so.ItemsJSON) : so.ItemsJSON;
            sessionStorage.setItem('duplicate_sale_order_items', JSON.stringify(items));
            const initData: Partial<SaleOrder> = {
                ...so,
                'SO No': undefined as any,
                'Status': 'Pending',
                'SO Date': undefined as any,
                'Delivery Date': undefined as any,
                'ItemsJSON': undefined,
            };
            openSOWindow(null, initData);
            addToast('Duplicating sale order...', 'info');
        } catch (err: any) {
            addToast(`Failed to duplicate: ${err.message}`, 'error');
        }
    };

    const handleConvertToInvoice = (so: SaleOrder) => {
        handleNavigation({
            view: 'invoices',
            payload: {
                action: 'create',
                soData: so
            }
        });
    };

    const filteredData = useMemo(() => {
        let dataToFilter = saleOrders || [];

        if (statusFilter) {
            dataToFilter = dataToFilter.filter(item => {
                if (statusFilter === 'Pending') return item.Status === 'Pending';
                if (statusFilter === 'Completed') return item.Status === 'Completed';
                if (statusFilter === 'Cancel') return item.Status === 'Cancel';
                return true;
            });
        }

        if (!searchQuery) return dataToFilter;

        return dataToFilter.filter(item =>
            ['SO No', 'Company Name', 'Contact Name', 'Status', 'Quote No'].some(key =>
                String(item[key as keyof SaleOrder] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    }, [saleOrders, searchQuery, statusFilter]);

    const selectedSaleOrder = useMemo(() => {
        let targetId = selectedSaleOrderId;
        if (viewMode === 'detail' && !targetId && filteredData.length > 0) {
            targetId = filteredData[0]['SO No'];
        }
        if (!targetId) return null;
        return filteredData.find(so => so['SO No'] === targetId) || null;
    }, [selectedSaleOrderId, filteredData, viewMode]);

    const allColumns = useMemo<ColumnDef<SaleOrder>[]>(() => [
        {
            accessorKey: 'SO No',
            header: 'SO No',
            isSortable: true,
            cell: (value: string) => (
                <div className="font-semibold text-muted-foreground/80">
                    {value}
                </div>
            )
        },
        {
            accessorKey: 'SO Date',
            header: 'SO Date',
            isSortable: true,
            cell: (value: string) => {
                const formatted = formatDisplayDate(value);
                return formatted === '-' ? <span className="text-muted-foreground italic">N/A</span> : formatted;
            },
        },
        {
            accessorKey: 'Company Name',
            header: 'Company Name',
            isSortable: true,
        },
        {
            accessorKey: 'Contact Name',
            header: 'Contact Name',
            isSortable: true,
        },
        {
            accessorKey: 'Total Amount',
            header: 'Amount',
            isSortable: true,
            cell: (value: string, row: SaleOrder) => {
                const formattedValue = formatCurrencySmartly(value, row.Currency);
                if (formattedValue === '-') {
                    return <span className="text-muted-foreground text-right block w-full">-</span>;
                }
                return (
                    <span className="text-sm font-medium text-foreground text-right block w-full">
                        {formattedValue}
                    </span>
                );
            }
        },
        {
            accessorKey: 'Bill Invoice',
            header: 'Taxable',
            isSortable: true,
            cell: (value: string | undefined) => {
                if (!value) return <span className="text-muted-foreground">-</span>;
                const display = value === 'Yes' ? 'VAT' : value === 'No' ? 'NON-VAT' : value;
                return <span className="font-medium text-foreground">{display}</span>;
            }
        },
        {
            accessorKey: 'Created By',
            header: 'Created By',
            isSortable: true,
        },
        {
            accessorKey: 'Status', header: 'Status', isSortable: true,
            cell: (value: SaleOrder['Status'], row: SaleOrder) => (
                <div onClick={e => e.stopPropagation()}>
                    <select
                        value={value}
                        onChange={e => handleStatusChange(row, e.target.value as SaleOrder['Status'])}
                        className={`bg-transparent border border-border rounded-md px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer
                            ${value === 'Pending' ? 'text-amber-500 bg-amber-500/10' : value === 'Completed' ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}
                    >
                        <option className="text-foreground bg-card" value="Pending">Pending</option>
                        <option className="text-foreground bg-card" value="Completed">Completed</option>
                        <option className="text-foreground bg-card" value="Cancel">Cancel</option>
                    </select>
                </div>
            )
        },
    ], []);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorageGet(SALE_ORDER_COLUMNS_VISIBILITY_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                    return new Set(parsed);
                }
            }
        } catch (e) {
            console.error("Failed to load visible columns from storage", e);
        }
        return new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean));
    });

    useEffect(() => {
        const saved = localStorageGet(SALE_ORDER_COLUMNS_VISIBILITY_KEY);
        if (!saved && allColumns.length > 0) {
            setVisibleColumns(new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean)));
        }
    }, [allColumns]);

    const handleColumnToggle = (columnKey: string) => {
        setVisibleColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(columnKey)) {
                if (newSet.size > 1) { // Prevent hiding the last column
                    newSet.delete(columnKey);
                }
            } else {
                newSet.add(columnKey);
            }
            try {
                localStorageSet(SALE_ORDER_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
            } catch (e) {
                console.error("Failed to save visible columns to storage", e);
            }
            return newSet;
        });
    };

    const displayedColumns = useMemo(() => {
        return allColumns.filter(c => c.accessorKey && visibleColumns.has(c.accessorKey as string));
    }, [allColumns, visibleColumns]);

    const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
        { id: 'table', label: 'Table', icon: <Table /> },
        { id: 'detail', label: 'Detail', icon: <Columns /> },
    ];

    if (error) {
        return (
            <div className="p-6 md:p-8">
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
                    <p className="font-bold">Error</p>
                    <p>Could not load sale orders data: {error}</p>
                </div>
            </div>
        );
    }

    const renderDetailView = () => (
        <div className="flex flex-col md:flex-row h-full">
            <aside className="w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col">
                <SaleOrderListContainer
                    saleOrders={filteredData}
                    selectedSaleOrderId={selectedSaleOrder?.['SO No'] || null}
                    onSelectSaleOrder={(id) => handleNavigation({ view: 'sale-orders', filter: navigation.filter, action: 'view', id })}
                    loading={loading && !saleOrders}
                />
            </aside>
            <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
                {loading && !selectedSaleOrder ? <Spinner /> : selectedSaleOrder ? (
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-2xl font-bold text-foreground">{selectedSaleOrder['Company Name']}</h1>
                                    <p className="text-muted-foreground font-mono mt-1">{selectedSaleOrder['SO No']}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    {selectedSaleOrder.Status === 'Completed' && (
                                        <button
                                            onClick={() => handleConvertToInvoice(selectedSaleOrder)}
                                            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-1.5 px-3 rounded-lg transition shadow-sm flex items-center gap-2 text-sm"
                                        >
                                            <FileText className="w-4 h-4" />
                                            Create Invoice & DO
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleEditSaleOrder(selectedSaleOrder)}
                                        className="text-sm font-semibold text-brand-500 hover:underline flex items-center gap-1.5"
                                    >
                                        <Pencil className="w-4 h-4" /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleDuplicateSaleOrder(selectedSaleOrder)}
                                        className="text-sm font-semibold text-violet-500 hover:underline flex items-center gap-1.5"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Duplicate
                                    </button>
                                    <button
                                        onClick={() => handleDeleteRequest(selectedSaleOrder)}
                                        className="text-sm font-semibold text-rose-500 hover:underline flex items-center gap-1.5"
                                    >
                                        <Trash2 className="w-4 h-4" /> Delete
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="bg-muted/50 p-4 rounded-lg">
                                    <dt className="text-sm font-medium text-muted-foreground/60">Total Amount</dt>
                                    <dd className="mt-1 text-xl font-semibold text-brand-500">{formatCurrencySmartly(selectedSaleOrder['Total Amount'], selectedSaleOrder.Currency)}</dd>
                                </div>
                                <div className="bg-muted/50 p-4 rounded-lg">
                                    <dt className="text-sm font-medium text-muted-foreground/60">Status</dt>
                                    <dd className="mt-1"><StatusBadge status={selectedSaleOrder.Status} /></dd>
                                </div>
                            </div>

                            <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                <DetailItem label="SO Date" value={formatDisplayDate(selectedSaleOrder['SO Date'])} />
                                <DetailItem label="Delivery Date" value={formatDisplayDate(selectedSaleOrder['Delivery Date'])} />
                                <DetailItem label="Quote Ref." value={selectedSaleOrder['Quote No']} />
                                <DetailItem label="Payment Term" value={selectedSaleOrder['Payment Term']} />
                                <DetailItem label="Contact Person" value={selectedSaleOrder['Contact Name']} />
                                <DetailItem label="Phone Number" value={selectedSaleOrder['Phone Number']} />
                                <DetailItem label="Bill Invoice" value={selectedSaleOrder['Bill Invoice'] === 'VAT' ? 'VAT' : selectedSaleOrder['Bill Invoice'] === 'NON-VAT' ? 'NON-VAT' : selectedSaleOrder['Bill Invoice']} />
                            </dl>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <EmptyState illustration={<Info className="w-16 h-16 text-muted-foreground/20" />}>
                            <h3 className="mt-2 text-sm font-semibold text-foreground">Select a Sale Order</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Choose an order from the list to see its details.</p>
                        </EmptyState>
                    </div>
                )}
            </main>
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-foreground">Sale Order Record</h1>
                </div>

                <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto mt-2 lg:mt-0">
                    {/* Search Box */}
                    <div className="relative w-full lg:w-64 flex-shrink-0">
                        <input
                            type="text"
                            placeholder="Search sale orders..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-muted border border-border text-foreground placeholder-muted-foreground text-sm rounded-md pl-10 pr-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition shadow-sm"
                        />
                        <Search className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                    </div>

                    <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                        {/* View Mode Toggle */}
                        <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border flex-shrink-0">
                            {VIEW_OPTIONS.map(view => (
                                <button
                                    key={view.id}
                                    onClick={() => setViewMode(view.id)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === view.id ? 'bg-background text-brand-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {view.icon}
                                    <span className="hidden xl:inline">{view.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Alignment/Wrap Icons */}
                        <div className="flex items-center bg-card border border-border rounded-md shadow-sm flex-shrink-0">
                            <button onClick={() => setCellWrapStyle('overflow')} className={`p-2 rounded-l-md hover:bg-muted transition ${cellWrapStyle === 'overflow' ? 'text-brand-600 bg-brand-500/10' : 'text-muted-foreground'}`}>
                                <ArrowRightToLine className="w-4 h-4" />
                            </button>
                            <button onClick={() => setCellWrapStyle('wrap')} className={`p-2 hover:bg-muted transition border-x border-border ${cellWrapStyle === 'wrap' ? 'text-brand-600 bg-brand-500/10' : 'text-muted-foreground'}`}>
                                <WrapText className="w-4 h-4" />
                            </button>
                            <button onClick={() => setCellWrapStyle('clip')} className={`p-2 rounded-r-md hover:bg-muted transition ${cellWrapStyle === 'clip' ? 'text-brand-600 bg-brand-500/10' : 'text-muted-foreground'}`}>
                                <Scissors className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Column Toggle / View Options */}
                        <div className="flex-shrink-0">
                            <DataTableColumnToggle
                                allColumns={allColumns}
                                visibleColumns={visibleColumns}
                                onColumnToggle={handleColumnToggle}
                                trigger={
                                    <button className="flex items-center gap-2 bg-card border border-border text-foreground font-semibold py-2 px-4 rounded-md hover:bg-muted transition shadow-sm text-sm">
                                        <LayoutGrid className="w-4 h-4" />
                                        View
                                    </button>
                                }
                            />
                        </div>

                        {/* New Sale Order Button */}
                        <PermissionGate module="sale_orders" action="create">
                          <button
                            onClick={handleNewSaleOrder}
                            className="flex-shrink-0 flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-md transition shadow-md whitespace-nowrap text-sm ml-auto lg:ml-0"
                          >
                            <span className="text-xl leading-none">+</span> New SO
                          </button>
                        </PermissionGate>
                    </div>
                </div>
            </header>

            <div className="flex-1 min-h-0 overflow-hidden p-4">
                {viewMode === 'table' ? (
                    <DataTable
                        tableId="saleorder-table"
                        data={filteredData}
                        columns={displayedColumns}
                        loading={loading}
                        onRowClick={handleViewSaleOrder}
                        initialSort={{ key: 'SO Date', direction: 'descending' }}
                        mobilePrimaryColumns={['SO No', 'Company Name', 'Total Amount', 'Status']}
                        cellWrapStyle={cellWrapStyle}
                        renderRowActions={(row) => (
                            <div className="flex items-center justify-center gap-3">
                                {row.Status === 'Completed' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleConvertToInvoice(row);
                                        }}
                                        className="p-2.5 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                                        title="Create Invoice & DO"
                                    >
                                        <FileText size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditSaleOrder(row);
                                    }}
                                    className="p-2.5 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                                    title="Edit"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicateSaleOrder(row);
                                    }}
                                    className="p-2.5 text-muted-foreground hover:text-violet-500 transition hover:bg-violet-500/10 rounded-full"
                                    title="Duplicate"
                                >
                                    <Copy size={16} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRequest(row);
                                    }}
                                    className="p-2.5 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full"
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                        renderRowContextMenu={(row) => (
                            <RowActionMenuItems
                                onOpenWindow={() => openSOWindow(row['SO No'])}
                                onView={() => handleViewSaleOrder(row)}
                                onEdit={() => handleEditSaleOrder(row)}
                                onDelete={() => handleDeleteRequest(row)}
                            >
                                {row.Status === 'Completed' && (
                                    <DropdownMenuItem onClick={() => handleConvertToInvoice(row)}>
                                        <FileText className="mr-2 h-4 w-4" /> Create Invoice & DO
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleDuplicateSaleOrder(row)}>
                                    <Copy className="mr-2 h-4 w-4" /> Duplicate
                                </DropdownMenuItem>
                            </RowActionMenuItems>
                        )}
                    />
                ) : (
                    renderDetailView()
                )}
            </div>

            <footer className="flex-shrink-0 bg-card border-t border-border p-3 flex items-center gap-3">


                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setStatusFilter(statusFilter === 'Pending' ? null : 'Pending')}
                        className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Pending' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                        Pending
                    </button>
                    <button
                        onClick={() => setStatusFilter(statusFilter === 'Completed' ? null : 'Completed')}
                        className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Completed' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                        Completed
                    </button>
                    <button
                        onClick={() => setStatusFilter(statusFilter === 'Cancel' ? null : 'Cancel')}
                        className={`whitespace-nowrap px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Cancel' ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                        Cancel
                    </button>
                </div>
            </footer>
            <ConfirmationModal
                isOpen={!!saleOrderToDelete}
                onClose={() => setSaleOrderToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Sale Order"
                confirmText="Delete"
                variant="danger"
            >
                Are you sure you want to delete sale order {saleOrderToDelete?.['SO No']}? This action cannot be undone.
            </ConfirmationModal>
        </div >
    );
}

export default SaleOrderDashboard;
