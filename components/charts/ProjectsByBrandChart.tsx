'use client';

import React, { useMemo, useRef, useId } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { PieChart } from 'lucide-react';
import { limperialTheme, useChartReady } from "../charts/echartsTheme";

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
  const titleId = useId();

  const isReady = useChartReady(containerRef, chartRef, [data, currency]);

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
        borderRadius: 12,
        padding: [12, 16],
        formatter: (params: any) => {
          const { name, value, percent, color } = params;
          const item = data.find(d => d.name === name);
          return `
            <div style="font-weight:700;margin-bottom:8px;opacity:0.6;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${name}</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
                        <span style="font-weight:800;font-size:16px;">${formatCurrency(value)}</span>
                    </div>
                    <span style="color:#3b82f6;font-size:12px;font-weight:700;background:rgba(59,130,246,0.1);padding:2px 8px;border-radius:6px;">${percent}%</span>
                </div>
                <div style="font-size:11px;color:hsl(var(--muted-foreground));font-weight:600;padding-left:18px;">
                    Orders: <strong>${item?.count ?? 0}</strong>
                </div>
            </div>
          `;
        }
      },
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
    <div className="bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden" style={{ height: '900px' }}>
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
