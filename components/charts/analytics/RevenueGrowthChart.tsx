'use client';

import React, { useRef, useMemo, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, TrendingDown, Minus, ZoomIn, ZoomOut, Download, Table, BarChart2, RefreshCw } from 'lucide-react';
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

// Always show full dollar amount with 2 decimal places
function formatLabel(val: number): string {
  if (val === 0) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatAxisTick(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
  return `$${val.toFixed(0)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const RevenueGrowthChart: React.FC<Props> = ({ data, onBarClick }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady = useChartReady(containerRef, chartRef, [data]);

  const [zoom, setZoom] = useState(1);
  const [showTable, setShowTable] = useState(false);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const { total, peak, trend } = useMemo(() => {
    const nonZero = data.filter(d => d.val > 0);
    const total = data.reduce((s, d) => s + d.val, 0);
    const peak = nonZero.length ? nonZero.reduce((a, b) => b.val > a.val ? b : a) : null;

    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (nonZero.length >= 2) {
      const last = nonZero[nonZero.length - 1].val;
      const prev = nonZero[nonZero.length - 2].val;
      trend = last > prev ? 'up' : last < prev ? 'down' : 'flat';
    }
    return { total, peak, trend };
  }, [data]);

  // Max value — used to pin all labels at the same Y (top of tallest bar)
  const maxVal = useMemo(() => Math.max(...data.map(d => d.val), 0), [data]);

  // ── Toolbar actions ────────────────────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    const next = Math.min(zoom + 0.25, 2.5);
    setZoom(next);
    chart.dispatchAction({ type: 'dataZoom', startValue: 0, endValue: Math.round(data.length / next) - 1 });
  }, [zoom, data.length]);

  const handleZoomOut = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    const next = Math.max(zoom - 0.25, 1);
    setZoom(next);
    chart.dispatchAction({ type: 'dataZoom', startValue: 0, endValue: data.length - 1 });
  }, [zoom, data.length]);

  const handleReset = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    setZoom(1);
    chart.dispatchAction({ type: 'dataZoom', startValue: 0, endValue: data.length - 1 });
  }, [data.length]);

  const handleDownload = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'revenue-growth.png';
    a.click();
  }, []);

  // ── Chart option ───────────────────────────────────────────────────────────
  const option = useMemo(() => {
    // Pad y-axis max by 20% above the tallest bar so labels have room
    const yMax = maxVal > 0 ? maxVal * 1.28 : 100;

    return {
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
          const p = Array.isArray(params) ? params.find((x: any) => x.seriesName === 'Revenue') ?? params[0] : params;
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
      legend: { show: false },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: 'slider',
          show: data.length > 6,
          bottom: 4,
          height: 20,
          borderColor: 'transparent',
          backgroundColor: 'rgba(226,232,240,0.4)',
          fillerColor: 'rgba(59,130,246,0.12)',
          handleStyle: { color: '#3b82f6', borderColor: '#3b82f6' },
          textStyle: { color: '#94a3b8', fontSize: 10 },
          dataBackground: {
            lineStyle: { color: '#cbd5e1', width: 1 },
            areaStyle: { color: 'rgba(203,213,225,0.3)' },
          },
        },
      ],
      animationDuration: 800,
      animationEasing: 'cubicOut',
      animationDelay: (idx: number) => idx * 30,
      grid: {
        top: '18%',       // extra room at top for the fixed-position labels
        left: '2%',
        right: '2%',
        bottom: data.length > 6 ? '14%' : '8%',
        containLabel: true,
      },
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
        min: 0,
        max: yMax,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          formatter: (v: number) => formatAxisTick(v),
          color: 'hsl(var(--muted-foreground))',
          fontSize: 11,
        },
        splitLine: { lineStyle: { type: 'dashed', color: 'hsl(var(--border))', opacity: 0.6 } },
      },
      series: [
        // ── Real bars ─────────────────────────────────────────────────────────
        {
          name: 'Revenue',
          type: 'bar',
          barWidth: '45%',
          barMaxWidth: 52,
          barGap: '-100%',  // ghost series sits on top, same slot
          z: 2,
          itemStyle: {
            borderRadius: [8, 8, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#60a5fa' },
              { offset: 1, color: '#1d4ed8' },
            ]),
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
          label: { show: false },
          data: data.map(d => d.val),
        },
        // ── Ghost bar series — all bars reach yMax, fully transparent,
        //    labels sit at 'top' so they all share the same fixed Y baseline
        {
          name: 'Labels',
          type: 'bar',
          barWidth: '45%',
          barMaxWidth: 52,
          barGap: '-100%',  // overlay exactly over real bars
          z: 1,
          silent: true,     // no hover/click on ghost bars
          itemStyle: { color: 'transparent', borderColor: 'transparent' },
          emphasis: { disabled: true },
          label: {
            show: true,
            position: 'top',
            distance: 6,
            formatter: (params: any) => {
              const val = data[params.dataIndex]?.val ?? 0;
              return val > 0 ? formatLabel(val) : '';
            },
            fontSize: 10,
            fontWeight: '700',
            color: '#1e40af',
            backgroundColor: 'rgba(239,246,255,0.90)',
            borderRadius: 4,
            padding: [2, 5],
          },
          // All ghost bars are the same height = yMax so 'position: top'
          // places every label at the exact same Y coordinate
          data: data.map(d => d.val > 0 ? yMax : 0),
        },
      ],
    };
  }, [data, maxVal]);

  const onEvents = useMemo(() => ({
    click: (params: any) => onBarClick?.(params.name),
  }), [onBarClick]);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const toolBtn = (active = false) =>
    `flex items-center justify-center w-7 h-7 rounded-lg border transition-all ${
      active
        ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
        : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/60'
    }`;

  return (
    <div className="bg-card rounded-2xl border shadow-sm flex flex-col overflow-hidden" style={{ height: showTable ? 'auto' : 'clamp(320px, 50vw, 500px)' }}>
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-brand-300 flex-shrink-0" />

      {/* Header */}
      <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-2 sm:pb-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">Revenue Growth</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {data[0]?.name?.split(' ').pop()} closed orders revenue
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
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

      {/* Total + toolbar */}
      <div className="px-3 sm:px-6 pb-2 sm:pb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <span className="text-lg sm:text-2xl font-black text-foreground tracking-tight">{formatFullCurrency(total)}</span>
          <span className="ml-2 text-xs text-muted-foreground font-medium">total this period</span>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={handleZoomIn} title="Zoom In" className={toolBtn()}>
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleZoomOut} title="Zoom Out" disabled={zoom <= 1} className={toolBtn()} style={{ opacity: zoom <= 1 ? 0.4 : 1 }}>
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleReset} title="Reset View" disabled={zoom === 1} className={toolBtn()} style={{ opacity: zoom === 1 ? 0.4 : 1 }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
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

      {/* Data table */}
      {showTable && (
        <div className="px-3 sm:px-6 pb-4 pt-2 flex-shrink-0 border-t border-border">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Period</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Revenue</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Orders</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">Avg / Order</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr
                    key={d.name}
                    className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => onBarClick?.(d.name)}
                  >
                    <td className="px-4 py-2.5 font-semibold text-foreground">{d.name}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-brand-600">{formatFullCurrency(d.val)}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{d.count}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {d.count > 0 ? formatFullCurrency(d.val / d.count) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full"
                            style={{ width: `${total > 0 ? (d.val / total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground w-10 text-right">
                          {total > 0 ? `${((d.val / total) * 100).toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-4 py-2.5 font-black text-foreground uppercase text-[10px] tracking-wider">Total</td>
                  <td className="px-4 py-2.5 text-right font-black text-brand-600">{formatFullCurrency(total)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-foreground">{data.reduce((s, d) => s + d.count, 0)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-muted-foreground">
                    {data.reduce((s, d) => s + d.count, 0) > 0
                      ? formatFullCurrency(total / data.reduce((s, d) => s + d.count, 0))
                      : '—'}
                  </td>
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

export default React.memo(RevenueGrowthChart);
