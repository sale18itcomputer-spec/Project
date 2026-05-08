'use client';

import React, { useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Tag } from 'lucide-react';
import { limperialTheme, useChartReady } from '../echartsTheme';

const ECharts = ReactECharts as any;

const PALETTE = [
  '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa',
  '#93c5fd', '#0f172a', '#1e3a8a', '#1e40af', '#334155',
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
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
  return `$${val.toFixed(0)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const SalesByBrandChart: React.FC<Props> = ({ data, onSliceClick }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady = useChartReady(containerRef, chartRef, [data]);

  const totalRevenue = data.reduce((a, b) => a + b.value, 0);
  const topBrand = data.length ? data[0] : null;
  const topShare = topBrand && totalRevenue > 0
    ? ((topBrand.value / totalRevenue) * 100).toFixed(1)
    : '0';

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderRadius: 14,
      padding: [14, 18],
      shadowBlur: 20,
      shadowColor: 'rgba(0,0,0,0.08)',
      textStyle: { color: '#1e293b', fontFamily: 'Inter, sans-serif' },
      formatter: (p: any) => {
        const pct = totalRevenue > 0 ? ((p.value / totalRevenue) * 100).toFixed(1) : '0';
        return `
          <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:10px;">${p.name}</div>
          <div style="font-weight:900;font-size:22px;color:#0f172a;letter-spacing:-1px;margin-bottom:8px;">${formatFullCurrency(p.value)}</div>
          <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:${p.color}18;border-radius:8px;">
            <span style="font-size:11px;color:#64748b;font-weight:600;">Market share:</span>
            <span style="font-weight:800;color:${p.color};font-size:13px;">${pct}%</span>
          </div>`;
      },
    },
    animationDuration: 900,
    animationEasing: 'cubicOut',
    legend: {
      bottom: '2%',
      left: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 14,
      type: 'scroll',
      textStyle: { fontSize: 11, fontWeight: '600', color: 'hsl(var(--muted-foreground))' },
    },
    series: [{
      type: 'pie',
      radius: ['60%', '80%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: 'hsl(var(--card))', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        scale: true,
        scaleSize: 6,
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(29,78,216,0.25)' },
      },
      data: data.map((d, i) => ({
        ...d,
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
    }],
    graphic: [
      {
        type: 'text', left: 'center', top: '33%',
        style: { text: formatCurrency(totalRevenue), fill: 'hsl(var(--foreground))', fontSize: 22, fontWeight: '900', textAlign: 'center', fontFamily: 'Inter, sans-serif' },
      },
      {
        type: 'text', left: 'center', top: '44%',
        style: { text: 'TOTAL REV', fill: 'hsl(var(--muted-foreground))', fontSize: 9, fontWeight: '700', letterSpacing: 3, textAlign: 'center', fontFamily: 'Inter, sans-serif' },
      },
      {
        type: 'text', left: 'center', top: '52%',
        style: {
          text: `${data.length} brand${data.length !== 1 ? 's' : ''}`,
          fill: 'hsl(var(--muted-foreground))',
          fontSize: 9, fontWeight: '600', textAlign: 'center', fontFamily: 'Inter, sans-serif',
        },
      },
    ],
  }), [data, totalRevenue]);

  const onEvents = useMemo(() => ({
    click: (p: any) => onSliceClick?.(p.name),
  }), [onSliceClick]);

  return (
    <div className="bg-card rounded-2xl border shadow-sm flex flex-col overflow-hidden" style={{ height: '500px' }}>
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-blue-800 via-blue-500 to-sky-400 flex-shrink-0" />

      <div className="px-6 pt-5 pb-2 flex-shrink-0 flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-tight">Sales by Brand</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue distribution across product brands</p>
        </div>
        {topBrand && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Top Brand</span>
            <span className="text-sm font-bold text-foreground">{topBrand.name}</span>
            <span className="text-[11px] text-muted-foreground">{topShare}% share</span>
          </div>
        )}
      </div>

      {/* Total + brand count */}
      <div className="px-6 pb-2 flex-shrink-0 flex items-center gap-3">
        <div>
          <span className="text-xl font-black text-foreground tracking-tight">{formatFullCurrency(totalRevenue)}</span>
          <span className="ml-2 text-xs text-muted-foreground font-medium">total revenue</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-blue-50 rounded-full">
          <span className="text-xs font-bold text-blue-700">{data.length}</span>
          <span className="text-[10px] text-blue-500 font-semibold">brands</span>
        </div>
      </div>

      <div className="px-2 flex-grow min-h-0 touch-pan-y" ref={containerRef}>
        {data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Tag className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm font-semibold">No brand data yet</p>
            <p className="text-xs text-muted-foreground/60">Brand revenue will appear as sale orders are placed.</p>
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
          <div className="h-full flex items-center justify-center">
            <div className="w-48 h-48 rounded-full bg-muted animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(SalesByBrandChart);
