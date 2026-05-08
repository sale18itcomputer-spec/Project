'use client';

import React, { useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { Users } from 'lucide-react';
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
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
  return `$${val.toFixed(0)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const AnalyticsTopCustomersChart: React.FC<Props> = ({ data, onBarClick }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady = useChartReady(containerRef, chartRef, [data]);

  const totalValue = data.reduce((s, d) => s + d.value, 0);
  const topCustomer = data[0] ?? null;

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
        const rank = data.findIndex(d => d.name === p.name) + 1;
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
          // Top customer gets special gold gradient
          if (params.dataIndex === data.length - 1) {
            return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
              { offset: 0, color: '#f59e0b' },
              { offset: 1, color: '#d97706' },
            ]);
          }
          const opacity = 1 - (params.dataIndex / data.length) * 0.5;
          return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: `rgba(59,130,246,${opacity})` },
            { offset: 1, color: `rgba(29,78,216,${opacity})` },
          ]);
        },
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(59,130,246,0.3)',
        },
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
        // Rank label on the left
        label: i === data.length - 1
          ? { show: true, position: 'insideLeft', formatter: '  #1', color: '#fff', fontWeight: '900', fontSize: 11 }
          : {},
      })).reverse(),
    }],
  }), [data, totalValue]);

  const onEvents = useMemo(() => ({
    click: (p: any) => onBarClick?.(p.name),
  }), [onBarClick]);

  return (
    <div className="bg-card rounded-2xl border shadow-sm flex flex-col overflow-hidden" style={{ height: '500px' }}>
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-amber-400 flex-shrink-0" />

      <div className="px-6 pt-5 pb-2 flex-shrink-0 flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-tight">Top 10 Customers</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Highest-value clients by closed revenue</p>
        </div>
        {topCustomer && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">🥇 #1 Client</span>
            <span className="text-sm font-bold text-foreground truncate max-w-[120px] text-right">{topCustomer.name}</span>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="px-6 pb-2 flex-shrink-0">
        <span className="text-xl font-black text-foreground tracking-tight">{formatFullCurrency(totalValue)}</span>
        <span className="ml-2 text-xs text-muted-foreground font-medium">combined revenue</span>
      </div>

      <div className="px-2 flex-grow min-h-0 touch-pan-y" ref={containerRef}>
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
    </div>
  );
};

export default React.memo(AnalyticsTopCustomersChart);
