'use client';

import React, { useRef, useMemo, useId } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { BarChart2 } from 'lucide-react';
import { useWindowSize } from "../../hooks/useWindowSize";
import { limperialTheme, useChartReady } from "../charts/echartsTheme";
import { useFilter } from "../../contexts/FilterContext";

echarts.registerTheme('limperial', limperialTheme);

const ECharts = ReactECharts as any;

interface MonthlyWinValueData {
  name: string;
  winValue: number;
  projectCount: number;
}

type Period = 'monthly' | 'quarterly' | 'yearly';

interface MonthlyWinValueChartProps {
  data: MonthlyWinValueData[];
  period: Period;
  onPeriodChange: (period: Period) => void;
  currency: 'USD' | 'KHR';
  isB2B?: boolean;
}

const ToggleButton: React.FC<{ period: Period, label: string, activePeriod: Period, onClick: (period: Period) => void }> =
  ({ period, label, activePeriod, onClick }) => {
    const isActive = period === activePeriod;
    return (
      <button
        onClick={() => onClick(period)}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${isActive ? 'bg-background shadow-sm text-brand-700' : 'text-muted-foreground hover:bg-accent'}`}
      >
        {label}
      </button>
    );
  };

const MonthlyWinValueChart: React.FC<MonthlyWinValueChartProps> = ({ data, period, onPeriodChange, currency, isB2B }) => {
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { filters, setFilter } = useFilter();
  const titleId = useId();

  const isReady = useChartReady(containerRef, chartRef, [data, period]);

  const formatCurrency = (value: number) => {
    if (!value) return currency === 'KHR' ? '៛0' : '$0';
    if (currency === 'KHR') {
      if (value >= 1000000) return `៛${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `៛${(value / 1000).toFixed(0)}K`;
      return `៛${value.toFixed(0)}`;
    }
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
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
      const currentMonthFilter = (filters.month || []) as string[];
      const currentYearFilter = (filters.year || []) as string[];

      if (period === 'monthly') {
        const [mShort, yearStr] = params.name.split(' ');
        if (!mShort || !yearStr) return;
        const isActive = currentMonthFilter.length === 1 && currentMonthFilter[0] === mShort &&
          currentYearFilter.length === 1 && currentYearFilter[0] === yearStr;
        if (isActive) { setFilter('month', []); setFilter('year', []); }
        else { setFilter('month', [mShort]); setFilter('year', [yearStr]); }
      } else if (period === 'yearly') {
        const clickedYear = params.name;
        const isActive = currentYearFilter.length === 1 && currentYearFilter[0] === clickedYear && currentMonthFilter.length === 0;
        if (isActive) { setFilter('year', []); }
        else { setFilter('year', [clickedYear]); setFilter('month', []); }
      }
    },
  };

  const option = useMemo(() => {
    if (!data || data.length === 0) return {};
    const totalCount = data.length;
    const barWidth = totalCount <= 4 ? '30%' : totalCount <= 8 ? '45%' : '60%';

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'hsl(var(--border))',
        borderWidth: 1,
        borderRadius: 12,
        padding: [12, 16],
        shadowBlur: 10,
        shadowColor: 'rgba(0,0,0,0.05)',
        textStyle: { color: 'hsl(var(--foreground))', fontFamily: 'Inter, sans-serif' },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          if (!p || p.value === undefined) return '';
          const item = data[p.dataIndex];
          return `
            <div style="font-weight:700;margin-bottom:10px;opacity:0.6;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;">${p.name}</div>
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:28px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
                        <span style="font-weight:800;font-size:18px;letter-spacing:-0.5px;">${formatFullCurrency(p.value)}</span>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;padding-left:20px;margin-top:-4px;">
                    <span style="font-size:12px;color:hsl(var(--muted-foreground));font-weight:600;">
                        ${isB2B ? 'Wins' : 'Orders'}: <strong style="color:hsl(var(--foreground))">${item?.projectCount || 0}</strong>
                    </span>
                </div>
            </div>
          `;
        }
      },
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      animationThreshold: 2000,
      grid: {
        top: '12%',
        left: '4%',
        right: '4%',
        bottom: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.name),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
        axisLabel: {
          color: 'hsl(var(--muted-foreground))',
          fontSize: 11,
          fontWeight: '600',
          margin: 15,
          rotate: isMobile ? 45 : 0
        }
      },
      yAxis: {
        type: 'value',
        splitLine: { show: true, lineStyle: { type: 'dashed', color: 'hsl(var(--border))' } },
        axisLabel: {
          formatter: (val: number) => formatCurrency(val),
          color: 'hsl(var(--muted-foreground))',
          fontSize: 11,
          fontWeight: '500'
        }
      },
      series: [{
        name: 'Revenue',
        type: 'bar',
        barWidth: isMobile ? '70%' : barWidth,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#3077d3' },
            { offset: 1, color: '#004aad' }
          ])
        },
        data: data.map(d => d.winValue),
        emphasis: {
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#60a5fa' },
                    { offset: 1, color: '#3077d3' }
                ])
            }
        }
      }]
    };
  }, [data, currency, isMobile, isB2B]);

  const chartTitle = { monthly: 'Monthly Revenue', quarterly: 'Quarterly Revenue', yearly: 'Yearly Revenue' }[period];

  return (
    <div className="bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden h-[400px] lg:h-[500px] w-full">
      <div className="p-6 pb-0 flex-shrink-0">
        <div className="flex flex-row justify-between items-start gap-2">
          <div>
            <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Financial Performance</h4>
            <h3 id={titleId} className="text-lg font-extrabold text-foreground">{chartTitle}</h3>
          </div>
          <div className="bg-muted p-1 rounded-lg flex gap-1 flex-shrink-0 mt-1">
            <ToggleButton period="monthly" label="Monthly" activePeriod={period} onClick={onPeriodChange} />
            <ToggleButton period="quarterly" label="Quarterly" activePeriod={period} onClick={onPeriodChange} />
            <ToggleButton period="yearly" label="Yearly" activePeriod={period} onClick={onPeriodChange} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isB2B 
            ? 'Total revenue from won pipelines over the selected period. Click bars to filter by date.' 
            : 'Total revenue from completed sale orders. Click bars to filter by date.'}
        </p>
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
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <BarChart2 className="w-12 h-12 text-muted-foreground/30" />
            <p className="mt-2 text-sm font-medium">No revenue data to display.</p>
            <p className="text-xs text-muted-foreground max-w-xs text-center border-t border-border/50 pt-3 mt-2">
              {isB2B
                ? 'Pipeline wins will appear here once projects are marked as Close (win).'
                : 'Revenue will appear here once sale orders are marked as Completed.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(MonthlyWinValueChart);
