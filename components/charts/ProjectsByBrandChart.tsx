'use client';

import React, { useMemo, useRef, useEffect, useState, useId } from 'react';
import ReactECharts from 'echarts-for-react';
import { useWindowSize } from "../../hooks/useWindowSize";
import { PieChart } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

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

const formatCurrency = (value: number, currency: string = 'USD') => {
  return new Intl.NumberFormat(currency === 'KHR' ? 'km-KH' : 'en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};


const SalesByBrandChart: React.FC<SalesByBrandChartProps> = ({ data, currency = 'USD' }) => {
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  const handleResize = useDebouncedCallback(() => {
    const echartsInstance = chartRef.current?.getEchartsInstance();
    if (echartsInstance) {
      echartsInstance.resize();
    }
  }, 150);

  useEffect(() => {
    // Ensure container has dimensions before rendering
    const timer = setTimeout(() => {
      setShouldRender(true);
      handleResize();
    }, 50);

    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  const chartOptions = useMemo(() => {
    if (!data || data.length === 0) return null;

    const totalValue = data.reduce((acc, item) => acc + item.totalValue, 0);

    return {
      title: [
        {
          text: formatCurrency(totalValue, currency),
          subtext: 'Total Revenue',
          left: '50%',
          top: '48%',
          textAlign: 'center',
          textStyle: {
            fontSize: isMobile ? 13 : 15,
            fontWeight: 800,
            color: '#1e293b'
          },
          subtextStyle: {
            fontSize: 10,
            color: '#64748b',
            fontWeight: 500
          }
        }
      ],
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const { name, value, percent } = params;
          const dataItem = data.find(item => item.name === name);
          return `
            <div style="font-weight: 700; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">${name}</div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 13px; margin-bottom: 2px;">
              <span style="color: #64748b;">Orders:</span>
              <span style="font-weight: 600;">${dataItem?.count || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 13px; margin-bottom: 2px;">
              <span style="color: #64748b;">Revenue:</span>
              <span style="font-weight: 600;">${formatCurrency(value || 0, currency)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 13px;">
              <span style="color: #64748b;">Share:</span>
              <span style="font-weight: 600; color: #0ea5e9;">${percent}%</span>
            </div>
          `;
        },
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderRadius: 12,
        padding: [12, 16],
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.05)',
        textStyle: { color: '#1e293b' }
      },
      legend: {
        orient: 'horizontal',
        bottom: 5,
        left: 'center',
        itemWidth: 8,
        itemHeight: 8,
        icon: 'circle',
        textStyle: {
          color: '#64748b',
          fontSize: 10,
          fontWeight: 500
        }
      },
      series: [
        {
          name: 'Sales by Brand',
          type: 'pie',
          radius: isMobile ? ['40%', '60%'] : ['45%', '65%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: !isMobile,
            position: 'outside',
            formatter: '{b}\n{d}%',
            color: '#64748b',
            fontSize: 10,
            fontWeight: 600
          },
          labelLine: {
            show: !isMobile,
            length: 10,
            length2: 5,
            smooth: true,
            lineStyle: {
              width: 1,
              color: '#cbd5e1'
            }
          },
          emphasis: {
            scale: true,
            scaleSize: 5,
            itemStyle: {
              shadowBlur: 15,
              shadowColor: 'rgba(0, 0, 0, 0.1)'
            }
          },
          data: data.map(item => ({
            name: item.name,
            value: item.totalValue
          }))
        }
      ],
      color: [
        '#0284c7', // Sky 600
        '#7c3aed', // Violet 600
        '#db2777', // Pink 600
        '#d97706', // Amber 600
        '#059669', // Emerald 600
        '#e11d48', // Rose 600
        '#4f46e5', // Indigo 600
        '#0d9488', // Teal 600
        '#ea580c', // Orange 600
        '#9333ea'  // Purple 600
      ]
    };
  }, [data, isMobile, currency]);

  const titleId = useId();

  return (
    <div className="w-full h-full bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col" ref={containerRef}>
      <div className="flex-shrink-0">
        <h2 id={titleId} className="text-base font-semibold text-foreground mb-0.5">Sales by Brand</h2>
        <p className="text-xs text-muted-foreground mb-4">Revenue share across product brands.</p>
      </div>
      {data && data.length > 0 ? (
        <div className="w-full flex-grow min-h-0" role="figure" aria-labelledby={titleId}>
          {shouldRender && (
            <ECharts
              ref={chartRef}
              option={chartOptions}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
          <PieChart className="w-12 h-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium">No brand data to display.</p>
        </div>
      )}
    </div>
  );
};

export default SalesByBrandChart;
