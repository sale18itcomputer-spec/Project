'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Receipt } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { useNavigation } from '../../../contexts/NavigationContext';
import { formatCurrencySmartly } from '../../../utils/formatters';
import { Receipt as ReceiptIcon, Table, Columns, Info, Pencil, LayoutGrid, Search, Trash2, WrapText, ArrowRightToLine, Scissors, Plus } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import KanbanView, { KanbanColumn } from '../views/KanbanView';
import Spinner from '../../common/Spinner';
import ReceiptCreator from '../../features/sales/ReceiptCreator';
import { useWindowSize } from '../../../hooks/useWindowSize';
import { deleteRecord } from '../../../services/api';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { useToast } from '../../../contexts/ToastContext';
import { localStorageGet, localStorageSet } from '../../../utils/storage';

const RV_COLUMNS_KEY = 'limperial-rv-columns-visibility';
type ViewMode = 'table' | 'board' | 'detail';

const StatusBadge: React.FC<{ status: Receipt['Status'] }> = ({ status }) => {
    const cfg: Record<string, { bg: string; text: string }> = {
        'Draft':     { bg: 'bg-sky-500/10',     text: 'text-sky-500' },
        'Issued':    { bg: 'bg-emerald-500/10',  text: 'text-emerald-500' },
        'Cancelled': { bg: 'bg-rose-500/10',     text: 'text-rose-500' },
    };
    const { bg, text } = cfg[status] ?? { bg: 'bg-muted', text: 'text-muted-foreground' };
    return (
        <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-md ${bg} ${text}`}>
            {status}
        </span>
    );
};

interface Props { initialPayload?: any; }

const ReceiptDashboard: React.FC<Props> = ({ initialPayload }) => {
    const { receipts = [], setReceipts, loading, error } = useData();
    const { addToast } = useToast();
    const [toDelete, setToDelete] = useState<Receipt | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [cellWrapStyle, setCellWrapStyle] = useState<'overflow' | 'wrap' | 'clip'>('wrap');
    const { handleNavigation, navigation } = useNavigation();
    const { width } = useWindowSize();
    const isMobile = width < 768;

    const isCreating = navigation.action === 'create' || navigation.action === 'edit'
        || (!!initialPayload && !navigation.action);

    const selectedId = useMemo(() => {
        if (navigation.action === 'view') return navigation.id || null;
        return null;
    }, [navigation.action, navigation.id]);

    const selectedToEdit = useMemo(() => {
        if (navigation.action === 'edit' && navigation.id && receipts) {
            return receipts.find(r => r['RV No'] === navigation.id) || null;
        }
        return null;
    }, [navigation.action, navigation.id, receipts]);

    useEffect(() => {
        if (navigation.action === 'view') setViewMode('detail');
    }, [navigation.action]);

    const handleNew = () => handleNavigation({ view: 'receipts', action: 'create' });
    const handleEdit = (row: Receipt) => handleNavigation({ view: 'receipts', action: 'edit', id: row['RV No'] });
    const handleView = (row: Receipt) => {
        if (isMobile) { handleEdit(row); return; }
        handleNavigation({ view: 'receipts', action: 'view', id: row['RV No'] });
    };
    const handleBack = () => handleNavigation({ view: 'receipts' });

    const handleConfirmDelete = async () => {
        if (!toDelete) return;
        const id = toDelete['RV No'];
        setToDelete(null);
        const original = receipts ? [...receipts] : [];
        setReceipts(prev => prev ? prev.filter(r => r['RV No'] !== id) : null);
        try {
            await deleteRecord('Receipts', id);
            addToast('Receipt deleted!', 'success');
        } catch {
            addToast('Failed to delete receipt.', 'error');
            setReceipts(original);
        }
    };

    const filteredData = useMemo(() => {
        let data = receipts || [];
        if (statusFilter) data = data.filter(r => r['Status'] === statusFilter);
        if (!searchQuery) return data;
        const q = searchQuery.toLowerCase();
        return data.filter(r =>
            ['RV No', 'Inv No', 'SO No', 'DO No', 'Company Name', 'Contact Name', 'Status', 'Payment Method', 'Created By'].some(
                k => String(r[k] ?? '').toLowerCase().includes(q)
            )
        );
    }, [receipts, searchQuery, statusFilter]);

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

    const kanbanColumns = useMemo<KanbanColumn<Receipt>[]>(() => {
        const statuses: Receipt['Status'][] = ['Draft', 'Issued', 'Cancelled'];
        const colors: Record<string, 'sky' | 'emerald' | 'rose'> = {
            Draft: 'sky', Issued: 'emerald', Cancelled: 'rose',
        };
        return statuses.map(s => ({
            id: s, title: s, color: colors[s],
            items: filteredData.filter(r => r['Status'] === s),
        }));
    }, [filteredData]);

    const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
        { id: 'table', label: 'Table', icon: <Table /> },
        { id: 'board', label: 'Board', icon: <LayoutGrid /> },
        { id: 'detail', label: 'Detail', icon: <Columns /> },
    ];

    if (error) return (
        <div className="p-8">
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg">
                <p className="font-bold">Error</p><p>Could not load receipts: {error}</p>
            </div>
        </div>
    );

    if (isCreating) return (
        <ReceiptCreator
            onBack={handleBack}
            existingReceipt={selectedToEdit}
            initialData={initialPayload}
        />
    );

    const selectedRV = selectedId ? (receipts || []).find(r => r['RV No'] === selectedId) : null;

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <ReceiptIcon className="w-5 h-5 text-brand-500" />
                    <h1 className="text-xl font-bold text-foreground">Receipts (RV)</h1>
                </div>
                <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
                    <div className="relative w-full lg:w-64">
                        <input
                            type="text" placeholder="Search receipts..."
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-muted border border-border text-foreground placeholder-muted-foreground/40 text-sm rounded-md pl-10 pr-4 py-2 focus:ring-2 focus:ring-brand-500 transition shadow-sm"
                        />
                        <Search className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border flex-shrink-0">
                            {VIEW_OPTIONS.map(v => (
                                <button key={v.id} onClick={() => setViewMode(v.id)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === v.id ? 'bg-background text-brand-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {v.icon}<span className="hidden xl:inline">{v.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center bg-card border border-border rounded-md shadow-sm flex-shrink-0">
                            <button onClick={() => setCellWrapStyle('overflow')} className={`p-2 rounded-l-md ${cellWrapStyle === 'overflow' ? 'text-brand-500 bg-brand-500/10' : 'text-muted-foreground'}`}><ArrowRightToLine size={16} /></button>
                            <button onClick={() => setCellWrapStyle('wrap')} className={`p-2 border-x border-border ${cellWrapStyle === 'wrap' ? 'text-brand-500 bg-brand-500/10' : 'text-muted-foreground'}`}><WrapText size={16} /></button>
                            <button onClick={() => setCellWrapStyle('clip')} className={`p-2 rounded-r-md ${cellWrapStyle === 'clip' ? 'text-brand-500 bg-brand-500/10' : 'text-muted-foreground'}`}><Scissors size={16} /></button>
                        </div>
                        <DataTableColumnToggle
                            allColumns={allColumns} visibleColumns={visibleColumns} onColumnToggle={handleColumnToggle}
                            trigger={
                                <button className="flex items-center gap-2 bg-card border border-border text-foreground font-semibold py-2 px-4 rounded-md hover:bg-muted transition shadow-sm text-sm flex-shrink-0">
                                    <LayoutGrid className="w-4 h-4" /> View
                                </button>
                            }
                        />
                        <button onClick={handleNew}
                            className="flex-shrink-0 flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-md transition shadow-md whitespace-nowrap text-sm ml-auto lg:ml-0">
                            <Plus size={16} /> New Receipt
                        </button>
                    </div>
                </div>
            </header>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-hidden bg-background p-4">
                {loading ? <Spinner /> : viewMode === 'table' ? (
                    <DataTable
                        tableId="rv-table" data={filteredData} columns={displayedColumns}
                        loading={loading} onRowClick={handleView}
                        initialSort={{ key: 'RV Date', direction: 'descending' }}
                        mobilePrimaryColumns={['RV No', 'Company Name', 'Amount', 'Status']}
                        cellWrapStyle={cellWrapStyle}
                        renderRowActions={row => (
                            <div className="flex items-center justify-center gap-3">
                                <button onClick={e => { e.stopPropagation(); handleView(row); }} className="p-2.5 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full" title="View"><Info size={16} /></button>
                                <button onClick={e => { e.stopPropagation(); handleEdit(row); }} className="p-2.5 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-full" title="Edit"><Pencil size={16} /></button>
                                <button onClick={e => { e.stopPropagation(); setToDelete(row); }} className="p-2.5 text-muted-foreground hover:text-rose-500 transition hover:bg-rose-500/10 rounded-full" title="Delete"><Trash2 size={16} /></button>
                            </div>
                        )}
                    />
                ) : viewMode === 'board' ? (
                    <KanbanView<Receipt>
                        columns={kanbanColumns} onCardClick={handleEdit}
                        renderCardContent={item => (
                            <>
                                <h4 className="font-bold text-foreground">{item['Company Name']}</h4>
                                <p className="text-sm text-muted-foreground font-mono">{item['RV No']}</p>
                                <p className="text-lg font-semibold text-brand-500 mt-2">
                                    {formatCurrencySmartly(String(item['Amount'] ?? ''), item['Currency'])}
                                </p>
                                {item['Payment Method'] && <p className="text-xs text-muted-foreground mt-1">{item['Payment Method']}</p>}
                            </>
                        )}
                        loading={loading} getItemId={item => item['RV No']}
                    />
                ) : (
                    <div className="h-full flex divide-x divide-border">
                        {/* List */}
                        <div className="w-80 flex-shrink-0 bg-card overflow-y-auto">
                            {filteredData.map(r => (
                                <button key={r['RV No']}
                                    onClick={() => handleNavigation({ view: 'receipts', action: 'view', id: r['RV No'] })}
                                    className={`w-full text-left p-4 border-b hover:bg-muted transition-colors ${selectedId === r['RV No'] ? 'bg-brand-500/10 border-r-4 border-r-brand-500' : 'border-border'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-foreground">{r['RV No']}</span>
                                        <StatusBadge status={r['Status']} />
                                    </div>
                                    <div className="text-sm font-medium text-foreground/80 truncate">{r['Company Name']}</div>
                                    <div className="text-sm font-bold text-brand-500 mt-2">
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
                                            <div className="flex gap-4">
                                                <button onClick={() => handleEdit(selectedRV)} className="flex items-center gap-2 text-brand-500 font-semibold hover:underline"><Pencil size={16} /> Edit</button>
                                                <button onClick={() => setToDelete(selectedRV)} className="flex items-center gap-2 text-rose-500 font-semibold hover:underline"><Trash2 size={16} /> Delete</button>
                                            </div>
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
                                                            <p className="text-2xl font-bold text-brand-500">
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
            <footer className="flex-shrink-0 bg-card border-t border-border p-3 flex items-center gap-3">
                {(['Draft', 'Issued', 'Cancelled'] as const).map(s => (
                    <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                        className={`px-5 py-2 rounded-md border text-sm font-semibold transition ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-border text-muted-foreground bg-muted hover:bg-muted/80'}`}>
                        {s}
                    </button>
                ))}
                <span className="ml-auto text-xs text-muted-foreground">{filteredData.length} records</span>
            </footer>

            <ConfirmationModal
                isOpen={!!toDelete} onClose={() => setToDelete(null)} onConfirm={handleConfirmDelete}
                title="Delete Receipt" confirmText="Delete" variant="danger">
                Are you sure you want to delete {toDelete?.['RV No']}? This action cannot be undone.
            </ConfirmationModal>
        </div>
    );
};

export default ReceiptDashboard;
