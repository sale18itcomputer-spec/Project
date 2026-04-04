'use client';

import React, { useMemo, Suspense } from 'react';
import MetricCard from "../../common/MetricCard";
import { useB2BData } from "../../../hooks/useB2BData";
import { FilterProvider } from "../../../contexts/FilterContext";
import DashboardFilterBar from "../components/DashboardFilterBar";
import { parseSheetValue } from "../../../utils/formatters";
import AnalyticsDashboard from "./AnalyticsDashboard";
import ContentSkeleton from "../../common/ContentSkeleton";

import { Briefcase, Building, Users, MessageSquare, ClipboardList, Calendar } from 'lucide-react';
import { useB2B } from "../../../contexts/B2BContext";

const DashboardContentSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-card p-5 rounded-xl border border-border shadow-sm h-[104px] animate-pulse" />
      ))}
    </div>
    <div className="h-16 bg-card rounded-xl border border-border shadow-sm animate-pulse" />
    <div className="h-96 bg-card rounded-xl border border-border shadow-sm animate-pulse" />
  </div>
);

const Dashboard = () => {
  // AnalyticsDashboard owns its own fetchModule call — no duplicate fetch here
  const { companies, contacts, projects, loading } = useB2BData();
  const { isB2B } = useB2B();

  const stats = useMemo(() => {
    if (loading) return null;

    const getBestValue = (item: any) =>
      parseSheetValue(item['Bid Value']) || parseSheetValue(item['Total Amount']) || parseSheetValue(item['Amount']) || parseSheetValue(item['Grand Total']) || 0;

    const wonProjects = (projects || []).filter(p => (p.Status || '').toLowerCase().includes('win'));

    return {
      projectsCount: projects?.length || 0,
      wonProjectsCount: wonProjects.length,
      companiesCount: companies?.length || 0,
      contactsCount: contacts?.length || 0,
    };
  }, [projects, companies, contacts, loading, isB2B]);

  const formatValue = (val?: number) => (val?.toLocaleString() || '0');

  if (loading) return <DashboardContentSkeleton />;

  return (
    <div className="w-full lg:h-full lg:overflow-y-auto custom-scrollbar bg-background/50">
      <div className="p-4 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Overview Dashboard</h1>
            <p className="text-muted-foreground mt-1 font-medium italic">Welcome back to Limperial, ready for a high-performance session?</p>
          </div>
        </div>

        {/* Top metric cards — populated from critical data (already loaded) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          <MetricCard title="Leads/Projects"      value={formatValue(stats?.projectsCount)}   icon={<Briefcase />} />
          <MetricCard title="Won Pipelines"        value={formatValue(stats?.wonProjectsCount)} icon={<ClipboardList />} />
          <MetricCard title="Active Companies"     value={formatValue(stats?.companiesCount)}  icon={<Building />} />
          <MetricCard title="Registered Contacts"  value={formatValue(stats?.contactsCount)}   icon={<Users />} />
          {/* These counters come from lazy data; AnalyticsDashboard will fill them */}
          <MetricCard title="Open Quotations"      value="—"                                   icon={<MessageSquare />} />
          <MetricCard title="Pending Orders"       value="—"                                   icon={<Calendar />} />
        </div>

        {/*
          AnalyticsDashboard owns:
            - fetchModule for Quotations / Sale Orders / Invoices / Meeting_Logs / Raw
            - filter bar
            - all chart computations
          Suspense boundary gives a skeleton while it bootstraps.
        */}
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
