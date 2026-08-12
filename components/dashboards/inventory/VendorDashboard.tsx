'use client';

import React, { useState, useMemo } from 'react';
import { Vendor } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { Pencil, Truck, UserPlus } from 'lucide-react';
import DataTable, { ColumnDef, CellWrapStyle } from "../../common/DataTable";
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import VendorWindowContent from "../../windows/content/VendorWindowContent";
import { useWindowManager } from "../../../contexts/WindowManagerContext";
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import ErrorState from '../../common/ErrorState';
import IconButton from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const VENDOR_COLUMNS_VISIBILITY_KEY = 'limperial-vendor-columns-visibility';

const VendorDashboard: React.FC = () => {
    const { vendors, loading, error } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebouncedValue(searchQuery);
    const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
    const { openWindow } = useWindowManager();

    const openVendorWindow = (vendorId: string | null, initialReadOnly: boolean) => {
        const id = `vendor-${vendorId ?? 'new'}`;
        openWindow({
            id,
            title: vendorId ? 'Vendor' : 'Add New Vendor',
            content: <VendorWindowContent windowId={id} vendorId={vendorId} initialReadOnly={initialReadOnly} />,
            draggable: true,
        });
    };

    const handleOpenNewVendor = () => openVendorWindow(null, false);
    const handleViewVendor = (vendor: Vendor) => openVendorWindow(vendor.id, true);
    const handleEditVendor = (vendor: Vendor) => openVendorWindow(vendor.id, false);

    const filteredData = useMemo(() => {
        if (!vendors) return [];
        if (!debouncedSearch) return vendors;
        const lowercasedQuery = debouncedSearch.toLowerCase();
        return vendors.filter(item =>
            ['vendor_name', 'category', 'contact_person', 'email', 'phone'].some(key =>
                String(item[key as keyof Vendor] ?? '').toLowerCase().includes(lowercasedQuery)
            )
        );
    }, [vendors, debouncedSearch]);

    const allColumns = useMemo<ColumnDef<Vendor>[]>(() => [
        {
            accessorKey: 'vendor_name',
            header: 'Vendor Name',
            isSortable: true,
            cell: (value: string) => <span className="font-semibold text-foreground">{value}</span>
        },
        { accessorKey: 'category', header: 'Category', isSortable: true },
        { accessorKey: 'contact_person', header: 'Contact Person', isSortable: true },
        { accessorKey: 'phone', header: 'Phone', isSortable: true },
        { accessorKey: 'email', header: 'Email', isSortable: true },
        {
            accessorKey: 'status',
            header: 'Status',
            isSortable: true,
            cell: (value: string) => {
                const statusColor = value === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground';
                return (
                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${statusColor}`}>
                        {value}
                    </span>
                );
            },
        },
    ], []);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorageGet(VENDOR_COLUMNS_VISIBILITY_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return new Set(parsed);
            }
        } catch (e) {
            console.error("Failed to load visible columns from storage", e);
        }
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
            localStorageSet(VENDOR_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
            return newSet;
        });
    };

    const displayedColumns = useMemo(() => {
        return allColumns.filter(c => c.accessorKey && visibleColumns.has(c.accessorKey as string));
    }, [allColumns, visibleColumns]);

    if (error) {
        return <ErrorState title="Could not load vendors" message={error} />;
    }

    return (
        <div className="h-full flex flex-col">
            <DashboardHeader
                title="Vendors"
                icon={<Truck />}
                subtitle={`${filteredData.length} vendors registered`}
            >
                <SearchInput
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Search vendors..."
                    label="Search vendors"
                />

                <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

                <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />

                <PermissionGate module="vendors" action="create">
                  <Button onClick={handleOpenNewVendor} aria-label="New vendor">
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">New Vendor</span>
                  </Button>
                </PermissionGate>
            </DashboardHeader>

            <div className="flex-1 overflow-hidden p-4">
                <DataTable
                    tableId="vendor-table"
                    data={filteredData}
                    columns={displayedColumns}
                    loading={loading}
                    onRowClick={handleViewVendor}
                    mobilePrimaryColumns={['vendor_name', 'category', 'status']}
                    cellWrapStyle={cellWrapStyle}
                    emptyState={{
                        title: 'No vendors yet',
                        description: 'Vendors you register will appear here.',
                    }}
                    renderRowActions={(row) => (
                        <IconButton
                            label="Edit vendor"
                            tone="primary"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleEditVendor(row);
                            }}
                        >
                            <Pencil size={16} aria-hidden="true" />
                        </IconButton>
                    )}
                    renderRowContextMenu={(row) => (
                        <RowActionMenuItems
                            onOpenWindow={() => openVendorWindow(row.id, false)}
                            onView={() => handleViewVendor(row)}
                            onEdit={() => handleEditVendor(row)}
                        />
                    )}
                />
            </div>
        </div>
    );
};

export default React.memo(VendorDashboard);

