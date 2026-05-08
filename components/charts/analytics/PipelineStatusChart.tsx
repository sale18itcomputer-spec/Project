'use client';

import React, { useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Layers } from 'lucide-react';
import { limperialTheme, useChartReady } from '../echartsTheme';

const ECharts = ReactECharts as any;

// Sophisticated multi-blue palette
const PALETTE = [
  '#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6',
  '#60a5fa', '#93c5fd', '#bfdbfe', '#0f172a', '#334155',
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
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady = useChartReady(containerRef, chartRef, [data]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const topStatus = data.length ? [...data].sort((a, b) => b.value - a.value)[0] : null;
  const activeCount = data.filter(d => !d.name.toLowerCase().includes('close')).reduce((s, d) => s + d.value, 0);

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
              <span style="font-size:13px;color:#94a3b8;font-weight:500;">deals</span>
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
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(30,58,138,0.25)' },
      },
      data: data.map((d, i) => ({
        ...d,
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
    }],
    graphic: [
      {
        type: 'text', left: 'center', top: '36%',
        style: { text: totalProjects, fill: 'hsl(var(--foreground))', fontSize: 48, fontWeight: '900', textAlign: 'center', fontFamily: 'Inter, sans-serif' },
      },
      {
        type: 'text', left: 'center', top: '50%',
        style: { text: 'PIPELINES', fill: 'hsl(var(--muted-foreground))', fontSize: 9, fontWeight: '700', letterSpacing: 3, textAlign: 'center', fontFamily: 'Inter, sans-serif' },
      },
    ],
  }), [data, total, totalProjects]);

  const onEvents = useMemo(() => ({
    click: (p: any) => onSliceClick?.(p.name),
  }), [onSliceClick]);

  return (
    <div className="bg-card rounded-2xl border shadow-sm flex flex-col overflow-hidden" style={{ height: '500px' }}>
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-blue-900 via-blue-600 to-blue-400 flex-shrink-0" />

      <div className="px-6 pt-5 pb-2 flex-shrink-0 flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-tight">Pipeline Status</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Distribution of all deals by current stage</p>
        </div>
        {topStatus && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Most Common</span>
            <span className="text-sm font-bold text-foreground">{topStatus.name}</span>
          </div>
        )}
      </div>

      {/* Stat pills */}
      <div className="px-6 pb-2 flex-shrink-0 flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 rounded-full">
          <span className="text-xs font-bold text-blue-700">{totalProjects}</span>
          <span className="text-[10px] text-blue-500 font-semibold">Total</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full">
          <span className="text-xs font-bold text-emerald-700">{activeCount}</span>
          <span className="text-[10px] text-emerald-500 font-semibold">Active</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full">
          <span className="text-xs font-bold text-slate-600">{totalProjects - activeCount}</span>
          <span className="text-[10px] text-slate-400 font-semibold">Closed</span>
        </div>
      </div>

      <div className="px-2 flex-grow min-h-0 touch-pan-y" ref={containerRef}>
        {data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Layers className="w-12 h-12 text-muted-foreground/20" />
            <p className="text-sm font-semibold">No pipeline data</p>
            <p className="text-xs text-muted-foreground/60">Pipeline stages will appear here.</p>
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

export default React.memo(PipelineStatusChart);
