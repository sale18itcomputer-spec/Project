'use client';

import React, { useState, useMemo } from 'react';
import { PurchaseOrder } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import DataTable, { ColumnDef } from "../../common/DataTable";
import { formatDisplayDate } from "../../../utils/time";
import PurchaseOrderCreator from "../../features/sales/PurchaseOrderCreator";
import { useNavigation } from "../../../contexts/NavigationContext";
import { formatCurrencySmartly } from "../../../utils/formatters";
import { ClipboardList, Pencil, Search, ArrowRightToLine, WrapText, Scissors, Trash2, Copy, Loader2, Warehouse } from 'lucide-react';
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import ConfirmationModal from "../../modals/ConfirmationModal";
import { Badge } from "../../ui/badge";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';

const PURCHASE_ORDER_COLUMNS_VISIBILITY_KEY = 'limperial-purchase-order-columns-visibility';

const PurchaseOrderDashboard: React.FC<{ initialPayload?: any }> = ({ initialPayload }) => {
    const { purchaseOrders, setPurchaseOrders, pricelist, vendorPricelist, loading, refetchData } = useData();
    const [searchQuery, setSearchQuery] = useState('');
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
    const [isDuplicating, setIsDuplicating] = useState(false);
    const { currentUser } = useAuth();

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

            handleNavigation({
                view: 'purchase-orders',
                filter: navigation.filter,
                action: 'create',
                payload: { isDuplicate: true, initialData }
            });
            addToast('Duplicating purchase order...', 'info');
        } catch (err: any) {
            addToast(`Failed to duplicate: ${err.message}`, 'error');
        } finally {
            setIsDuplicating(false);
        }
    };

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

            // ── Enrich each PO item with full metadata ────────────────────────
            // Lookup cascade per item:
            //   Tier 1 — brand/category stored directly on the PO item (new columns)
            //   Tier 2 — main pricelist match by Code === item_number
            //   Tier 3 — vendor_pricelist match by model_name === item_number
            //   Fallback — raw PO item data
            const inventoryPayload = items
                .filter(item => item.qty > 0)
                .map(item => {
                    const code = (item.item_number ?? '').trim();

                    // Tier 1: fields already stored on the PO item (after combobox selection)
                    const hasPOBrand = !!(item.brand || '').trim();

                    // Tier 2: main pricelist (Code match)
                    const plMatch = (pricelist ?? []).find(
                        p => p.Code && p.Code.toLowerCase() === code.toLowerCase()
                    );

                    // Tier 3: vendor pricelist (model_name match)
                    const vplMatch = (vendorPricelist ?? []).find(
                        v => v.model_name && v.model_name.toLowerCase() === code.toLowerCase()
                    );

                    // Resolve each field with cascade priority
                    const resolvedBrand    = hasPOBrand         ? item.brand
                                           : plMatch?.Brand     ? plMatch.Brand
                                           : vplMatch?.brand    ? vplMatch.brand
                                           : '';

                    const resolvedCategory = (item.category ?? '').trim()
                                           ? item.category
                                           : plMatch?.Category  ? plMatch.Category
                                           : 'General';

                    // model_name: prefer pricelist Model > vendor model_name > item_number
                    const resolvedModel    = plMatch?.Model      ? plMatch.Model
                                           : vplMatch?.model_name ? vplMatch.model_name
                                           : code || item.description?.substring(0, 80) || 'N/A';

                    // description: PO item description is ground truth (user typed it);
                    // fall back to pricelist Description or vendor specification
                    const resolvedDesc     = (item.description ?? '').trim()
                                           ? item.description
                                           : plMatch?.Description   ? plMatch.Description
                                           : vplMatch?.specification ? vplMatch.specification
                                           : '';

                    // unit_price: PO item price is always the PO-agreed price
                    const resolvedPrice    = item.unit_price ?? 0;

                    return {
                        po_id:       po.id,
                        po_number:   po.po_number,
                        vendor_id:   po.vendor_id   ?? null,
                        vendor_name: po.vendor_name ?? '',
                        category:    resolvedCategory,
                        code:        code,
                        brand:       resolvedBrand,
                        model_name:  resolvedModel,
                        description: resolvedDesc,
                        qty:         item.qty,
                        unit_price:  resolvedPrice,
                        currency:    po.currency ?? 'USD',
                        status:      'In Stock',
                        created_by:  currentUser?.Name ?? 'System',
                        created_at:  new Date().toISOString(),
                        updated_at:  new Date().toISOString(),
                    };
                });

            const { error: invErr } = await supabase
                .from('inventory')
                .insert(inventoryPayload);

            if (invErr) throw invErr;

            addToast(
                `${inventoryPayload.length} item(s) from PO ${po.po_number} added to Inventory!`,
                'success'
            );
        } catch (err: any) {
            addToast(`Failed to convert to inventory: ${err.message}`, 'error');
        } finally {
            setConvertingId(null);
        }
    };

    const filteredData = useMemo(() => {
        let data = purchaseOrders || [];

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.po_number.toLowerCase().includes(q) ||
                (item.vendor_name || '').toLowerCase().includes(q) ||
                (item.ordered_by_name || '').toLowerCase().includes(q)
            );
        }

        return data;
    }, [purchaseOrders, searchQuery]);

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
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-background">
                <ClipboardList className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h2 className="text-xl font-bold mb-2 text-foreground">Access Restricted</h2>
                <p className="max-w-md">You don't have permission to view or manage Purchase Orders. This area is restricted to Administrators only.</p>
            </div>
        );
    }

    if (isCreating) {
        const creatorInitialData = navigation.payload?.initialData;
        
        return (
            <PurchaseOrderCreator
                onBack={() => {
                    handleNavigation({ view: 'purchase-orders', filter: navigation.filter });
                    refetchData();
                }}
                existingPO={selectedPOToEdit}
                initialData={creatorInitialData}
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

                        <PermissionGate module="purchase_orders" action="create">
                          <button
                            onClick={handleNewPO}
                            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-md whitespace-nowrap text-sm"
                          >
                            <span className="text-xl leading-none">+</span> New PO
                          </button>
                        </PermissionGate>
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
                            {/* Convert to Inventory — shown for Approved/Completed POs */}
                            {(row.status === 'Approved' || row.status === 'Completed') && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleConvertToInventory(row); }}
                                    disabled={convertingId === row.id}
                                    className="p-2 text-muted-foreground hover:text-emerald-500 transition hover:bg-emerald-500/10 rounded-full disabled:opacity-50"
                                    title="Convert to Inventory"
                                >
                                    {convertingId === row.id
                                        ? <Loader2 size={16} className="animate-spin" />
                                        : <Warehouse size={16} />}
                                </button>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleEditPO(row); }}
                                className="p-2 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full"
                                title="Edit"
                            >
                                <Pencil size={16} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDuplicatePO(row); }}
                                disabled={isDuplicating}
                                className="p-2 text-muted-foreground hover:text-violet-500 transition hover:bg-violet-500/10 rounded-full disabled:opacity-50"
                                title="Duplicate"
                            >
                                {isDuplicating ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteRequest(row); }}
                                className="p-2 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full"
                                title="Delete"
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

