import React, { useRef, useEffect, useId } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { BarChart2 } from 'lucide-react';
import { useWindowSize } from '../hooks/useWindowSize';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { limperialTheme } from './charts/echartsTheme';
import { useFilter } from '../contexts/FilterContext';

echarts.registerTheme('limperial', limperialTheme);

interface MonthlyWinValueData {
  name: string; // e.g., "Apr 2024", "Q2 2024", "2024"
  winValue: number;
  projectCount: number;
}

type Period = 'monthly' | 'quarterly' | 'yearly';

interface MonthlyWinValueChartProps {
    data: MonthlyWinValueData[];
    period: Period;
    onPeriodChange: (period: Period) => void;
    currency: 'USD' | 'KHR';
}

const ToggleButton: React.FC<{ period: Period, label: string, activePeriod: Period, onClick: (period: Period) => void }> = 
({ period, label, activePeriod, onClick }) => {
    const isActive = period === activePeriod;
    return (
        <button
            onClick={() => onClick(period)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                isActive ? 'bg-white shadow-sm text-brand-700' : 'text-slate-600 hover:bg-slate-200'
            }`}
        >
            {label}
        </button>
    );
}

const MonthlyWinValueChart: React.FC<MonthlyWinValueChartProps> = ({ data, period, onPeriodChange, currency }) => {
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { filters, setFilter } = useFilter();
  const titleId = useId();

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
  
  const formatFullCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        currencyDisplay: currency === 'KHR' ? 'code' : 'symbol'
      }).format(value).replace('KHR', '៛');
  }

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
  
  const monthMap: { [key: string]: string } = {
    'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April', 'May': 'May', 'Jun': 'June',
    'Jul': 'July', 'Aug': 'August', 'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
  };

  const onEvents = {
    'click': (params: any) => {
        if (!params.name) return;

        const currentMonthFilter = (filters.month || []) as string[];
        const currentYearFilter = (filters.year || []) as string[];

        if (period === 'monthly') {
            const [monthStr, yearStr] = params.name.split(' ');
            const clickedMonth = monthMap[monthStr];
            const clickedYear = yearStr;

            if (!clickedMonth || !clickedYear) return;

            const isFilterActive = currentMonthFilter.length === 1 && currentMonthFilter[0] === clickedMonth &&
                                 currentYearFilter.length === 1 && currentYearFilter[0] === clickedYear;

            if (isFilterActive) {
                setFilter('month', []);
                setFilter('year', []);
            } else {
                setFilter('month', [clickedMonth]);
                setFilter('year', [clickedYear]);
            }
        } else if (period === 'yearly') {
            const clickedYear = params.name;

            const isFilterActive = currentYearFilter.length === 1 && currentYearFilter[0] === clickedYear && currentMonthFilter.length === 0;

            if (isFilterActive) {
                setFilter('year', []);
            } else {
                setFilter('year', [clickedYear]);
                setFilter('month', []); // Clear month filter when setting a year one
            }
        }
    }
  };

  const avgValue = data.length > 0 ? data.reduce((sum, d) => sum + d.winValue, 0) / data.length : 0;

  const option = {
    grid: {
      left: isMobile ? '1%' : '3%',
      right: isMobile ? '4%' : '4%',
      bottom: isMobile ? '20%' : 80, // Increased bottom margin for slider
      top: 70, // Add space for toolbox
      containLabel: true,
    },
    toolbox: {
        show: true,
        orient: 'vertical',
        left: 'right',
        top: 'center',
        feature: {
          mark: { show: true },
          dataView: { show: true, readOnly: false, title: "Data View" },
          magicType: { show: true, type: ['line', 'bar'], title: { line: "Line", bar: "Bar" }},
          restore: { show: true, title: "Restore" },
          saveAsImage: { show: true, title: "Save Image" }
        }
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisTick: {
        alignWithLabel: true,
      },
      axisLabel: {
        rotate: isMobile ? 30 : 0,
        interval: 'auto',
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => formatCurrency(value),
      },
    },
    series: [
      {
        name: 'Revenue',
        type: 'bar',
        cursor: 'pointer',
        barWidth: isMobile ? '80%' : '60%',
        data: data.map(d => Math.round(d.winValue)),
        itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#60a5fa' },
                { offset: 1, color: '#004aad' }
            ]),
            borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#93c5fd' },
                    { offset: 1, color: '#3077d3' }
                ])
            }
        },
        label: {
          show: !isMobile,
          position: 'top',
          formatter: (params: any) => new Intl.NumberFormat('en-US').format(params.value),
          fontSize: 12,
        },
        markLine: {
            silent: true,
            symbol: 'none',
            data: [
              {
                yAxis: avgValue,
                name: 'Average',
                lineStyle: {
                  type: 'dashed',
                  color: '#f59e0b',
                  width: 2
                },
                label: {
                  formatter: `Avg: ${formatCurrency(avgValue)}`,
                  position: 'insideEndTop',
                  color: '#b45309',
                  padding: [2, 4],
                  backgroundColor: 'rgba(255, 251, 235, 0.8)',
                  borderRadius: 4,
                }
              }
            ]
        }
      },
    ],
    tooltip: {
      formatter: (params: any) => {
        const param = Array.isArray(params) ? params[0] : params;
        if (!param || param.value === undefined) return '';
        
        const { name, value, dataIndex } = param;
        const { projectCount } = data[dataIndex];

        const marker = `<span class="w-3 h-3 rounded-full mr-2 inline-block" style="background-color: ${param.color.colorStops ? param.color.colorStops[1].color : param.color};"></span>`;
        
        return `
            <div class="font-bold text-gray-800 mb-2">${name}</div>
            <div class="flex items-center">
                ${marker}
                <span class="text-gray-600">Revenue:</span>
                <span class="font-semibold text-gray-800 ml-auto">${formatFullCurrency(value)}</span>
            </div>
            <div class="flex items-center mt-1">
                <span class="w-3 h-3 rounded-full mr-2 inline-block bg-slate-400"></span>
                <span class="text-gray-600">Projects Won:</span>
                <span class="font-semibold text-gray-800 ml-auto">${projectCount}</span>
            </div>`;
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      },
      {
        type: 'slider',
        show: !isMobile && data.length > 12,
        start: 0,
        end: 100,
        bottom: 10,
        height: 40,
      }
    ],
    legend: {
      show: false,
    },
  };

  const chartTitle = {
    monthly: 'Monthly Revenue',
    quarterly: 'Quarterly Revenue',
    yearly: 'Yearly Revenue'
  }[period];

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col" ref={containerRef}>
        <div className="flex flex-col sm:flex-row justify-between items-start mb-4 flex-shrink-0 gap-2">
            <div>
                <h2 id={titleId} className="text-lg font-semibold text-gray-900 mb-1">{chartTitle}</h2>
                <p className="text-sm text-slate-600">Revenue from won projects. Click and drag to zoom.</p>
            </div>
            <div className="bg-slate-100 p-1 rounded-lg flex gap-1 flex-shrink-0">
                <ToggleButton period='monthly' label='Monthly' activePeriod={period} onClick={onPeriodChange} />
                <ToggleButton period='quarterly' label='Quarterly' activePeriod={period} onClick={onPeriodChange} />
                <ToggleButton period='yearly' label='Yearly' activePeriod={period} onClick={onPeriodChange} />
            </div>
        </div>
      {data && data.length > 0 ? (
        <div className="w-full flex-grow min-h-0" role="figure" aria-labelledby={titleId}>
            <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} onEvents={onEvents} notMerge={true} lazyUpdate={true} theme="limperial" />
        </div>
      ) : (
         <div className="flex flex-col items-center justify-center flex-grow text-slate-600">
            <BarChart2 className="w-12 h-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium">No revenue data to display for the selected filters.</p>
        </div>
      )}
    </div>
  );
};

export default MonthlyWinValueChart;