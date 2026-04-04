'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import { useB2BData } from "../../../hooks/useB2BData";
import { useAuth } from "../../../contexts/AuthContext";
import { limperialTheme, useChartReady } from "../../charts/echartsTheme";
import { Clock } from 'lucide-react';
import { useB2B } from "../../../contexts/B2BContext";
import { parseSheetValue } from "../../../utils/formatters";
import { useFilter } from "../../../contexts/FilterContext";
import { DateRangePicker } from "../../common/DateRangePicker";
import DashboardFilterBar from "../components/DashboardFilterBar";
import PendingWorks from './PendingWorks';

import ReactECharts from 'echarts-for-react';
const ECharts = ReactECharts as any;

echarts.registerTheme('limperial', limperialTheme);

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

function formatCurrency(val: number, currency = 'USD'): string {
  const prefix = currency === 'KHR' ? '៛' : '$';
  if (Math.abs(val) >= 1_000_000) return `${prefix}${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000)     return `${prefix}${Math.round(val / 1_000)}k`;
  return `${prefix}${val.toFixed(0)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function parseRevKey(k: string): Date {
  if (k.startsWith('Q')) {
    const [q, y] = k.split(' ');
    return new Date(`${y}-${['01', '04', '07', '10'][parseInt(q[1]) - 1]}-01`);
  }
  return new Date(`1 ${k}`);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const SectionHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="h-8 w-1 bg-primary rounded-full" />
    <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
  </div>
);

const ChartCard = ({
  title, description, containerRef, isReady, option, chartRef, onEvents,
}: {
  title: string; description: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isReady: boolean; option: any;
  chartRef: React.RefObject<any>;
  onEvents?: Record<string, Function>;
}) => (
  <div className="bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden" style={{ height: '500px' }}>
    <div className="p-6 pb-0 flex-shrink-0">
      <h3 className="text-lg font-extrabold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
    <div className="p-4 flex-grow min-h-0 touch-pan-y" ref={containerRef}>
      {isReady && (
        <ECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%' }}
          theme="limperial"
          onEvents={onEvents}
          notMerge={true}
          lazyUpdate={false}
        />
      )}
    </div>
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

  // Refs — must be at top level
  const pendingChartRef    = useRef<any>(null);
  const revenueChartRef    = useRef<any>(null);
  const pipelineChartRef   = useRef<any>(null);
  const customersChartRef  = useRef<any>(null);
  const brandChartRef      = useRef<any>(null);

  const pendingContainerRef    = useRef<HTMLDivElement>(null);
  const revenueContainerRef    = useRef<HTMLDivElement>(null);
  const pipelineContainerRef   = useRef<HTMLDivElement>(null);
  const customersContainerRef  = useRef<HTMLDivElement>(null);
  const brandContainerRef      = useRef<HTMLDivElement>(null);

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
  }, [filters, currentUser]);

  // ---------------------------------------------------------------------------
  // Pricelist code→brand lookup — only rebuilds when pricelist changes (not on filters)
  // ---------------------------------------------------------------------------
  const codeToBrand = useMemo(() => {
    const map: Record<string, string> = {};
    pricelist?.forEach(p => {
      if (p.Code && p.Brand) map[p.Code.trim().toLowerCase()] = p.Brand.trim();
    });
    return map;
  }, [pricelist]);

  // ---------------------------------------------------------------------------
  // Filter options for the filter bar — derived from all data sources
  // ---------------------------------------------------------------------------
  const filterOptions = useMemo(() => {
    const unique = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)));

    const allStatuses = [
      ...(projects?.map(p => p.Status)   || []),
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
  // Metric counters (quotesCount + saleOrdersCount) for the header cards
  // These are fast O(n) passes — fine to keep here
  // ---------------------------------------------------------------------------
  const lazyMetrics = useMemo(() => ({
    quotesCount:     (quotations  || []).filter(q  => q.Status === 'Open').length,
    saleOrdersCount: (saleOrders  || []).filter(so => so.Status === 'Pending').length,
  }), [quotations, saleOrders]);

  // ---------------------------------------------------------------------------
  // Chart data computations
  // ---------------------------------------------------------------------------
  const opData = useMemo(() => {
    const isAdmin = currentUser?.Role === 'Admin';
    const name    = currentUser?.Name;
    const canView = (u?: string, p?: string) => isAdmin || u === name || p === name;

    const counts = { Quotations: 0, SaleOrders: 0, Projects: 0, Invoices: 0, Meetings: 0 };
    quotations?.forEach(q  => { if (canView(q['Created By'], q['Prepared By'])  && ['Open', 'Pending'].includes(q.Status))              counts.Quotations++; });
    saleOrders?.forEach(so => { if (canView(so['Created By'], so['Prepared By']) && ['Pending', 'Processing'].includes(so.Status))        counts.SaleOrders++; });
    projects?.forEach(p    => { if ((isAdmin || p['Responsible By'] === name)    && !(p.Status || '').toLowerCase().includes('close'))    counts.Projects++; });
    invoices?.forEach(inv  => { if ((isAdmin || inv['Created By'] === name)      && ['Draft', 'Processing', 'Partial Paid'].includes(inv.Status)) counts.Invoices++; });
    return { pendingCounts: counts };
  }, [quotations, saleOrders, projects, invoices, currentUser]);

  const revenueData = useMemo(() => {
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

  const customerData = useMemo(() => {
    const items = (isB2B ? (projects || []) : (saleOrders || []))
      .filter(i => (i.Status || '').toLowerCase().includes('completed') || (i.Status || '').toLowerCase().includes('win'))
      .filter(passesFilters);
    const map: Record<string, number> = {};
    items.forEach(i => { const n = i['Company Name'] || 'Unknown'; map[n] = (map[n] || 0) + getBestValue(i); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [saleOrders, projects, isB2B, passesFilters]);

  const brandData = useMemo(() => {
    // codeToBrand is pre-built — no pricelist iteration here
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
        // Parse once per SO — result is consumed inline, no extra allocation
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

  const pipelineData = useMemo(() => {
    const counts: Record<string, number> = {};
    projects?.filter(passesFilters).forEach(p => { const s = p.Status || 'Active'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [projects, passesFilters]);

  // ---------------------------------------------------------------------------
  // Chart readiness
  // ---------------------------------------------------------------------------
  const pendingReady   = useChartReady(pendingContainerRef,   pendingChartRef,   [opData]);
  const revenueReady   = useChartReady(revenueContainerRef,   revenueChartRef,   [revenueData, revenuePeriod]);
  const pipelineReady  = useChartReady(pipelineContainerRef,  pipelineChartRef,  [pipelineData]);
  const customersReady = useChartReady(customersContainerRef, customersChartRef, [customerData]);
  const brandReady     = useChartReady(brandContainerRef,     brandChartRef,     [brandData]);

  // ---------------------------------------------------------------------------
  // Chart options
  // ---------------------------------------------------------------------------
  const CHART_BLUES = ['#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff'];

  const pendingOption = useMemo(() => ({
    tooltip: {
      trigger: 'item', borderRadius: 12, padding: [12, 16],
      formatter: (p: any) => `
        <div style="font-weight:700;margin-bottom:8px;opacity:0.6;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${p.name}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span style="font-weight:800;font-size:16px;">${p.value}</span>
          </div>
          <span style="color:#0d9488;font-size:12px;font-weight:700;background:rgba(13,148,136,0.1);padding:2px 8px;border-radius:6px;">${p.percent}%</span>
        </div>`
    },
    legend: { bottom: '2%', left: 'center', icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 14, textStyle: { fontSize: 11, fontWeight: '600', color: 'hsl(var(--muted-foreground))' } },
    series: [{
      type: 'pie', radius: ['64%', '80%'], center: ['50%', '42%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 2, borderColor: 'hsl(var(--card))', borderWidth: 1 },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
      data: [
        { value: opData.pendingCounts.Projects,   name: 'Projects',   itemStyle: { color: '#004aad' } },
        { value: opData.pendingCounts.Quotations,  name: 'Quotations',  itemStyle: { color: '#3077d3' } },
        { value: opData.pendingCounts.SaleOrders,  name: 'Orders',      itemStyle: { color: '#60a5fa' } },
        { value: opData.pendingCounts.Invoices,    name: 'Invoices',    itemStyle: { color: '#94a3b8' } },
        { value: opData.pendingCounts.Meetings,    name: 'Meetings',    itemStyle: { color: '#cbd5e1' } },
      ],
    }],
    graphic: [
      { type: 'text', left: 'center', top: '35%', style: { text: Object.values(opData.pendingCounts).reduce((a, b) => a + b, 0), fill: 'hsl(var(--foreground))', fontSize: 44, fontWeight: '900', textAlign: 'center' } },
      { type: 'text', left: 'center', top: '49%', style: { text: 'PENDING', fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: '700', letterSpacing: 2, textAlign: 'center' } },
    ],
  }), [opData]);

  const revenueOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'hsl(var(--border))',
      borderRadius: 12, padding: [12, 16], shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.05)',
      textStyle: { color: 'hsl(var(--foreground))', fontFamily: 'Inter, sans-serif' },
      formatter: (params: any) => `
        <div style="font-weight:700;margin-bottom:10px;opacity:0.6;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;">${params[0].name}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:28px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${params[0].color}"></span>
            <span style="font-weight:800;font-size:18px;letter-spacing:-0.5px;">${formatFullCurrency(params[0].value)}</span>
          </div>
        </div>`,
    },
    animationDuration: 1000, animationEasing: 'cubicOut',
    grid: { top: '18%', left: '4%', right: '4%', bottom: '12%', containLabel: true },
    xAxis: { type: 'category', data: revenueData.map(d => d.name), axisLabel: { color: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: '600', rotate: revenueData.length > 8 ? 30 : 0 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrency(v), color: 'hsl(var(--muted-foreground))', fontSize: 11 }, splitLine: { lineStyle: { type: 'dashed', color: 'hsl(var(--border))' } } },
    series: [{
      name: 'Revenue', type: 'bar', barWidth: '35%',
      itemStyle: { borderRadius: [6, 6, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#3077d3' }, { offset: 1, color: '#004aad' }]) },
      emphasis: { itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#60a5fa' }, { offset: 1, color: '#3077d3' }]) } },
      label: { show: true, position: 'top', formatter: (params: any) => (params.value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), fontSize: 11, fontWeight: 'bold', color: '#000000', fontFamily: 'Inter, sans-serif' },
      data: revenueData.map(d => d.val),
    }],
  }), [revenueData]);

  const customerOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'hsl(var(--border))',
      borderRadius: 12, padding: [12, 16], shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.05)',
      textStyle: { color: 'hsl(var(--foreground))', fontFamily: 'Inter, sans-serif' },
      formatter: (params: any) => `
        <div style="font-weight:700;margin-bottom:10px;opacity:0.6;font-size:11px;">${params[0].name}</div>
        <span style="font-weight:800;font-size:18px;">${formatFullCurrency(params[0].value)}</span>`,
    },
    animationDuration: 1000, animationEasing: 'cubicOut',
    grid: { left: '2%', right: '12%', bottom: '8%', top: '4%', containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrency(v), fontSize: 10, color: 'hsl(var(--muted-foreground))' } },
    yAxis: { type: 'category', data: customerData.map(d => d.name).reverse(), axisLabel: { fontSize: 11, fontWeight: '600', color: 'hsl(var(--foreground))', width: 120, overflow: 'truncate' } },
    series: [{
      name: 'Revenue', type: 'bar', barMaxWidth: 24,
      itemStyle: { borderRadius: [0, 6, 6, 0], color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [{ offset: 0, color: '#3077d3' }, { offset: 1, color: '#004aad' }]) },
      data: customerData.map(d => d.value).reverse(),
    }],
  }), [customerData]);

  const pipelineOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'hsl(var(--border))',
      borderRadius: 12, padding: [12, 16], shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.05)',
      textStyle: { color: 'hsl(var(--foreground))', fontFamily: 'Inter, sans-serif' },
      formatter: (p: any) => `
        <div style="font-weight:700;margin-bottom:10px;opacity:0.6;font-size:11px;">${p.name}</div>
        <span style="font-weight:800;font-size:18px;">${p.value}<span style="font-size:12px;opacity:0.5;margin-left:4px;">Deals</span></span>
        <span style="color:#0ea5e9;font-size:12px;font-weight:700;background:rgba(14,165,233,0.1);padding:4px 10px;border-radius:8px;margin-left:8px;">${p.percent}%</span>`,
    },
    animationDuration: 1000, animationEasing: 'cubicOut',
    legend: { bottom: '2%', left: 'center', icon: 'circle', itemWidth: 8, itemHeight: 8, type: 'scroll', textStyle: { fontSize: 11, fontWeight: '600', color: 'hsl(var(--muted-foreground))' } },
    series: [{
      type: 'pie', radius: ['64%', '80%'], center: ['50%', '42%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 2, borderColor: 'hsl(var(--card))', borderWidth: 1 },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
      data: pipelineData.map((d, i) => ({ ...d, itemStyle: { color: CHART_BLUES[i % 9] } })),
    }],
    graphic: [
      { type: 'text', left: 'center', top: '35%', style: { text: projects?.length || 0, fill: 'hsl(var(--foreground))', fontSize: 44, fontWeight: '900', textAlign: 'center' } },
      { type: 'text', left: 'center', top: '49%', style: { text: 'TOTAL', fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: '700', letterSpacing: 2, textAlign: 'center' } },
    ],
  }), [pipelineData, projects]);

  const brandOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'hsl(var(--border))',
      borderRadius: 12, padding: [12, 16], shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.05)',
      textStyle: { color: 'hsl(var(--foreground))', fontFamily: 'Inter, sans-serif' },
      formatter: (p: any) => `
        <div style="font-weight:700;margin-bottom:10px;opacity:0.6;font-size:11px;">${p.name}</div>
        <span style="font-weight:800;font-size:18px;">${formatFullCurrency(p.value)}</span>
        <span style="color:#0ea5e9;font-size:12px;font-weight:700;background:rgba(14,165,233,0.1);padding:4px 10px;border-radius:8px;margin-left:8px;">${p.percent}%</span>`,
    },
    animationDuration: 1000, animationEasing: 'cubicOut',
    legend: { bottom: '2%', left: 'center', icon: 'circle', itemWidth: 8, itemHeight: 8, type: 'scroll', textStyle: { fontSize: 11, fontWeight: '600', color: 'hsl(var(--muted-foreground))' } },
    series: [{
      type: 'pie', radius: ['64%', '80%'], center: ['50%', '42%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 2, borderColor: 'hsl(var(--card))', borderWidth: 1 },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
      data: brandData.map((d, i) => ({ ...d, itemStyle: { color: CHART_BLUES[i % 9] } })),
    }],
    graphic: [
      { type: 'text', left: 'center', top: '35%', style: { text: formatCurrency(brandData.reduce((a, b) => a + b.value, 0)), fill: 'hsl(var(--foreground))', fontSize: 24, fontWeight: '900', textAlign: 'center' } },
      { type: 'text', left: 'center', top: '46%', style: { text: 'TOTAL REV', fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: '700', letterSpacing: 2, textAlign: 'center' } },
    ],
  }), [brandData]);

  // Stable chart event handlers
  const revenueEvents = useMemo(() => ({
    click: (params: any) => {
      if (!params.name) return;
      if (revenuePeriod === 'monthly') {
        const [mShort, year] = params.name.split(' ');
        if (mShort && year) {
          setFilter('month', filters.month?.includes(mShort) ? [] : [mShort]);
          setFilter('year',  filters.year?.includes(year)   ? [] : [year]);
        }
      } else if (revenuePeriod === 'yearly') {
        setFilter('year', filters.year?.includes(params.name) ? [] : [params.name]);
      }
    },
  }), [revenuePeriod, filters.month, filters.year, setFilter]);

  const customerEvents = useMemo(() => ({
    click: (p: any) => setFilter('companyName', filters.companyName?.includes(p.name) ? [] : [p.name]),
  }), [filters.companyName, setFilter]);

  const pipelineEvents = useMemo(() => ({
    click: (p: any) => setFilter('status', filters.status?.includes(p.name) ? [] : [p.name]),
  }), [filters.status, setFilter]);

  const brandEvents = useMemo(() => ({
    click: (p: any) => setFilter('brand1', filters.brand1?.includes(p.name) ? [] : [p.name]),
  }), [filters.brand1, setFilter]);

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      {/* Filter bar */}
      <div className="sticky top-0 z-50">
        <DashboardFilterBar {...filterOptions} />
      </div>

      {/* Revenue */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <SectionHeader title="Revenue Insights" />
          <div className="ml-auto flex items-center gap-2">
            <DateRangePicker />
            <div className="bg-muted p-1 rounded-lg flex gap-1 flex-shrink-0 h-9 items-center">
              {(['monthly', 'quarterly', 'yearly'] as const).map(p => (
                <button key={p} onClick={() => setRevenuePeriod(p)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors capitalize ${revenuePeriod === p ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ChartCard
          title="Revenue Growth"
          description={isB2B ? 'Revenue from won pipelines over time.' : 'Revenue from completed sale orders over time.'}
          containerRef={revenueContainerRef} isReady={revenueReady} option={revenueOption} chartRef={revenueChartRef}
          onEvents={revenueEvents}
        />
      </div>

      {/* Core Analytics */}
      <div className="space-y-4">
        <SectionHeader title="Core Analytics" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title="Pending Distribution" description="Items currently awaiting action, by module." containerRef={pendingContainerRef} isReady={pendingReady} option={pendingOption} chartRef={pendingChartRef} />
          <ChartCard title="Top 10 Customers" description="Highest revenue-generating clients." containerRef={customersContainerRef} isReady={customersReady} option={customerOption} chartRef={customersChartRef} onEvents={customerEvents} />
        </div>
      </div>

      {/* Pipelines */}
      <div className="space-y-4">
        <SectionHeader title="Portfolio & Pipelines" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title="Pipeline Status" description="Distribution of all pipelines by current status." containerRef={pipelineContainerRef} isReady={pipelineReady} option={pipelineOption} chartRef={pipelineChartRef} onEvents={pipelineEvents} />
          <div style={{ height: '500px' }} className="overflow-hidden rounded-xl">
            <PendingWorks />
          </div>
        </div>
      </div>

      {/* Market */}
      <div className="space-y-4">
        <SectionHeader title="Market Intelligence" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title="Sales by Brand" description="Revenue distribution across product brands." containerRef={brandContainerRef} isReady={brandReady} option={brandOption} chartRef={brandChartRef} onEvents={brandEvents} />
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
