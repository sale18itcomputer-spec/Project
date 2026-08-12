'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Invoice, ServiceTicket } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import DataTable, { ColumnDef, CellWrapStyle } from '../../common/DataTable';
import { formatDisplayDate } from '../../../utils/time';
import { Plus, Receipt as ReceiptIcon, Wallet, Pencil, Trash2, Printer, Copy, Wrench, Send } from 'lucide-react';
import { DataTableColumnToggle } from '../../common/DataTableColumnToggle';
import { useToast } from '../../../contexts/ToastContext';
import { deleteRecord } from '../../../services/api';
import ConfirmationModal from '../../modals/ConfirmationModal';
import { localStorageGet, localStorageSet } from '../../../utils/storage';
import { PermissionGate } from '../../common/PermissionGate';
import { usePermissions } from '../../../hooks/usePermissions';
import RowActionMenuItems from '../../common/RowActionMenuItems';
import { DropdownMenuItem } from '../../ui/dropdown-menu';
import { StatusBadge } from '../../ui/status-badge';
import { useWindowManager } from '../../../contexts/WindowManagerContext';
import InvoiceWindowContent from '../../windows/content/InvoiceWindowContent';
import ServiceTicketWindowContent from '../../windows/content/ServiceTicketWindowContent';
import { generatePDF, sendPdfToTelegramChat } from '../../../lib/pdfClient';
import { useAuth } from '../../../contexts/AuthContext';
import { getUserTelegramChatId } from '../../../utils/telegram';
import QuickPaymentModal from '../../modals/QuickPaymentModal';
import { computeInvoiceAR, InvoiceAR } from '../../../utils/collection';
import { formatCurrencySmartly } from '../../../utils/formatters';

import { isServiceInvoice, SERVICE_REMARK_PREFIX } from '../../../utils/serviceInvoice';
import DashboardHeader from '../../common/DashboardHeader';
import SearchInput from '../../common/SearchInput';
import CellWrapToggle from '../../common/CellWrapToggle';
import ErrorState from '../../common/ErrorState';
import StatusFilterBar from '../../common/StatusFilterBar';
import IconButton from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const COLUMNS_VISIBILITY_KEY = 'limperial-service-invoices-columns-visibility';

const ServiceInvoiceDashboard: React.FC = () => {
    const { invoices, setInvoices, receipts, companies, serviceTickets, fetchModule, loading, error } = useData();
    const { can } = usePermissions();
    const { addToast } = useToast();
    const { openWindow } = useWindowManager();
    const { currentUser } = useAuth();

    // Tickets are needed for the "Open Ticket" jump from linked invoices.
    useEffect(() => { fetchModule('Service Tickets'); }, [fetchModule]);

    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebouncedValue(searchQuery);
    const [statusFilter, setStatusFilter] = useState<string | null>('All');
    const [cellWrapStyle, setCellWrapStyle] = useState<CellWrapStyle>('nowrap');
    const [paymentTarget, setPaymentTarget] = useState<InvoiceAR | null>(null);
    const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

    // ── Data ──────────────────────────────────────────────────────────────────

    const serviceInvoices = useMemo(
        () => (invoices ?? []).filter(isServiceInvoice),
        [invoices]
    );

    const filteredData = useMemo(() => {
        let data = serviceInvoices;
        // `null` is what StatusFilterBar writes when the active chip is cleared —
        // it means the same thing as the 'All' chip: no status filter.
        if (statusFilter === 'Overdue') {
            data = data.filter(inv => computeInvoiceAR(inv, receipts).collectionStatus === 'Overdue');
        } else if (statusFilter && statusFilter !== 'All') {
            data = data.filter(inv => inv.Status === statusFilter);
        }
        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            data = data.filter(inv =>
                inv['Inv No']?.toLowerCase().includes(q) ||
                inv['Company Name']?.toLowerCase().includes(q) ||
                inv['Remark']?.toLowerCase().includes(q) ||
                inv['Contact Name']?.toLowerCase().includes(q)
            );
        }
        return data;
    }, [serviceInvoices, statusFilter, debouncedSearch, receipts]);

    // ── Window helpers ────────────────────────────────────────────────────────

    const openInvoiceWindow = useCallback((invNo: string | null, initialData?: any) => {
        const id = invNo ? `invoice-${invNo}` : `invoice-service-new-${Date.now()}`;
        openWindow({
            id,
            title: invNo ? `Invoice: ${invNo}` : 'New Service Invoice',
            content: <InvoiceWindowContent windowId={id} invNo={invNo} initialData={initialData} />,
            noPadding: true,
            initialWidth: 1200,
            initialHeight: 820,
            minWidth: 900,
            minHeight: 600,
        });
    }, [openWindow]);

    const openNewServiceInvoice = useCallback(() => {
        openInvoiceWindow(null, { action: 'service-new' });
    }, [openInvoiceWindow]);

    // ── Delete ────────────────────────────────────────────────────────────────

    const handleDeleteRequest = useCallback((inv: Invoice) => setInvoiceToDelete(inv), []);

    const handleConfirmDelete = async () => {
        if (!invoiceToDelete) return;
        const invNo = invoiceToDelete['Inv No'];
        const snapshot = invoices ? [...invoices] : [];
        setInvoiceToDelete(null);
        setInvoices(prev => prev ? prev.filter(i => i['Inv No'] !== invNo) : null);
        try {
            await deleteRecord('Invoices', invNo);
            addToast('Invoice deleted.', 'success');
        } catch {
            addToast('Failed to delete invoice.', 'error');
            setInvoices(snapshot);
        }
    };

    // ── Payment ───────────────────────────────────────────────────────────────

    const handleRecordPayment = useCallback((inv: Invoice) => {
        setPaymentTarget(computeInvoiceAR(inv, receipts));
    }, [receipts]);

    // ── Summary ───────────────────────────────────────────────────────────────

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { All: serviceInvoices.length, Overdue: 0 };
        for (const inv of serviceInvoices) {
            counts[inv.Status] = (counts[inv.Status] ?? 0) + 1;
            if (computeInvoiceAR(inv, receipts).collectionStatus === 'Overdue') counts.Overdue += 1;
        }
        return counts;
    }, [serviceInvoices, receipts]);

    // Total unpaid across active USD invoices (KHR invoices excluded from the sum).
    const outstandingUSD = useMemo(() =>
        serviceInvoices
            .filter(inv => (inv.Currency ?? 'USD') === 'USD' && inv.Status !== 'Cancel')
            .reduce((sum, inv) => sum + Math.max(0, computeInvoiceAR(inv, receipts).outstanding), 0),
    [serviceInvoices, receipts]);

    // ── Print / Duplicate / Ticket link ──────────────────────────────────────

    const buildPdfPayload = useCallback((invoice: Invoice) => {
        let items: any[] = [];
        if (typeof invoice.ItemsJSON === 'string') {
            try { items = JSON.parse(invoice.ItemsJSON); } catch { /* ignore malformed JSON */ }
        } else {
            items = invoice.ItemsJSON || [];
        }

        const subTotal = items.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
        const tax = invoice.Taxable === 'VAT' ? subTotal * 0.1 : 0;
        const grandTotal = subTotal + tax;

        return {
            type: 'Service Invoice' as const,
            headerData: {
                ...invoice,
                'Company Address': invoice['Company Address'] || companies?.find(c => c['Company Name'] === invoice['Company Name'])?.['Address (English)'] || '',
                'Invoice No': invoice['Inv No'],
                'Inv No.': invoice['Inv No'],
            },
            items: items.filter((item: any) => item.no > 0 || item.isPromotion).map((item: any) => ({
                no: item.no,
                itemCode: item.itemCode,
                modelName: item.modelName,
                description: item.description,
                qty: item.qty,
                unitPrice: item.unitPrice,
                amount: item.amount,
                isPromotion: item.isPromotion,
            })),
            totals: { subTotal, tax, grandTotal },
            currency: (invoice.Currency as 'USD' | 'KHR') || 'USD',
            filename: `ServiceInvoice_${invoice['Inv No']}.pdf`,
        };
    }, [companies]);

    const handlePrintInvoice = useCallback(async (invoice: Invoice) => {
        try {
            await generatePDF(buildPdfPayload(invoice));
        } catch (err: any) {
            addToast(`Failed to generate PDF: ${err.message}`, 'error');
        }
    }, [buildPdfPayload, addToast]);

    const handleSendToTelegram = useCallback(async (invoice: Invoice) => {
        const chatId = getUserTelegramChatId(currentUser);
        if (!chatId) {
            addToast('No Telegram Chat ID on your user profile. Ask an admin to add it in User Management.', 'error');
            return;
        }
        addToast('Sending to your Telegram...', 'info');
        try {
            await sendPdfToTelegramChat({
                ...buildPdfPayload(invoice),
                chatId,
                caption: `<b>Service Invoice ${invoice['Inv No']}</b>\n${invoice['Company Name'] ?? ''}`,
            });
            addToast('Sent to your Telegram.', 'success');
        } catch (err: any) {
            addToast(`Telegram send failed: ${err.message}`, 'error');
        }
    }, [buildPdfPayload, currentUser, addToast]);

    const handleDuplicateInvoice = useCallback((invoice: Invoice) => {
        openInvoiceWindow(null, { action: 'duplicate', duplicateOf: invoice });
        addToast('Duplicating service invoice...', 'info');
    }, [openInvoiceWindow, addToast]);

    const findLinkedTicket = useCallback((inv: Invoice): ServiceTicket | undefined => {
        const remark = inv['Remark'] ?? '';
        if (!remark.startsWith(SERVICE_REMARK_PREFIX)) return undefined;
        const ticketNo = remark.slice(SERVICE_REMARK_PREFIX.length).trim();
        return serviceTickets?.find(t => t.ticket_no === ticketNo);
    }, [serviceTickets]);

    const openTicketWindow = useCallback((ticket: ServiceTicket) => {
        const windowId = `service-ticket-${ticket.id}`;
        openWindow({
            id: windowId,
            title: 'Service Ticket',
            content: <ServiceTicketWindowContent windowId={windowId} ticketId={ticket.id!} initialReadOnly={true} />,
            draggable: true,
            initialWidth: 900,
            initialHeight: 760,
            minWidth: 880,
            minHeight: 480,
        });
    }, [openWindow]);

    // ── Columns ───────────────────────────────────────────────────────────────

    const allColumns = useMemo<ColumnDef<Invoice>[]>(() => [
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
            header: 'Reference',
            isSortable: true,
            cell: (v: any) => {
                if (!v) return <span className="text-muted-foreground/40">—</span>;
                const ticketNo = v.startsWith(SERVICE_REMARK_PREFIX)
                    ? v.replace(SERVICE_REMARK_PREFIX, '')
                    : null;
                return ticketNo
                    ? <span className="font-mono text-xs text-primary">{ticketNo}</span>
                    : <span className="text-xs text-muted-foreground italic">{v}</span>;
            },
        },
        { accessorKey: 'Company Name', header: 'Company', isSortable: true },
        { accessorKey: 'Contact Name', header: 'Contact', isSortable: true },
        {
            accessorKey: 'Amount',
            header: 'Amount',
            isSortable: true,
            cell: (v: any, row: Invoice) => (
                <span className="text-sm font-medium text-right block w-full">
                    {formatCurrencySmartly(Number(v) || 0, row['Currency'] ?? 'USD')}
                </span>
            ),
        },
        { accessorKey: 'Currency', header: 'CCY', isSortable: true },
        {
            accessorKey: 'Status',
            header: 'Status',
            isSortable: true,
            cell: (v: any) => <StatusBadge status={v} />,
        },
        {
            accessorKey: 'Due Date',
            header: 'Due / Overdue',
            isSortable: true,
            cell: (_: any, row: Invoice) => {
                const ar = computeInvoiceAR(row, receipts);
                if (!ar.dueDate) return <span className="text-muted-foreground/30 text-xs">COD</span>;
                if (ar.outstanding <= 0.005) return <span className="text-xs text-muted-foreground">{formatDisplayDate(row['Due Date'] || ar.dueDate.toISOString())}</span>;
                if (ar.daysPastDue > 0) return <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{ar.daysPastDue}d overdue</span>;
                return <span className="text-xs text-muted-foreground">in {Math.abs(ar.daysPastDue)}d</span>;
            },
        },
    ], [receipts]);

    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorageGet(COLUMNS_VISIBILITY_KEY);
            if (saved) {
                const set = new Set<string>(JSON.parse(saved));
                set.add('Due Date'); // surface the newly-added overdue column for older saved sets
                return set;
            }
        } catch { }
        return new Set(allColumns.map(c => c.accessorKey as string).filter(Boolean));
    });

    const handleColumnToggle = (key: string) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) { if (next.size > 1) next.delete(key); }
            else next.add(key);
            localStorageSet(COLUMNS_VISIBILITY_KEY, JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const displayedColumns = useMemo(
        () => allColumns.filter(c => visibleColumns.has(c.accessorKey as string)),
        [allColumns, visibleColumns]
    );

    const STATUS_FILTERS = ['All', 'Draft', 'Processing', 'Completed', 'Overdue', 'Cancel'];

    if (error) {
        return <ErrorState title="Could not load service invoices" message={error} />;
    }

    return (
        <div className="h-full flex flex-col">
            {/* ── Header ── */}
            <DashboardHeader
                title="Service Invoices"
                icon={<ReceiptIcon />}
                subtitle={
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${outstandingUSD > 0.005 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        Outstanding: {formatCurrencySmartly(outstandingUSD, 'USD')}
                    </span>
                }
            >
                <SearchInput
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Search invoices..."
                    label="Search service invoices"
                />

                <CellWrapToggle value={cellWrapStyle} onChange={setCellWrapStyle} />

                <DataTableColumnToggle
                    allColumns={allColumns}
                    visibleColumns={visibleColumns}
                    onColumnToggle={handleColumnToggle}
                />

                <PermissionGate module="service_invoices" action="create">
                    <Button onClick={openNewServiceInvoice} aria-label="New service invoice">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">New Invoice</span>
                    </Button>
                </PermissionGate>
            </DashboardHeader>

            {/* ── Table ── */}
            <div className="flex-1 overflow-hidden p-4">
                <DataTable
                    tableId="service-invoice-table"
                    data={filteredData}
                    columns={displayedColumns}
                    loading={loading}
                    onRowClick={inv => openInvoiceWindow(inv['Inv No'])}
                    initialSort={{ key: 'Inv Date', direction: 'descending' }}
                    mobilePrimaryColumns={['Inv No', 'Company Name', 'Status', 'Amount']}
                    cellWrapStyle={cellWrapStyle}
                    emptyState={{
                        title: 'No service invoices yet',
                        description: 'Invoices raised against service tickets will appear here.',
                    }}
                    renderRowActions={row => {
                        const ar = computeInvoiceAR(row, receipts);
                        const canPay = (row.Status === 'Processing' || row.Status === 'Completed') && ar.outstanding > 0.005;
                        return (
                            <div className="flex items-center justify-center gap-1">
                                <PermissionGate module="service_invoices" action="edit">
                                    <IconButton
                                        label="Edit invoice"
                                        tone="primary"
                                        onClick={e => { e.stopPropagation(); openInvoiceWindow(row['Inv No']); }}
                                    >
                                        <Pencil size={15} aria-hidden="true" />
                                    </IconButton>
                                </PermissionGate>
                                {canPay && (
                                    <PermissionGate module="service_invoices" action="edit">
                                        <IconButton
                                            label="Record payment"
                                            onClick={e => { e.stopPropagation(); handleRecordPayment(row); }}
                                            className="hover:text-emerald-500 hover:bg-emerald-500/10"
                                        >
                                            <Wallet size={15} aria-hidden="true" />
                                        </IconButton>
                                    </PermissionGate>
                                )}
                                <IconButton
                                    label="Print PDF"
                                    tone="primary"
                                    onClick={e => { e.stopPropagation(); handlePrintInvoice(row); }}
                                >
                                    <Printer size={15} aria-hidden="true" />
                                </IconButton>
                                <PermissionGate module="service_invoices" action="delete">
                                    <IconButton
                                        label="Delete invoice"
                                        tone="danger"
                                        onClick={e => { e.stopPropagation(); handleDeleteRequest(row); }}
                                    >
                                        <Trash2 size={15} aria-hidden="true" />
                                    </IconButton>
                                </PermissionGate>
                            </div>
                        );
                    }}
                    renderRowContextMenu={row => {
                        const ar = computeInvoiceAR(row, receipts);
                        const canPay = (row.Status === 'Processing' || row.Status === 'Completed') && ar.outstanding > 0.005;
                        const linkedTicket = findLinkedTicket(row);
                        return (
                            <RowActionMenuItems
                                onOpenWindow={() => openInvoiceWindow(row['Inv No'])}
                                onEdit={can('service_invoices', 'edit') ? () => openInvoiceWindow(row['Inv No']) : undefined}
                                onDelete={can('service_invoices', 'delete') ? () => handleDeleteRequest(row) : undefined}
                            >
                                {linkedTicket && (
                                    <DropdownMenuItem onClick={() => openTicketWindow(linkedTicket)}>
                                        <Wrench className="mr-2 h-4 w-4" /> Open Ticket {linkedTicket.ticket_no}
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handlePrintInvoice(row)}>
                                    <Printer className="mr-2 h-4 w-4" /> Print
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSendToTelegram(row)}>
                                    <Send className="mr-2 h-4 w-4" /> Send to my Telegram
                                </DropdownMenuItem>
                                {can('service_invoices', 'create') && (
                                    <DropdownMenuItem onClick={() => handleDuplicateInvoice(row)}>
                                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                                    </DropdownMenuItem>
                                )}
                                {canPay && can('service_invoices', 'edit') && (
                                    <DropdownMenuItem onClick={() => handleRecordPayment(row)}>
                                        <Wallet className="mr-2 h-4 w-4" /> Record Payment
                                    </DropdownMenuItem>
                                )}
                            </RowActionMenuItems>
                        );
                    }}
                />
            </div>

            {/* ── Status filters ── */}
            <StatusFilterBar
                options={STATUS_FILTERS.map(s => ({ value: s, label: s, count: statusCounts[s] ?? 0 }))}
                active={statusFilter}
                onChange={setStatusFilter}
                summary={`${filteredData.length} invoices`}
            />

            {/* ── Modals ── */}
            {paymentTarget && (
                <QuickPaymentModal ar={paymentTarget} onClose={() => setPaymentTarget(null)} />
            )}

            {invoiceToDelete && (
                <ConfirmationModal
                    isOpen={!!invoiceToDelete}
                    onClose={() => setInvoiceToDelete(null)}
                    onConfirm={handleConfirmDelete}
                    title="Delete Service Invoice"
                    confirmText="Delete"
                    variant="danger"
                >
                    <p>
                        Delete invoice <strong>{invoiceToDelete['Inv No']}</strong>
                        {invoiceToDelete['Company Name'] ? ` for ${invoiceToDelete['Company Name']}` : ''}?
                        This cannot be undone.
                    </p>
                </ConfirmationModal>
            )}
        </div>
    );
};

export default ServiceInvoiceDashboard;
