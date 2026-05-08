'use client';

import React, { useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { ClipboardList } from 'lucide-react';
import { limperialTheme, useChartReady } from '../echartsTheme';

const ECharts = ReactECharts as any;

export interface PendingCounts {
  Projects: number;
  Quotations: number;
  SaleOrders: number;
  Invoices: number;
  Meetings: number;
}

interface Props {
  data: PendingCounts;
}

const SEGMENTS = [
  { key: 'Projects',   label: 'Projects',    color: '#1d4ed8' },
  { key: 'Quotations', label: 'Quotations',   color: '#3b82f6' },
  { key: 'SaleOrders', label: 'Sale Orders',  color: '#60a5fa' },
  { key: 'Invoices',   label: 'Invoices',     color: '#93c5fd' },
  { key: 'Meetings',   label: 'Meetings',     color: '#bfdbfe' },
] as const;

const PendingDistributionChart: React.FC<Props> = ({ data }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady = useChartReady(containerRef, chartRef, [data]);

  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const topSegment = SEGMENTS.reduce((best, s) =>
    (data[s.key] ?? 0) > (data[best.key] ?? 0) ? s : best
  );

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
        const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0';
        return `
          <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:10px;">${p.name}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
              <span style="font-weight:900;font-size:28px;color:#0f172a;">${p.value}</span>
            </div>
            <span style="background:${p.color}22;color:${p.color};font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;">${pct}%</span>
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
      itemGap: 16,
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
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(59,130,246,0.3)' },
      },
      data: SEGMENTS.map(s => ({
        value: data[s.key] ?? 0,
        name: s.label,
        itemStyle: { color: s.color },
      })),
    }],
    graphic: [
      {
        type: 'text', left: 'center', top: '37%',
        style: { text: total, fill: 'hsl(var(--foreground))', fontSize: 48, fontWeight: '900', textAlign: 'center', fontFamily: 'Inter, sans-serif' },
      },
      {
        type: 'text', left: 'center', top: '51%',
        style: { text: 'PENDING', fill: 'hsl(var(--muted-foreground))', fontSize: 9, fontWeight: '700', letterSpacing: 3, textAlign: 'center', fontFamily: 'Inter, sans-serif' },
      },
    ],
  }), [data, total]);

  return (
    <div className="bg-card rounded-2xl border shadow-sm flex flex-col overflow-hidden" style={{ height: '500px' }}>
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-blue-700 via-blue-500 to-blue-300 flex-shrink-0" />

      <div className="px-6 pt-5 pb-2 flex-shrink-0 flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-tight">Pending Distribution</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Items awaiting action across all modules</p>
        </div>
        {total > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Highest</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full" style={{ background: topSegment.color }} />
              <span className="text-sm font-bold text-foreground">{topSegment.label}</span>
              <span className="text-sm font-black text-blue-600">({data[topSegment.key]})</span>
            </div>
          </div>
        )}
      </div>

      {/* Mini stat row */}
      <div className="px-6 pb-2 flex-shrink-0">
        <div className="flex items-center gap-4">
          {SEGMENTS.map(s => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-[11px] font-semibold text-muted-foreground">{data[s.key] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-2 flex-grow min-h-0 touch-pan-y" ref={containerRef}>
        {total === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <ClipboardList className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm font-semibold">No pending items</p>
            <p className="text-xs text-muted-foreground/70">All caught up! 🎉</p>
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
          <div className="h-full flex items-center justify-center">
            <div className="w-48 h-48 rounded-full bg-muted animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(PendingDistributionChart);
