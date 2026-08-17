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
import MetricCard from '../../common/MetricCard';

const ACTIVE_TICKET_STATUSES = ['Open', 'In Progress', 'Pending Parts'];

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
        <div className="metric-cards-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
            {canSeeMoney && (
                <>
                    <MetricCard
                        title="Invoiced (Month)"
                        value={formatCurrencySmartly(kpis.invoicedMonth, 'USD')}
                        subValue="This calendar month"
                        icon={<TrendingUp />}
                        accentColor="blue"
                    />
                    <MetricCard
                        title="Collected (Month)"
                        value={formatCurrencySmartly(kpis.collectedMonth, 'USD')}
                        subValue="Payments received"
                        icon={<CheckCircle2 />}
                        accentColor="teal"
                    />
                    <MetricCard
                        title="Outstanding AR"
                        value={formatCurrencySmartly(kpis.outstanding, 'USD')}
                        subValue={`${kpis.openInvoices} open invoices`}
                        icon={<Wallet />}
                        accentColor="purple"
                        onClick={() => router.push('/collection')}
                    />
                    <MetricCard
                        title="Overdue AR"
                        value={formatCurrencySmartly(kpis.overdue, 'USD')}
                        subValue={kpis.overdueCount > 0 ? `${kpis.overdueCount} invoices past due` : 'All current'}
                        icon={<AlertTriangle />}
                        accentColor={kpis.overdue > 0.005 ? 'coral' : 'green'}
                        onClick={() => router.push('/collection')}
                    />
                </>
            )}
            {canSeeTickets && (
                <MetricCard
                    title="Open Tickets"
                    value={String(kpis.openTickets)}
                    subValue="Awaiting resolution"
                    icon={<Wrench />}
                    accentColor={kpis.openTickets > 0 ? 'amber' : 'green'}
                    onClick={() => router.push('/service-tickets')}
                />
            )}
        </div>
    );
};

export default FinancialKpiRow;
