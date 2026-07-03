'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Invoice } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { Receipt as ReceiptIcon, Search, Wallet } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import InvoiceWindowContent from '../../windows/content/InvoiceWindowContent';
import QuickPaymentModal from '../../modals/QuickPaymentModal';
import { computeInvoiceAR, InvoiceAR } from '../../../utils/collection';
import { formatCurrencySmartly } from '../../../utils/formatters';
import { PermissionGate } from '../../common/PermissionGate';

const SERVICE_REMARK_PREFIX = 'Service Ticket: ';

const STATUS_STYLES: Record<string, string> = {
    'Draft':      'bg-sky-500/10 text-sky-500',
    'Processing': 'bg-amber-500/10 text-amber-500',
    'Completed':  'bg-emerald-500/10 text-emerald-500',
    'Cancel':     'bg-rose-500/10 text-rose-500',
};

const StatusBadge: React.FC<{ value: string }> = ({ value }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[value] ?? 'bg-muted text-muted-foreground'}`}>
        {value}
    </span>
);

const ServiceInvoiceDashboard: React.FC = () => {
    const { invoices, receipts, loading } = useData();
    const { can } = usePermissions();
    const { openWindow } = useWindowManager();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [paymentTarget, setPaymentTarget] = useState<InvoiceAR | null>(null);

    const serviceInvoices = useMemo(
        () => (invoices ?? []).filter(inv => inv['Remark']?.startsWith(SERVICE_REMARK_PREFIX)),
        [invoices]
    );

    const filteredData = useMemo(() => {
        let data = serviceInvoices;
        if (statusFilter !== 'All') data = data.filter(inv => inv.Status === statusFilter);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(inv =>
                inv['Inv No']?.toLowerCase().includes(q) ||
                inv['Company Name']?.toLowerCase().includes(q) ||
                inv['Remark']?.toLowerCase().includes(q) ||
                inv['Contact Name']?.toLowerCase().includes(q)
            );
        }
        return data;
    }, [serviceInvoices, statusFilter, searchQuery]);

    const openInvoiceWindow = useCallback((invNo: string) => {
        const id = `invoice-${invNo}`;
        openWindow({
            id,
            title: `Invoice: ${invNo}`,
            content: <InvoiceWindowContent windowId={id} invNo={invNo} />,
            noPadding: true,
            initialWidth: 1200,
            initialHeight: 820,
            minWidth: 900,
            minHeight: 600,
        });
    }, [openWindow]);

    const handleRecordPayment = useCallback((inv: Invoice) => {
        setPaymentTarget(computeInvoiceAR(inv, receipts));
    }, [receipts]);

    const columns = useMemo<ColumnDef<Invoice>[]>(() => [
        {
            accessorKey: 'Inv No',
            header: 'Inv No',
            isSortable: true,
            cell: (v: any) => <span className="font-semibold text-muted-foreground/80">{v}</span>,
        },
        {
            accessorKey: 'Inv Date',
            header: 'Date',
            isSortable: true,
            cell: (v: any) => formatDisplayDate(v),
        },
        {
            accessorKey: 'Remark',
            header: 'Ticket No',
            isSortable: true,
            cell: (v: any) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {v?.replace(SERVICE_REMARK_PREFIX, '') || '—'}
                </span>
            ),
        },
        { accessorKey: 'Company Name', header: 'Company', isSortable: true },
        { accessorKey: 'Contact Name', header: 'Contact', isSortable: true },
        {
            accessorKey: 'Amount',
            header: 'Amount',
            isSortable: true,
            cell: (v: any, row: Invoice) => formatCurrencySmartly(Number(v) || 0, row['Currency'] ?? 'USD'),
        },
        { accessorKey: 'Currency', header: 'CCY', isSortable: true },
        {
            accessorKey: 'Status',
            header: 'Status',
            isSortable: true,
            cell: (v: any) => <StatusBadge value={v} />,
        },
    ], []);

    const STATUS_FILTERS = ['All', 'Processing', 'Completed', 'Cancel'];

    return (
        <div className="h-full flex flex-col">
            <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4 flex flex-col gap-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <ReceiptIcon className="text-brand-500" size={20} />
                            Service Invoices
                        </h2>
                        <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {filteredData.length} invoices
                        </span>
                    </div>
                    <div className="relative w-full lg:w-64">
                        <input
                            type="text"
                            placeholder="Search invoices..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-muted border-transparent text-sm rounded-lg focus:ring-2 focus:ring-brand-500 block w-full pl-10 p-2.5 transition"
                        />
                        <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                    </div>
                </div>

                <div className="flex gap-1 flex-wrap">
                    {STATUS_FILTERS.map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-md border text-sm font-semibold transition ${
                                statusFilter === s
                                    ? 'bg-brand-600 text-white border-brand-600'
                                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 overflow-hidden p-4">
                <DataTable
                    tableId="service-invoice-table"
                    data={filteredData}
                    columns={columns}
                    loading={loading}
                    onRowClick={inv => openInvoiceWindow(inv['Inv No'])}
                    initialSort={{ key: 'Inv Date', direction: 'descending' }}
                    mobilePrimaryColumns={['Inv No', 'Company Name', 'Status', 'Amount']}
                    renderRowActions={row => (
                        <PermissionGate module="invoices" action="edit">
                            <button
                                onClick={e => { e.stopPropagation(); handleRecordPayment(row); }}
                                className="p-2 text-muted-foreground hover:text-emerald-500 transition hover:bg-emerald-500/10 rounded-full"
                                title="Record Payment"
                            >
                                <Wallet size={15} />
                            </button>
                        </PermissionGate>
                    )}
                />
            </div>

            {paymentTarget && (
                <QuickPaymentModal ar={paymentTarget} onClose={() => setPaymentTarget(null)} />
            )}
        </div>
    );
};

export default ServiceInvoiceDashboard;
