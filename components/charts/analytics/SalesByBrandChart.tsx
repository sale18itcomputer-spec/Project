'use client';

import React, { useRef, useMemo, useCallback, useState } from 'react';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { Tag, Download, Table, BarChart2 } from 'lucide-react';
import { limperialTheme, useChartReady } from '../echartsTheme';

echarts.registerTheme('limperial', limperialTheme);
const ECharts = ReactECharts as any;

// Rich blue palette — same family as the other charts
const PALETTE = [
  '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa',
  '#93c5fd', '#1e3a8a', '#1e40af', '#334155', '#475569',
];

export interface BrandDataPoint {
  name: string;
  value: number;
}

interface Props {
  data: BrandDataPoint[];
  onSliceClick?: (name: string) => void;
}

function formatCurrency(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000)     return `$${(val / 1_000).toFixed(1)}k`;
  return `$${val.toFixed(0)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const SalesByBrandChart: React.FC<Props> = ({ data, onSliceClick }) => {
  const chartRef     = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady      = useChartReady(containerRef, chartRef, [data]);
  const [showTable, setShowTable] = useState(false);

  const sorted       = useMemo(() => [...data].sort((a, b) => b.value - a.value), [data]);
  const totalRevenue = useMemo(() => data.reduce((a, b) => a + b.value, 0), [data]);
  const topBrand     = sorted[0] ?? null;
  const topShare     = topBrand && totalRevenue > 0
    ? ((topBrand.value / totalRevenue) * 100).toFixed(1)
    : '0';

  const handleDownload = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const a = document.createElement('a'); a.href = url; a.download = 'sales-by-brand.png'; a.click();
  }, []);

  // Horizontal bar chart — same layout as Top Customers / Pipeline Status
  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(59,130,246,0.06)' } },
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 14,
      padding: [14, 18],
      shadowBlur: 20,
      shadowColor: 'rgba(0,0,0,0.08)',
      textStyle: { color: '#1e293b', fontFamily: 'Inter, sans-serif' },
      formatter: (params: any) => {
        const p = params[0];
        const pct = totalRevenue > 0 ? ((p.value / totalRevenue) * 100).toFixed(1) : '0';
        return `
          <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;">${p.name}</div>
          <div style="font-weight:900;font-size:22px;color:#0f172a;letter-spacing:-1px;margin-bottom:8px;">${formatFullCurrency(p.value)}</div>
          <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:#eff6ff;border-radius:8px;">
            <span style="font-size:11px;color:#64748b;font-weight:600;">Market share:</span>
            <span style="font-weight:800;color:#1d4ed8;font-size:13px;">${pct}%</span>
          </div>`;
      },
    },
    animationDuration: 800,
    animationEasing: 'cubicOut',
    animationDelay: (idx: number) => idx * 40,
    grid: { left: '2%', right: '16%', top: '3%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        formatter: (v: number) => formatCurrency(v),
        fontSize: 10,
        color: 'hsl(var(--muted-foreground))',
      },
      splitLine: { lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.6 } },
    },
    yAxis: {
      type: 'category',
      data: sorted.map(d => d.name).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'hsl(var(--foreground))',
        width: 110,
        overflow: 'truncate',
      },
    },
    series: [{
      name: 'Revenue',
      type: 'bar',
      barMaxWidth: 22,
      itemStyle: {
        borderRadius: [0, 8, 8, 0],
        color: (params: any) => {
          // Top brand gets amber to match Top Customers chart
          if (params.dataIndex === sorted.length - 1) {
            return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
              { offset: 0, color: '#f59e0b' },
              { offset: 1, color: '#d97706' },
            ]);
          }
          const opacity = 1 - (params.dataIndex / sorted.length) * 0.5;
          return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: `rgba(96,165,250,${opacity})` },
            { offset: 1, color: `rgba(29,78,216,${opacity})` },
          ]);
        },
      },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(59,130,246,0.3)' } },
      label: {
        show: true,
        position: 'right',
        distance: 8,
        formatter: (params: any) => formatCurrency(params.value),
        fontSize: 10,
        fontWeight: '700',
        color: 'hsl(var(--muted-foreground))',
      },
      data: sorted.map((d, i) => ({
        value: d.value,
        label: i === sorted.length - 1
          ? { show: true, position: 'insideLeft', formatter: '  #1', color: '#fff', fontWeight: '900', fontSize: 11 }
          : {},
      })).reverse(),
    }],
  }), [sorted, totalRevenue]);

  const onEvents = useMemo(() => ({
    click: (p: any) => onSliceClick?.(p.name),
  }), [onSliceClick]);

  const toolBtn = (active = false) =>
    `flex items-center justify-center w-7 h-7 rounded-lg border transition-all ${active
      ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
      : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/60'}`;

  return (
    <div className="bg-card rounded-2xl border shadow-sm flex flex-col overflow-hidden" style={{ height: showTable ? 'auto' : '500px' }}>
      <div className="h-1 bg-gradient-to-r from-blue-800 via-blue-500 to-amber-400 flex-shrink-0" />

      {/* Header */}
      <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-2 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">Sales by Brand</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Revenue distribution across product brands</p>
          </div>
          {topBrand && (
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">🥇 Top Brand</span>
              <span className="text-sm font-bold text-foreground truncate max-w-[120px] text-right">{topBrand.name}</span>
              <span className="text-[11px] text-muted-foreground">{topShare}% share</span>
            </div>
          )}
        </div>
      </div>

      {/* Total + toolbar */}
      <div className="px-3 sm:px-6 pb-2 sm:pb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <span className="text-lg sm:text-2xl font-black text-foreground tracking-tight">{formatFullCurrency(totalRevenue)}</span>
          <span className="ml-2 text-xs text-muted-foreground font-medium">total revenue · {data.length} brand{data.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleDownload} title="Download PNG" className={toolBtn()}>
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowTable(v => !v)} title="Toggle Data Table" className={toolBtn(showTable)}>
            <Table className="w-3.5 h-3.5" />
          </button>
          <button disabled title="Bar Chart" className={toolBtn(true)} style={{ cursor: 'default' }}>
            <BarChart2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 flex-grow min-h-0 touch-pan-y" ref={containerRef} style={{ height: showTable ? '320px' : undefined }}>
        {data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Tag className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm font-semibold">No brand data yet</p>
            <p className="text-xs text-muted-foreground/60">Brand revenue will appear as sale orders are placed.</p>
          </div>
        ) : isReady ? (
          <ECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} theme="limperial" onEvents={onEvents} notMerge={true} lazyUpdate={false} />
        ) : (
          <div className="h-full flex flex-col justify-center gap-2.5 px-4 py-6 animate-pulse">
            {[90, 75, 65, 55, 45, 38, 30, 24, 18].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-20 h-3 bg-muted rounded" />
                <div className="h-4 bg-muted rounded-r-full" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data table */}
      {showTable && (
        <div className="px-3 sm:px-6 pb-4 pt-2 flex-shrink-0 border-t border-border">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Rank</th>
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Brand</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Revenue</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d, i) => (
                  <tr key={d.name} className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onSliceClick?.(d.name)}>
                    <td className="px-4 py-2.5 font-bold text-muted-foreground">
                      {i === 0 ? <span className="text-amber-500">🥇 #1</span> : <span>#{i + 1}</span>}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-foreground">{d.name}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-600">{formatFullCurrency(d.value)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalRevenue > 0 ? (d.value / totalRevenue) * 100 : 0}%` }} />
                        </div>
                        <span className="text-muted-foreground w-10 text-right">
                          {totalRevenue > 0 ? `${((d.value / totalRevenue) * 100).toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-4 py-2.5 font-black text-foreground uppercase text-[10px] tracking-wider" colSpan={2}>Total</td>
                  <td className="px-4 py-2.5 text-right font-black text-blue-600">{formatFullCurrency(totalRevenue)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-muted-foreground">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesByBrandChart);
