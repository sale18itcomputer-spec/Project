
import React, { useState, useMemo, useEffect } from 'react';
import { SaleOrder, Quotation } from '../types';
import { useData } from '../contexts/DataContext';
import DataTable, { ColumnDef } from './DataTable';
import { parseDate, formatDateAsMDY, formatDisplayDate } from '../utils/time';
import SaleOrderCreator from './SaleOrderCreator';
import { useNavigation } from '../contexts/NavigationContext';
import { SALE_ORDER_SHEET_ID } from '../constants';
import MetricCard from './MetricCard';
import { parseSheetValue, formatCurrencySmartly, determineCurrency } from '../utils/formatters';
import { ShoppingCart, DollarSign, CheckCircle, Table, Columns, Info, Pencil, ArrowRightToLine, WrapText, Scissors, LayoutGrid, Search, Trash2, FileText } from 'lucide-react';
import { DataTableColumnToggle } from './DataTableColumnToggle';
import ViewToggle from './ViewToggle';
import KanbanView, { KanbanColumn } from './KanbanView';
import SaleOrderListContainer from './SaleOrderListContainer';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import { useToast } from '../contexts/ToastContext';
import { deleteRecord } from '../services/api';
import ConfirmationModal from './ConfirmationModal';

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

type ViewMode = 'table' | 'board' | 'detail';

const SaleOrderDashboard: React.FC<SaleOrderDashboardProps> = ({ initialPayload }) => {
    const { saleOrders, setSaleOrders, loading, error } = useData();
    const { addToast } = useToast();
    const [isCreating, setIsCreating] = useState(!!initialPayload);
    const [selectedSaleOrderToEdit, setSelectedSaleOrderToEdit] = useState<SaleOrder | null>(null);
    const [saleOrderToDelete, setSaleOrderToDelete] = useState<SaleOrder | null>(null);
    const [initialData, setInitialData] = useState<Partial<SaleOrder> | undefined>(() => {
        if (!initialPayload) return undefined;

        // Case 1: From Quotation
        if (initialPayload['Quote No.'] && !initialPayload.isPipeline) {
            const quotation = initialPayload as Quotation;
            return {
                'Quote No.': quotation['Quote No.'],
                'Company Name': quotation['Company Name'],
                'Contact Name': quotation['Contact Name'],
                'Phone Number': quotation['Contact Number'],
                'Email': quotation['Contact Email'],
                'Total Amount': quotation.Amount,
                'Payment Term': quotation['Payment Term'],
                'Status': 'Pending',
                'Currency': quotation.Currency,
                'Bill Invoice': quotation['Tax Type'] === 'NON-VAT' ? 'NON-VAT' : 'VAT',
                'ItemsJSON': quotation.ItemsJSON,
            };
        }

        // Case 2: From Pipeline
        if (initialPayload.isPipeline) {
            return {
                'Quote No.': initialPayload['Quote No.'] || '',
                'Company Name': initialPayload['Company Name'] || '',
                'Contact Name': initialPayload['Contact Name'] || '',
                'Status': 'Pending',
                'Currency': 'USD',
                'Bill Invoice': 'VAT',
            };
        }

        return undefined;
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>('Pending');
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('overflow');
    const [selectedSaleOrderId, setSelectedSaleOrderId] = useState<string | null>(null);
    const { handleNavigation } = useNavigation();

    const handleNewSaleOrder = () => {
        setSelectedSaleOrderToEdit(null);
        setIsCreating(true);
    };

    const handleEditSaleOrder = (saleOrder: SaleOrder) => {
        setSelectedSaleOrderToEdit(saleOrder);
        setIsCreating(true);
    };

    const handleViewSaleOrder = (saleOrder: SaleOrder) => {
        setViewMode('detail');
        setSelectedSaleOrderId(saleOrder['SO No.']);
    };

    const handleDeleteRequest = (saleOrder: SaleOrder) => {
        setSaleOrderToDelete(saleOrder);
    };

    const handleConfirmDelete = async () => {
        if (!saleOrderToDelete) return;
        const originalOrders = saleOrders ? [...saleOrders] : [];
        const orderId = saleOrderToDelete['SO No.'];
        setSaleOrderToDelete(null);
        setSaleOrders(prev => prev ? prev.filter(so => so['SO No.'] !== orderId) : null);
        try {
            await deleteRecord('Sale Orders', orderId);
            addToast('Sale Order deleted!', 'success');
        } catch (err: any) {
            addToast('Failed to delete sale order.', 'error');
            setSaleOrders(originalOrders);
        }
    };

    const handleBackToDashboard = () => {
        setIsCreating(false);
        setSelectedSaleOrderToEdit(null);
        setInitialData(undefined);
        if (initialPayload) {
            handleNavigation({ view: 'sale-orders' }); // Clear the payload
        }
    };

    const handleConvertToInvoice = (so: SaleOrder) => {
        handleNavigation({
            view: 'invoice-do',
            payload: {
                action: 'create',
                soData: so
            }
        });
    };

    const metrics = useMemo(() => {
        if (!saleOrders) return { total: 0, totalValueUSD: 0, totalValueKHR: 0, completionRate: 0 };

        const { totalValueUSD, totalValueKHR } = saleOrders.reduce((acc, so) => {
            const value = parseSheetValue(so['Total Amount']);
            const determinedCurrency = determineCurrency(value, so.Currency);
            if (determinedCurrency === 'KHR') {
                acc.totalValueKHR += value;
            } else {
                acc.totalValueUSD += value;
            }
            return acc;
        }, { totalValueUSD: 0, totalValueKHR: 0 });

        const completedCount = saleOrders.filter(so => so.Status === 'Completed').length;
        const totalConsidered = saleOrders.filter(so => ['Completed', 'Cancel'].includes(so.Status)).length;
        const completionRate = totalConsidered > 0 ? (completedCount / totalConsidered) * 100 : 0;

        return {
            total: saleOrders.length,
            totalValueUSD,
            totalValueKHR,
            completionRate,
        };
    }, [saleOrders]);

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
            ['SO No.', 'Company Name', 'Contact Name', 'Status', 'Quote No.'].some(key =>
                String(item[key as keyof SaleOrder] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    }, [saleOrders, searchQuery, statusFilter]);

    const selectedSaleOrder = useMemo(() => {
        if (!selectedSaleOrderId) return null;
        return filteredData.find(so => so['SO No.'] === selectedSaleOrderId) || null;
    }, [selectedSaleOrderId, filteredData]);

    useEffect(() => {
        if (viewMode === 'detail' && !selectedSaleOrderId && filteredData.length > 0) {
            setSelectedSaleOrderId(filteredData[0]['SO No.']);
        }
    }, [viewMode, selectedSaleOrderId, filteredData]);

    const allColumns = useMemo<ColumnDef<SaleOrder>[]>(() => [
        {
            accessorKey: 'SO No.',
            header: 'SO No.',
            isSortable: true,
            cell: (value: string, row) => (
                <div className="font-semibold text-muted-foreground/80">
                    {value}
                </div>
            )
        },
        {
            accessorKey: 'SO Date',
            header: 'SO Date',
            isSortable: true,
            cell: (value: string) => formatDateAsMDY(parseDate(value)),
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
        { accessorKey: 'Status', header: 'Status', isSortable: true, cell: (value: SaleOrder['Status']) => <StatusBadge status={value} /> },
    ], [SALE_ORDER_SHEET_ID]);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(SALE_ORDER_COLUMNS_VISIBILITY_KEY);
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
        const saved = localStorage.getItem(SALE_ORDER_COLUMNS_VISIBILITY_KEY);
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
                localStorage.setItem(SALE_ORDER_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
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
        { id: 'board', label: 'Board', icon: <LayoutGrid /> },
        { id: 'detail', label: 'Detail', icon: <Columns /> },
    ];

    const kanbanColumns = useMemo<KanbanColumn<SaleOrder>[]>(() => {
        const statuses: SaleOrder['Status'][] = ['Pending', 'Completed', 'Cancel'];
        const statusColors: { [key in SaleOrder['Status']]: 'amber' | 'emerald' | 'rose' } = {
            'Pending': 'amber',
            'Completed': 'emerald',
            'Cancel': 'rose',
        };

        return statuses.map(status => ({
            id: status,
            title: status,
            color: statusColors[status],
            items: filteredData.filter(so => so.Status === status),
        }));
    }, [filteredData]);

    const renderKanbanCard = (item: SaleOrder) => {
        const formattedValue = formatCurrencySmartly(item['Total Amount'], item.Currency);
        return (
            <>
                <h4 className="font-bold text-foreground text-base">{item['Company Name']}</h4>
                <p className="text-sm text-muted-foreground font-mono">{item['SO No.']}</p>
                <p className="text-lg font-semibold text-brand-600 dark:text-brand-400 mt-2">{formattedValue}</p>
                <p className="text-sm text-muted-foreground mt-2">By {item['Created By']}</p>
            </>
        );
    };


    if (isCreating) {
        return (
            <SaleOrderCreator
                onBack={handleBackToDashboard}
                existingSaleOrder={selectedSaleOrderToEdit}
                initialData={initialData}
            />
        );
    }

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

    const usdStr = metrics.totalValueUSD > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(metrics.totalValueUSD) : '';
    const khrStr = metrics.totalValueKHR > 0 ? `៛${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(metrics.totalValueKHR)}` : '';

    let mainValue: string;
    let subValue: string | undefined;

    if (usdStr && khrStr) {
        mainValue = usdStr;
        subValue = khrStr;
    } else if (usdStr) {
        mainValue = usdStr;
    } else if (khrStr) {
        mainValue = khrStr;
    } else {
        mainValue = '$0';
    }

    const renderDetailView = () => (
        <div className="flex flex-col md:flex-row h-full">
            <aside className="w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col">
                <SaleOrderListContainer
                    saleOrders={filteredData}
                    selectedSaleOrderId={selectedSaleOrderId}
                    onSelectSaleOrder={setSelectedSaleOrderId}
                    loading={loading && !saleOrders}
                />
            </aside>
            <main className="flex-1 p-6 sm:p-8 overflow-y-auto bg-background">
                {loading && !selectedSaleOrder ? <Spinner /> : selectedSaleOrder ? (
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-2xl font-bold text-foreground">{selectedSaleOrder['Company Name']}</h1>
                                    <p className="text-muted-foreground font-mono mt-1">{selectedSaleOrder['SO No.']}</p>
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
                                <DetailItem label="Quote Ref." value={selectedSaleOrder['Quote No.']} />
                                <DetailItem label="Payment Term" value={selectedSaleOrder['Payment Term']} />
                                <DetailItem label="Contact Person" value={selectedSaleOrder['Contact Name']} />
                                <DetailItem label="Phone Number" value={selectedSaleOrder['Phone Number']} />
                                <DetailItem label="Bill Invoice" value={selectedSaleOrder['Bill Invoice'] === 'Yes' ? 'VAT' : selectedSaleOrder['Bill Invoice'] === 'No' ? 'NON-VAT' : selectedSaleOrder['Bill Invoice']} />
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
        <div className="h-full flex flex-col bg-background">
            <header className="flex-shrink-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-foreground">Sale Order Record</h1>
                </div>

                <div className="flex items-center gap-2">
                    {/* Search Box */}
                    <div className="relative w-64">
                        <input
                            type="text"
                            placeholder="Search sale orders..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-muted border border-border text-foreground placeholder-muted-foreground text-sm rounded-md pl-10 pr-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition shadow-sm"
                        />
                        <Search className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
                        {VIEW_OPTIONS.map(view => (
                            <button
                                key={view.id}
                                onClick={() => setViewMode(view.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === view.id ? 'bg-background text-brand-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {view.icon}
                                <span className="hidden lg:inline">{view.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Alignment/Wrap Icons */}
                    <div className="flex items-center bg-card border border-border rounded-md shadow-sm">
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

                    {/* New Sale Order Button */}
                    <button
                        onClick={handleNewSaleOrder}
                        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-md transition shadow-md whitespace-nowrap text-sm"
                    >
                        <span className="text-xl leading-none">+</span> New SO
                    </button>
                </div>
            </header>

            <div className="flex-1 min-h-0 overflow-hidden bg-background p-4">
                {viewMode === 'table' ? (
                    <DataTable
                        tableId="saleorder-table"
                        data={filteredData}
                        columns={displayedColumns}
                        loading={loading}
                        onRowClick={handleViewSaleOrder}
                        initialSort={{ key: 'SO Date', direction: 'descending' }}
                        mobilePrimaryColumns={['SO No.', 'Company Name', 'Total Amount', 'Status']}
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
                                        handleDeleteRequest(row);
                                    }}
                                    className="p-2.5 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full"
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                    />
                ) : viewMode === 'board' ? (
                    <KanbanView<SaleOrder>
                        columns={kanbanColumns}
                        onCardClick={handleViewSaleOrder}
                        renderCardContent={renderKanbanCard}
                        loading={loading}
                        getItemId={(item) => item['SO No.']}
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
                Are you sure you want to delete sale order {saleOrderToDelete?.['SO No.']}? This action cannot be undone.
            </ConfirmationModal>
        </div >
    );
}

export default SaleOrderDashboard;