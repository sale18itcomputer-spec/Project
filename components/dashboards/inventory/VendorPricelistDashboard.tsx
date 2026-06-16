'use client';

import React, { useState, useMemo } from 'react';
import { VendorPricelistItem } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { Pencil, Search, ArrowRightToLine, WrapText, Filter, Tag, Download, Upload, Loader2 } from 'lucide-react';
import DataTable, { ColumnDef } from "../../common/DataTable";
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { useWindowSize } from "../../../hooks/useWindowSize";
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

const VENDOR_PRICELIST_COLUMNS_VISIBILITY_KEY = 'limperial-vendor-pricelist-columns-visibility';

const VendorPricelistDashboard: React.FC = () => {
    const { vendorPricelist, vendors, loading, error, refetchData } = useData();

    const { addToast } = useToast();
    const { currentUser } = useAuth();
    const { showField, can } = usePermissions();
    const { openWindow } = useWindowManager();

    const [searchQuery, setSearchQuery] = useState('');
    const [vendorFilter, setVendorFilter] = useState<string>('all');
    const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('nowrap' as any);
    const [isUploading, setIsUploading] = useState(false);
    useWindowSize();

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

        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            data = data.filter(item =>
                ['brand', 'model_name', 'specification', 'vendor_name'].some(key =>
                    String(item[key as keyof VendorPricelistItem] ?? '').toLowerCase().includes(lowercasedQuery)
                )
            );
        }

        return data;
    }, [vendorPricelist, searchQuery, vendorFilter]);

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
                        <span className="text-right block w-full font-medium text-brand-600">
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
        return <div className="p-8 text-rose-500">Error: {error}</div>;
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 lg:p-6 bg-card border-b border-border flex-shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{filteredData.length} items from {vendorFilter === 'all' ? 'all' : vendors?.find(v => v.id === vendorFilter)?.vendor_name} vendors</p>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-start lg:items-center">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-muted-foreground" />
                            <select
                                value={vendorFilter}
                                onChange={(e) => setVendorFilter(e.target.value)}
                                className="bg-muted border-none text-sm rounded-lg p-2 focus:ring-1 focus:ring-brand-500"
                            >
                                <option value="all">All Vendors</option>
                                {vendors?.map(v => (
                                    <option key={v.id} value={v.id}>{v.vendor_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative w-full lg:w-64">
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-muted border-transparent text-foreground placeholder-muted-foreground/50 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 block w-full pl-10 p-2.5 transition"
                            />
                            <Search className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="bg-muted p-1 rounded-lg flex items-center gap-1">
                                <button onClick={() => setCellWrapStyle('overflow')} className={`p-1.5 rounded ${cellWrapStyle === 'overflow' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><ArrowRightToLine size={16} /></button>
                                <button onClick={() => setCellWrapStyle('wrap')} className={`p-1.5 rounded ${cellWrapStyle === 'wrap' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><WrapText size={16} /></button>
                            </div>
                            <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />

                            <div className="flex items-center gap-2 border-l pl-2 ml-1">
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="p-2 text-muted-foreground hover:text-brand-500 transition-colors"
                                    title="Download Template"
                                >
                                    <Download size={20} />
                                </button>

                                <label className="cursor-pointer p-2 text-muted-foreground hover:text-emerald-500 transition-colors" title="Bulk Upload">
                                    {isUploading ? <Loader2 size={20} className="animate-spin text-brand-500" /> : <Upload size={20} />}
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                    />
                                </label>
                            </div>

                            <PermissionGate module="vendor_pricelist" action="create">
                              <button
                                onClick={handleOpenNewItem}
                                className="flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition shadow-sm"
                              >
                                <Tag className="w-5 h-5 mr-2" />
                                <span>Add Item</span>
                              </button>
                            </PermissionGate>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-4">
                <DataTable
                    tableId="vendor-pricelist-table"
                    data={filteredData}
                    columns={displayedColumns}
                    loading={loading}
                    onRowClick={handleViewItem}
                    mobilePrimaryColumns={['model_name', 'brand', 'dealer_price']}

                    cellWrapStyle={cellWrapStyle}
                    renderRowActions={(row) => (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleEditItem(row);
                            }}
                            className="p-2 text-muted-foreground hover:text-brand-500 transition"
                        >
                            <Pencil size={16} />
                        </button>
                    )}
                    renderRowContextMenu={(row) => (
                        <RowActionMenuItems
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

