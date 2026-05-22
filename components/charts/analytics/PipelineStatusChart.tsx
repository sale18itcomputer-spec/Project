'use client';

import React, { useRef, useMemo, useCallback, useState } from 'react';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { Layers, Download, Table, BarChart2 } from 'lucide-react';
import { limperialTheme, useChartReady } from '../echartsTheme';

echarts.registerTheme('limperial', limperialTheme);
const ECharts = ReactECharts as any;

const PALETTE = [
  '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa',
  '#93c5fd', '#1e3a8a', '#1e40af', '#334155', '#475569',
];

export interface PipelineDataPoint {
  name: string;
  value: number;
}

interface Props {
  data: PipelineDataPoint[];
  totalProjects: number;
  onSliceClick?: (name: string) => void;
}

const PipelineStatusChart: React.FC<Props> = ({ data, totalProjects, onSliceClick }) => {
  const chartRef     = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady      = useChartReady(containerRef, chartRef, [data]);
  const [showTable, setShowTable] = useState(false);

  const sorted      = useMemo(() => [...data].sort((a, b) => b.value - a.value), [data]);
  const total       = data.reduce((s, d) => s + d.value, 0);
  const topStatus   = sorted[0] ?? null;
  const activeCount = data.filter(d => !d.name.toLowerCase().includes('close')).reduce((s, d) => s + d.value, 0);

  const handleDownload = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const a = document.createElement('a'); a.href = url; a.download = 'pipeline-status.png'; a.click();
  }, []);

  // Horizontal bar chart sorted descending
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
        const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0';
        return `
          <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;">${p.name}</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-weight:900;font-size:26px;color:#0f172a;">${p.value}</span>
            <span style="font-size:13px;color:#94a3b8;font-weight:500;">deals</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:#eff6ff;border-radius:8px;margin-top:8px;">
            <span style="font-size:11px;color:#64748b;font-weight:600;">Share:</span>
            <span style="font-weight:800;color:#1d4ed8;font-size:13px;">${pct}%</span>
          </div>`;
      },
    },
    animationDuration: 800,
    animationEasing: 'cubicOut',
    animationDelay: (idx: number) => idx * 40,
    grid: { left: '2%', right: '12%', top: '3%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: 'hsl(var(--muted-foreground))', fontSize: 10 },
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
        width: 120,
        overflow: 'truncate',
      },
    },
    series: [{
      name: 'Deals',
      type: 'bar',
      barMaxWidth: 24,
      itemStyle: {
        borderRadius: [0, 8, 8, 0],
        color: (params: any) => {
          const opacity = 1 - (params.dataIndex / sorted.length) * 0.55;
          return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: `rgba(59,130,246,${opacity})` },
            { offset: 1, color: `rgba(29,78,216,${opacity})` },
          ]);
        },
      },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(59,130,246,0.3)' } },
      label: {
        show: true,
        position: 'right',
        distance: 8,
        formatter: (p: any) => p.value,
        fontSize: 11,
        fontWeight: '700',
        color: 'hsl(var(--muted-foreground))',
      },
      data: sorted.map(d => d.value).reverse(),
    }],
  }), [sorted, total]);

  const onEvents = useMemo(() => ({
    click: (p: any) => onSliceClick?.(p.name),
  }), [onSliceClick]);

  const toolBtn = (active = false) =>
    `flex items-center justify-center w-7 h-7 rounded-lg border transition-all ${active
      ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
      : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/60'}`;

  return (
    <div className="bg-card rounded-2xl border shadow-sm flex flex-col overflow-hidden" style={{ height: showTable ? 'auto' : '500px' }}>
      <div className="h-1 bg-gradient-to-r from-blue-900 via-blue-600 to-blue-400 flex-shrink-0" />

      {/* Header */}
      <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-2 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">Pipeline Status</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Distribution of all deals by current stage</p>
          </div>
          {topStatus && (
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Most Common</span>
              <span className="text-sm font-bold text-foreground">{topStatus.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats + toolbar */}
      <div className="px-3 sm:px-6 pb-2 sm:pb-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 rounded-full">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{totalProjects}</span>
            <span className="text-[10px] text-blue-500 font-semibold">Total</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-full">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{activeCount}</span>
            <span className="text-[10px] text-emerald-500 font-semibold">Active</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full">
            <span className="text-xs font-bold text-foreground">{totalProjects - activeCount}</span>
            <span className="text-[10px] text-muted-foreground font-semibold">Closed</span>
          </div>
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
            <Layers className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm font-semibold">No pipeline data</p>
            <p className="text-xs text-muted-foreground/60">Pipeline stages will appear here.</p>
          </div>
        ) : isReady ? (
          <ECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} theme="limperial" onEvents={onEvents} notMerge={true} lazyUpdate={false} />
        ) : (
          <div className="h-full flex flex-col justify-center gap-2.5 px-4 py-6 animate-pulse">
            {[85, 65, 55, 45, 35, 28].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-20 h-3 bg-muted rounded" />
                <div className="h-5 bg-muted rounded-r-full" style={{ width: `${w}%` }} />
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
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Deals</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d, i) => (
                  <tr key={d.name} className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onSliceClick?.(d.name)}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                        <span className="font-semibold text-foreground">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-600">{d.value}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${total > 0 ? (d.value / total) * 100 : 0}%` }} />
                        </div>
                        <span className="text-muted-foreground w-10 text-right">
                          {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-4 py-2.5 font-black text-foreground uppercase text-[10px] tracking-wider">Total</td>
                  <td className="px-4 py-2.5 text-right font-black text-blue-600">{total}</td>
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

export default React.memo(PipelineStatusChart);
