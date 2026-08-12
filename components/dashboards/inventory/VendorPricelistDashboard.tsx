'use client';

import React, { useState, useMemo } from 'react';
import { VendorPricelistItem } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { Pencil, Filter, Tag, Package, Download, Upload, Loader2 } from 'lucide-react';
import DataTable, { ColumnDef, CellWrapStyle } from "../../common/DataTable";
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { Badge } from "../../ui/badge";
import ExcelJS from 'exceljs';
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { usePermissions } from '../../../hooks/usePermissions';
import { insertRecord } from "../../../services/b2bDb";
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import VendorPricelistWindowContent from '../../windows/content/VendorPricelistWindowContent';

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

const VENDOR_PRICELIST_COLUMNS_VISIBILITY_KEY = 'limperial-vendor-pricelist-columns-visibility';

const VendorPricelistDashboard: React.FC = () => {
    const { vendorPricelist, vendors, loading, error, refetchData } = useData();

    const { addToast } = useToast();
    const { currentUser } = useAuth();
    const { showField, can } = usePermissions();
    const { openWindow } = useWindowManager();

    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebouncedValue(searchQuery);
    const [vendorFilter, setVendorFilter] = useState<string>('all');
    const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
    const [isUploading, setIsUploading] = useState(false);

    const handleOpenNewItem = () => {
        const winId = 'vendor-pricelist-new';
        openWindow({
            id: winId,
            title: 'Add Pricelist Item',
            content: <VendorPricelistWindowContent windowId={winId} itemId={null} />,
            initialWidth: 560,
            initialHeight: 680,
            draggable: true,
            onClose: () => {},
        });
    };
    const handleViewItem = (item: VendorPricelistItem) => {
        const winId = `vendor-pricelist-${item.id}`;
        openWindow({
            id: winId,
            title: `Item: ${item.model_name}`,
            content: <VendorPricelistWindowContent windowId={winId} itemId={item.id} initialReadOnly={true} />,
            initialWidth: 560,
            initialHeight: 680,
            draggable: true,
            onClose: () => {},
        });
    };
    const handleEditItem = (item: VendorPricelistItem) => {
        const winId = `vendor-pricelist-edit-${item.id}`;
        openWindow({
            id: winId,
            title: `Editing: ${item.model_name}`,
            content: <VendorPricelistWindowContent windowId={winId} itemId={item.id} initialReadOnly={false} />,
            initialWidth: 560,
            initialHeight: 680,
            draggable: true,
            onClose: () => {},
        });
    };

    const handleDownloadTemplate = async () => {
        const headers = [
            'Vendor Name', 'Brand', 'Model Name', 'Specification',
            'Dealer Price', 'User Price', 'Promotion', 'Currency', 'Status', 'Remarks'
        ];
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');
        worksheet.addRow(headers);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vendor_pricelist_template.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast('Template downloaded!', 'success');
    };


    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !vendors) return;

        setIsUploading(true);

        try {
            const buffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const worksheet = workbook.worksheets[0];

            // Read headers from the first row
            const headerRow = worksheet.getRow(1);
            const headers: string[] = [];
            headerRow.eachCell((cell) => {
                headers.push(cell.text);
            });

            // Read data rows into JSON
            const jsonData: Record<string, any>[] = [];
            worksheet.eachRow((row, rowIndex) => {
                if (rowIndex === 1) return; // skip header row
                const rowData: Record<string, any> = {};
                row.eachCell((cell, colIndex) => {
                    rowData[headers[colIndex - 1]] = cell.value;
                });
                if (Object.keys(rowData).length > 0) {
                    jsonData.push(rowData);
                }
            });

            if (jsonData.length === 0) {
                addToast('The file is empty', 'error');
                return;
            }

            let successCount = 0;
            let errorCount = 0;

            for (const row of jsonData) {
                const vendorName = row['Vendor Name'];
                const vendorId = vendors.find(v => v.vendor_name === vendorName)?.id;

                if (!vendorId) {
                    console.error(`Vendor not found: ${vendorName}`);
                    errorCount++;
                    continue;
                }

                const newItem = {
                    vendor_id: vendorId,
                    brand: row['Brand'] || '',
                    model_name: row['Model Name'] || 'Unnamed Item',
                    specification: row['Specification'] || '',
                    dealer_price: parseFloat(row['Dealer Price']) || 0,
                    user_price: parseFloat(row['User Price']) || 0,
                    promotion: row['Promotion'] || '',
                    currency: row['Currency'] || 'USD',
                    status: row['Status'] || 'Available',
                    remarks: row['Remarks'] || '',
                    created_by: currentUser?.Name || ''
                };

                try {
                    await insertRecord('vendor_pricelist', newItem, false);
                    successCount++;
                } catch (err) {
                    console.error(err);
                    errorCount++;
                }
            }

            addToast(`Bulk upload complete! ${successCount} items added, ${errorCount} failed.`, errorCount > 0 ? 'info' : 'success');
            refetchData();
        } catch (err) {
            console.error(err);
            addToast('Failed to process file', 'error');
        } finally {
            setIsUploading(false);
            event.target.value = ''; // Reset input
        }
    };

    const filteredData = useMemo(() => {
        if (!vendorPricelist) return [];
        let data = vendorPricelist;

        if (vendorFilter !== 'all') {
            data = data.filter(item => item.vendor_id === vendorFilter);
        }

        if (debouncedSearch) {
            const lowercasedQuery = debouncedSearch.toLowerCase();
            data = data.filter(item =>
                ['brand', 'model_name', 'specification', 'vendor_name'].some(key =>
                    String(item[key as keyof VendorPricelistItem] ?? '').toLowerCase().includes(lowercasedQuery)
                )
            );
        }

        return data;
    }, [vendorPricelist, debouncedSearch, vendorFilter]);

    const allColumns = useMemo<ColumnDef<VendorPricelistItem>[]>(() => {
        const canSeeVendorPricing = showField('showVendorPricing');
        const columns: ColumnDef<VendorPricelistItem>[] = [
            { accessorKey: 'brand', header: 'Brand', isSortable: true },
            {
                accessorKey: 'model_name',
                header: 'Model Name',
                isSortable: true,
                cell: (value: string) => <span className="font-semibold text-foreground">{value}</span>
            },
            { accessorKey: 'specification', header: 'Specification', isSortable: true },
            ...(canSeeVendorPricing ? [
                {
                    accessorKey: 'dealer_price',
                    header: 'Dealer Price',
                    isSortable: true,
                    cell: (value: number, row: VendorPricelistItem) => (
                        <span className="text-right block w-full font-medium">
                            {row.currency === 'KHR' ? `៛${value?.toLocaleString()}` : `$${value?.toLocaleString()}`}
                        </span>
                    )
                } as ColumnDef<VendorPricelistItem>,
                {
                    accessorKey: 'user_price',
                    header: 'User Price',
                    isSortable: true,
                    cell: (value: number, row: VendorPricelistItem) => (
                        <span className="text-right block w-full font-medium text-primary">
                            {row.currency === 'KHR' ? `៛${value?.toLocaleString()}` : `$${value?.toLocaleString()}`}
                        </span>
                    )
                } as ColumnDef<VendorPricelistItem>,
            ] : []),
            { accessorKey: 'promotion', header: 'Promotion', isSortable: true },
            { accessorKey: 'vendor_name', header: 'Vendor', isSortable: true },
            {
                accessorKey: 'status',
                header: 'Status',
                isSortable: true,
                cell: (value: string) => {
                    let variant: 'outline' | 'secondary' | 'destructive' = 'outline';
                    if (value === 'Out of Stock') variant = 'destructive';
                    if (value === 'Available') variant = 'outline';
                    return <Badge variant={variant}>{value}</Badge>;
                },
            },
        ];

        return columns;
    }, [showField]);


    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        const defaultVisible = new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean));
        try {
            const saved = localStorageGet(VENDOR_PRICELIST_COLUMNS_VISIBILITY_KEY);
            if (saved) {
                const savedSet = new Set<string>(JSON.parse(saved));
                // Add vendor_name if it's missing (helps users with stale cache)
                if (!savedSet.has('vendor_name')) {
                    savedSet.add('vendor_name');
                }
                return savedSet;
            }
        } catch { }
        return defaultVisible;
    });

    const handleColumnToggle = (columnKey: string) => {
        setVisibleColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(columnKey)) {
                if (newSet.size > 1) newSet.delete(columnKey);
            } else {
                newSet.add(columnKey);
            }
            localStorageSet(VENDOR_PRICELIST_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
            return newSet;
        });
    };

    const displayedColumns = useMemo(() => {
        return allColumns.filter(c => c.accessorKey && visibleColumns.has(c.accessorKey as string));
    }, [allColumns, visibleColumns]);

    if (error) {
        return <ErrorState title="Could not load the vendor pricelist" message={error} />;
    }

    return (
        <div className="h-full flex flex-col">
            <DashboardHeader
                title="Vendor Pricelist"
                icon={<Package />}
                subtitle={`${filteredData.length} items from ${vendorFilter === 'all' ? 'all' : vendors?.find(v => v.id === vendorFilter)?.vendor_name} vendors`}
            >
                <div className="flex flex-shrink-0 items-center gap-2">
                    <Filter className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                    <select
                        value={vendorFilter}
                        onChange={(e) => setVendorFilter(e.target.value)}
                        aria-label="Filter by vendor"
                        className="h-9 rounded-md border border-border bg-muted px-2 text-sm text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="all">All Vendors</option>
                        {vendors?.map(v => (
                            <option key={v.id} value={v.id}>{v.vendor_name}</option>
                        ))}
                    </select>
                </div>

                <SearchInput
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Search items..."
                    label="Search pricelist items"
                />

                <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

                <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />

                <div className="flex flex-shrink-0 items-center gap-1 border-l border-border pl-2">
                    <IconButton
                        label="Download Template"
                        onClick={handleDownloadTemplate}
                    >
                        <Download size={18} aria-hidden="true" />
                    </IconButton>

                    {/* Stays a <label> so the click still opens the hidden file input;
                        `asChild` gives it the canonical icon-button styling. */}
                    <Button asChild variant="ghostMuted" size="iconTouch" className="cursor-pointer rounded-md">
                        <label title="Bulk Upload" aria-label="Bulk Upload">
                            {isUploading ? <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={isUploading}
                            />
                        </label>
                    </Button>
                </div>

                <PermissionGate module="vendor_pricelist" action="create">
                  <Button onClick={handleOpenNewItem} aria-label="Add pricelist item">
                    <Tag className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Add Item</span>
                  </Button>
                </PermissionGate>
            </DashboardHeader>

            <div className="flex-1 overflow-hidden p-4">
                <DataTable
                    tableId="vendor-pricelist-table"
                    data={filteredData}
                    columns={displayedColumns}
                    loading={loading}
                    onRowClick={handleViewItem}
                    mobilePrimaryColumns={['model_name', 'brand', 'dealer_price']}

                    cellWrapStyle={cellWrapStyle}
                    emptyState={{
                        title: 'No pricelist items yet',
                        description: 'Items you add or bulk-upload will appear here.',
                    }}
                    renderRowActions={(row) => (
                        <IconButton
                            label="Edit item"
                            tone="primary"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleEditItem(row);
                            }}
                        >
                            <Pencil size={16} aria-hidden="true" />
                        </IconButton>
                    )}
                    renderRowContextMenu={(row) => (
                        <RowActionMenuItems
                            onOpenWindow={() => handleViewItem(row)}
                            onView={() => handleViewItem(row)}
                            onEdit={() => handleEditItem(row)}
                        />
                    )}
                />
            </div>
        </div>
    );
};

export default React.memo(VendorPricelistDashboard);

