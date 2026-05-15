'use client';

import React, { useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { limperialTheme, useChartReady } from '../echartsTheme';

echarts.registerTheme('limperial', limperialTheme);
const ECharts = ReactECharts as any;

export interface RevenueDataPoint {
  name: string;
  val: number;
  count: number;
}

interface Props {
  data: RevenueDataPoint[];
  onBarClick?: (name: string) => void;
}

function formatCurrency(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
  return `$${val.toFixed(0)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const RevenueGrowthChart: React.FC<Props> = ({ data, onBarClick }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady = useChartReady(containerRef, chartRef, [data]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const { total, peak, trend } = useMemo(() => {
    const nonZero = data.filter(d => d.val > 0);
    const total = data.reduce((s, d) => s + d.val, 0);
    const peak = nonZero.length ? nonZero.reduce((a, b) => b.val > a.val ? b : a) : null;

    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (nonZero.length >= 2) {
      const last  = nonZero[nonZero.length - 1].val;
      const prev  = nonZero[nonZero.length - 2].val;
      trend = last > prev ? 'up' : last < prev ? 'down' : 'flat';
    }
    return { total, peak, trend };
  }, [data]);

  const peakIdx = peak ? data.findIndex(d => d.name === peak.name) : -1;

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
      textStyle: { color: '#1e293b', fontFamily: 'Inter, sans-serif', fontSize: 13 },
      formatter: (params: any) => {
        const p = params[0];
        const d = data[p.dataIndex];
        return `
          <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:10px;">${p.name}</div>
          <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px;">
            <span style="font-weight:900;font-size:22px;color:#0f172a;letter-spacing:-1px;">${formatFullCurrency(p.value)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#f8fafc;border-radius:8px;margin-top:6px;">
            <span style="font-size:11px;color:#64748b;font-weight:600;">Orders closed:</span>
            <span style="font-weight:800;color:#3b82f6;font-size:13px;">${d?.count ?? 0}</span>
          </div>`;
      },
    },
    animationDuration: 800,
    animationEasing: 'cubicOut',
    animationDelay: (idx: number) => idx * 30,
    grid: { top: '8%', left: '2%', right: '2%', bottom: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'hsl(var(--muted-foreground))',
        fontSize: 11,
        fontWeight: '600',
        rotate: data.length > 8 ? 30 : 0,
        interval: 0,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        formatter: (v: number) => formatCurrency(v),
        color: 'hsl(var(--muted-foreground))',
        fontSize: 11,
      },
      splitLine: { lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.6 } },
    },
    series: [
      {
        name: 'Revenue',
        type: 'bar',
        barWidth: '45%',
        barMaxWidth: 52,
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: (params: any) => {
            if (params.dataIndex === peakIdx) {
              return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#f59e0b' },
                { offset: 1, color: '#d97706' },
              ]);
            }
            return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#60a5fa' },
              { offset: 1, color: '#1d4ed8' },
            ]);
          },
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#93c5fd' },
              { offset: 1, color: '#3b82f6' },
            ]),
            shadowBlur: 12,
            shadowColor: 'rgba(59,130,246,0.4)',
          },
        },
        label: {
          show: false,
        },
        data: data.map(d => d.val),
      },
      {
        // Trend line overlay
        name: 'Trend',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' },
        itemStyle: { color: '#f59e0b', borderWidth: 2, borderColor: '#fff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245,158,11,0.12)' },
            { offset: 1, color: 'rgba(245,158,11,0)' },
          ]),
        },
        data: data.map(d => d.val),
        z: 2,
      },
    ],
  }), [data, peakIdx]);

  const onEvents = useMemo(() => ({
    click: (params: any) => onBarClick?.(params.name),
  }), [onBarClick]);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-slate-400';

  return (
    <div className="bg-card rounded-2xl border shadow-sm flex flex-col overflow-hidden" style={{ height: 'clamp(320px, 50vw, 500px)' }}>
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-amber-400 flex-shrink-0" />

      <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-2 sm:pb-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">Revenue Growth</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {data[0]?.name?.split(' ').pop()} closed orders revenue
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {peak && (
              <div className="text-right hidden xs:block">
                <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Peak</p>
                <p className="text-xs font-bold text-foreground">{peak.name}</p>
              </div>
            )}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
              trend === 'up' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
              trend === 'down' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' :
              'bg-slate-100 text-slate-500 dark:bg-slate-800'
            }`}>
              <TrendIcon className="w-3 h-3" />
              <span className="hidden sm:inline">{trend === 'up' ? 'Trending Up' : trend === 'down' ? 'Trending Down' : 'Stable'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Total revenue stat */}
      <div className="px-3 sm:px-6 pb-2 sm:pb-3 flex-shrink-0">
        <span className="text-lg sm:text-2xl font-black text-foreground tracking-tight">{formatFullCurrency(total)}</span>
        <span className="ml-2 text-xs text-muted-foreground font-medium">total this period</span>
      </div>

      <div className="px-2 flex-grow min-h-0 touch-pan-y" ref={containerRef}>
        {isReady ? (
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
          <div className="h-full flex items-end gap-2 px-4 pb-8 pt-4 animate-pulse">
            {[40, 65, 45, 80, 55, 90, 70, 50, 75, 60, 85, 45].map((h, i) => (
              <div key={i} className="flex-1 bg-muted rounded-t-md" style={{ height: `${h}%` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(RevenueGrowthChart);
