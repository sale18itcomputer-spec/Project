'use client';

import React, { useRef, useMemo, useCallback, useState } from 'react';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { ClipboardList, Download, Table, BarChart2 } from 'lucide-react';
import { limperialTheme, useChartReady } from '../echartsTheme';

echarts.registerTheme('limperial', limperialTheme);
const ECharts = ReactECharts as any;

export interface PendingCounts {
  Projects: number;
  Quotations: number;
  SaleOrders: number;
  Invoices: number;
  Meetings: number;
}

interface Props { data: PendingCounts; }

const SEGMENTS = [
  { key: 'Projects',   label: 'Projects',   color: '#1d4ed8' },
  { key: 'Quotations', label: 'Quotations', color: '#3b82f6' },
  { key: 'SaleOrders', label: 'Sale Orders',color: '#60a5fa' },
  { key: 'Invoices',   label: 'Invoices',   color: '#93c5fd' },
  { key: 'Meetings',   label: 'Meetings',   color: '#bfdbfe' },
] as const;

const PendingDistributionChart: React.FC<Props> = ({ data }) => {
  const chartRef     = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady      = useChartReady(containerRef, chartRef, [data]);
  const [showTable, setShowTable] = useState(false);

  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const topSegment = SEGMENTS.reduce((best, s) =>
    (data[s.key] ?? 0) > (data[best.key] ?? 0) ? s : best
  );

  const handleDownload = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const a = document.createElement('a'); a.href = url; a.download = 'pending-distribution.png'; a.click();
  }, []);

  // Horizontal stacked bar — one bar, each segment is a series
  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 14,
      padding: [14, 18],
      shadowBlur: 20,
      shadowColor: 'rgba(0,0,0,0.08)',
      textStyle: { color: '#1e293b', fontFamily: 'Inter, sans-serif' },
      formatter: (params: any[]) =>
        params.filter(p => p.value > 0).map(p => {
          const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0';
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span style="font-weight:600;font-size:12px;color:#475569;">${p.seriesName}</span>
            <span style="font-weight:800;font-size:13px;color:#0f172a;margin-left:auto;padding-left:16px;">${p.value}</span>
            <span style="font-weight:600;font-size:11px;color:#94a3b8;">${pct}%</span>
          </div>`;
        }).join(''),
    },
    animationDuration: 800,
    animationEasing: 'cubicOut',
    grid: { left: '2%', right: '2%', top: '8%', bottom: '18%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: 'hsl(var(--muted-foreground))', fontSize: 10 },
      splitLine: { lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.5 } },
    },
    yAxis: {
      type: 'category',
      data: ['Pending Items'],
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
    },
    legend: {
      bottom: 0,
      left: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 16,
      textStyle: { fontSize: 11, fontWeight: '600', color: 'hsl(var(--muted-foreground))' },
    },
    series: SEGMENTS.map((s, i) => ({
      name: s.label,
      type: 'bar',
      stack: 'total',
      barWidth: 48,
      itemStyle: {
        color: s.color,
        borderRadius: i === 0 ? [6, 0, 0, 6] : i === SEGMENTS.length - 1 ? [0, 6, 6, 0] : 0,
      },
      emphasis: { focus: 'series', itemStyle: { shadowBlur: 10, shadowColor: 'rgba(59,130,246,0.3)' } },
      label: {
        show: (data[s.key] ?? 0) > 0,
        position: 'inside',
        formatter: () => data[s.key] > 0 ? String(data[s.key]) : '',
        fontSize: 11,
        fontWeight: '700',
        color: s.key === 'Meetings' ? '#1d4ed8' : '#fff',
      },
      data: [data[s.key] ?? 0],
    })),
  }), [data, total]);

  const toolBtn = (active = false) =>
    `flex items-center justify-center w-7 h-7 rounded-lg border transition-all ${active
      ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
      : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/60'}`;

  return (
    <div className="bg-card rounded-2xl border shadow-sm flex flex-col overflow-hidden" style={{ height: showTable ? 'auto' : '500px' }}>
      <div className="h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-300 flex-shrink-0" />

      {/* Header */}
      <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-2 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">Pending Distribution</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Items awaiting action across all modules</p>
          </div>
          {total > 0 && (
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider">Highest</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: topSegment.color }} />
                <span className="text-sm font-bold text-foreground">{topSegment.label} ({data[topSegment.key]})</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Total + toolbar */}
      <div className="px-3 sm:px-6 pb-2 sm:pb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <span className="text-lg sm:text-2xl font-black text-foreground tracking-tight">{total}</span>
          <span className="ml-2 text-xs text-muted-foreground font-medium">total pending</span>
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
      <div className="px-2 flex-grow min-h-0 touch-pan-y" ref={containerRef} style={{ height: showTable ? '280px' : undefined }}>
        {total === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <ClipboardList className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm font-semibold">No pending items</p>
            <p className="text-xs text-muted-foreground/70">All caught up! 🎉</p>
          </div>
        ) : isReady ? (
          <ECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} theme="limperial" notMerge={true} lazyUpdate={false} />
        ) : (
          <div className="h-full flex items-center justify-center px-8">
            <div className="w-full h-12 bg-muted rounded-lg animate-pulse" />
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
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Module</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Count</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {SEGMENTS.map(s => (
                  <tr key={s.key} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="font-semibold text-foreground">{s.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-brand-600">{data[s.key] ?? 0}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${total > 0 ? ((data[s.key] ?? 0) / total) * 100 : 0}%`, background: s.color }} />
                        </div>
                        <span className="text-muted-foreground w-10 text-right">
                          {total > 0 ? `${(((data[s.key] ?? 0) / total) * 100).toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-4 py-2.5 font-black text-foreground uppercase text-[10px] tracking-wider">Total</td>
                  <td className="px-4 py-2.5 text-right font-black text-brand-600">{total}</td>
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

export default React.memo(PendingDistributionChart);
