import React, { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useWindowSize } from '../hooks/useWindowSize';
import { PieChart } from 'lucide-react';

const ECharts = ReactECharts as any;

interface SalesByBrandData {
  name: string;
  count: number;
  totalValue: number;
}

interface SalesByBrandChartProps {
  data: SalesByBrandData[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};


const SalesByBrandChart: React.FC<SalesByBrandChartProps> = ({ data }) => {
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const chartRef = useRef<any>(null);

  const chartOptions = useMemo(() => {
    if (!data || data.length === 0) return null;

    return {
      title: {
        text: 'Sales by Brand',
        subtext: 'Revenue distribution across product brands',
        left: 'center',
        top: 20,
        textStyle: {
          fontSize: isMobile ? 16 : 18,
          fontWeight: 600,
          color: '#334155'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const { name, value, percent } = params;
          const dataItem = data.find(item => item.name === name);
          return `
            <div style="font-weight: 600; margin-bottom: 4px;">${name}</div>
            <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 13px;">
              <span>Total Orders:</span>
              <span style="font-weight: 600;">${dataItem?.count || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 13px;">
              <span>Revenue:</span>
              <span style="font-weight: 600;">${formatCurrency(value || 0)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 13px;">
              <span>Share:</span>
              <span style="font-weight: 600;">${percent}%</span>
            </div>
          `;
        },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        className: 'echarts-tooltip-dark',
        borderWidth: 0,
        padding: [12, 16],
        textStyle: {
          color: '#1e293b'
        }
      },
      legend: {
        orient: isMobile ? 'horizontal' : 'vertical',
        left: isMobile ? 'center' : 'right',
        bottom: isMobile ? 0 : 'auto',
        top: isMobile ? 'auto' : 'middle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          color: '#64748b'
        }
      },
      series: [
        {
          name: 'Sales by Brand',
          type: 'pie',
          radius: isMobile ? ['30%', '60%'] : ['40%', '70%'],
          center: isMobile ? ['50%', '55%'] : ['45%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: !isMobile,
            formatter: '{b}: {d}%',
            color: '#64748b'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold'
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
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
        '#0ea5e9', // Sky
        '#8b5cf6', // Violet
        '#ec4899', // Pink
        '#f59e0b', // Amber
        '#10b981', // Emerald
        '#f43f5e', // Rose
        '#6366f1', // Indigo
        '#14b8a6', // Teal
        '#f97316', // Orange
        '#a855f7'  // Purple
      ]
    };
  }, [data, isMobile]);

  return (
    <div className="w-full h-full bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {data && data.length > 0 ? (
        <ECharts
          ref={chartRef}
          option={chartOptions}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
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