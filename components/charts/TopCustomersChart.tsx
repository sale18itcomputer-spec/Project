'use client';

import React, { useRef, useMemo, useId } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { BarChartHorizontal } from 'lucide-react';
import { useFilter } from "../../contexts/FilterContext";
import { useWindowSize } from "../../hooks/useWindowSize";
import { limperialTheme, useChartReady } from "../charts/echartsTheme";

echarts.registerTheme('limperial', limperialTheme);

const ECharts = ReactECharts as any;

interface CustomerData {
  name: string;
  winValue: number;
  projectCount: number;
}

interface TopCustomersChartProps {
  data: CustomerData[];
  totalWinValue: number;
  currency: 'USD' | 'KHR';
}

const TopCustomersChart: React.FC<TopCustomersChartProps> = ({ data, totalWinValue, currency }) => {
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { filters, setFilter } = useFilter();
  const titleId = useId();

  const isReady = useChartReady(containerRef, chartRef, [data, currency]);

  const formatCurrency = (val: number) => {
    const prefix = currency === 'KHR' ? '៛' : '$';
    if (val >= 1000000) return `${prefix}${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${prefix}${Math.round(val / 1000)}k`;
    return `${prefix}${val}`;
  };

  const formatFullCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: currency === 'KHR' ? 'code' : 'symbol',
    }).format(value).replace('KHR', '៛');

  const onEvents = {
    click: (params: any) => {
      if (!params.name) return;
      const company = params.name.replace(/^\d+\.\s*/, '');
      const current = (filters.companyName || []) as string[];
      if (current.length === 1 && current[0] === company) {
        setFilter('companyName', []);
      } else {
        setFilter('companyName', [company]);
      }
    },
  };

  const option = useMemo(() => {
    if (!data || data.length === 0) return {};
    const rankedData = [...data]
      .sort((a, b) => b.winValue - a.winValue)
      .slice(0, 10);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        borderRadius: 12,
        padding: [12, 16],
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          if (!p || p.value === undefined) return '';
          const name = p.name.replace(/^\d+\.\s*/, '');
          const pct = totalWinValue > 0 ? ((p.value / totalWinValue) * 100).toFixed(1) : '0';
          return `
            <div style="font-weight:700;margin-bottom:8px;opacity:0.6;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${name}</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
                        <span style="font-weight:800;font-size:16px;">${formatFullCurrency(p.value)}</span>
                    </div>
                    <span style="color:#3b82f6;font-size:12px;font-weight:700;background:rgba(59,130,246,0.1);padding:2px 8px;border-radius:6px;">${pct}%</span>
                </div>
                <div style="font-size:11px;color:hsl(var(--muted-foreground));font-weight:600;padding-left:18px;">
                    Orders: <strong>${p.data.projectCount}</strong>
                </div>
            </div>
          `;
        }
      },
      grid: {
        left: '2%',
        right: '12%',
        bottom: '8%',
        top: '4%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => formatCurrency(val),
          fontSize: 10,
          color: 'hsl(var(--muted-foreground))'
        },
        splitLine: { lineStyle: { type: 'dashed', color: 'hsl(var(--border))' } },
      },
      yAxis: {
        type: 'category',
        data: rankedData.map((d, i) => `${i + 1}. ${d.name}`).reverse(),
        axisLabel: {
          fontSize: 11,
          fontWeight: 600,
          width: isMobile ? 120 : 200,
          overflow: 'truncate',
          ellipsis: '…',
          color: 'hsl(var(--foreground))'
        },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [{
        name: 'Revenue',
        type: 'bar',
        barMaxWidth: 24,
        data: rankedData.map((d, i) => ({
          value: d.winValue,
          projectCount: d.projectCount,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: i === 0 ? '#3b82f6' : '#64748b' },
                { offset: 1, color: i === 0 ? '#004aad' : '#334155' },
            ]),
          },
        })).reverse(),
        label: {
          show: !isMobile,
          position: 'right',
          distance: 10,
          formatter: (params: any) => formatCurrency(params.value),
          fontSize: 11,
          fontWeight: 700,
          color: 'hsl(var(--muted-foreground))'
        },
        emphasis: {
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: '#60a5fa' },
                    { offset: 1, color: '#2563eb' }
                ])
            }
        }
      }],
    };
  }, [data, totalWinValue, currency, isMobile]);

  return (
    <div className="bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden" style={{ height: '900px' }}>
      <div className="p-6 pb-0 flex-shrink-0">
        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Customer Performance</h4>
        <h3 id={titleId} className="text-lg font-extrabold text-foreground">Top 10 Customers</h3>
        <p className="text-xs text-muted-foreground mt-1">Highest revenue-generating clients by total order value.</p>
      </div>

      <div className="p-4 flex-grow min-h-0" ref={containerRef}>
        {data && data.length > 0 ? (
          isReady && (
            <ECharts
              ref={chartRef}
              option={option}
              style={{ height: '100%', width: '100%' }}
              onEvents={onEvents}
              notMerge={true}
              lazyUpdate={false}
              theme="limperial"
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-2">
            <BarChartHorizontal className="w-12 h-12 text-muted-foreground/30" />
            <p className="mt-2 text-sm font-medium">No customer data to display.</p>
            <p className="text-xs text-muted-foreground max-w-[180px] border-t border-border/50 pt-3 mt-2">Top customers will appear here as sale orders are completed.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(TopCustomersChart);
