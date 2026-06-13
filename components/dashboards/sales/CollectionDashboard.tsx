'use client';

import React, { useState, useMemo } from 'react';
import { Wallet, Search, TrendingUp, AlertTriangle, CheckCircle2, Clock, FileText, ExternalLink } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useNavigation } from '@/contexts/NavigationContext';
import DataTable, { ColumnDef } from '@/components/common/DataTable';
import Spinner from '@/components/common/Spinner';
import {
    computeCollectionRows,
    totalOutstanding,
    outstandingByBucket,
    paidInRange,
    InvoiceAR,
    CollectionStatus,
    AgingBucket,
} from '@/utils/collection';
import { formatCurrencySmartly } from '@/utils/formatters';
import { formatDisplayDate } from '@/utils/time';
import QuickPaymentModal from '@/components/modals/QuickPaymentModal';
import { usePermissions } from '@/hooks/usePermissions';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

const COLLECTION_STATUSES: CollectionStatus[] = ['Pending', 'Partial', 'Overdue', 'Paid'];
const AGING_BUCKETS: AgingBucket[] = ['Current', '1-30', '31-60', '61-90', '90+'];

const statusBadge = (s: CollectionStatus) => {
    const cfg: Record<CollectionStatus, { bg: string; text: string }> = {
        'Pending':   { bg: 'bg-sky-500/10',     text: 'text-sky-600 dark:text-sky-400' },
        'Partial':   { bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400' },
        'Overdue':   { bg: 'bg-rose-500/10',    text: 'text-rose-600 dark:text-rose-400' },
        'Paid':      { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
        'Cancelled': { bg: 'bg-muted',          text: 'text-muted-foreground' },
    };
    const { bg, text } = cfg[s];
    return <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md ${bg} ${text}`}>{s}</span>;
};

const KpiCard: React.FC<{
    label: string;
    value: string;
    sub?: string;
    icon: React.ReactNode;
    tone?: 'default' | 'warn' | 'danger' | 'good';
    onClick?: () => void;
    active?: boolean;
}> = ({ label, value, sub, icon, tone = 'default', onClick, active }) => {
    const tones = {
        default: 'text-foreground',
        warn:    'text-amber-600 dark:text-amber-400',
        danger:  'text-rose-600 dark:text-rose-400',
        good:    'text-emerald-600 dark:text-emerald-400',
    } as const;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={`text-left bg-card border ${active ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-border'} rounded-lg p-4 transition-all ${onClick ? 'hover:border-brand-400 hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">{label}</span>
                <span className={tones[tone]}>{icon}</span>
            </div>
            <div className={`text-2xl font-black ${tones[tone]}`}>{value}</div>
            {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </button>
    );
};

const CollectionDashboard: React.FC = () => {
    const { invoices, receipts, loading } = useData();
    const { handleNavigation } = useNavigation();
    const { can } = usePermissions();

    const canRecordPayment = can('collection', 'create');

    const [statusFilter, setStatusFilter] = useState<CollectionStatus | null>(null);
    const [bucketFilter, setBucketFilter] = useState<AgingBucket | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentTarget, setPaymentTarget] = useState<InvoiceAR | null>(null);

    // ── Derive AR rows ────────────────────────────────────────────────────────
    const allRows = useMemo<InvoiceAR[]>(
        () => computeCollectionRows(invoices, receipts),
        [invoices, receipts],
    );

    // ── KPIs (computed before filter so cards show the full picture) ──────────
    const kpis = useMemo(() => {
        const openRows = allRows.filter(r => r.collectionStatus !== 'Paid' && r.collectionStatus !== 'Cancelled');
        const buckets = outstandingByBucket(openRows);
        const total = totalOutstanding(openRows);

        // "Paid this month" — sum of receipts in the current calendar month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const paidMonth = paidInRange(allRows, monthStart, monthEnd);

        const overdueTotal = buckets['1-30'] + buckets['31-60'] + buckets['61-90'] + buckets['90+'];

        return { total, current: buckets['Current'], overdueTotal, buckets, paidMonth };
    }, [allRows]);

    // ── Filter ────────────────────────────────────────────────────────────────
    const filteredRows = useMemo(() => {
        let rows = allRows;
        if (statusFilter) rows = rows.filter(r => r.collectionStatus === statusFilter);
        if (bucketFilter) {
            // '61-90' is the sentinel for the "60+ Days" card which covers both
            // 61-90 and 90+ aging buckets. All other bucket filters are exact.
            const matchBuckets: AgingBucket[] = bucketFilter === '61-90'
                ? ['61-90', '90+']
                : [bucketFilter];
            rows = rows.filter(r => r.outstanding > 0 && matchBuckets.includes(r.agingBucket));
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            rows = rows.filter(r => {
                const inv = r.invoice;
                return ['Inv No', 'SO No', 'Company Name', 'Contact Name'].some(k =>
                    String(inv[k] ?? '').toLowerCase().includes(q),
                );
            });
        }
        return rows;
    }, [allRows, statusFilter, bucketFilter, searchQuery]);

    // ── Table columns ─────────────────────────────────────────────────────────
    const columns = useMemo<ColumnDef<InvoiceAR>[]>(() => [
        {
            accessorKey: 'invoice',
            header: 'Inv No',
            isSortable: true,
            cell: (_: any, row: InvoiceAR) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleNavigation({ view: 'invoices', action: 'view', id: row.invoice['Inv No'] });
                    }}
                    className="font-semibold text-brand-600 hover:underline"
                >
                    {row.invoice['Inv No']}
                </button>
            ),
        },
        {
            accessorKey: 'invoice',
            header: 'Company',
            isSortable: true,
            cell: (_: any, row: InvoiceAR) => (
                <div className="text-sm">
                    <div className="font-medium text-foreground">{row.invoice['Company Name'] || '—'}</div>
                    {row.invoice['Contact Name'] && (
                        <div className="text-xs text-muted-foreground">{row.invoice['Contact Name']}</div>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'invoice',
            header: 'Inv Date',
            isSortable: true,
            cell: (_: any, row: InvoiceAR) => (
                <span className="text-sm text-muted-foreground">{formatDisplayDate(row.invoice['Inv Date'])}</span>
            ),
        },
        {
            accessorKey: 'dueDate',
            header: 'Due Date',
            isSortable: true,
            cell: (v: Date | null) => v
                ? <span className="text-sm">{v.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                : <span className="text-muted-foreground/40 text-xs">COD</span>,
        },
        {
            accessorKey: 'invoice',
            header: 'Payment Term',
            cell: (_: any, row: InvoiceAR) => (
                <span className="text-xs text-muted-foreground">{row.invoice['Payment Term'] || '—'}</span>
            ),
        },
        {
            accessorKey: 'invoiced',
            header: 'Invoiced',
            isSortable: true,
            cell: (v: number, row: InvoiceAR) => (
                <span className="text-sm tabular-nums">{formatCurrencySmartly(v, row.invoice.Currency)}</span>
            ),
        },
        {
            accessorKey: 'deposit',
            header: 'Deposit',
            isSortable: true,
            cell: (v: number, row: InvoiceAR) =>
                v > 0
                    ? <span className="text-sm tabular-nums text-muted-foreground">{formatCurrencySmartly(v, row.invoice.Currency)}</span>
                    : <span className="text-muted-foreground/30 text-xs">—</span>,
        },
        {
            accessorKey: 'paid',
            header: 'Paid',
            isSortable: true,
            cell: (v: number, row: InvoiceAR) =>
                v > 0
                    ? <span className="text-sm tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrencySmartly(v, row.invoice.Currency)}</span>
                    : <span className="text-muted-foreground/30 text-xs">—</span>,
        },
        {
            accessorKey: 'outstanding',
            header: 'Outstanding',
            isSortable: true,
            cell: (v: number, row: InvoiceAR) =>
                v > 0
                    ? <span className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">{formatCurrencySmartly(v, row.invoice.Currency)}</span>
                    : <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrencySmartly(0, row.invoice.Currency)}</span>,
        },
        {
            accessorKey: 'collectionStatus',
            header: 'Status',
            isSortable: true,
            cell: (v: CollectionStatus) => statusBadge(v),
        },
        {
            accessorKey: 'daysPastDue',
            header: 'Days Past Due',
            isSortable: true,
            cell: (v: number, row: InvoiceAR) => {
                if (row.outstanding <= 0) return <span className="text-muted-foreground/30 text-xs">—</span>;
                if (v <= 0) return <span className="text-xs text-muted-foreground">in {Math.abs(v)}d</span>;
                return <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{v}d overdue</span>;
            },
        },
    ], [handleNavigation]);

    // ── Row actions (record-payment or "Open Invoice") ────────────────────────
    const renderRowActions = (row: InvoiceAR) => {
        const canPay = canRecordPayment && row.outstanding > 0;
        return (
            <div className="flex items-center justify-end gap-2">
                {canPay && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setPaymentTarget(row); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-md transition shadow-sm whitespace-nowrap"
                        title="Record Payment"
                    >
                        <Wallet className="w-3.5 h-3.5" /> Record Payment
                    </button>
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleNavigation({ view: 'invoices', action: 'view', id: row.invoice['Inv No'] });
                    }}
                    className="p-2 text-muted-foreground hover:text-brand-500 transition hover:bg-brand-500/10 rounded-md"
                    title="Open Invoice"
                >
                    <ExternalLink className="w-4 h-4" />
                </button>
            </div>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col">
            <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                    <Wallet className="w-5 h-5 text-brand-500" />
                    <h1 className="text-xl font-bold text-foreground">Collection</h1>
                    <span className="text-sm text-muted-foreground ml-1">Accounts Receivable</span>
                    {!canRecordPayment && (
                        <span className="ml-3 text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-md uppercase font-bold tracking-wider">Read-Only</span>
                    )}
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                    <KpiCard
                        label="Total Outstanding"
                        value={formatCurrencySmartly(kpis.total, 'USD')}
                        sub={`${allRows.filter(r => r.outstanding > 0).length} open invoices`}
                        icon={<TrendingUp className="w-4 h-4" />}
                        tone="default"
                    />
                    <KpiCard
                        label="Current"
                        value={formatCurrencySmartly(kpis.current, 'USD')}
                        sub="Not yet due"
                        icon={<Clock className="w-4 h-4" />}
                        tone="default"
                        active={bucketFilter === 'Current'}
                        onClick={() => setBucketFilter(bucketFilter === 'Current' ? null : 'Current')}
                    />
                    <KpiCard
                        label="1-30 Days"
                        value={formatCurrencySmartly(kpis.buckets['1-30'], 'USD')}
                        sub="Overdue"
                        icon={<AlertTriangle className="w-4 h-4" />}
                        tone="warn"
                        active={bucketFilter === '1-30'}
                        onClick={() => setBucketFilter(bucketFilter === '1-30' ? null : '1-30')}
                    />
                    <KpiCard
                        label="31-60 Days"
                        value={formatCurrencySmartly(kpis.buckets['31-60'], 'USD')}
                        sub="Overdue"
                        icon={<AlertTriangle className="w-4 h-4" />}
                        tone="warn"
                        active={bucketFilter === '31-60'}
                        onClick={() => setBucketFilter(bucketFilter === '31-60' ? null : '31-60')}
                    />
                    <KpiCard
                        label="60+ Days"
                        value={formatCurrencySmartly(kpis.buckets['61-90'] + kpis.buckets['90+'], 'USD')}
                        sub="Critically overdue"
                        icon={<AlertTriangle className="w-4 h-4" />}
                        tone="danger"
                        active={bucketFilter === '61-90'}
                        onClick={() => setBucketFilter((bucketFilter === '61-90') ? null : '61-90')}
                    />
                    <KpiCard
                        label="Paid This Month"
                        value={formatCurrencySmartly(kpis.paidMonth, 'USD')}
                        sub="Across all invoices"
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        tone="good"
                    />
                </div>

                {/* Filter row */}
                <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                    <div className="relative w-full lg:w-72">
                        <input
                            type="text"
                            placeholder="Search by invoice, company, contact..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-muted border border-border text-foreground placeholder-muted-foreground/40 text-sm rounded-md pl-10 pr-4 py-2 focus:ring-2 focus:ring-brand-500 transition shadow-sm"
                        />
                        <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => { setStatusFilter(null); setBucketFilter(null); }}
                            className={`px-4 py-1.5 rounded-md border text-xs font-semibold transition ${statusFilter === null && bucketFilter === null ? 'bg-brand-600 text-white border-brand-600' : 'border-border text-muted-foreground bg-card hover:bg-muted'}`}
                        >
                            All ({allRows.length})
                        </button>
                        {COLLECTION_STATUSES.map(s => {
                            const count = allRows.filter(r => r.collectionStatus === s).length;
                            return (
                                <button
                                    key={s}
                                    onClick={() => { setStatusFilter(statusFilter === s ? null : s); setBucketFilter(null); }}
                                    className={`px-4 py-1.5 rounded-md border text-xs font-semibold transition ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-border text-muted-foreground bg-card hover:bg-muted'}`}
                                >
                                    {s} ({count})
                                </button>
                            );
                        })}
                        {bucketFilter && (
                            <button
                                onClick={() => setBucketFilter(null)}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition"
                            >
                                Clear aging filter ({bucketFilter})
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-hidden p-4">
                {loading && allRows.length === 0 ? (
                    <Spinner />
                ) : filteredRows.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <FileText className="w-12 h-12 text-muted-foreground/40 mb-3" />
                        <h3 className="text-sm font-semibold text-foreground">No invoices match these filters</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                            Once an invoice is issued (Processing or Completed), it appears here for collection tracking.
                        </p>
                    </div>
                ) : (
                    <DataTable<InvoiceAR>
                        tableId="collection-table"
                        data={filteredRows}
                        columns={columns}
                        loading={false}
                        initialSort={{ key: 'daysPastDue', direction: 'descending' }}
                        mobilePrimaryColumns={['invoice', 'outstanding', 'collectionStatus']}
                        cellWrapStyle="nowrap"
                        renderRowActions={renderRowActions}
                        renderRowContextMenu={(row) => (
                            <>
                                {canRecordPayment && row.outstanding > 0 && (
                                    <DropdownMenuItem onClick={() => setPaymentTarget(row)}>
                                        <Wallet className="mr-2 h-4 w-4" /> Record Payment
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleNavigation({ view: 'invoices', action: 'view', id: row.invoice['Inv No'] })}>
                                    <ExternalLink className="mr-2 h-4 w-4" /> Open Invoice
                                </DropdownMenuItem>
                            </>
                        )}
                    />
                )}
            </div>

            {/* Payment modal */}
            {paymentTarget && (
                <QuickPaymentModal
                    ar={paymentTarget}
                    onClose={() => setPaymentTarget(null)}
                />
            )}
        </div>
    );
};

export default CollectionDashboard;
