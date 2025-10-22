import React, { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { BarChartHorizontal } from 'lucide-react';
import { useFilter } from '../contexts/FilterContext';
import { useWindowSize } from '../hooks/useWindowSize';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { limperialTheme } from './charts/echartsTheme';

echarts.registerTheme('limperial', limperialTheme);

interface CustomerData {
  name: string;
  winValue: number;
}

interface TopCustomersChartProps {
    data: CustomerData[];
    totalWinValue: number;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const formatShortCurrency = (val: number | string) => {
    const num = Number(val);
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${Math.round(num/1000)}k`;
    return `$${num}`;
}

const TopCustomersChart: React.FC<TopCustomersChartProps> = ({ data, totalWinValue }) => {
    const { width } = useWindowSize();
    const isMobile = width ? width < 768 : false;
    const chartRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { filters, setFilter } = useFilter();

    const handleResize = useDebouncedCallback(() => {
        const echartsInstance = chartRef.current?.getEchartsInstance();
        if (echartsInstance) {
        echartsInstance.resize();
        }
    }, 150);

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [handleResize]);

    const onEvents = {
        'click': (params: any) => {
            if (params.name) {
                const clickedCompany = params.name;
                const currentCompanyFilter = (filters.companyName || []) as string[];

                if (currentCompanyFilter.length === 1 && currentCompanyFilter[0] === clickedCompany) {
                    setFilter('companyName', []);
                } else {
                    setFilter('companyName', [clickedCompany]);
                }
            }
        }
    };
    
    const option = {
        grid: {
            left: '1%',
            right: isMobile ? '15%' : '10%',
            bottom: '3%',
            top: '3%',
            containLabel: true,
        },
        xAxis: {
            type: 'value',
            axisLabel: {
                formatter: (val: number) => formatShortCurrency(val),
            }
        },
        yAxis: {
            type: 'category',
            data: data.map(d => d.name).reverse(),
            axisLabel: {
                width: isMobile ? 80 : 160,
                overflow: 'truncate',
                fontWeight: 500,
            }
        },
        series: [{
            name: 'Total Win Value',
            type: 'bar',
            cursor: 'pointer',
            data: data.map(d => d.winValue).reverse(),
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: '#93c5fd' },
                    { offset: 1, color: '#004aad' }
                ])
            },
            emphasis: {
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: '#add6ff' },
                        { offset: 1, color: '#3077d3' }
                    ])
                }
            },
            label: {
                show: true,
                position: isMobile ? 'right' : 'insideRight',
                formatter: (params: any) => isMobile ? formatShortCurrency(params.value) : new Intl.NumberFormat('en-US').format(params.value),
                color: isMobile ? '#4b5563' : '#fff',
                fontWeight: 600,
            }
        }],
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any) => {
                const param = Array.isArray(params) ? params[0] : params;
                if (!param || param.value === undefined) return '';

                const value = param.value;
                const name = param.name;
                const percentage = totalWinValue > 0 ? ((value / totalWinValue) * 100).toFixed(1) : 0;
                const marker = `<span class="w-3 h-3 rounded-full mr-2 inline-block" style="background-color: ${param.color.colorStops ? param.color.colorStops[1].color : param.color};"></span>`;
                return `
                        <div class="flex items-center mb-1 font-bold text-gray-800">
                           ${marker}
                           <span>${name}</span>
                        </div>
                        <div class="text-sm text-gray-600 pl-5">Win Value: <strong>${formatCurrency(value)}</strong></div>
                        <div class="text-sm text-gray-600 pl-5">Contribution: <strong>${percentage}%</strong></div>`;
            }
        },
        legend: { show: false },
    };
    

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col" ref={containerRef}>
      <div className="flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Top 10 Customers by Revenue</h2>
          <p className="text-sm text-gray-500 mb-4">Highest revenue-generating clients from won pipelines.</p>
      </div>
      {data && data.length > 0 ? (
        <div className="w-full flex-grow min-h-0">
            <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} onEvents={onEvents} notMerge={true} lazyUpdate={true} theme="limperial" />
        </div>
      ) : (
         <div className="flex flex-col items-center justify-center flex-grow text-gray-500">
            <BarChartHorizontal className="w-12 h-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium">No customer data to display.</p>
        </div>
      )}
    </div>
  );
};

export default TopCustomersChart;