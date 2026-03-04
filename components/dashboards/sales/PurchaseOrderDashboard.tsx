'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PurchaseOrder } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import DataTable, { ColumnDef } from "../../common/DataTable";
import { formatDisplayDate } from "../../../utils/time";
import PurchaseOrderCreator from "../../features/sales/PurchaseOrderCreator";
import { useNavigation } from "../../../contexts/NavigationContext";
import { formatCurrencySmartly } from "../../../utils/formatters";
import { ClipboardList, Pencil, Search, ArrowRightToLine, WrapText, Scissors, Trash2 } from 'lucide-react';
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import ConfirmationModal from "../../modals/ConfirmationModal";
import { useWindowSize } from "../../../hooks/useWindowSize";
import { Badge } from "../../ui/badge";
import { localStorageGet, localStorageSet } from '../../../utils/storage';

const PURCHASE_ORDER_COLUMNS_VISIBILITY_KEY = 'limperial-purchase-order-columns-visibility';

const PurchaseOrderDashboard: React.FC<{ initialPayload?: any }> = ({ initialPayload }) => {
    const { purchaseOrders, setPurchaseOrders, loading, error, vendors, refetchData } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const { handleNavigation, navigation } = useNavigation();

    const isCreating = navigation.action === 'create' || navigation.action === 'edit' || (!!initialPayload && !navigation.action);

    const selectedPOToEdit = useMemo(() => {
        if (navigation.action === 'edit' && navigation.id && purchaseOrders) {
            return purchaseOrders.find(po => po.id === navigation.id) || null;
        }
        if (initialPayload?.action === 'edit' && initialPayload?.data) {
            return initialPayload.data;
        }
        return null;
    }, [navigation.action, navigation.id, purchaseOrders, initialPayload]);
    const { addToast } = useToast();
    const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('wrap');
    const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
    const { width } = useWindowSize();
    const isMobile = width < 1024;
    const { currentUser } = useAuth();

    const handleNewPO = () => {
        handleNavigation({ view: 'purchase-orders', filter: navigation.filter, action: 'create' });
    };

    const handleEditPO = (po: PurchaseOrder) => {
        handleNavigation({ view: 'purchase-orders', filter: navigation.filter, action: 'edit', id: po.id });
    };

    const handleDeleteRequest = (po: PurchaseOrder) => {
        setPoToDelete(po);
    };

    const handleConfirmDelete = async () => {
        if (!poToDelete) return;

        const poId = poToDelete.id;
        try {
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .eq('id', poId);

            if (error) throw error;

            addToast('Purchase Order deleted!', 'success');
            setPurchaseOrders(current => current ? current.filter(p => p.id !== poId) : null);
            setPoToDelete(null);
        } catch (err: any) {
            addToast('Failed to delete purchase order.', 'error');
            console.error(err);
        }
    };

    const filteredData = useMemo(() => {
        let data = purchaseOrders || [];

        if (statusFilter) {
            data = data.filter(item => item.status === statusFilter);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.po_number.toLowerCase().includes(q) ||
                (item.vendor_name || '').toLowerCase().includes(q) ||
                (item.ordered_by_name || '').toLowerCase().includes(q)
            );
        }

        return data;
    }, [purchaseOrders, searchQuery, statusFilter]);

    const allColumns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
        {
            accessorKey: 'po_number',
            header: 'PO Number',
            isSortable: true,
            cell: (value: string) => <span className="font-semibold text-foreground">{value}</span>
        },
        {
            accessorKey: 'order_date',
            header: 'Order Date',
            isSortable: true,
            cell: (value: string) => formatDisplayDate(value)
        },
        {
            accessorKey: 'vendor_name',
            header: 'Vendor',
            isSortable: true,
            cell: (value: string) => <span className="font-medium">{value || 'N/A'}</span>
        },
        {
            accessorKey: 'grand_total',
            header: 'Amount',
            isSortable: true,
            cell: (value: number, row) => (
                <span className="font-semibold text-right block w-full">
                    {formatCurrencySmartly(value, row.currency)}
                </span>
            )
        },
        {
            accessorKey: 'status',
            header: 'Status',
            isSortable: true,
            cell: (value: string) => {
                let variant: 'outline' | 'secondary' | 'destructive' | 'default' = 'outline';
                if (value === 'Approved' || value === 'Completed') variant = 'secondary';
                if (value === 'Cancelled') variant = 'destructive';
                return <Badge variant={variant}>{value}</Badge>;
            }
        },
        {
            accessorKey: 'ordered_by_name',
            header: 'Ordered By',
            isSortable: true,
        }
    ], []);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorageGet(PURCHASE_ORDER_COLUMNS_VISIBILITY_KEY);
            if (saved) return new Set(JSON.parse(saved));
        } catch (e) { }
        return new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean));
    });

    const handleColumnToggle = (columnKey: string) => {
        setVisibleColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(columnKey)) {
                if (newSet.size > 1) newSet.delete(columnKey);
            } else {
                newSet.add(columnKey);
            }
            localStorageSet(PURCHASE_ORDER_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
            return newSet;
        });
    };

    const displayedColumns = useMemo(() => {
        return allColumns.filter(c => c.accessorKey && visibleColumns.has(c.accessorKey as string));
    }, [allColumns, visibleColumns]);

    if (currentUser?.Role !== 'Admin') {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-background">
                <ClipboardList className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h2 className="text-xl font-bold mb-2 text-foreground">Access Restricted</h2>
                <p className="max-w-md">You don't have permission to view or manage Purchase Orders. This area is restricted to Administrators only.</p>
            </div>
        );
    }

    if (isCreating) {
        return (
            <PurchaseOrderCreator
                onBack={() => {
                    handleNavigation({ view: 'purchase-orders', filter: navigation.filter });
                    refetchData();
                }}
                existingPO={selectedPOToEdit}
            />
        );
    }

    return (
        <div className="h-full flex flex-col bg-background">
            <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ClipboardList className="text-brand-500" />
                        Purchase Orders
                    </h2>
                    <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {filteredData.length} items
                    </span>
                </div>

                <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
                    <div className="relative w-full lg:w-64">
                        <input
                            type="text"
                            placeholder="Search POs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-muted border-transparent text-sm rounded-lg focus:ring-2 focus:ring-brand-500 block w-full pl-10 p-2.5 transition"
                        />
                        <Search className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
                            <button onClick={() => setCellWrapStyle('overflow')} className={`p-1.5 rounded ${cellWrapStyle === 'overflow' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><ArrowRightToLine size={16} /></button>
                            <button onClick={() => setCellWrapStyle('wrap')} className={`p-1.5 rounded ${cellWrapStyle === 'wrap' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><WrapText size={16} /></button>
                            <button onClick={() => setCellWrapStyle('clip')} className={`p-1.5 rounded ${cellWrapStyle === 'clip' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><Scissors size={16} /></button>
                        </div>

                        <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />

                        <button
                            onClick={handleNewPO}
                            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-md whitespace-nowrap text-sm"
                        >
                            <span className="text-xl leading-none">+</span> New PO
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-hidden p-4">
                <DataTable
                    tableId="purchase-order-table"
                    data={filteredData}
                    columns={displayedColumns}
                    loading={loading}
                    onRowClick={handleEditPO}
                    initialSort={{ key: 'order_date', direction: 'descending' }}
                    cellWrapStyle={cellWrapStyle}
                    mobilePrimaryColumns={['po_number', 'vendor_name', 'grand_total', 'status']}
                    renderRowActions={(row) => (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleEditPO(row); }}
                                className="p-2 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                            >
                                <Pencil size={16} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteRequest(row); }}
                                className="p-2 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                />
            </div>

            <ConfirmationModal
                isOpen={!!poToDelete}
                onClose={() => setPoToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Purchase Order"
                variant="danger"
            >
                Are you sure you want to delete PO "{poToDelete?.po_number}"? This cannot be undone.
            </ConfirmationModal>
        </div>
    );
};

export default PurchaseOrderDashboard;

