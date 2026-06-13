'use client';

import React, { useRef, useMemo, useCallback, useState } from 'react';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { Users, Download, Table, BarChart2 } from 'lucide-react';
import { limperialTheme, useChartReady } from '../echartsTheme';

echarts.registerTheme('limperial', limperialTheme);
const ECharts = ReactECharts as any;

export interface CustomerDataPoint {
  name: string;
  value: number;
}

interface Props {
  data: CustomerDataPoint[];
  onBarClick?: (name: string) => void;
}

function formatCurrency(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000)     return `$${(val / 1_000).toFixed(1)}k`;
  return `$${val.toFixed(0)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const AnalyticsTopCustomersChart: React.FC<Props> = ({ data, onBarClick }) => {
  const chartRef     = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady      = useChartReady(containerRef, chartRef, [data]);
  const [showTable, setShowTable] = useState(false);

  const totalValue = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);
  const topCustomer = data[0] ?? null;

  const handleDownload = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'top-customers.png';
    a.click();
  }, []);

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
        const pct = totalValue > 0 ? ((p.value / totalValue) * 100).toFixed(1) : '0';
        const rank = data.length - p.dataIndex;
        return `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="font-size:14px;font-weight:900;color:#1d4ed8;">#${rank}</span>
            <span style="font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;">${p.name}</span>
          </div>
          <div style="font-weight:900;font-size:22px;color:#0f172a;letter-spacing:-1px;margin-bottom:8px;">${formatFullCurrency(p.value)}</div>
          <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:#eff6ff;border-radius:8px;">
            <span style="font-size:11px;color:#64748b;font-weight:600;">Share of total:</span>
            <span style="font-weight:800;color:#1d4ed8;font-size:13px;">${pct}%</span>
          </div>`;
      },
    },
    animationDuration: 800,
    animationEasing: 'cubicOut',
    animationDelay: (idx: number) => (data.length - 1 - idx) * 40,
    grid: { left: '2%', right: '14%', bottom: '5%', top: '3%', containLabel: true },
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
      data: data.map(d => d.name).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'hsl(var(--foreground))',
        width: 130,
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
          // Top customer (#1) = amber gradient, rest = blue gradient fading down
          if (params.dataIndex === data.length - 1) {
            return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
              { offset: 0, color: '#f59e0b' },
              { offset: 1, color: '#d97706' },
            ]);
          }
          const opacity = 1 - (params.dataIndex / data.length) * 0.5;
          return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: `rgba(96,165,250,${opacity})` },
            { offset: 1, color: `rgba(29,78,216,${opacity})` },
          ]);
        },
      },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(59,130,246,0.3)' },
      },
      label: {
        show: true,
        position: 'right',
        distance: 8,
        formatter: (params: any) => formatCurrency(params.value),
        fontSize: 10,
        fontWeight: '700',
        color: 'hsl(var(--muted-foreground))',
      },
      data: data.map((d, i) => ({
        value: d.value,
        label: i === data.length - 1
          ? { show: true, position: 'insideLeft', formatter: '  #1', color: '#fff', fontWeight: '900', fontSize: 11 }
          : {},
      })).reverse(),
    }],
  }), [data, totalValue]);

  const onEvents = useMemo(() => ({
    click: (p: any) => onBarClick?.(p.name),
  }), [onBarClick]);

  // Shared toolbar button style — identical to RevenueGrowthChart
  const toolBtn = (active = false) =>
    `flex items-center justify-center w-7 h-7 rounded-lg border transition-all ${
      active
        ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
        : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/60'
    }`;

  return (
    <div
      className="bg-card rounded-2xl border shadow-sm flex flex-col overflow-hidden"
      style={{ height: showTable ? 'auto' : '500px' }}
    >
      {/* ── Top accent bar — matches Revenue Growth (blue only) ── */}
      <div className="h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-amber-400 flex-shrink-0" />

      {/* ── Header row ── */}
      <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-2 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">Top 10 Customers</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Highest-value clients by closed revenue</p>
          </div>
          {/* #1 client badge — matches trend badge position in RevenueGrowthChart */}
          {topCustomer && (
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">🥇 #1 Client</span>
              <span className="text-sm font-bold text-foreground truncate max-w-[120px] text-right">{topCustomer.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Total + toolbar row — mirrors RevenueGrowthChart exactly ── */}
      <div className="px-3 sm:px-6 pb-2 sm:pb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <span className="text-lg sm:text-2xl font-black text-foreground tracking-tight">
            {formatFullCurrency(totalValue)}
          </span>
          <span className="ml-2 text-xs text-muted-foreground font-medium">combined revenue</span>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1">
          <button onClick={handleDownload} title="Download PNG" className={toolBtn()}>
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowTable(v => !v)}
            title="Toggle Data Table"
            className={toolBtn(showTable)}
          >
            <Table className="w-3.5 h-3.5" />
          </button>
          <button disabled title="Bar Chart" className={toolBtn(true)} style={{ cursor: 'default' }}>
            <BarChart2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Chart ── */}
      <div
        className="px-2 flex-grow min-h-0 touch-pan-y"
        ref={containerRef}
        style={{ height: showTable ? '320px' : undefined }}
      >
        {data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Users className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm font-semibold">No customer data yet</p>
            <p className="text-xs text-muted-foreground/60">Revenue will appear as orders are completed.</p>
          </div>
        ) : isReady ? (
          <ECharts
            ref={chartRef}
            option={option}
            style={{ height: '100%', width: '100%' }}
            theme="limperial"
            onEvents={onEvents}
            notMerge={true}
            lazyUpdate={false}
          />
        ) : (
          <div className="h-full flex flex-col justify-center gap-2.5 px-4 py-6 animate-pulse">
            {[90, 75, 65, 60, 50, 45, 40, 35, 30, 25].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-24 h-3 bg-muted rounded" />
                <div className="h-4 bg-muted rounded-r-full" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Data table — same structure as RevenueGrowthChart ── */}
      {showTable && (
        <div className="px-3 sm:px-6 pb-4 pt-2 flex-shrink-0 border-t border-border">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Rank</th>
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Customer</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Revenue</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr
                    key={d.name}
                    className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => onBarClick?.(d.name)}
                  >
                    <td className="px-4 py-2.5 font-bold text-muted-foreground">
                      {i === 0 ? (
                        <span className="text-amber-500">🥇 #1</span>
                      ) : (
                        <span>#{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-foreground">{d.name}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-brand-600">{formatFullCurrency(d.value)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full"
                            style={{ width: `${totalValue > 0 ? (d.value / totalValue) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground w-10 text-right">
                          {totalValue > 0 ? `${((d.value / totalValue) * 100).toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-4 py-2.5 font-black text-foreground uppercase text-[10px] tracking-wider" colSpan={2}>Total</td>
                  <td className="px-4 py-2.5 text-right font-black text-brand-600">{formatFullCurrency(totalValue)}</td>
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

export default React.memo(AnalyticsTopCustomersChart);
