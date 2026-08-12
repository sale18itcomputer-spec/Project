'use client';


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SaleOrder, Quotation } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import DataTable, { ColumnDef, CellWrapStyle } from "../../common/DataTable";
import { formatDisplayDate } from "../../../utils/time";
import { useWindowManager } from "../../../contexts/WindowManagerContext";
import SaleOrderWindowContent from "../../windows/content/SaleOrderWindowContent";
import { useNavigation } from "../../../contexts/NavigationContext";
import { formatCurrencySmartly } from "../../../utils/formatters";
import { Table, Columns, Info, Pencil, Plus, Trash2, FileText, Copy } from 'lucide-react';
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
import { StatusBadge } from "../../ui/status-badge";
import DashboardHeader from "../../common/DashboardHeader";
import SearchInput from "../../common/SearchInput";
import ViewToggle from "../../common/ViewToggle";
import CellWrapToggle from "../../common/CellWrapToggle";
import ErrorState from "../../common/ErrorState";
import StatusFilterBar from "../../common/StatusFilterBar";
import IconButton from "../../ui/icon-button";
import { Button } from "../../ui/button";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";


interface SaleOrderDashboardProps {
    initialPayload?: any; // Can be Quotation or a pipeline data object
}

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
    const debouncedSearch = useDebouncedValue(searchQuery);
    const [statusFilter, setStatusFilter] = useState<string | null>('Pending');
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');

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
        // Reset the dedup key whenever the action clears, so a repeat create/edit
        // fires. Without this, the key for a create is always "create:" (no id),
        // so after the first conversion the ref stays set and every subsequent
        // create is silently swallowed (page stays mounted under the window manager).
        if (!navigation.action || navigation.action === 'view') { lastNavKeyRef.current = ''; return; }
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

        if (!debouncedSearch) return dataToFilter;

        return dataToFilter.filter(item =>
            ['SO No', 'Company Name', 'Contact Name', 'Status', 'Quote No'].some(key =>
                String(item[key as keyof SaleOrder] ?? '').toLowerCase().includes(debouncedSearch.toLowerCase())
            )
        );
    }, [saleOrders, debouncedSearch, statusFilter]);

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
                        className={`bg-transparent border border-border rounded-md px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer
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
        return <ErrorState title="Could not load sale orders" message={error} />;
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
                                <div className="flex items-center gap-2">
                                    {selectedSaleOrder.Status === 'Completed' && (
                                        <Button
                                            size="sm"
                                            onClick={() => handleConvertToInvoice(selectedSaleOrder)}
                                        >
                                            <FileText className="h-4 w-4" aria-hidden="true" />
                                            Create Invoice & DO
                                        </Button>
                                    )}
                                    <Button
                                        variant="link"
                                        size="sm"
                                        onClick={() => handleEditSaleOrder(selectedSaleOrder)}
                                        className="font-semibold"
                                    >
                                        <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                                    </Button>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        onClick={() => handleDuplicateSaleOrder(selectedSaleOrder)}
                                        className="font-semibold text-violet-500"
                                    >
                                        <Copy className="h-4 w-4" aria-hidden="true" />
                                        Duplicate
                                    </Button>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        onClick={() => handleDeleteRequest(selectedSaleOrder)}
                                        className="font-semibold text-rose-500"
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="bg-muted/50 p-4 rounded-lg">
                                    <dt className="text-sm font-medium text-muted-foreground/60">Total Amount</dt>
                                    <dd className="mt-1 text-xl font-semibold text-primary">{formatCurrencySmartly(selectedSaleOrder['Total Amount'], selectedSaleOrder.Currency)}</dd>
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
            <DashboardHeader title="Sale Order Record">
                {/* Search Box */}
                <SearchInput
                    id="sale-order-search"
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Search sale orders..."
                    label="Search sale orders"
                />

                {/* View Mode Toggle */}
                <ViewToggle<ViewMode>
                    views={VIEW_OPTIONS}
                    activeView={viewMode}
                    onViewChange={setViewMode}
                />

                {/* Alignment/Wrap Icons */}
                <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

                {/* Column Toggle / View Options */}
                <DataTableColumnToggle
                    allColumns={allColumns}
                    visibleColumns={visibleColumns}
                    onColumnToggle={handleColumnToggle}
                />

                {/* New Sale Order Button */}
                <PermissionGate module="sale_orders" action="create">
                  <Button onClick={handleNewSaleOrder} aria-label="New sale order">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">New SO</span>
                  </Button>
                </PermissionGate>
            </DashboardHeader>

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
                        emptyState={{
                            title: 'No sale orders yet',
                            description: 'Sale orders you create will appear here.',
                        }}
                        renderRowActions={(row) => (
                            <div className="flex items-center justify-center gap-1">
                                {row.Status === 'Completed' && (
                                    <IconButton
                                        label="Create Invoice & DO"
                                        tone="primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleConvertToInvoice(row);
                                        }}
                                    >
                                        <FileText size={16} aria-hidden="true" />
                                    </IconButton>
                                )}
                                <IconButton
                                    label="Edit sale order"
                                    tone="primary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditSaleOrder(row);
                                    }}
                                >
                                    <Pencil size={16} aria-hidden="true" />
                                </IconButton>
                                <IconButton
                                    label="Duplicate sale order"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicateSaleOrder(row);
                                    }}
                                    className="hover:bg-violet-500/10 hover:text-violet-500"
                                >
                                    <Copy size={16} aria-hidden="true" />
                                </IconButton>
                                <IconButton
                                    label="Delete sale order"
                                    tone="danger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRequest(row);
                                    }}
                                >
                                    <Trash2 size={16} aria-hidden="true" />
                                </IconButton>
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

            <StatusFilterBar
                options={['Pending', 'Completed', 'Cancel']}
                active={statusFilter}
                onChange={setStatusFilter}
                summary={`${filteredData.length} records`}
            />

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
