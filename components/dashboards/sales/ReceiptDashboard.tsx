'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Receipt } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef, CellWrapStyle } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { useNavigation } from '../../../contexts/NavigationContext';
import { formatCurrencySmartly } from '../../../utils/formatters';
import { Receipt as ReceiptIcon, Table, Columns, Info } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import Spinner from '../../common/Spinner';
import ReceiptCreator from '../../features/sales/ReceiptCreator';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { Wallet, ArrowRight } from 'lucide-react';
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

const RV_COLUMNS_KEY = 'limperial-rv-columns-visibility';
type ViewMode = 'table' | 'detail';

interface Props { initialPayload?: any; }

const ReceiptDashboard: React.FC<Props> = ({ initialPayload }) => {
    // Receipts are now read-only audit records. They're created exclusively via
    // QuickPaymentModal in the Collection tab. setReceipts is kept available for
    // realtime + optimistic updates triggered elsewhere, but this dashboard does
    // not mutate receipts directly.
    const { receipts = [], loading, error } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebouncedValue(searchQuery);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
    const { handleNavigation, navigation } = useNavigation();
    const isMobile = useIsMobile();

    // Only "view" mode is reachable now. Any inbound "edit" or "create" action
    // (from legacy links or URL hacking) is treated as a view so the form is
    // never opened in editable mode.
    const isCreating = navigation.action === 'view'
        || (!!initialPayload && !navigation.action);

    const selectedId = useMemo(() => {
        if (navigation.action === 'view') return navigation.id || null;
        return null;
    }, [navigation.action, navigation.id]);

    useEffect(() => {
        if (navigation.action === 'view') setViewMode('detail');
    }, [navigation.action]);

    const handleView = (row: Receipt) => {
        handleNavigation({ view: 'receipts', action: 'view', id: row['RV No'] });
    };
    const handleBack = () => handleNavigation({ view: 'receipts' });

    const filteredData = useMemo(() => {
        let data = receipts || [];
        if (statusFilter) data = data.filter(r => r['Status'] === statusFilter);
        if (!debouncedSearch) return data;
        const q = debouncedSearch.toLowerCase();
        return data.filter(r =>
            ['RV No', 'Inv No', 'SO No', 'DO No', 'Company Name', 'Contact Name', 'Status', 'Payment Method', 'Created By'].some(
                k => String(r[k] ?? '').toLowerCase().includes(q)
            )
        );
    }, [receipts, debouncedSearch, statusFilter]);

    const allColumns = useMemo<ColumnDef<Receipt>[]>(() => [
        {
            accessorKey: 'RV No', header: 'RV No', isSortable: true,
            cell: (v: string) => <div className="font-semibold text-muted-foreground/80">{v}</div>,
        },
        {
            accessorKey: 'RV Date', header: 'RV Date', isSortable: true,
            cell: (v: string) => formatDisplayDate(v),
        },
        { accessorKey: 'Inv No', header: 'Inv No', isSortable: true },
        { accessorKey: 'DO No', header: 'DO No', isSortable: true },
        { accessorKey: 'Company Name', header: 'Company Name', isSortable: true },
        { accessorKey: 'Contact Name', header: 'Contact Name', isSortable: true },
        {
            accessorKey: 'Amount', header: 'Amount', isSortable: true,
            cell: (v: number, row: Receipt) => (
                <span className="text-sm font-medium text-foreground text-right block w-full">
                    {formatCurrencySmartly(String(v ?? ''), row['Currency'])}
                </span>
            ),
        },
        {
            accessorKey: 'Payment Method', header: 'Payment Method', isSortable: true,
            cell: (v: string) => v || <span className="text-muted-foreground/30">–</span>,
        },
        {
            accessorKey: 'Tax Type', header: 'Tax Type', isSortable: true,
            cell: (v: string) => v ? <span className="font-medium text-foreground">{v}</span> : <span className="text-muted-foreground/30">–</span>,
        },
        { accessorKey: 'Created By', header: 'Created By', isSortable: true },
        {
            accessorKey: 'Status', header: 'Status', isSortable: true,
            cell: (v: Receipt['Status']) => <StatusBadge status={v} />,
        },
    ], []);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorageGet(RV_COLUMNS_KEY);
            if (saved) return new Set(JSON.parse(saved));
        } catch { }
        // Default visible columns
        return new Set(['RV No', 'RV Date', 'Inv No', 'Company Name', 'Amount', 'Payment Method', 'Status']);
    });

    const handleColumnToggle = (key: string) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) { if (next.size > 1) next.delete(key); }
            else next.add(key);
            localStorageSet(RV_COLUMNS_KEY, JSON.stringify(Array.from(next)));
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

    if (error) return <ErrorState title="Could not load receipts" message={error} />;

    const selectedRV = selectedId ? (receipts || []).find(r => r['RV No'] === selectedId) : null;

    // Only the "view" action opens ReceiptCreator. Forced into read-only mode
    // inside ReceiptCreator (next step) — no edit/create entry points remain.
    if (isCreating && selectedRV) return (
        <ReceiptCreator
            onBack={handleBack}
            existingReceipt={selectedRV}
            initialData={initialPayload}
        />
    );

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <DashboardHeader title="Receipts (RV)" icon={<ReceiptIcon />}>
                <SearchInput
                    id="receipt-search"
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Search receipts..."
                    label="Search receipts"
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

                <Button
                    onClick={() => handleNavigation({ view: 'collection' })}
                    title="Record payments in Collection to create receipts"
                    aria-label="Record payment"
                >
                    <Wallet size={16} aria-hidden="true" />
                    <span className="hidden sm:inline">Record Payment</span>
                    <ArrowRight size={14} aria-hidden="true" />
                </Button>
            </DashboardHeader>

            {/* Banner — receipts are created via Collection only */}
            <div className="flex-shrink-0 px-4 lg:px-6 py-2.5 bg-primary/5 border-b border-border flex items-center gap-2 text-xs text-muted-foreground">
                <Wallet className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span>Receipts are created automatically when you record a payment.</span>
                <button
                    onClick={() => handleNavigation({ view: 'collection' })}
                    className="font-bold text-primary hover:underline inline-flex items-center gap-0.5"
                >
                    Go to Collection <ArrowRight className="w-3 h-3" />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-hidden p-4">
                {loading ? <Spinner /> : viewMode === 'table' ? (
                    <DataTable
                        tableId="rv-table" data={filteredData} columns={displayedColumns}
                        loading={loading} onRowClick={handleView}
                        initialSort={{ key: 'created_at', direction: 'descending' }}
                        mobilePrimaryColumns={['RV No', 'Company Name', 'Amount', 'Status']}
                        cellWrapStyle={cellWrapStyle}
                        emptyState={{
                            title: 'No receipts yet',
                            description: 'Receipts appear here once you record a payment in Collection.',
                        }}
                        renderRowActions={row => (
                            <div className="flex items-center justify-center gap-1">
                                <IconButton
                                    label="View receipt"
                                    tone="primary"
                                    onClick={e => { e.stopPropagation(); handleView(row); }}
                                >
                                    <Info size={16} aria-hidden="true" />
                                </IconButton>
                            </div>
                        )}
                        renderRowContextMenu={row => (
                            <RowActionMenuItems onView={() => handleView(row)} />
                        )}
                    />
                ) : (
                    <div className="h-full flex divide-x divide-border">
                        {/* List */}
                        <div className="w-80 flex-shrink-0 bg-card overflow-y-auto">
                            {filteredData.map(r => (
                                <button key={r['RV No']}
                                    onClick={() => handleNavigation({ view: 'receipts', action: 'view', id: r['RV No'] })}
                                    className={`w-full text-left p-4 border-b hover:bg-muted transition-colors ${selectedId === r['RV No'] ? 'bg-primary/10 border-r-4 border-r-primary' : 'border-border'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-foreground">{r['RV No']}</span>
                                        <StatusBadge status={r['Status']} />
                                    </div>
                                    <div className="text-sm font-medium text-foreground/80 truncate">{r['Company Name']}</div>
                                    <div className="text-sm font-bold text-primary mt-2">
                                        {formatCurrencySmartly(String(r['Amount'] ?? ''), r['Currency'])}
                                    </div>
                                    {r['Payment Method'] && <div className="text-xs text-muted-foreground mt-1">{r['Payment Method']}</div>}
                                </button>
                            ))}
                            {filteredData.length === 0 && <div className="p-8 text-center text-muted-foreground">No receipts found</div>}
                        </div>
                        {/* Detail */}
                        <div className="flex-1 overflow-y-auto p-8">
                            {selectedRV ? (
                                <div className="max-w-3xl mx-auto space-y-6">
                                    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                                        <div className="px-6 py-4 bg-muted border-b border-border flex justify-between items-center">
                                            <h2 className="text-lg font-bold text-foreground">Receipt Details</h2>
                                            <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md uppercase font-bold tracking-wider">Issued · Immutable</span>
                                        </div>
                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Document Info</label>
                                                    <div className="mt-2 grid grid-cols-2 gap-3">
                                                        {[
                                                            ['RV No', selectedRV['RV No']],
                                                            ['RV Date', formatDisplayDate(selectedRV['RV Date'])],
                                                            ['Invoice Ref', selectedRV['Inv No'] || '–'],
                                                            ['DO Ref', selectedRV['DO No'] || '–'],
                                                            ['SO Ref', selectedRV['SO No'] || '–'],
                                                            ['Tax Type', selectedRV['Tax Type'] || '–'],
                                                        ].map(([label, val]) => (
                                                            <div key={label}>
                                                                <p className="text-xs text-muted-foreground">{label}</p>
                                                                <p className="font-semibold text-foreground/80">{val}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Payment</label>
                                                    <div className="mt-2 space-y-2">
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">Total Amount</p>
                                                            <p className="text-2xl font-bold text-primary">
                                                                {formatCurrencySmartly(String(selectedRV['Amount'] ?? ''), selectedRV['Currency'])}
                                                            </p>
                                                        </div>
                                                        <p className="text-sm"><span className="text-muted-foreground">Method: </span><span className="font-medium">{selectedRV['Payment Method'] || '–'}</span></p>
                                                        <p className="text-sm"><span className="text-muted-foreground">Term: </span><span className="font-medium">{selectedRV['Payment Term'] || '–'}</span></p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Customer</label>
                                                    <p className="mt-1 font-bold text-foreground text-lg leading-tight">{selectedRV['Company Name']}</p>
                                                    <p className="text-sm text-muted-foreground">{selectedRV['Company Address']}</p>
                                                    {selectedRV['Tin No'] && <p className="text-xs text-muted-foreground mt-1">TIN: {selectedRV['Tin No']}</p>}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Contact</label>
                                                    <div className="mt-1 space-y-1">
                                                        <p className="text-sm font-semibold text-foreground/80">{selectedRV['Contact Name']}</p>
                                                        <p className="text-sm text-muted-foreground">{selectedRV['Phone Number']}</p>
                                                        <p className="text-sm text-muted-foreground">{selectedRV['Email']}</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Status</label>
                                                    <div className="mt-2"><StatusBadge status={selectedRV['Status']} /></div>
                                                </div>
                                            </div>
                                        </div>
                                        {selectedRV['Remark'] && (
                                            <div className="px-6 pb-6">
                                                <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Remark</label>
                                                <p className="mt-1 text-sm text-foreground/80">{selectedRV['Remark']}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30">
                                    <ReceiptIcon size={48} className="mb-4 opacity-20" />
                                    <p className="text-lg">Select a receipt to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <StatusFilterBar
                options={['Draft', 'Issued', 'Cancelled']}
                active={statusFilter}
                onChange={setStatusFilter}
                summary={`${filteredData.length} records`}
            />

        </div>
    );
};

export default ReceiptDashboard;
