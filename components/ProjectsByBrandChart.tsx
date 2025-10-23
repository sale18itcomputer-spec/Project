import React, { useRef, useEffect, useState, useMemo, useId } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { PieChart } from 'lucide-react';
import { useFilter } from '../contexts/FilterContext';
import { useWindowSize } from '../hooks/useWindowSize';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { limperialTheme } from './charts/echartsTheme';

echarts.registerTheme('limperial', limperialTheme);

interface BrandData {
  name: string;
  count: number;
  totalValue: number;
}

interface ProjectsByBrandChartProps {
    data: BrandData[];
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};


const ProjectsByBrandChart: React.FC<ProjectsByBrandChartProps> = ({ data }) => {
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { filters, setFilter } = useFilter();
  const [metric, setMetric] = useState<'count' | 'value'>('count');
  const titleId = useId();

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
  
  const chartData = useMemo(() => {
    return data.map(d => ({
        name: d.name,
        value: metric === 'count' ? d.count : d.totalValue,
        originalCount: d.count,
        originalValue: d.totalValue
    })).sort((a, b) => b.value - a.value);
  }, [data, metric]);

  const total = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);
  
  const onEvents = {
      click: (params: any) => {
          if (params.name) {
              const clickedBrand = params.name;
              const currentBrandFilter = (filters.brand1 || []) as string[];

              if (currentBrandFilter.length === 1 && currentBrandFilter[0] === clickedBrand) {
                  setFilter('brand1', []);
              } else {
                  setFilter('brand1', [clickedBrand]);
              }
          }
      },
      mouseover: (params: any) => {
        if (params.componentType === 'series' && chartRef.current) {
            const echartsInstance = chartRef.current.getEchartsInstance();
            echartsInstance.setOption({
                title: {
                    text: metric === 'count' ? params.value.toLocaleString() : formatCurrency(params.value),
                    subtext: params.name,
                }
            });
        }
      },
      mouseout: () => {
         if (chartRef.current) {
            const echartsInstance = chartRef.current.getEchartsInstance();
            echartsInstance.setOption({
                title: {
                    text: metric === 'count' ? total.toLocaleString() : formatCurrency(total),
                    subtext: metric === 'count' ? 'Total Pipelines' : 'Total Value'
                }
            });
        }
      },
  };

  const option = {
    title: {
        text: metric === 'count' ? total.toLocaleString() : formatCurrency(total),
        subtext: metric === 'count' ? 'Total Pipelines' : 'Total Value',
        left: 'center',
        top: 'center',
        textStyle: { fontSize: isMobile ? 24 : 32, fontWeight: 'bold' },
        subtextStyle: { fontSize: isMobile ? 12 : 14, color: '#64748b' } // slate-500
    },
    tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
            if (!params || params.value === undefined) return '';
            const { name, percent, color, data } = params;
            const { originalCount, originalValue } = data;
            return `
                    <div class="flex items-center mb-1 font-bold text-gray-800">
                       <span class="w-3 h-3 rounded-full mr-2" style="background-color: ${color};"></span>
                       <span>${name}</span>
                    </div>
                    <div class="text-sm text-gray-600 pl-5">Pipelines: <strong>${originalCount}</strong> (${percent}%)</div>
                    <div class="text-sm text-gray-600 pl-5">Total Value: <strong>${formatCurrency(originalValue)}</strong></div>`;
        }
    },
    toolbox: {
        show: true,
        feature: {
          dataView: { show: true, readOnly: false, title: "Data View" },
          saveAsImage: { show: true, title: "Save Image" }
        }
    },
    legend: {
        type: 'scroll',
        orient: 'horizontal',
        bottom: 10,
        left: 'center',
        data: chartData.map(d => d.name)
    },
    series: [{
      name: 'Pipelines by Brand',
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      cursor: 'pointer',
      label: {
          show: false,
          position: 'center'
      },
      emphasis: {
          scaleSize: 8,
          label: {
              show: false
          }
      },
      data: chartData,
    }],
  };


  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col" ref={containerRef}>
      <div className="flex-shrink-0 flex justify-between items-start">
        <div>
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 mb-1">Pipelines by Brand</h2>
          <p className="text-sm text-slate-600 mb-4">Distribution of pipelines across different brands.</p>
        </div>
        <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
            <button onClick={() => setMetric('count')} className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${metric === 'count' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-600 hover:bg-slate-200'}`}>Count</button>
            <button onClick={() => setMetric('value')} className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${metric === 'value' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-600 hover:bg-slate-200'}`}>Value</button>
        </div>
      </div>
      {data && data.length > 0 ? (
        <div className="w-full flex-grow min-h-0" role="figure" aria-labelledby={titleId}>
          <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} onEvents={onEvents} notMerge={true} lazyUpdate={true} theme="limperial"/>
        </div>
      ) : (
         <div className="flex flex-col items-center justify-center flex-grow text-slate-600">
            <PieChart className="w-12 h-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium">No brand data to display.</p>
        </div>
      )}
    </div>
  );
};

export default ProjectsByBrandChart;