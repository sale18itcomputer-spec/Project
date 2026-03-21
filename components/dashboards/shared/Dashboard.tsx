'use client';

import React, { useMemo, useState, useEffect } from 'react';
import MetricCard from "../../common/MetricCard";
import { useB2BData } from "../../../hooks/useB2BData";
import { FilterProvider } from "../../../contexts/FilterContext";
import DashboardFilterBar from "../components/DashboardFilterBar";
import { parseSheetValue } from "../../../utils/formatters";
import AnalyticsDashboard from "./AnalyticsDashboard";

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
  const { quotations, saleOrders, companies, contacts, projects, invoices, loading, fetchModule } = useB2BData();
  const { isB2B } = useB2B();

  const [renderStep, setRenderStep] = useState(0);

  useEffect(() => {
    fetchModule('Quotations', 'Sale Orders', 'Invoices', 'Meeting_Logs');
  }, [fetchModule]);

  useEffect(() => {
    if (!loading) {
      const timer = setInterval(() => {
        setRenderStep(prev => (prev < 10 ? prev + 1 : prev));
      }, 100);
      return () => clearInterval(timer);
    }
  }, [loading]);

  const stats = useMemo(() => {
    if (loading) return null;

    const getBestValue = (item: any) => 
      parseSheetValue(item['Bid Value']) || parseSheetValue(item['Total Amount']) || parseSheetValue(item['Amount']) || parseSheetValue(item['Grand Total']) || 0;

    const completedOrders = (saleOrders || []).filter(so => (so.Status || '').toLowerCase().includes('complete'));
    const totalWinValueB2B = (projects || [])
      .filter(p => (p.Status || '').toLowerCase().includes('win'))
      .reduce((sum, p) => sum + getBestValue(p), 0);
    
    const totalWinValueB2C = completedOrders
      .reduce((sum, so) => sum + getBestValue(so), 0);

    return {
      projectsCount: projects?.length || 0,
      wonProjectsCount: projects?.filter(p => (p.Status || '').toLowerCase().includes('win')).length || 0,
      companiesCount: companies?.length || 0,
      contactsCount: contacts?.length || 0,
      quotesCount: quotations?.filter(q => q.Status === 'Open').length || 0,
      saleOrdersCount: saleOrders?.filter(so => so.Status === 'Pending').length || 0,
      revenue: isB2B ? totalWinValueB2B : totalWinValueB2C
    };
  }, [projects, companies, contacts, quotations, saleOrders, loading, isB2B]);

  const filterOptions = useMemo(() => {
    if (loading) return { statuses: [], assignees: [], companies: [], brands: [], months: [], years: [] };
    
    const unique = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)));
    
    const allStatuses = [
      ...(projects?.map(p => p.Status) || []),
      ...(quotations?.map(q => q.Status) || []),
      ...(saleOrders?.map(so => so.Status) || []),
      ...(invoices?.map(i => i.Status) || [])
    ];
    
    const allAssignees = [
      ...(projects?.map(p => p['Responsible By']) || []),
      ...(quotations?.map(q => q['Created By']) || []),
      ...(quotations?.map(q => q['Prepared By']) || []),
      ...(saleOrders?.map(so => so['Created By']) || []),
      ...(saleOrders?.map(so => so['Prepared By']) || []),
      ...(invoices?.map(i => i['Created By']) || [])
    ];
    
    const allCompanies = [
      ...(projects?.map(p => p['Company Name']) || []),
      ...(quotations?.map(q => q['Company Name']) || []),
      ...(saleOrders?.map(so => so['Company Name']) || []),
      ...(invoices?.map(i => i['Company Name']) || []),
      ...(companies?.map(c => c['Company Name']) || [])
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    return {
      statuses: unique(allStatuses).sort(),
      assignees: unique(allAssignees).sort(),
      companies: unique(allCompanies).sort(),
      brands: ['Limperial'], // Placeholder
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      years: years
    };
  }, [projects, quotations, saleOrders, invoices, companies, loading]);

  if (loading) return <DashboardContentSkeleton />;

  const transitionClass = (step: number) => 
    `transition-all duration-700 ${renderStep >= step ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.98]'}`;

  const formatValue = (val?: number) => (val?.toLocaleString() || '0');

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-background/50">
      <div className="p-4 md:p-8 space-y-8 min-h-screen">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Overview Dashboard</h1>
            <p className="text-muted-foreground mt-1 font-medium italic">Welcome back to Limperial, ready for a high-performance session?</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          <MetricCard title="Leads/Projects" value={formatValue(stats?.projectsCount)} icon={<Briefcase />} className={transitionClass(0)} />
          <MetricCard title="Won Pipelines" value={formatValue(stats?.wonProjectsCount)} icon={<ClipboardList />} className={transitionClass(0)} />
          <MetricCard title="Active Companies" value={formatValue(stats?.companiesCount)} icon={<Building />} className={transitionClass(1)} />
          <MetricCard title="Registered Contacts" value={formatValue(stats?.contactsCount)} icon={<Users />} className={transitionClass(1)} />
          <MetricCard title="Open Quotations" value={formatValue(stats?.quotesCount)} icon={<MessageSquare />} className={transitionClass(2)} />
          <MetricCard title="Pending Orders" value={formatValue(stats?.saleOrdersCount)} icon={<Calendar />} className={transitionClass(2)} />
        </div>

        {/* Sticky filter bar — stays above charts when scrolling */}
        <div className={`sticky top-0 z-50 ${transitionClass(3)}`}>
          <DashboardFilterBar {...filterOptions} />
        </div>

        {renderStep >= 4 && (
          <div className={transitionClass(4)}>
            <AnalyticsDashboard />
          </div>
        )}
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
