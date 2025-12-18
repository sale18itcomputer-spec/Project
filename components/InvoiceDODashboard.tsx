
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice } from '../types';
import { useData } from '../contexts/DataContext';
import DataTable, { ColumnDef } from './DataTable';
import { parseDate, formatDateAsMDY, formatDisplayDate } from '../utils/time';
import { useNavigation } from '../contexts/NavigationContext';
import MetricCard from './MetricCard';
import { parseSheetValue, formatCurrencySmartly, determineCurrency } from '../utils/formatters';
import { FileText, DollarSign, CheckCircle, Table, Columns, Info, Pencil, ArrowRightToLine, WrapText, Scissors, LayoutGrid, Search, Trash2 } from 'lucide-react';
import { DataTableColumnToggle } from './DataTableColumnToggle';
import ViewToggle from './ViewToggle';
import KanbanView, { KanbanColumn } from './KanbanView';
import Spinner from './Spinner';
import EmptyState from './EmptyState';
import InvoiceCreator from './InvoiceCreator';
import { useWindowSize } from '../hooks/useWindowSize';
import { deleteRecord } from '../services/api';
import ConfirmationModal from './ConfirmationModal';
import { useToast } from '../contexts/ToastContext';

interface InvoiceDODashboardProps {
    initialPayload?: any;
}

const StatusBadge: React.FC<{ status: Invoice['Status'] }> = ({ status }) => {
    const statusConfig: { [key in Invoice['Status'] | string]: { bg: string; text: string } } = {
        'Draft': { bg: 'bg-slate-100', text: 'text-slate-800' },
        'Processing': { bg: 'bg-brand-100', text: 'text-slate-800' },
        'Completed': { bg: 'bg-emerald-100', text: 'text-slate-800' },
        'Cancel': { bg: 'bg-rose-100', text: 'text-slate-800' },
    };

    const config = statusConfig[status] || { bg: 'bg-slate-100', text: 'text-slate-800' };

    return (
        <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-md ${config.bg} ${config.text}`}>
            {status}
        </span>
    );
};

const INVOICE_COLUMNS_VISIBILITY_KEY = 'limperial-invoice-columns-visibility';
type ViewMode = 'table' | 'board' | 'detail';

const InvoiceDODashboard: React.FC<InvoiceDODashboardProps> = ({ initialPayload }) => {
    const { invoices = [], setInvoices, loading, error } = useData();
    const { addToast } = useToast();
    const [isCreating, setIsCreating] = useState(!!initialPayload);
    const [selectedInvoiceToEdit, setSelectedInvoiceToEdit] = useState<Invoice | null>(null);
    const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
    const [initialData, setInitialData] = useState<any>(initialPayload);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('overflow');
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const { handleNavigation } = useNavigation();
    const { width } = useWindowSize();
    const isMobile = width < 768;

    const handleNewInvoice = () => {
        setInitialData(null);
        setSelectedInvoiceToEdit(null);
        setIsCreating(true);
    };

    const handleEditInvoice = (invoice: Invoice) => {
        setSelectedInvoiceToEdit(invoice);
        setIsCreating(true);
    };

    const handleViewInvoice = (invoice: Invoice) => {
        if (isMobile) {
            handleEditInvoice(invoice);
        } else {
            setSelectedInvoiceId(invoice['Inv No.']);
            setViewMode('detail');
        }
    };

    const handleDeleteRequest = (invoice: Invoice) => {
        setInvoiceToDelete(invoice);
    };

    const handleConfirmDelete = async () => {
        if (!invoiceToDelete) return;
        const originalInvoices = invoices ? [...invoices] : [];
        const invoiceId = invoiceToDelete['Inv No.'];
        setInvoiceToDelete(null);
        setInvoices(prev => prev ? prev.filter(inv => inv['Inv No.'] !== invoiceId) : null);
        try {
            await deleteRecord('Invoices', invoiceId);
            addToast('Invoice deleted!', 'success');
        } catch (err: any) {
            addToast('Failed to delete invoice.', 'error');
            setInvoices(originalInvoices);
        }
    };

    const handleBackToDashboard = () => {
        setIsCreating(false);
        setSelectedInvoiceToEdit(null);
        setInitialData(null);
        if (initialPayload) {
            handleNavigation({ view: 'invoice-do' }); // Clear payload
        }
    };

    const filteredData = useMemo(() => {
        let dataToFilter = invoices || [];
        if (statusFilter) {
            dataToFilter = dataToFilter.filter(item => {
                if (statusFilter === 'Processing') return item.Status === 'Processing';
                if (statusFilter === 'Completed') return item.Status === 'Completed';
                return true;
            });
        }
        if (!searchQuery) return dataToFilter;
        return dataToFilter.filter(item =>
            ['Inv No.', 'Company Name', 'Contact Name', 'Status', 'Taxable', 'Created By', 'SO No.'].some(key =>
                String(item[key as keyof Invoice] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    }, [invoices, searchQuery, statusFilter]);

    const allColumns = useMemo<ColumnDef<Invoice>[]>(() => [
        {
            accessorKey: 'Inv No.',
            header: 'Inv No.',
            isSortable: true,
            cell: (value: string) => (
                <div className="font-semibold text-slate-800">{value}</div>
            )
        },
        {
            accessorKey: 'Inv Date',
            header: 'Inv Date',
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
            accessorKey: 'Amount',
            header: 'Amount',
            isSortable: true,
            cell: (value: string, row: Invoice) => (
                <span className="text-sm font-medium text-slate-800 text-right block w-full">
                    {formatCurrencySmartly(value, row.Currency)}
                </span>
            )
        },
        {
            accessorKey: 'Taxable',
            header: 'Taxable',
            isSortable: true,
            cell: (value: string | undefined) => {
                if (!value) return <span className="text-slate-400">-</span>;
                const display = value === 'Yes' ? 'VAT' : value === 'No' ? 'NON-VAT' : value;
                return <span className="font-medium text-slate-600">{display}</span>;
            }
        },
        {
            accessorKey: 'Created By',
            header: 'Created By',
            isSortable: true,
        },
        {
            accessorKey: 'Status',
            header: 'Status',
            isSortable: true,
            cell: (value: Invoice['Status']) => <StatusBadge status={value} />
        }
    ], [invoices]);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(INVOICE_COLUMNS_VISIBILITY_KEY);
            if (saved) return new Set(JSON.parse(saved));
        } catch (e) { }
        return new Set(allColumns.map(c => c.accessorKey || (c as any).id).filter(Boolean));
    });

    const handleColumnToggle = (columnKey: string) => {
        setVisibleColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(columnKey)) {
                if (newSet.size > 1) newSet.delete(columnKey);
            } else {
                newSet.add(columnKey);
            }
            localStorage.setItem(INVOICE_COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(newSet)));
            return newSet;
        });
    };

    const displayedColumns = useMemo(() => {
        return allColumns.filter(c => (c.accessorKey && visibleColumns.has(c.accessorKey as string)) || ((c as any).id && visibleColumns.has((c as any).id)));
    }, [allColumns, visibleColumns]);

    const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
        { id: 'table', label: 'Table', icon: <Table /> },
        { id: 'board', label: 'Board', icon: <LayoutGrid /> },
        { id: 'detail', label: 'Detail', icon: <Columns /> },
    ];

    const kanbanColumns = useMemo<KanbanColumn<Invoice>[]>(() => {
        const statuses: Invoice['Status'][] = ['Draft', 'Processing', 'Completed', 'Cancel'];
        const statusColors: { [key in Invoice['Status']]: 'sky' | 'amber' | 'emerald' | 'rose' } = {
            'Draft': 'sky', 'Processing': 'amber', 'Completed': 'emerald', 'Cancel': 'rose',
        };
        return statuses.map(status => ({
            id: status, title: status, color: statusColors[status],
            items: filteredData.filter(inv => inv.Status === status),
        }));
    }, [filteredData]);

    const renderKanbanCard = (item: Invoice) => (
        <>
            <h4 className="font-bold text-slate-900 text-base">{item['Company Name']}</h4>
            <p className="text-sm text-slate-500 font-mono">{item['Inv No.']}</p>
            <p className="text-lg font-semibold text-brand-800 mt-2">{formatCurrencySmartly(item.Amount, item.Currency)}</p>
            <p className="text-sm text-slate-600 mt-2">By {item['Created By']}</p>
        </>
    );

    if (error) {
        return (
            <div className="p-6 md:p-8">
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
                    <p className="font-bold">Error</p>
                    <p>Could not load invoices & DO data: {error}</p>
                </div>
            </div>
        );
    }

    if (isCreating) {
        return (
            <InvoiceCreator
                onBack={handleBackToDashboard}
                existingInvoice={selectedInvoiceToEdit}
                initialData={initialData}
            />
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-slate-900">INVOICE & DO Record</h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <input
                            type="text" placeholder="Search invoices..."
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-300 text-slate-700 placeholder-slate-400 text-sm rounded-md pl-10 pr-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition shadow-sm"
                        />
                        <Search className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                    </div>
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                        {VIEW_OPTIONS.map(view => (
                            <button
                                key={view.id} onClick={() => setViewMode(view.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === view.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {view.icon} <span className="hidden lg:inline">{view.label}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center bg-white border border-slate-200 rounded-md shadow-sm">
                        <button onClick={() => setCellWrapStyle('overflow')} className={`p-2 rounded-l-md ${cellWrapStyle === 'overflow' ? 'text-brand-600 bg-brand-50' : 'text-slate-500'}`}><ArrowRightToLine size={16} /></button>
                        <button onClick={() => setCellWrapStyle('wrap')} className={`p-2 border-x ${cellWrapStyle === 'wrap' ? 'text-brand-600 bg-brand-50' : 'text-slate-500'}`}><WrapText size={16} /></button>
                        <button onClick={() => setCellWrapStyle('clip')} className={`p-2 rounded-r-md ${cellWrapStyle === 'clip' ? 'text-brand-600 bg-brand-50' : 'text-slate-500'}`}><Scissors size={16} /></button>
                    </div>
                    <DataTableColumnToggle
                        allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle}
                        trigger={
                            <button className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-md hover:bg-slate-50 transition shadow-sm text-sm">
                                <LayoutGrid className="w-4 h-4" /> View
                            </button>
                        }
                    />
                    <button
                        onClick={handleNewInvoice}
                        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-md transition shadow-md whitespace-nowrap text-sm"
                    >
                        <span className="text-xl leading-none">+</span> New Invoice
                    </button>
                </div>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-50">
                {loading ? <Spinner /> : viewMode === 'table' ? (
                    <DataTable
                        tableId="invoice-table" data={filteredData} columns={displayedColumns} loading={loading}
                        onRowClick={handleViewInvoice} initialSort={{ key: 'Inv Date', direction: 'descending' }}
                        mobilePrimaryColumns={['Inv No.', 'Company Name', 'Amount', 'Status']}
                        cellWrapStyle={cellWrapStyle}
                        renderRowActions={(row) => (
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewInvoice(row);
                                    }}
                                    className="p-2.5 text-slate-400 hover:text-brand-600 transition hover:bg-brand-50 rounded-full"
                                    title="View"
                                >
                                    <Info size={16} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditInvoice(row);
                                    }}
                                    className="p-2.5 text-slate-400 hover:text-brand-600 transition hover:bg-brand-50 rounded-full"
                                    title="Edit"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRequest(row);
                                    }}
                                    className="p-2.5 text-slate-400 hover:text-rose-600 transition hover:bg-rose-50 rounded-full"
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                    />
                ) : viewMode === 'board' ? (
                    <KanbanView<Invoice>
                        columns={kanbanColumns} onCardClick={handleEditInvoice} renderCardContent={renderKanbanCard}
                        loading={loading} getItemId={(item) => item['Inv No.']}
                    />
                ) : (
                    <div className="h-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">
                        {/* Summary List */}
                        <div className="w-full md:w-80 flex-shrink-0 bg-white overflow-y-auto">
                            {filteredData.map(inv => (
                                <button
                                    key={inv['Inv No.']}
                                    onClick={() => setSelectedInvoiceId(inv['Inv No.'])}
                                    className={`w-full text-left p-4 border-b hover:bg-slate-50 transition-colors ${selectedInvoiceId === inv['Inv No.'] ? 'bg-brand-50 border-r-4 border-r-brand-600' : 'border-slate-100'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-slate-900">{inv['Inv No.']}</span>
                                        <StatusBadge status={inv.Status} />
                                    </div>
                                    <div className="text-sm font-medium text-slate-700 truncate">{inv['Company Name']}</div>
                                    <div className="text-xs text-slate-500 mt-1">{inv['Inv Date']}</div>
                                    <div className="text-sm font-bold text-brand-700 mt-2">{formatCurrencySmartly(inv.Amount, inv.Currency)}</div>
                                </button>
                            ))}
                            {filteredData.length === 0 && <div className="p-8 text-center text-slate-400">No invoices found</div>}
                        </div>

                        {/* Detail Content */}
                        <div className="flex-1 bg-slate-50 overflow-y-auto p-4 md:p-8">
                            {selectedInvoiceId ? (
                                (() => {
                                    const selectedInv = invoices.find(i => i['Inv No.'] === selectedInvoiceId);
                                    if (!selectedInv) return null;
                                    return (
                                        <div className="max-w-4xl mx-auto space-y-6">
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                                    <h2 className="text-lg font-bold text-slate-800">Invoice Details</h2>
                                                    <div className="flex items-center gap-4">
                                                        <button
                                                            onClick={() => handleEditInvoice(selectedInv)}
                                                            className="flex items-center gap-2 text-brand-600 font-semibold hover:underline"
                                                        >
                                                            <Pencil size={16} /> Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRequest(selectedInv)}
                                                            className="flex items-center gap-2 text-rose-600 font-semibold hover:underline"
                                                        >
                                                            <Trash2 size={16} /> Delete
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Invoice Info</label>
                                                            <div className="mt-1 grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <p className="text-xs text-slate-500">Invoice No.</p>
                                                                    <p className="font-bold text-slate-900">{selectedInv['Inv No.']}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-slate-500">Date</p>
                                                                    <p className="font-semibold text-slate-800">{selectedInv['Inv Date']}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-slate-500">SO Ref</p>
                                                                    <p className="font-medium text-slate-800">{selectedInv['SO No.'] || 'N/A'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-slate-500">Taxable</p>
                                                                    <p className="font-medium text-slate-800">
                                                                        {selectedInv['Taxable'] === 'Yes' ? 'VAT' : selectedInv['Taxable'] === 'No' ? 'NON-VAT' : selectedInv['Taxable'] || 'N/A'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Financials</label>
                                                            <div className="mt-1">
                                                                <p className="text-xs text-slate-500">Total Amount</p>
                                                                <p className="text-2xl font-bold text-brand-700">{formatCurrencySmartly(selectedInv.Amount, selectedInv.Currency)}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer</label>
                                                            <p className="mt-1 font-bold text-slate-900 text-lg leading-tight">{selectedInv['Company Name']}</p>
                                                            <p className="text-sm text-slate-600 mt-1">{selectedInv['Company Address']}</p>
                                                            {selectedInv['Tin No.'] && <p className="text-xs text-slate-500 mt-1">TIN: {selectedInv['Tin No.']}</p>}
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact</label>
                                                            <div className="mt-1 space-y-1">
                                                                <p className="text-sm font-semibold text-slate-800">{selectedInv['Contact Name']}</p>
                                                                <p className="text-sm text-slate-600">{selectedInv['Phone Number']}</p>
                                                                <p className="text-sm text-slate-600">{selectedInv['Email']}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {selectedInv['Attachment'] && (
                                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                        <FileText size={18} className="text-brand-600" />
                                                        Attachment
                                                    </h3>
                                                    <a
                                                        href={selectedInv['Attachment']}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors font-semibold"
                                                    >
                                                        View Document
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <FileText size={48} className="mb-4 opacity-20" />
                                    <p className="text-lg">Select an invoice to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <footer className="flex-shrink-0 bg-white border-t border-slate-200 p-3 flex items-center gap-3">

                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                    <button onClick={() => setStatusFilter(statusFilter === 'Processing' ? null : 'Processing')} className={`px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Processing' ? 'bg-brand-600 text-white' : 'border-slate-300'}`}>Processing</button>
                    <button onClick={() => setStatusFilter(statusFilter === 'Completed' ? null : 'Completed')} className={`px-6 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === 'Completed' ? 'bg-brand-600 text-white' : 'border-slate-300'}`}>Completed</button>
                </div>
            </footer>
            <ConfirmationModal
                isOpen={!!invoiceToDelete}
                onClose={() => setInvoiceToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Invoice"
                confirmText="Delete"
                variant="danger"
            >
                Are you sure you want to delete invoice {invoiceToDelete?.['Inv No.']}? This action cannot be undone.
            </ConfirmationModal>
        </div>
    );
};

export default InvoiceDODashboard;
