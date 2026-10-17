'use client';

import React, { useMemo, Suspense, useEffect } from 'react';
import MetricCard, { StatGroup } from "../../common/MetricCard";
import { useB2BData } from "../../../hooks/useB2BData";
import { FilterProvider } from "../../../contexts/FilterContext";

import AnalyticsDashboard from "./AnalyticsDashboard";
import ContentSkeleton from "../../common/ContentSkeleton";
import FinancialKpiRow from "./FinancialKpiRow";

import { Briefcase, Building, Users, MessageSquare, ClipboardList, Calendar, Loader2 } from 'lucide-react';
import { useB2B } from "../../../contexts/B2BContext";

const DashboardContentSkeleton = () => (
  <div className="w-full lg:h-full lg:overflow-y-auto custom-scrollbar">
    <div className="dashboard-container p-3 sm:p-4 md:p-8 space-y-5 sm:space-y-8">

      {/* Header — visible title anchors the user while data loads */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight">
            Overview Dashboard
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Loader2 className="animate-spin h-3.5 w-3.5 text-primary/60" aria-hidden="true" />
            <p className="text-sm text-muted-foreground font-medium">
              Fetching your data…
            </p>
          </div>
        </div>
      </div>

      {/* Metric card skeletons — same grid and card shape as the real cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-3 w-16 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
              <div className="h-4 w-4 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 60 + 80}ms` }} />
            </div>
            <div className="h-7 w-12 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 60 + 100}ms` }} />
            <div className="mt-2 h-2.5 w-20 bg-muted/60 rounded animate-pulse" style={{ animationDelay: `${i * 60 + 150}ms` }} />
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="h-12 bg-card rounded-xl border border-border animate-pulse" />

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-72 bg-card rounded-xl border border-border animate-pulse" style={{ animationDelay: '200ms' }} />
        <div className="h-72 bg-card rounded-xl border border-border animate-pulse" style={{ animationDelay: '260ms' }} />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const { companies, contacts, projects, quotations, saleOrders, loading, fetchModule } = useB2BData();
  const { isB2B } = useB2B();

  // Fetch Quotations and Sale Orders lazily when the dashboard mounts
  useEffect(() => {
    fetchModule('Quotations', 'Sale Orders');
  }, [fetchModule]);

  const stats = useMemo(() => {
    if (loading) return null;

    const wonProjects = (projects || []).filter(p => p.Status === 'Closure (Win)');

    // Open Quotes: still awaiting a decision. Closed = Close (Win) / Close (Lose)
    // / Cancel (plus legacy terminal states). The substrings must match the real
    // quote vocabulary ('close' catches both Win and Lose) — otherwise won/lost/
    // cancelled quotes get miscounted as open.
    const closedStatuses = ['close', 'win', 'lose', 'lost', 'cancel', 'rejected', 'done', 'invoiced', 'expired'];
    const openQuotes = (quotations || []).filter(q => {
      const status = (q['Status'] || q['Quote Status'] || '').toLowerCase();
      return status === '' || !closedStatuses.some(s => status.includes(s));
    });

    // Pending Orders: sale orders not in a terminal state. Orders are created as
    // 'Completed', so 'complete' MUST be excluded or every finished order counts
    // as pending.
    const pendingOrders = (saleOrders || []).filter(so => {
      const status = (so['Status'] || so['SO Status'] || so['Delivery Status'] || '').toLowerCase();
      return status === '' || (!status.includes('complete') && !status.includes('done') && !status.includes('cancel') && !status.includes('delivered'));
    });

    return {
      projectsCount: projects?.length || 0,
      wonProjectsCount: wonProjects.length,
      companiesCount: companies?.length || 0,
      contactsCount: contacts?.length || 0,
      openQuotesCount: openQuotes.length,
      totalQuotesCount: quotations?.length || 0,
      pendingOrdersCount: pendingOrders.length,
      totalOrdersCount: saleOrders?.length || 0,
    };
  }, [projects, companies, contacts, quotations, saleOrders, loading, isB2B]);

  const fmt = (val?: number) => val?.toLocaleString() ?? '0';

  if (loading) return <DashboardContentSkeleton />;

  return (
    <div className="w-full lg:h-full lg:overflow-y-auto custom-scrollbar">
      <div className="dashboard-container p-3 sm:p-4 md:p-8 space-y-5 sm:space-y-8">

        {/* Header */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight">
          Overview Dashboard
        </h1>

        {/* Pipeline */}
        <StatGroup label="Pipeline" columns={6}>
          <MetricCard title="Leads" value={fmt(stats?.projectsCount)} icon={<Briefcase />} />
          <MetricCard
            title="Won pipelines"
            value={fmt(stats?.wonProjectsCount)}
            context={stats?.projectsCount ? `${Math.round(((stats?.wonProjectsCount ?? 0) / stats.projectsCount) * 100)}% of leads` : undefined}
            icon={<ClipboardList />}
            tone={stats?.wonProjectsCount ? 'good' : 'default'}
          />
          <MetricCard title="Companies" value={fmt(stats?.companiesCount)} icon={<Building />} />
          <MetricCard title="Contacts" value={fmt(stats?.contactsCount)} icon={<Users />} />
          <MetricCard
            title="Open quotes"
            value={fmt(stats?.openQuotesCount)}
            context={stats?.totalQuotesCount ? `of ${fmt(stats.totalQuotesCount)} quotes` : undefined}
            icon={<MessageSquare />}
            isEmpty={!stats?.totalQuotesCount}
          />
          <MetricCard
            title="Pending orders"
            value={fmt(stats?.pendingOrdersCount)}
            context={stats?.totalOrdersCount ? `of ${fmt(stats.totalOrdersCount)} orders` : undefined}
            icon={<Calendar />}
            isEmpty={!stats?.totalOrdersCount}
          />
        </StatGroup>

        {/* Financial & service KPIs */}
        <FinancialKpiRow />

        {/* Analytics section */}
        <Suspense fallback={<ContentSkeleton />}>
          <AnalyticsDashboard />
        </Suspense>

      </div>
    </div>
  );
};

export default function WrappedDashboard() {
  return (
    <FilterProvider>
      <Dashboard />
    </FilterProvider>
  );
}
