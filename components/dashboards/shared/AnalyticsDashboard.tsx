'use client';

import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as echarts from 'echarts';
import { useB2BData } from "../../../hooks/useB2BData";
import { useAuth } from "../../../contexts/AuthContext";
import { limperialTheme, useChartReady } from "../../charts/echartsTheme";
import { Clock } from 'lucide-react';
import { useB2B } from "../../../contexts/B2BContext";
import { parseSheetValue } from "../../../utils/formatters";
import { useFilter } from "../../../contexts/FilterContext";
import PendingWorks from './PendingWorks';

// Must cast to any to avoid echarts-for-react type conflicts in strict mode
import ReactECharts from 'echarts-for-react';
const ECharts = ReactECharts as any;

// Register theme once, safely on client side
echarts.registerTheme('limperial', limperialTheme);

const AnalyticsDashboard: React.FC = () => {
    const { quotations, saleOrders, projects, invoices, pricelist, fetchModule } = useB2BData();
    const { currentUser } = useAuth();
    const { isB2B } = useB2B();
    const { filters } = useFilter();

    // --- Refs must be declared at top level (rules of hooks) ---
    const pendingChartRef   = useRef<any>(null);
    const revenueChartRef   = useRef<any>(null);
    const pipelineChartRef  = useRef<any>(null);
    const customersChartRef = useRef<any>(null);
    const brandChartRef     = useRef<any>(null);

    const pendingContainerRef   = useRef<HTMLDivElement>(null);
    const revenueContainerRef   = useRef<HTMLDivElement>(null);
    const pipelineContainerRef  = useRef<HTMLDivElement>(null);
    const customersContainerRef = useRef<HTMLDivElement>(null);
    const brandContainerRef     = useRef<HTMLDivElement>(null);

    const [revenuePeriod, setRevenuePeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

    useEffect(() => {
        fetchModule('Quotations', 'Sale Orders', 'Invoices', 'Meeting_Logs', 'Raw');
    }, [fetchModule]);

    // --- Formatters ---
    const formatCurrency = (val: number, currency: string = 'USD') => {
        const prefix = currency === 'KHR' ? '៛' : '$';
        if (Math.abs(val) >= 1000000) return `${prefix}${(val / 1000000).toFixed(1)}M`;
        if (Math.abs(val) >= 1000)    return `${prefix}${Math.round(val / 1000)}k`;
        return `${prefix}${val.toFixed(0)}`;
    };

    const formatFullCurrency = (value: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

    // Helper to get Best Date from a record
    const getBestDate = (item: any): Date | null => {
        const str = item['Created Date'] || item['SO Date'] || item['Inv Date'] || item['Due Date'] || item['Quote Date'] || item['order_date'] || item['created_at'];
        if (!str) return null;
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    };

    // Helper to get Best Value from a record
    const getBestValue = (item: any): number =>
        parseSheetValue(item['Bid Value']) ||
        parseSheetValue(item['Total Amount']) ||
        parseSheetValue(item['Amount']) ||
        parseSheetValue(item['Grand Total']) ||
        parseSheetValue(item['sub_total']) ||
        0;

    // Helper: check if a record passes active filters
    const passesFilters = (item: any): boolean => {
        const d = getBestDate(item);

        // Year filter (default to current year if no year is explicitly selected)
        const currentYear = new Date().getFullYear();
        if (d) {
            if (filters.year?.length) {
                if (!filters.year.includes(String(d.getFullYear()))) return false;
            } else {
                if (d.getFullYear() !== currentYear) return false;
            }
        }
        // Month filter (stored as short e.g. 'Jan')
        if (filters.month?.length && d) {
            const itemMonthShort = d.toLocaleDateString('en-US', { month: 'short' });
            if (!filters.month.includes(itemMonthShort)) return false;
        }
        // Date range
        if (filters.startDate && d) {
            if (d < new Date(filters.startDate)) return false;
        }
        if (filters.endDate && d) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            if (d > end) return false;
        }
        // Status filter
        if (filters.status?.length) {
            if (!filters.status.some(s => (item.Status || '').toLowerCase() === s.toLowerCase())) return false;
        }
        // Company filter
        if (filters.companyName?.length) {
            if (!filters.companyName.includes(item['Company Name'])) return false;
        }
        // Assignee filter
        if (filters.responsibleBy?.length) {
            const assignee = item['Responsible By'] || item['Created By'] || item['Prepared By'] || '';
            if (!filters.responsibleBy.includes(assignee)) return false;
        }
        return true;
    };

    // --- Data ---
    const opData = useMemo(() => {
        const canView = (u?: string, p?: string) =>
            currentUser?.Role === 'Admin' || u === currentUser?.Name || p === currentUser?.Name;

        const counts = { Quotations: 0, SaleOrders: 0, Projects: 0, Invoices: 0, Meetings: 0 };
        quotations?.forEach(q  => { if (canView(q['Created By'], q['Prepared By'])  && ['Open','Pending'].includes(q.Status)) counts.Quotations++; });
        saleOrders?.forEach(so => { if (canView(so['Created By'], so['Prepared By']) && ['Pending','Processing'].includes(so.Status)) counts.SaleOrders++; });
        projects?.forEach(p    => { if ((currentUser?.Role === 'Admin' || p['Responsible By'] === currentUser?.Name) && !(p.Status||'').toLowerCase().includes('close')) counts.Projects++; });
        invoices?.forEach(inv  => { if ((currentUser?.Role === 'Admin' || inv['Created By'] === currentUser?.Name) && ['Draft','Processing','Partial Paid'].includes(inv.Status)) counts.Invoices++; });
        return { pendingCounts: counts };
    }, [quotations, saleOrders, projects, invoices, currentUser]);

    const revenueData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // If no year filter is explicitly set, default to showing the current year
        // so all 12 months are always visible on load
        const activeYear = (filters.year?.length ? parseInt(filters.year[0]) : currentYear);

        // Pre-build skeleton so all slots appear even at $0
        const groups: Record<string, { val: number; count: number }> = {};

        if (revenuePeriod === 'monthly') {
            MONTH_SHORT.forEach(m => {
                groups[`${m} ${activeYear}`] = { val: 0, count: 0 };
            });
        } else if (revenuePeriod === 'quarterly') {
            ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
                groups[`${q} ${activeYear}`] = { val: 0, count: 0 };
            });
        }
        // yearly: no skeleton — only years with data are shown

        const items = (isB2B
            ? (projects  || []).filter(p  => (p.Status  || '').toLowerCase().includes('win'))
            : (saleOrders || []).filter(so => (so.Status || '').toLowerCase().includes('complete')))
            .filter(passesFilters);

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
            .sort((a, b) => {
                const parseKey = (k: string) => {
                    if (k.startsWith('Q')) {
                        const [q, y] = k.split(' ');
                        return new Date(`${y}-${['01','04','07','10'][parseInt(q[1]) - 1]}-01`);
                    }
                    return new Date(`1 ${k}`);
                };
                return parseKey(a.name).getTime() - parseKey(b.name).getTime();
            });
    }, [saleOrders, projects, revenuePeriod, isB2B, filters]);

    const customerData = useMemo(() => {
        const items = (isB2B ? (projects || []) : (saleOrders || []))
            .filter(i =>
                (i.Status || '').toLowerCase().includes('completed') ||
                (i.Status || '').toLowerCase().includes('win')
            )
            .filter(passesFilters);
        const map: Record<string, number> = {};
        items.forEach(i => {
            const name = i['Company Name'] || 'Unknown';
            map[name] = (map[name] || 0) + getBestValue(i);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
    }, [saleOrders, projects, isB2B, filters]);

    const brandData = useMemo(() => {
        // Build a fast itemCode -> Brand lookup from pricelist
        const codeToBarnd: Record<string, string> = {};
        pricelist?.forEach(p => {
            if (p.Code && p.Brand) codeToBarnd[p.Code.trim().toLowerCase()] = p.Brand.trim();
        });

        const map: Record<string, number> = {};

        if (isB2B) {
            // For B2B: use the Brand 1 field on the project itself
            (projects || []).filter(passesFilters).forEach(item => {
                const brand = (item as any)['Brand 1']?.trim() || (item as any)['Brand']?.trim() || 'Other';
                const val = getBestValue(item);
                if (val > 0) map[brand] = (map[brand] || 0) + val;
            });
        } else {
            // For B2C: parse each sale order's ItemsJSON for line items
            (saleOrders || []).filter(passesFilters).forEach(so => {
                if (!so.ItemsJSON) return;
                try {
                    const lineItems: any[] = typeof so.ItemsJSON === 'string'
                        ? JSON.parse(so.ItemsJSON)
                        : so.ItemsJSON;
                    if (!Array.isArray(lineItems)) return;

                    lineItems.forEach(li => {
                        const code = (li.itemCode || '').trim().toLowerCase();
                        // Lookup brand: first from pricelist by code, fallback to inline Brand field
                        const brand = codeToBarnd[code] || (li.Brand || li.brand || '').trim() || 'Other';
                        const amount = typeof li.amount === 'number' ? li.amount : parseFloat(li.amount) || 0;
                        if (amount > 0) map[brand] = (map[brand] || 0) + amount;
                    });
                } catch {}
            });
        }

        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [saleOrders, projects, pricelist, isB2B, filters]);

    const pipelineData = useMemo(() => {
        const counts: Record<string, number> = {};
        projects?.filter(passesFilters).forEach(p => { const s = p.Status || 'Active'; counts[s] = (counts[s] || 0) + 1; });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [projects, filters]);

    // --- Readiness (one hook per chart, at top level) ---
    const pendingReady   = useChartReady(pendingContainerRef,   pendingChartRef,   [opData]);
    const revenueReady   = useChartReady(revenueContainerRef,   revenueChartRef,   [revenueData, revenuePeriod]);
    const pipelineReady  = useChartReady(pipelineContainerRef,  pipelineChartRef,  [pipelineData]);
    const customersReady = useChartReady(customersContainerRef, customersChartRef, [customerData]);
    const brandReady     = useChartReady(brandContainerRef,     brandChartRef,     [brandData]);

    // --- CHART OPTIONS ---
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
                { value: opData.pendingCounts.Projects,    name: 'Projects',    itemStyle: { color: '#004aad' } },
                { value: opData.pendingCounts.Quotations,  name: 'Quotations',  itemStyle: { color: '#3077d3' } },
                { value: opData.pendingCounts.SaleOrders,  name: 'Orders',      itemStyle: { color: '#60a5fa' } },
                { value: opData.pendingCounts.Invoices,    name: 'Invoices',    itemStyle: { color: '#94a3b8' } },
                { value: opData.pendingCounts.Meetings,    name: 'Meetings',    itemStyle: { color: '#cbd5e1' } },
            ]
        }],
        graphic: [
            { type: 'text', left: 'center', top: '35%', style: { text: Object.values(opData.pendingCounts).reduce((a, b) => a + b, 0), fill: 'hsl(var(--foreground))', fontSize: 44, fontWeight: '900', textAlign: 'center' } },
            { type: 'text', left: 'center', top: '49%', style: { text: 'PENDING', fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: '700', letterSpacing: 2, textAlign: 'center' } }
        ]
    }), [opData]);

    const revenueOption = useMemo(() => ({
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' }, borderRadius: 12, padding: [12, 16],
            formatter: (params: any) => `
                <div style="font-weight:700;margin-bottom:8px;opacity:0.6;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${params[0].name}</div>
                <div style="font-weight:800;font-size:16px;">${formatFullCurrency(params[0].value)}</div>`
        },
        grid: { top: '18%', left: '4%', right: '4%', bottom: '12%', containLabel: true },
        xAxis: { type: 'category', data: revenueData.map(d => d.name), axisLabel: { color: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: '600', rotate: revenueData.length > 8 ? 30 : 0 } },
        yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrency(v), color: 'hsl(var(--muted-foreground))', fontSize: 11 }, splitLine: { lineStyle: { type: 'dashed', color: 'hsl(var(--border))' } } },
        series: [{
            name: 'Revenue', type: 'bar', barWidth: '35%',
            itemStyle: { borderRadius: [6, 6, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#3077d3' }, { offset: 1, color: '#004aad' }]) },
            emphasis: {
                label: { show: true },
                itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#60a5fa' }, { offset: 1, color: '#3077d3' }]) }
            },
            label: {
                show: true,
                position: 'top',
                formatter: (params: any) => {
                    const val: number = params.value ?? 0;
                    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                },
                fontSize: 11,
                fontWeight: 'bold',
                color: '#000000',
                fontFamily: 'Inter, sans-serif'
            },
            data: revenueData.map(d => d.val)
        }]
    }), [revenueData]);

    const customerOption = useMemo(() => ({
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' }, borderRadius: 12, padding: [12, 16],
            formatter: (params: any) => `
                <div style="font-weight:700;margin-bottom:8px;opacity:0.6;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${params[0].name}</div>
                <div style="font-weight:800;font-size:16px;">${formatFullCurrency(params[0].value)}</div>`
        },
        grid: { left: '2%', right: '12%', bottom: '8%', top: '4%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrency(v), fontSize: 10, color: 'hsl(var(--muted-foreground))' } },
        yAxis: { type: 'category', data: customerData.map(d => d.name).reverse(), axisLabel: { fontSize: 11, fontWeight: '600', color: 'hsl(var(--foreground))', width: 120, overflow: 'truncate' } },
        series: [{
            name: 'Revenue', type: 'bar', barMaxWidth: 24,
            itemStyle: { borderRadius: [0, 6, 6, 0], color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [{ offset: 0, color: '#3077d3' }, { offset: 1, color: '#004aad' }]) },
            data: customerData.map(d => d.value).reverse()
        }]
    }), [customerData]);

    const pipelineOption = useMemo(() => ({
        tooltip: {
            trigger: 'item', borderRadius: 12, padding: [12, 16],
            formatter: (p: any) => `
                <div style="font-weight:700;margin-bottom:8px;opacity:0.6;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${p.name}</div>
                <div style="font-weight:800;font-size:16px;">${p.value} Pipelines (${p.percent}%)</div>`
        },
        legend: { bottom: '2%', left: 'center', icon: 'circle', itemWidth: 8, itemHeight: 8, type: 'scroll', textStyle: { fontSize: 11, fontWeight: '600', color: 'hsl(var(--muted-foreground))' } },
        series: [{
            type: 'pie', radius: ['64%', '80%'], center: ['50%', '42%'], avoidLabelOverlap: false,
            itemStyle: { borderRadius: 2, borderColor: 'hsl(var(--card))', borderWidth: 1 },
            label: { show: false },
            emphasis: { scale: true, scaleSize: 4 },
            data: pipelineData
        }],
        graphic: [
            { type: 'text', left: 'center', top: '35%', style: { text: projects?.length || 0, fill: 'hsl(var(--foreground))', fontSize: 44, fontWeight: '900', textAlign: 'center' } },
            { type: 'text', left: 'center', top: '49%', style: { text: 'TOTAL', fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: '700', letterSpacing: 2, textAlign: 'center' } }
        ]
    }), [pipelineData, projects]);

    const brandOption = useMemo(() => ({
        tooltip: {
            trigger: 'item', borderRadius: 12, padding: [12, 16],
            formatter: (p: any) => `
                <div style="font-weight:700;margin-bottom:8px;opacity:0.6;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${p.name}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
                    <span style="font-weight:800;font-size:16px;">${formatFullCurrency(p.value)}</span>
                    <span style="color:#0d9488;font-size:12px;font-weight:700;background:rgba(13,148,136,0.1);padding:2px 8px;border-radius:6px;">${p.percent}%</span>
                </div>`
        },
        legend: { bottom: '2%', left: 'center', icon: 'circle', itemWidth: 8, itemHeight: 8, type: 'scroll', textStyle: { fontSize: 11, fontWeight: '600', color: 'hsl(var(--muted-foreground))' } },
        series: [{
            type: 'pie', radius: ['64%', '80%'], center: ['50%', '42%'], avoidLabelOverlap: false,
            itemStyle: { borderRadius: 2, borderColor: 'hsl(var(--card))', borderWidth: 1 },
            label: { show: false },
            emphasis: { scale: true, scaleSize: 4 },
            data: brandData
        }],
        graphic: [
            { type: 'text', left: 'center', top: '35%', style: { text: formatCurrency(brandData.reduce((a, b) => a + b.value, 0)), fill: 'hsl(var(--foreground))', fontSize: 24, fontWeight: '900', textAlign: 'center' } },
            { type: 'text', left: 'center', top: '46%', style: { text: 'TOTAL REV', fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: '700', letterSpacing: 2, textAlign: 'center' } }
        ]
    }), [brandData]);

    // --- UI Helpers ---
    const SectionHeader = ({ title }: { title: string }) => (
        <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-1 bg-primary rounded-full" />
            <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
        </div>
    );

    const ChartCard = ({ title, description, containerRef, isReady, option, chartRef }: {
        title: string; description: string;
        containerRef: React.RefObject<HTMLDivElement | null>;
        isReady: boolean; option: any;
        chartRef: React.RefObject<any>;
    }) => (
        <div className="bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden" style={{ height: '500px' }}>
            <div className="p-6 pb-0 flex-shrink-0">
                <h3 className="text-lg font-extrabold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
            <div className="p-4 flex-grow min-h-0" ref={containerRef}>
                {isReady && (
                    <ECharts
                        ref={chartRef}
                        option={option}
                        style={{ height: '100%', width: '100%' }}
                        theme="limperial"
                        notMerge={true}
                        lazyUpdate={false}
                    />
                )}
            </div>
        </div>
    );

    const PeriodToggle = () => (
        <div className="flex items-center gap-3 mb-4">
            <SectionHeader title="Revenue Insights" />
            <div className="ml-auto bg-muted p-1 rounded-lg flex gap-1 flex-shrink-0">
                {(['monthly', 'quarterly', 'yearly'] as const).map(p => (
                    <button key={p} onClick={() => setRevenuePeriod(p)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors capitalize ${revenuePeriod === p ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
                        {p}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            {/* Revenue */}
            <div className="space-y-4">
                <PeriodToggle />
                <ChartCard title="Revenue Growth" description={isB2B ? 'Revenue from won pipelines over time.' : 'Revenue from completed sale orders over time.'} containerRef={revenueContainerRef} isReady={revenueReady} option={revenueOption} chartRef={revenueChartRef} />
            </div>

            {/* Core Analytics */}
            <div className="space-y-4">
                <SectionHeader title="Core Analytics" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ChartCard title="Pending Distribution" description="Items currently awaiting action, by module." containerRef={pendingContainerRef} isReady={pendingReady} option={pendingOption} chartRef={pendingChartRef} />
                    <ChartCard title="Top 10 Customers" description="Highest revenue-generating clients." containerRef={customersContainerRef} isReady={customersReady} option={customerOption} chartRef={customersChartRef} />
                </div>
            </div>

            {/* Pipelines */}
            <div className="space-y-4">
                <SectionHeader title="Portfolio & Pipelines" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ChartCard title="Pipeline Status" description="Distribution of all pipelines by current status." containerRef={pipelineContainerRef} isReady={pipelineReady} option={pipelineOption} chartRef={pipelineChartRef} />
                    <div style={{ height: '500px' }} className="overflow-hidden rounded-xl">
                        <PendingWorks />
                    </div>
                </div>
            </div>

            {/* Market */}
            <div className="space-y-4">
                <SectionHeader title="Market Intelligence" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ChartCard title="Sales by Brand" description="Revenue distribution across product brands." containerRef={brandContainerRef} isReady={brandReady} option={brandOption} chartRef={brandChartRef} />
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
