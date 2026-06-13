'use client';

import React, { useRef, useMemo, useCallback, useState } from 'react';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, TrendingDown, Minus, Download, Table, LineChart } from 'lucide-react';
import { limperialTheme, useChartReady } from '../echartsTheme';

echarts.registerTheme('limperial', limperialTheme);
const ECharts = ReactECharts as any;

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export interface ConversionDataPoint {
  name: string;           // e.g. "Jan 2025"
  quotes: number;         // total quotations issued
  converted: number;      // won / converted to sale orders
  rate: number;           // conversion % (0‒100)
}

interface Props {
  data: ConversionDataPoint[];
}

function formatPct(val: number): string {
  return `${val.toFixed(1)}%`;
}

const QuoteConversionChart: React.FC<Props> = ({ data }) => {
  const chartRef     = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady      = useChartReady(containerRef, chartRef, [data]);
  const [showTable, setShowTable]   = useState(false);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const { avgRate, trend, totalQuotes, totalConverted } = useMemo(() => {
    const nonEmpty = data.filter(d => d.quotes > 0);
    const totalQuotes     = data.reduce((s, d) => s + d.quotes,     0);
    const totalConverted  = data.reduce((s, d) => s + d.converted,  0);
    const avgRate = totalQuotes > 0 ? (totalConverted / totalQuotes) * 100 : 0;

    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (nonEmpty.length >= 2) {
      const last = nonEmpty[nonEmpty.length - 1].rate;
      const prev = nonEmpty[nonEmpty.length - 2].rate;
      trend = last > prev ? 'up' : last < prev ? 'down' : 'flat';
    }
    return { avgRate, trend, totalQuotes, totalConverted };
  }, [data]);

  const handleDownload = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quote-conversion.png';
    a.click();
  }, []);

  // ── Chart option ───────────────────────────────────────────────────────────
  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: '#3b82f6', type: 'dashed' } },
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 14,
      padding: [14, 18],
      shadowBlur: 20,
      shadowColor: 'rgba(0,0,0,0.08)',
      textStyle: { color: '#1e293b', fontFamily: 'Inter, sans-serif', fontSize: 12 },
      formatter: (params: any[]) => {
        const period = params[0]?.name ?? '';
        const convP  = params.find(p => p.seriesName === 'Conversion Rate');
        const quotesP = params.find(p => p.seriesName === 'Quotes Issued');
        const wonP    = params.find(p => p.seriesName === 'Converted');
        return `
          <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:10px;">${period}</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
              <span style="display:flex;align-items:center;gap:6px;color:#64748b;font-size:11px;font-weight:600;">
                <span style="width:8px;height:8px;border-radius:50%;background:#1d4ed8;display:inline-block;"></span>
                Conversion Rate
              </span>
              <span style="font-weight:900;font-size:15px;color:#1d4ed8;">${formatPct(convP?.value ?? 0)}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
              <span style="display:flex;align-items:center;gap:6px;color:#64748b;font-size:11px;font-weight:600;">
                <span style="width:8px;height:8px;border-radius:50%;background:#93c5fd;display:inline-block;"></span>
                Quotes Issued
              </span>
              <span style="font-weight:700;color:#475569;">${quotesP?.value ?? 0}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
              <span style="display:flex;align-items:center;gap:6px;color:#64748b;font-size:11px;font-weight:600;">
                <span style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block;"></span>
                Converted
              </span>
              <span style="font-weight:700;color:#10b981;">${wonP?.value ?? 0}</span>
            </div>
          </div>`;
      },
    },
    legend: {
      bottom: 0,
      left: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 20,
      textStyle: { fontSize: 11, fontWeight: '600', color: 'hsl(var(--muted-foreground))' },
    },
    animationDuration: 900,
    animationEasing: 'cubicOut',
    grid: {
      top: '8%',
      left: '2%',
      right: '4%',
      bottom: '14%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'hsl(var(--muted-foreground))',
        fontSize: 10,
        fontWeight: '600',
        rotate: data.length > 8 ? 30 : 0,
        interval: 0,
      },
    },
    yAxis: [
      // Left: count axis (Quotes / Converted)
      {
        type: 'value',
        name: 'Count',
        nameTextStyle: { color: 'hsl(var(--muted-foreground))', fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: 'hsl(var(--muted-foreground))', fontSize: 10 },
        splitLine: { lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.6 } },
      },
      // Right: rate axis (%)
      {
        type: 'value',
        name: 'Rate %',
        min: 0,
        max: 100,
        nameTextStyle: { color: 'hsl(var(--muted-foreground))', fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          formatter: (v: number) => `${v}%`,
          color: '#1d4ed8',
          fontSize: 10,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      // Quotes Issued — bar (left axis)
      {
        name: 'Quotes Issued',
        type: 'bar',
        yAxisIndex: 0,
        barMaxWidth: 28,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#93c5fd' },
            { offset: 1, color: '#bfdbfe' },
          ]),
        },
        emphasis: { itemStyle: { color: '#60a5fa' } },
        data: data.map(d => d.quotes),
      },
      // Converted — bar overlay (left axis)
      {
        name: 'Converted',
        type: 'bar',
        yAxisIndex: 0,
        barMaxWidth: 28,
        barGap: '-100%', // sit on top of Quotes
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#34d399' },
            { offset: 1, color: '#10b981' },
          ]),
        },
        emphasis: { itemStyle: { color: '#6ee7b7' } },
        data: data.map(d => d.converted),
      },
      // Conversion Rate — line (right axis)
      {
        name: 'Conversion Rate',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3,
          color: '#1d4ed8',
          shadowBlur: 8,
          shadowColor: 'rgba(29,78,216,0.3)',
          shadowOffsetY: 4,
        },
        itemStyle: { color: '#1d4ed8', borderWidth: 2, borderColor: '#fff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(29,78,216,0.18)' },
            { offset: 1, color: 'rgba(29,78,216,0.01)' },
          ]),
        },
        emphasis: { itemStyle: { symbolSize: 9 } },
        data: data.map(d => parseFloat(d.rate.toFixed(1))),
      },
    ],
  }), [data]);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const toolBtn = (active = false) =>
    `flex items-center justify-center w-7 h-7 rounded-lg border transition-all ${
      active
        ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
        : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/60'
    }`;

  const hasData = data.some(d => d.quotes > 0);

  return (
    <div
      className="bg-card rounded-2xl border shadow-sm flex flex-col overflow-hidden"
      style={{ height: showTable ? 'auto' : '500px' }}
    >
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-brand-800 via-brand-500 to-emerald-400 flex-shrink-0" />

      {/* Header */}
      <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-2 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">Quote Conversion Rate</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Quotes issued vs. converted to orders by period</p>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold flex-shrink-0 ${
            trend === 'up'   ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
            trend === 'down' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' :
                               'bg-slate-100 text-slate-500 dark:bg-slate-800'
          }`}>
            <TrendIcon className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">
              {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI row + toolbar */}
      <div className="px-3 sm:px-6 pb-2 sm:pb-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <div>
            <span className="text-lg sm:text-2xl font-black text-brand-600 tracking-tight">
              {formatPct(avgRate)}
            </span>
            <span className="ml-1.5 text-xs text-muted-foreground font-medium">avg. conversion</span>
          </div>
          <div className="text-xs text-muted-foreground font-medium hidden sm:block">
            <span className="font-semibold text-foreground">{totalConverted}</span> won of{' '}
            <span className="font-semibold text-foreground">{totalQuotes}</span> quotes
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={handleDownload} title="Download PNG" className={toolBtn()}>
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowTable(v => !v)} title="Toggle Data Table" className={toolBtn(showTable)}>
            <Table className="w-3.5 h-3.5" />
          </button>
          <button disabled title="Line Chart" className={toolBtn(true)} style={{ cursor: 'default' }}>
            <LineChart className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div
        className="px-2 flex-grow min-h-0 touch-pan-y"
        ref={containerRef}
        style={{ height: showTable ? '300px' : undefined }}
      >
        {!hasData ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <LineChart className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm font-semibold">No conversion data yet</p>
            <p className="text-xs text-muted-foreground/60">
              Conversion rates will appear as quotations are issued and won.
            </p>
          </div>
        ) : isReady ? (
          <ECharts
            ref={chartRef}
            option={option}
            style={{ height: '100%', width: '100%' }}
            theme="limperial"
            notMerge={true}
            lazyUpdate={false}
          />
        ) : (
          <div className="h-full flex items-end gap-2 px-4 pb-8 pt-4 animate-pulse">
            {[30, 50, 40, 70, 55, 85, 65, 45, 75, 60, 80, 50].map((h, i) => (
              <div key={i} className="flex-1 bg-muted rounded-t-md" style={{ height: `${h}%` }} />
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
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Period</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Quotes</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Converted</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.name} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-foreground">{d.name}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{d.quotes}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{d.converted}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${d.rate}%`,
                              background: d.rate >= 60 ? '#10b981' : d.rate >= 30 ? '#3b82f6' : '#f59e0b',
                            }}
                          />
                        </div>
                        <span className={`font-bold w-12 text-right ${
                          d.rate >= 60 ? 'text-emerald-600' :
                          d.rate >= 30 ? 'text-blue-600' : 'text-amber-600'
                        }`}>
                          {formatPct(d.rate)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-4 py-2.5 font-black text-foreground uppercase text-[10px] tracking-wider">Total / Avg</td>
                  <td className="px-4 py-2.5 text-right font-bold text-foreground">{totalQuotes}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{totalConverted}</td>
                  <td className="px-4 py-2.5 text-right font-black text-brand-600">{formatPct(avgRate)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(QuoteConversionChart);
