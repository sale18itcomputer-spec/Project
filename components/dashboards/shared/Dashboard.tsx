'use client';

import React, { useMemo, Suspense, useEffect } from 'react';
import MetricCard from "../../common/MetricCard";
import { useB2BData } from "../../../hooks/useB2BData";
import { FilterProvider } from "../../../contexts/FilterContext";

import { parseSheetValue } from "../../../utils/formatters";
import AnalyticsDashboard from "./AnalyticsDashboard";
import ContentSkeleton from "../../common/ContentSkeleton";

import { Briefcase, Building, Users, MessageSquare, ClipboardList, Calendar } from 'lucide-react';
import { useB2B } from "../../../contexts/B2BContext";

const DashboardContentSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border h-[120px] animate-pulse" />
      ))}
    </div>
    <div className="h-16 bg-card rounded-xl border border-border animate-pulse" />
    <div className="h-96 bg-card rounded-xl border border-border animate-pulse" />
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

    const wonProjects = (projects || []).filter(p => (p.Status || '').toLowerCase().includes('win'));

    // Open Quotes: quotations that are not cancelled/rejected/done
    const closedStatuses = ['cancelled', 'rejected', 'done', 'invoiced', 'expired'];
    const openQuotes = (quotations || []).filter(q => {
      const status = (q['Status'] || q['Quote Status'] || '').toLowerCase();
      return status === '' || !closedStatuses.some(s => status.includes(s));
    });

    // Pending Orders: sale orders that are not fully delivered/cancelled
    const pendingOrders = (saleOrders || []).filter(so => {
      const status = (so['Status'] || so['SO Status'] || so['Delivery Status'] || '').toLowerCase();
      return status === '' || (!status.includes('done') && !status.includes('cancel') && !status.includes('delivered'));
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
    <div className="w-full lg:h-full lg:overflow-y-auto custom-scrollbar bg-background/50">
      <div className="p-3 sm:p-4 md:p-8 space-y-5 sm:space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-foreground leading-tight">
              Overview Dashboard
            </h1>
            <p className="hidden md:block text-muted-foreground mt-1 font-medium italic">
              Welcome back to Limperial, ready for a high-performance session?
            </p>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          <MetricCard
            title="Leads"
            value={fmt(stats?.projectsCount)}
            icon={<Briefcase />}
            accentColor="blue"
            change={stats?.projectsCount ? `${fmt(stats.projectsCount)} active` : 'None yet'}
            changeType={stats?.projectsCount ? 'neutral' : 'neutral'}
          />
          <MetricCard
            title="Won Pipelines"
            value={fmt(stats?.wonProjectsCount)}
            icon={<ClipboardList />}
            accentColor="coral"
            change={stats?.wonProjectsCount === 0 ? 'No wins yet' : `${fmt(stats?.wonProjectsCount)} closed`}
            changeType={stats?.wonProjectsCount === 0 ? 'neutral' : 'increase'}
          />
          <MetricCard
            title="Companies"
            value={fmt(stats?.companiesCount)}
            icon={<Building />}
            accentColor="teal"
            change="Growing"
            changeType="increase"
          />
          <MetricCard
            title="Contacts"
            value={fmt(stats?.contactsCount)}
            icon={<Users />}
            accentColor="purple"
            change={stats?.contactsCount ? `${fmt(stats.contactsCount)} total` : 'None yet'}
            changeType={stats?.contactsCount ? 'increase' : 'neutral'}
          />
          <MetricCard
            title="Open Quotes"
            value={fmt(stats?.openQuotesCount)}
            icon={<MessageSquare />}
            accentColor="amber"
            change={
              stats?.totalQuotesCount
                ? `${fmt(stats.openQuotesCount)} of ${fmt(stats.totalQuotesCount)}`
                : 'None yet'
            }
            changeType={stats?.openQuotesCount ? 'increase' : 'neutral'}
            isEmpty={!stats?.totalQuotesCount}
          />
          <MetricCard
            title="Pending Orders"
            value={fmt(stats?.pendingOrdersCount)}
            icon={<Calendar />}
            accentColor="pink"
            change={
              stats?.totalOrdersCount
                ? `${fmt(stats.pendingOrdersCount)} of ${fmt(stats.totalOrdersCount)}`
                : 'None yet'
            }
            changeType={stats?.pendingOrdersCount ? 'increase' : 'neutral'}
            isEmpty={!stats?.totalOrdersCount}
          />
        </div>

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
