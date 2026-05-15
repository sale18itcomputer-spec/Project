'use client';

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useB2BData } from "../../../hooks/useB2BData";
import { useAuth } from "../../../contexts/AuthContext";
import { useB2B } from "../../../contexts/B2BContext";
import { parseSheetValue } from "../../../utils/formatters";
import { useFilter } from "../../../contexts/FilterContext";
import DashboardFilterBar from "../components/DashboardFilterBar";
import PendingWorks from './PendingWorks';
import { Clock } from 'lucide-react';

import RevenueGrowthChart, { RevenueDataPoint } from '../../charts/analytics/RevenueGrowthChart';
import PendingDistributionChart, { PendingCounts } from '../../charts/analytics/PendingDistributionChart';
import AnalyticsTopCustomersChart, { CustomerDataPoint } from '../../charts/analytics/AnalyticsTopCustomersChart';
import PipelineStatusChart, { PipelineDataPoint } from '../../charts/analytics/PipelineStatusChart';
import SalesByBrandChart, { BrandDataPoint } from '../../charts/analytics/SalesByBrandChart';

// ---------------------------------------------------------------------------
// Stable helpers (defined once, outside the component — never recreated)
// ---------------------------------------------------------------------------
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getBestDate(item: any): Date | null {
  const str =
    item['Created Date'] || item['SO Date'] || item['Inv Date'] ||
    item['Due Date']     || item['Quote Date'] || item['order_date'] || item['created_at'];
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function getBestValue(item: any): number {
  return (
    parseSheetValue(item['Bid Value'])    ||
    parseSheetValue(item['Total Amount']) ||
    parseSheetValue(item['Amount'])       ||
    parseSheetValue(item['Grand Total'])  ||
    parseSheetValue(item['sub_total'])    ||
    0
  );
}

function parseRevKey(k: string): Date {
  if (k.startsWith('Q')) {
    const [q, y] = k.split(' ');
    return new Date(`${y}-${['01', '04', '07', '10'][parseInt(q[1]) - 1]}-01`);
  }
  return new Date(`1 ${k}`);
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
const SectionHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="h-8 w-1 bg-primary rounded-full" />
    <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const AnalyticsDashboard: React.FC = () => {
  const { quotations, saleOrders, projects, invoices, pricelist, fetchModule } = useB2BData();
  const { currentUser } = useAuth();
  const { isB2B } = useB2B();
  const { filters, setFilter } = useFilter();

  const [revenuePeriod, setRevenuePeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  // Single fetchModule call — owns all lazy data for this view
  useEffect(() => {
    fetchModule('Quotations', 'Sale Orders', 'Invoices', 'Meeting_Logs', 'Raw');
  }, [fetchModule]);

  // ---------------------------------------------------------------------------
  // passesFilters — stable useCallback, only recreated when filters/user change
  // ---------------------------------------------------------------------------
  const passesFilters = useCallback((item: any): boolean => {
    const d = getBestDate(item);
    const currentYear = new Date().getFullYear();

    if (d) {
      if (filters.year?.length) {
        if (!filters.year.includes(String(d.getFullYear()))) return false;
      } else {
        if (d.getFullYear() !== currentYear) return false;
      }
      if (filters.month?.length) {
        if (!filters.month.includes(MONTH_SHORT[d.getMonth()])) return false;
      }
      if (filters.startDate && d < new Date(filters.startDate)) return false;
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
    }

    if (filters.status?.length) {
      if (!filters.status.some(s => (item.Status || '').toLowerCase() === s.toLowerCase())) return false;
    }
    if (filters.companyName?.length) {
      if (!filters.companyName.includes(item['Company Name'])) return false;
    }
    if (filters.responsibleBy?.length) {
      const assignee = item['Responsible By'] || item['Created By'] || item['Prepared By'] || '';
      if (!filters.responsibleBy.includes(assignee)) return false;
    }
    if (filters.brand1?.length) {
      const brand = item['Brand 1']?.trim() || item['Brand']?.trim() || 'Other';
      if (!filters.brand1.includes(brand)) return false;
    }
    return true;
  }, [filters]);

  // ---------------------------------------------------------------------------
  // Pricelist code→brand lookup — only rebuilds when pricelist changes
  // ---------------------------------------------------------------------------
  const codeToBrand = useMemo(() => {
    const map: Record<string, string> = {};
    pricelist?.forEach(p => {
      if (p.Code && p.Brand) map[p.Code.trim().toLowerCase()] = p.Brand.trim();
    });
    return map;
  }, [pricelist]);

  // ---------------------------------------------------------------------------
  // Filter options for the filter bar
  // ---------------------------------------------------------------------------
  const filterOptions = useMemo(() => {
    const unique = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)));
    const allStatuses = [
      ...(projects?.map(p => p.Status)    || []),
      ...(quotations?.map(q => q.Status)  || []),
      ...(saleOrders?.map(so => so.Status) || []),
      ...(invoices?.map(i => i.Status)    || []),
    ];
    const allAssignees = [
      ...(projects?.map(p => p['Responsible By'])   || []),
      ...(quotations?.map(q => q['Created By'])     || []),
      ...(quotations?.map(q => q['Prepared By'])    || []),
      ...(saleOrders?.map(so => so['Created By'])   || []),
      ...(saleOrders?.map(so => so['Prepared By'])  || []),
      ...(invoices?.map(i => i['Created By'])       || []),
    ];
    const allCompanies = [
      ...(projects?.map(p => p['Company Name'])     || []),
      ...(quotations?.map(q => q['Company Name'])   || []),
      ...(saleOrders?.map(so => so['Company Name']) || []),
      ...(invoices?.map(i => i['Company Name'])     || []),
    ];
    const currentYear = new Date().getFullYear();
    return {
      statuses:  unique(allStatuses).sort(),
      assignees: unique(allAssignees).sort(),
      companies: unique(allCompanies).sort(),
      brands:    ['Limperial'],
      months:    MONTH_SHORT,
      years:     Array.from({ length: 5 }, (_, i) => currentYear - i),
    };
  }, [projects, quotations, saleOrders, invoices]);

  // ---------------------------------------------------------------------------
  // Chart data computations
  // ---------------------------------------------------------------------------
  const pendingCounts: PendingCounts = useMemo(() => {
    const isAdmin = currentUser?.Role === 'Admin';
    const name    = currentUser?.Name;
    const canView = (u?: string, p?: string) => isAdmin || u === name || p === name;
    const counts: PendingCounts = { Quotations: 0, SaleOrders: 0, Projects: 0, Invoices: 0, Meetings: 0 };
    quotations?.forEach(q  => { if (canView(q['Created By'], q['Prepared By'])  && ['Open', 'Pending'].includes(q.Status))              counts.Quotations++; });
    saleOrders?.forEach(so => { if (canView(so['Created By'], so['Prepared By']) && ['Pending', 'Processing'].includes(so.Status))        counts.SaleOrders++; });
    projects?.forEach(p    => { if ((isAdmin || p['Responsible By'] === name)    && !(p.Status || '').toLowerCase().includes('close'))    counts.Projects++; });
    invoices?.forEach(inv  => { if ((isAdmin || inv['Created By'] === name)      && ['Draft', 'Processing', 'Partial Paid'].includes(inv.Status)) counts.Invoices++; });
    return counts;
  }, [quotations, saleOrders, projects, invoices, currentUser]);

  const revenueData: RevenueDataPoint[] = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const activeYear  = filters.year?.length ? parseInt(filters.year[0]) : currentYear;
    const groups: Record<string, { val: number; count: number }> = {};
    if (revenuePeriod === 'monthly') {
      MONTH_SHORT.forEach(m => { groups[`${m} ${activeYear}`] = { val: 0, count: 0 }; });
    } else if (revenuePeriod === 'quarterly') {
      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => { groups[`${q} ${activeYear}`] = { val: 0, count: 0 }; });
    }
    const items = (isB2B
      ? (projects   || []).filter(p  => (p.Status  || '').toLowerCase().includes('win'))
      : (saleOrders || []).filter(so => (so.Status || '').toLowerCase().includes('complete'))
    ).filter(passesFilters);
    items.forEach(item => {
      const d = getBestDate(item);
      if (!d) return;
      const key = revenuePeriod === 'monthly'
        ? `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
        : revenuePeriod === 'quarterly'
          ? `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
          : String(d.getFullYear());
      if (!groups[key]) groups[key] = { val: 0, count: 0 };
      groups[key].val += getBestValue(item);
      groups[key].count++;
    });
    return Object.entries(groups)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => parseRevKey(a.name).getTime() - parseRevKey(b.name).getTime());
  }, [saleOrders, projects, revenuePeriod, isB2B, passesFilters, filters.year]);

  const customerData: CustomerDataPoint[] = useMemo(() => {
    const items = (isB2B ? (projects || []) : (saleOrders || []))
      .filter(i => (i.Status || '').toLowerCase().includes('completed') || (i.Status || '').toLowerCase().includes('win'))
      .filter(passesFilters);
    const map: Record<string, number> = {};
    items.forEach(i => { const n = i['Company Name'] || 'Unknown'; map[n] = (map[n] || 0) + getBestValue(i); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [saleOrders, projects, isB2B, passesFilters]);

  const brandData: BrandDataPoint[] = useMemo(() => {
    const map: Record<string, number> = {};
    if (isB2B) {
      (projects || []).filter(passesFilters).forEach(item => {
        const brand = (item as any)['Brand 1']?.trim() || (item as any)['Brand']?.trim() || 'Other';
        const val   = getBestValue(item);
        if (val > 0) map[brand] = (map[brand] || 0) + val;
      });
    } else {
      (saleOrders || []).filter(passesFilters).forEach(so => {
        if (!so.ItemsJSON) return;
        let lineItems: any[];
        try {
          lineItems = typeof so.ItemsJSON === 'string' ? JSON.parse(so.ItemsJSON) : so.ItemsJSON;
          if (!Array.isArray(lineItems)) return;
        } catch { return; }
        lineItems.forEach(li => {
          const code   = (li.itemCode || '').trim().toLowerCase();
          const brand  = codeToBrand[code] || (li.Brand || li.brand || '').trim() || 'Other';
          const amount = typeof li.amount === 'number' ? li.amount : parseFloat(li.amount) || 0;
          if (amount > 0) map[brand] = (map[brand] || 0) + amount;
        });
      });
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [saleOrders, projects, isB2B, passesFilters, codeToBrand]);

  const pipelineData: PipelineDataPoint[] = useMemo(() => {
    const counts: Record<string, number> = {};
    projects?.filter(passesFilters).forEach(p => { const s = p.Status || 'Active'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [projects, passesFilters]);

  // ---------------------------------------------------------------------------
  // Filter click handlers
  // ---------------------------------------------------------------------------
  const handleRevenueBarClick = useCallback((name: string) => {
    const parts = name.split(' ');
    if (revenuePeriod === 'monthly' && parts.length === 2) {
      const [mShort, year] = parts;
      setFilter('month', filters.month?.includes(mShort) ? [] : [mShort]);
      setFilter('year',  filters.year?.includes(year)   ? [] : [year]);
    } else if (revenuePeriod === 'yearly') {
      setFilter('year', filters.year?.includes(name) ? [] : [name]);
    }
  }, [revenuePeriod, filters.month, filters.year, setFilter]);

  const handleCustomerClick = useCallback((name: string) => {
    setFilter('companyName', filters.companyName?.includes(name) ? [] : [name]);
  }, [filters.companyName, setFilter]);

  const handlePipelineClick = useCallback((name: string) => {
    setFilter('status', filters.status?.includes(name) ? [] : [name]);
  }, [filters.status, setFilter]);

  const handleBrandClick = useCallback((name: string) => {
    setFilter('brand1', filters.brand1?.includes(name) ? [] : [name]);
  }, [filters.brand1, setFilter]);

  return (
    <div className="space-y-8 sm:space-y-12 animate-in fade-in duration-500">
      {/* Filter bar — sticky on desktop, static on mobile to avoid eating vertical space */}
      <div className="hidden sm:sticky sm:block top-0 z-50">
        <DashboardFilterBar {...filterOptions} />
      </div>
      {/* Mobile: non-sticky, sits inline */}
      <div className="sm:hidden">
        <DashboardFilterBar {...filterOptions} />
      </div>

      {/* Revenue */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2 mb-4">
          <SectionHeader title="Revenue Insights" />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-muted p-1 rounded-lg flex gap-1 flex-shrink-0 h-8 items-center">
              {(['monthly', 'quarterly', 'yearly'] as const).map(p => (
                <button key={p} onClick={() => setRevenuePeriod(p)}
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-colors capitalize ${revenuePeriod === p ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        <RevenueGrowthChart data={revenueData} onBarClick={handleRevenueBarClick} />
      </div>

      {/* Core Analytics */}
      <div className="space-y-4">
        <SectionHeader title="Core Analytics" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PendingDistributionChart data={pendingCounts} />
          <AnalyticsTopCustomersChart data={customerData} onBarClick={handleCustomerClick} />
        </div>
      </div>

      {/* Pipelines */}
      <div className="space-y-4">
        <SectionHeader title="Portfolio & Pipelines" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PipelineStatusChart data={pipelineData} totalProjects={projects?.length || 0} onSliceClick={handlePipelineClick} />
          <div style={{ height: '500px' }} className="overflow-hidden rounded-xl">
            <PendingWorks />
          </div>
        </div>
      </div>

      {/* Market */}
      <div className="space-y-4">
        <SectionHeader title="Market Intelligence" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SalesByBrandChart data={brandData} onSliceClick={handleBrandClick} />
          <div className="bg-card rounded-xl border shadow-sm p-8 flex flex-col items-center justify-center text-center space-y-4" style={{ height: '500px' }}>
            <Clock className="w-16 h-16 text-primary/20" />
            <h3 className="text-xl font-bold">Real-time Insights</h3>
            <p className="text-muted-foreground max-w-xs font-medium">Additional metrics will be calculated here based on your CRM activity.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
