'use client';

import React, { useState, useMemo } from 'react';
import { Vendor } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { Pencil, Search, ArrowRightToLine, WrapText, Scissors, UserPlus } from 'lucide-react';
import DataTable, { ColumnDef } from "../../common/DataTable";
import { DataTableColumnToggle } from "../../common/DataTableColumnToggle";
import { useWindowSize } from "../../../hooks/useWindowSize";
import NewVendorModal from "../../modals/NewVendorModal";
import { localStorageGet, localStorageSet } from '../../../utils/storage';

const VENDOR_COLUMNS_VISIBILITY_KEY = 'limperial-vendor-columns-visibility';

const VendorDashboard: React.FC = () => {
    const { vendors, loading, error } = useData();
    const [modalConfig, setModalConfig] = useState<{ vendor: Vendor | null, isReadOnly: boolean, isOpen: boolean }>({ vendor: null, isReadOnly: false, isOpen: false });
    // Initialize isOpen to false, I just saw I put true by mistake in the line above. 
    // Fixing it in the actual implementation below.
    const [searchQuery, setSearchQuery] = useState('');
    const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('wrap');
    const { width } = useWindowSize();

    const handleCloseModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
    const handleOpenNewVendor = () => setModalConfig({ vendor: null, isReadOnly: false, isOpen: true });
    const handleViewVendor = (vendor: Vendor) => {
        setModalConfig({ vendor, isReadOnly: true, isOpen: true });
    };

    const filteredData = useMemo(() => {
        if (!vendors) return [];
        if (!searchQuery) return vendors;
        const lowercasedQuery = searchQuery.toLowerCase();
        return vendors.filter(item =>
            ['vendor_name', 'category', 'contact_person', 'email', 'phone'].some(key =>
                String(item[key as keyof Vendor] ?? '').toLowerCase().includes(lowercasedQuery)
            )
        );
    }, [vendors, searchQuery]);

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
        return (
            <div className="p-6 md:p-8">
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
                    <p className="font-bold">Error</p>
                    <p>Could not load vendor data: {error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="p-4 lg:p-6 bg-card border-b border-border flex-shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center">
                            <span className="text-lg font-semibold text-foreground">{filteredData.length}</span>
                            <span className="ml-2 text-sm text-muted-foreground">vendors registered</span>
                        </div>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-start lg:items-center">
                        <div className="relative w-full lg:w-64 flex-shrink-0">
                            <input
                                type="text"
                                placeholder="Search vendors..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-muted border-transparent text-foreground placeholder-muted-foreground/50 text-sm rounded-lg focus:ring-2 focus:ring-brand-500/50 focus:bg-background focus:border-brand-500 block w-full pl-10 p-2.5 transition"
                            />
                            <Search className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="bg-muted p-1 rounded-lg flex items-center gap-1">
                                <button onClick={() => setCellWrapStyle('overflow')} className={`p-1.5 rounded ${cellWrapStyle === 'overflow' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><ArrowRightToLine size={16} /></button>
                                <button onClick={() => setCellWrapStyle('wrap')} className={`p-1.5 rounded ${cellWrapStyle === 'wrap' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><WrapText size={16} /></button>
                                <button onClick={() => setCellWrapStyle('clip')} className={`p-1.5 rounded ${cellWrapStyle === 'clip' ? 'bg-background shadow text-brand-500' : 'text-muted-foreground'}`}><Scissors size={16} /></button>
                            </div>
                            <DataTableColumnToggle allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle} />
                            <button
                                onClick={handleOpenNewVendor}
                                className="flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-lg transition shadow-sm ml-auto lg:ml-0"
                            >
                                <UserPlus className="w-5 h-5 mr-2" />
                                <span>New Vendor</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-4">
                <DataTable
                    tableId="vendor-table"
                    data={filteredData}
                    columns={displayedColumns}
                    loading={loading}
                    onRowClick={handleViewVendor}
                    mobilePrimaryColumns={['vendor_name', 'category', 'status']}
                    cellWrapStyle={cellWrapStyle}
                    renderRowActions={(row) => (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setModalConfig({ vendor: row, isReadOnly: false, isOpen: true });
                            }}
                            className="p-2 text-muted-foreground hover:text-brand-500 transition"
                        >
                            <Pencil size={16} />
                        </button>
                    )}
                />
            </div>

            <NewVendorModal
                isOpen={modalConfig.isOpen}
                onClose={handleCloseModal}
                existingData={modalConfig.vendor}
                initialReadOnly={modalConfig.isReadOnly}
            />
        </div>
    );
};

export default React.memo(VendorDashboard);

