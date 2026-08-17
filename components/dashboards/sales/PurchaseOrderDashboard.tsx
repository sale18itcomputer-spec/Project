'use client';

import React, { useState, useMemo } from 'react';
import { PurchaseOrder } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import DataTable, { ColumnDef, CellWrapStyle } from "../../common/DataTable";
import { formatDisplayDate } from "../../../utils/time";
import { useWindowManager } from "../../../contexts/WindowManagerContext";
import PurchaseOrderWindowContent from "../../windows/content/PurchaseOrderWindowContent";
import { formatCurrencySmartly } from "../../../utils/formatters";
import { ClipboardList, Pencil, Plus, Trash2, Copy, Loader2, Warehouse } from 'lucide-react';
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import { convertPurchaseOrderToInventory } from "../../../services/inventoryApi";
import ConfirmationModal from "../../modals/ConfirmationModal";
import { Badge } from "../../ui/badge";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import RowActionMenuItems from "../../common/RowActionMenuItems";
import { DropdownMenuItem } from "../../ui/dropdown-menu";
import DashboardHeader from "../../common/DashboardHeader";
import SearchInput from "../../common/SearchInput";
import CellWrapToggle from "../../common/CellWrapToggle";
import ErrorState from "../../common/ErrorState";
import IconButton from "../../ui/icon-button";
import { Button } from "../../ui/button";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";

const PURCHASE_ORDER_COLUMNS_VISIBILITY_KEY = 'limperial-purchase-order-columns-visibility';

const PurchaseOrderDashboard: React.FC<{ initialPayload?: any }> = () => {
    const { purchaseOrders, setPurchaseOrders, pricelist, vendorPricelist, loading, error } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebouncedValue(searchQuery);
    const { openWindow } = useWindowManager();
    const { addToast } = useToast();
    const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
    const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
    const [isDuplicating, setIsDuplicating] = useState(false);
    const { currentUser } = useAuth();

    const openPOWindow = (poId: string | null, initialData?: Partial<PurchaseOrder>) => {
        const id = poId ? `po-${poId}` : (initialData ? 'po-duplicate' : 'po-new');
        openWindow({
            id,
            title: poId ? 'Edit Purchase Order' : 'New Purchase Order',
            content: <PurchaseOrderWindowContent windowId={id} poId={poId} initialData={initialData} />,
            draggable: true,
            initialWidth: 1100,
            initialHeight: 750,
            minWidth: 850,
            minHeight: 550,
        });
    };

    const fetchPOItems = async (poId: string) => {
        const { data, error } = await supabase
            .from('purchase_order_items')
            .select('*')
            .eq('purchase_order_id', poId)
            .order('line_number', { ascending: true });
        if (error) throw error;
        return data;
    };

    const handleDuplicatePO = async (po: PurchaseOrder) => {
        setIsDuplicating(true);
        try {
            // Fetch items for this PO
            const items = await fetchPOItems(po.id);
            
            // Store in sessionStorage
            sessionStorage.setItem('duplicate_purchase_order_items', JSON.stringify(items));
            
            // Prepare initial metadata (resetting unique or date fields)
            const initialData: Partial<PurchaseOrder> = {
                ...po,
                id: undefined as any,
                po_number: '', // Reset to trigger auto-generation (if any) or leave blank for user
                status: 'Draft',
                order_date: new Date().toISOString().split('T')[0],
                delivery_date: '',
            };

            openPOWindow(null, initialData);
            addToast('Duplicating purchase order...', 'info');
        } catch (err: any) {
            addToast(`Failed to duplicate: ${err.message}`, 'error');
        } finally {
            setIsDuplicating(false);
        }
    };

    const handleNewPO = () => openPOWindow(null);

    const handleEditPO = (po: PurchaseOrder) => openPOWindow(po.id!);

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

    // ── Convert PO → Inventory ────────────────────────────────────────────────
    const [convertingId, setConvertingId] = useState<string | null>(null);

    const handleConvertToInventory = async (po: PurchaseOrder) => {
        if (!po.id) return;
        setConvertingId(po.id);
        try {
            // Fetch line items for this PO
            const { data: items, error: itemsErr } = await supabase
                .from('purchase_order_items')
                .select('*')
                .eq('po_id', po.id)
                .order('line_number', { ascending: true });

            if (itemsErr) throw itemsErr;
            if (!items || items.length === 0) {
                addToast('No line items found on this PO.', 'error');
                return;
            }

            const result = await convertPurchaseOrderToInventory(po, items, {
                pricelist,
                vendorPricelist,
                createdBy: currentUser?.Name ?? 'System',
            });

            if (result.resynced) {
                addToast(result.count > 0
                    ? `Inventory synced from PO ${po.po_number} (${result.count} item(s) updated).`
                    : `PO ${po.po_number} inventory is already up to date.`, 'success');
            } else if (result.converted) {
                addToast(`${result.count} item(s) from PO ${po.po_number} added to Inventory!`, 'success');
            } else {
                addToast('No line items with quantity > 0 found on this PO.', 'error');
            }
        } catch (err: any) {
            addToast(`Failed to convert to inventory: ${err.message}`, 'error');
        } finally {
            setConvertingId(null);
        }
    };

    const filteredData = useMemo(() => {
        let data = purchaseOrders || [];

        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            data = data.filter(item =>
                item.po_number.toLowerCase().includes(q) ||
                (item.vendor_name || '').toLowerCase().includes(q) ||
                (item.ordered_by_name || '').toLowerCase().includes(q)
            );
        }

        return data;
    }, [purchaseOrders, debouncedSearch]);

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
        } catch { }
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
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <ClipboardList className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h2 className="text-xl font-bold mb-2 text-foreground">Access Restricted</h2>
                <p className="max-w-md">You don't have permission to view or manage Purchase Orders. This area is restricted to Administrators only.</p>
            </div>
        );
    }

    if (error) {
        return <ErrorState title="Could not load purchase orders" message={error} />;
    }

    return (
        <div className="h-full flex flex-col">
            <DashboardHeader
                title="Purchase Orders"
                icon={<ClipboardList />}
                subtitle={`${filteredData.length} items`}
            >
                <SearchInput
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Search POs..."
                    label="Search purchase orders"
                />

                <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

                <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />

                <PermissionGate module="purchase_orders" action="create">
                  <Button onClick={handleNewPO} aria-label="New purchase order">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">New PO</span>
                  </Button>
                </PermissionGate>
            </DashboardHeader>

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
                    emptyState={{
                        title: 'No purchase orders yet',
                        description: 'Purchase orders you raise will appear here.',
                    }}
                    renderRowActions={(row) => (
                        <div className="flex items-center gap-1">
                            {/* Convert to Inventory — shown for Approved/Completed POs */}
                            {(row.status === 'Approved' || row.status === 'Completed') && (
                                <IconButton
                                    label="Convert to Inventory"
                                    onClick={(e) => { e.stopPropagation(); handleConvertToInventory(row); }}
                                    disabled={convertingId === row.id}
                                >
                                    {convertingId === row.id
                                        ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                        : <Warehouse size={16} aria-hidden="true" />}
                                </IconButton>
                            )}
                            <IconButton
                                label="Edit purchase order"
                                tone="primary"
                                onClick={(e) => { e.stopPropagation(); handleEditPO(row); }}
                            >
                                <Pencil size={16} aria-hidden="true" />
                            </IconButton>
                            <IconButton
                                label="Duplicate purchase order"
                                onClick={(e) => { e.stopPropagation(); handleDuplicatePO(row); }}
                                disabled={isDuplicating}
                            >
                                {isDuplicating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                            </IconButton>
                            <IconButton
                                label="Delete purchase order"
                                tone="danger"
                                onClick={(e) => { e.stopPropagation(); handleDeleteRequest(row); }}
                            >
                                <Trash2 size={16} aria-hidden="true" />
                            </IconButton>
                        </div>
                    )}
                    renderRowContextMenu={(row) => (
                        <RowActionMenuItems
                            onOpenWindow={() => openPOWindow(row.id!)}
                            onEdit={() => handleEditPO(row)}
                            onDelete={() => handleDeleteRequest(row)}
                        >
                            {(row.status === 'Approved' || row.status === 'Completed') && (
                                <DropdownMenuItem disabled={convertingId === row.id} onClick={() => handleConvertToInventory(row)}>
                                    <Warehouse className="mr-2 h-4 w-4" /> Convert to Inventory
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem disabled={isDuplicating} onClick={() => handleDuplicatePO(row)}>
                                <Copy className="mr-2 h-4 w-4" /> Duplicate
                            </DropdownMenuItem>
                        </RowActionMenuItems>
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

