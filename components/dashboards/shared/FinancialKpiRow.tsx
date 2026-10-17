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
import MetricCard, { StatGroup } from '../../common/MetricCard';

const ACTIVE_TICKET_STATUSES = ['Open', 'In Progress', 'Pending Parts'];

// A genuine zero must read $0.00. formatCurrencySmartly treats 0 as "no value" and prints "-",
// which on a money tile looks like the figure failed to load.
const money = (n: number): string =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toNum = (v: unknown): number => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
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
        const openRows = rows.filter(r => r.collectionStatus !== 'Paid' && r.collectionStatus !== 'Cancelled' && r.collectionStatus !== 'Converted');
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
        <StatGroup label="Finance and service" columns={canSeeMoney && canSeeTickets ? 5 : canSeeMoney ? 4 : 5}>
            {canSeeMoney && (
                <>
                    <MetricCard title="Invoiced (month)" value={money(kpis.invoicedMonth)} context="This calendar month" icon={<TrendingUp />} />
                    <MetricCard
                        title="Collected (month)"
                        value={money(kpis.collectedMonth)}
                        context="Payments received"
                        icon={<CheckCircle2 />}
                        tone={kpis.collectedMonth > 0.005 ? 'good' : 'default'}
                    />
                    <MetricCard
                        title="Outstanding AR"
                        value={money(kpis.outstanding)}
                        context={`${kpis.openInvoices} open invoice${kpis.openInvoices === 1 ? '' : 's'}`}
                        icon={<Wallet />}
                        onClick={() => router.push('/collection')}
                    />
                    <MetricCard
                        title="Overdue AR"
                        value={money(kpis.overdue)}
                        context={kpis.overdueCount > 0 ? `${kpis.overdueCount} invoice${kpis.overdueCount === 1 ? '' : 's'} past due` : 'Nothing overdue'}
                        icon={<AlertTriangle />}
                        tone={kpis.overdue > 0.005 ? 'danger' : 'default'}
                        onClick={() => router.push('/collection')}
                    />
                </>
            )}
            {canSeeTickets && (
                <MetricCard
                    title="Open tickets"
                    value={String(kpis.openTickets)}
                    context="Awaiting resolution"
                    icon={<Wrench />}
                    tone={kpis.openTickets > 0 ? 'warn' : 'default'}
                    onClick={() => router.push('/service-tickets')}
                />
            )}
        </StatGroup>
    );
};

export default FinancialKpiRow;
