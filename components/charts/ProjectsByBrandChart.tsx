'use client';

import React, { useMemo, useRef, useId } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { PieChart } from 'lucide-react';
import { limperialTheme, useChartReady } from "../charts/echartsTheme";
import { useFilter } from "../../contexts/FilterContext";

echarts.registerTheme('limperial', limperialTheme);

const ECharts = ReactECharts as any;

interface SalesByBrandData {
  name: string;
  count: number;
  totalValue: number;
}

interface SalesByBrandChartProps {
  data: SalesByBrandData[];
  currency?: string;
}

const BRAND_COLORS = [
  '#004aad', '#3077d3', '#60a5fa', '#93c5fd', '#bfdbfe',
  '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'
];

const SalesByBrandChart: React.FC<SalesByBrandChartProps> = ({ data, currency = 'USD' }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { filters, setFilter } = useFilter();
  const titleId = useId();

  const isReady = useChartReady(containerRef, chartRef, [data, currency]);

  const onEvents = {
    click: (p: any) => {
      if (!p.name) return;
      const current = (filters.brand1 || []) as string[];
      if (current.includes(p.name)) {
        setFilter('brand1', []);
      } else {
        setFilter('brand1', [p.name]);
      }
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'KHR' ? 'USD' : currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value).replace('$', currency === 'KHR' ? '៛' : '$');

  const option = useMemo(() => {
    if (!data || data.length === 0) return {};
    const totalValue = data.reduce((acc, item) => acc + item.totalValue, 0);

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'hsl(var(--border))',
        borderRadius: 12,
        padding: [12, 16],
        shadowBlur: 10,
        shadowColor: 'rgba(0,0,0,0.05)',
        textStyle: { color: 'hsl(var(--foreground))', fontFamily: 'Inter, sans-serif' },
        formatter: (params: any) => {
          const { name, value, percent, color } = params;
          const item = data.find(d => d.name === name);
          return `
            <div style="font-weight:700;margin-bottom:10px;opacity:0.6;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;">${name}</div>
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:28px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}"></span>
                        <span style="font-weight:800;font-size:18px;letter-spacing:-0.5px;">${formatCurrency(value)}</span>
                    </div>
                    <span style="color:#0ea5e9;font-size:12px;font-weight:700;background:rgba(14,165,233,0.1);padding:4px 10px;border-radius:8px;">${percent}%</span>
                </div>
                <div style="font-size:12px;color:hsl(var(--muted-foreground));font-weight:600;padding-left:20px;margin-top:-4px;">
                    Volume: <strong style="color:hsl(var(--foreground))">${item?.count ?? 0}</strong>
                </div>
            </div>
          `;
        }
      },
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      animationThreshold: 2000,
      legend: {
        bottom: '2%',
        left: 'center',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 16,
        textStyle: {
            fontSize: 11,
            fontWeight: '600',
            color: 'hsl(var(--muted-foreground))',
            fontFamily: 'Inter, sans-serif'
        },
        type: 'scroll'
      },
      series: [{
        name: 'Sales by Brand',
        type: 'pie',
        radius: ['64%', '80%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        itemStyle: {
            borderRadius: 2,
            borderColor: 'hsl(var(--card))',
            borderWidth: 1
        },
        label: { show: false },
        emphasis: {
            scale: true,
            scaleSize: 4,
            itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.05)'
            }
        },
        data: data.map((item, i) => ({
            name: item.name,
            value: item.totalValue,
            itemStyle: { color: BRAND_COLORS[i % BRAND_COLORS.length] }
        })),
      }],
      graphic: [
        {
            type: 'text',
            left: 'center',
            top: '32%',
            style: {
                text: formatCurrency(totalValue),
                textAlign: 'center',
                fill: 'hsl(var(--foreground))',
                fontSize: 24,
                fontWeight: '900',
                fontFamily: 'Inter, sans-serif'
            }
        },
        {
            type: 'text',
            left: 'center',
            top: '46%',
            style: {
                text: 'TOTAL REVENUE',
                textAlign: 'center',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 2,
                fontFamily: 'Inter, sans-serif'
            }
        }
      ]
    };
  }, [data, currency]);

  return (
    <div className="bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden h-[400px] lg:h-[500px] w-full">
      <div className="p-6 pb-0 flex-shrink-0">
        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Product Distribution</h4>
        <h3 id={titleId} className="text-lg font-extrabold text-foreground">Sales by Brand</h3>
        <p className="text-xs text-muted-foreground mt-1">Revenue share across product brands from sale order line items.</p>
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
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center gap-2">
            <PieChart className="w-12 h-12 text-muted-foreground/30" />
            <p className="mt-2 text-sm font-medium">No brand data to display.</p>
            <p className="text-xs text-muted-foreground max-w-[180px] border-t border-border/50 pt-3 mt-2">Brand data is extracted from sale order line items.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(SalesByBrandChart);
