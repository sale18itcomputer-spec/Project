'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Wallet, AlertTriangle, CheckCircle2, Wrench } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { usePermissions } from '../../../hooks/usePermissions';
import {
    computeCollectionRows,
    totalOutstanding,
    outstandingByBucket,
    paidInRange,
} from '../../../utils/collection';
import { parseDate } from '../../../utils/time';
import { formatCurrencySmartly } from '../../../utils/formatters';

const ACTIVE_TICKET_STATUSES = ['Open', 'In Progress', 'Pending Parts'];

const toNum = (v: unknown): number => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
};

const KpiCard: React.FC<{
    label: string;
    value: string;
    sub?: string;
    icon: React.ReactNode;
    tone?: 'default' | 'warn' | 'danger' | 'good';
    onClick?: () => void;
}> = ({ label, value, sub, icon, tone = 'default', onClick }) => {
    const tones = {
        default: 'text-foreground',
        warn: 'text-amber-600 dark:text-amber-400',
        danger: 'text-rose-600 dark:text-rose-400',
        good: 'text-emerald-600 dark:text-emerald-400',
    } as const;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={`text-left bg-card border border-border rounded-xl p-4 transition-all ${onClick ? 'hover:border-brand-400 hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">{label}</span>
                <span className={tones[tone]}>{icon}</span>
            </div>
            <div className={`text-xl sm:text-2xl font-black ${tones[tone]}`}>{value}</div>
            {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </button>
    );
};

/**
 * Financial overview strip for the main dashboard — invoicing, collection and
 * service KPIs derived from the shared AR engine. Only rendered for users who
 * can view collection or invoices.
 */
const FinancialKpiRow: React.FC = () => {
    const { invoices, receipts, serviceTickets, fetchModule } = useData();
    const { can } = usePermissions();
    const router = useRouter();

    const canSeeMoney = can('collection', 'view') || can('invoices', 'view');
    const canSeeTickets = can('service_tickets', 'view');

    useEffect(() => {
        if (canSeeMoney) fetchModule('Invoices', 'Receipts');
        if (canSeeTickets) fetchModule('Service Tickets');
    }, [canSeeMoney, canSeeTickets, fetchModule]);

    const kpis = useMemo(() => {
        const rows = computeCollectionRows(invoices, receipts);
        const openRows = rows.filter(r => r.collectionStatus !== 'Paid' && r.collectionStatus !== 'Cancelled');
        const buckets = outstandingByBucket(openRows);
        const outstanding = totalOutstanding(openRows);
        const overdue = buckets['1-30'] + buckets['31-60'] + buckets['61-90'] + buckets['90+'];
        const overdueCount = openRows.filter(r => r.collectionStatus === 'Overdue').length;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const collectedMonth = paidInRange(rows, monthStart, monthEnd);

        // Invoiced this month — net of deposit, active (non-cancelled) invoices dated this month.
        let invoicedMonth = 0;
        for (const inv of invoices ?? []) {
            if (inv.Status === 'Cancel' || inv.Status === 'Draft') continue;
            const d = parseDate(inv['Inv Date']);
            if (!d || d < monthStart || d > monthEnd) continue;
            invoicedMonth += toNum(inv.Amount) - toNum(inv.Deposit);
        }

        const openTickets = (serviceTickets ?? []).filter(t => ACTIVE_TICKET_STATUSES.includes(t.status)).length;

        return { outstanding, overdue, overdueCount, collectedMonth, invoicedMonth, openInvoices: openRows.filter(r => r.outstanding > 0).length, openTickets };
    }, [invoices, receipts, serviceTickets]);

    if (!canSeeMoney && !canSeeTickets) return null;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
            {canSeeMoney && (
                <>
                    <KpiCard
                        label="Invoiced (Month)"
                        value={formatCurrencySmartly(kpis.invoicedMonth, 'USD')}
                        sub="This calendar month"
                        icon={<TrendingUp className="w-4 h-4" />}
                    />
                    <KpiCard
                        label="Collected (Month)"
                        value={formatCurrencySmartly(kpis.collectedMonth, 'USD')}
                        sub="Payments received"
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        tone="good"
                    />
                    <KpiCard
                        label="Outstanding AR"
                        value={formatCurrencySmartly(kpis.outstanding, 'USD')}
                        sub={`${kpis.openInvoices} open invoices`}
                        icon={<Wallet className="w-4 h-4" />}
                        onClick={() => router.push('/collection')}
                    />
                    <KpiCard
                        label="Overdue AR"
                        value={formatCurrencySmartly(kpis.overdue, 'USD')}
                        sub={kpis.overdueCount > 0 ? `${kpis.overdueCount} invoices past due` : 'All current'}
                        icon={<AlertTriangle className="w-4 h-4" />}
                        tone={kpis.overdue > 0.005 ? 'danger' : 'good'}
                        onClick={() => router.push('/collection')}
                    />
                </>
            )}
            {canSeeTickets && (
                <KpiCard
                    label="Open Tickets"
                    value={String(kpis.openTickets)}
                    sub="Awaiting resolution"
                    icon={<Wrench className="w-4 h-4" />}
                    tone={kpis.openTickets > 0 ? 'warn' : 'good'}
                    onClick={() => router.push('/service-tickets')}
                />
            )}
        </div>
    );
};

export default FinancialKpiRow;
