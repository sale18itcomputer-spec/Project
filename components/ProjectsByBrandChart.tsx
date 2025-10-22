import React, { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { BarChartHorizontal } from 'lucide-react';
import { useFilter } from '../contexts/FilterContext';
import { useWindowSize } from '../hooks/useWindowSize';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { limperialTheme } from './charts/echartsTheme';

echarts.registerTheme('limperial', limperialTheme);

interface BrandData {
  name: string;
  count: number;
}

interface ProjectsByBrandChartProps {
    data: BrandData[];
}

const ProjectsByBrandChart: React.FC<ProjectsByBrandChartProps> = ({ data }) => {
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

  const totalProjects = data.reduce((sum, item) => sum + item.count, 0);
  
  const onEvents = {
      'click': (params: any) => {
          if (params.name) {
              const clickedBrand = params.name;
              const currentBrandFilter = (filters.brand1 || []) as string[];

              if (currentBrandFilter.length === 1 && currentBrandFilter[0] === clickedBrand) {
                  setFilter('brand1', []);
              } else {
                  setFilter('brand1', [clickedBrand]);
              }
          }
      }
  };

  const option = {
    grid: {
        left: '1%',
        right: '15%',
        bottom: '3%',
        top: '3%',
        containLabel: true,
    },
    xAxis: {
        type: 'value',
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
      name: 'Pipeline Count',
      type: 'bar',
      cursor: 'pointer',
      data: data.map(d => d.count).reverse(),
      itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#91cc75' },
              { offset: 1, color: '#3ba272' }
          ])
      },
      emphasis: {
          itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: '#b6e09a' },
                  { offset: 1, color: '#54b78a' }
              ])
          }
      },
      label: {
          show: true,
          position: 'right',
          fontWeight: '600',
      },
    }],
    tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
            const param = Array.isArray(params) ? params[0] : params;
            if (!param || param.value === undefined) return '';

            const value = param.value;
            const name = param.name;
            const percentage = totalProjects > 0 ? ((value / totalProjects) * 100).toFixed(1) : 0;
            const marker = `<span class="w-3 h-3 rounded-full mr-2 inline-block" style="background-color: ${param.color.colorStops ? param.color.colorStops[1].color : param.color};"></span>`;
            
            return `
                    <div class="flex items-center mb-1 font-bold text-gray-800">
                        ${marker}
                        <span>${name}</span>
                    </div>
                    <div class="text-sm text-gray-600 pl-5">Pipelines: <strong>${value}</strong> (${percentage}%)</div>`;
        }
    },
    legend: { show: false },
  };


  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col" ref={containerRef}>
      <div className="flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Pipelines by Brand</h2>
        <p className="text-sm text-gray-500 mb-4">Distribution of pipelines across different brands.</p>
      </div>
      {data && data.length > 0 ? (
        <div className="w-full flex-grow min-h-0">
          <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} onEvents={onEvents} notMerge={true} lazyUpdate={true} theme="limperial"/>
        </div>
      ) : (
         <div className="flex flex-col items-center justify-center flex-grow text-gray-500">
            <BarChartHorizontal className="w-12 h-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium">No brand data to display.</p>
        </div>
      )}
    </div>
  );
};

export default ProjectsByBrandChart;