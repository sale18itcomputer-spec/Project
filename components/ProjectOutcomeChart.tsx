import React, { useRef, useEffect, useId } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { ProjectStatusData } from '../types';
import { PieChart } from 'lucide-react';
import { useFilter } from '../contexts/FilterContext';
import { useWindowSize } from '../hooks/useWindowSize';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { limperialTheme } from './charts/echartsTheme';

echarts.registerTheme('limperial', limperialTheme);

const ECharts = ReactECharts as any;

const getStatusColor = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'close (win)') return '#059669'; // emerald-600
  if (['price request', 'revising specs'].includes(s)) return '#e11d48'; // rose-600
  if (['pending po', 'ordering'].includes(s)) return '#2563eb'; // blue-600
  return '#94a3b8'; // slate-400 for others
};

interface ProjectOutcomeChartProps {
  data: ProjectStatusData[];
}

const ProjectOutcomeChart: React.FC<ProjectOutcomeChartProps> = ({ data }) => {
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { filters, setFilter } = useFilter();
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

  const totalProjects = data.reduce((sum, entry) => sum + entry.value, 0);

  const onEvents = {
    'click': (params: any) => {
      if (params.name) {
        const clickedStatus = params.name;
        const currentStatusFilter = (filters.status || []) as string[];

        // If the clicked status is the only one in the filter, clear the filter. Otherwise, set it.
        if (currentStatusFilter.length === 1 && currentStatusFilter[0] === clickedStatus) {
          setFilter('status', []); // Clear filter
        } else {
          setFilter('status', [clickedStatus]); // Set filter
        }
      }
    }
  };

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (!params || params.value === undefined) return '';
        const { value, name, percent, color } = params;
        return `<div class="p-2">
                    <div class="flex items-center mb-1">
                       <span class="w-3 h-3 rounded-full mr-2" style="background-color: ${color};"></span>
                       <span class="font-bold text-gray-800">${name}</span>
                    </div>
                    <div class="text-sm text-gray-600 pl-5">Pipelines: <strong>${value}</strong> (${percent}%)</div>
                </div>`;
      }
    },
    legend: {
      show: isMobile,
      type: 'scroll',
      orient: 'horizontal',
      bottom: 10,
      textStyle: {
        fontSize: 10,
      }
    },
    toolbox: {
      show: true,
      orient: 'vertical',
      left: 'right',
      top: 'center',
      feature: {
        mark: { show: true },
        dataView: { show: true, readOnly: false, title: "Data View" },
        restore: { show: true, title: "Restore" },
        saveAsImage: { show: true, title: "Save Image" }
      }
    },
    title: {
      text: totalProjects.toString(),
      subtext: 'Pipelines',
      left: 'center',
      top: isMobile ? '35%' : 'center',
      textStyle: { fontSize: isMobile ? 24 : 32, fontWeight: 'bold' },
      subtextStyle: { fontSize: isMobile ? 12 : 14, color: '#6b7280' }
    },
    color: data.map(d => getStatusColor(d.name)),
    series: [
      {
        name: 'Pipeline Status',
        type: 'pie',
        cursor: 'pointer',
        radius: isMobile ? ['30%', '50%'] : ['45%', '60%'],
        center: ['50%', isMobile ? '40%' : '52%'],
        roseType: 'radius',
        itemStyle: {
          borderRadius: 5
        },
        label: {
          show: !isMobile,
          formatter: '{b}\n{c}',
          minMargin: 5,
          edgeDistance: 10,
          lineHeight: 16
        },
        labelLine: {
          show: !isMobile,
          length: 15,
          length2: 0,
          maxSurfaceAngle: 80,
        },
        emphasis: {
          scaleSize: 8,
        },
        data: data.sort((a, b) => b.value - a.value).map(d => ({ value: d.value, name: d.name })),
      }
    ],
  };

  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm h-full flex flex-col" ref={containerRef}>
      <h2 id={titleId} className="text-lg font-semibold text-foreground mb-1 flex-shrink-0">Pipeline Status</h2>
      <p className="text-sm text-muted-foreground mb-4 flex-shrink-0">A summary of all pipelines by their current status.</p>
      {data && data.length > 0 ? (
        <div className="w-full h-full flex-grow min-h-0" role="figure" aria-labelledby={titleId}>
          <ECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} onEvents={onEvents} notMerge={true} lazyUpdate={true} theme="limperial" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-grow text-slate-600">
          <PieChart className="w-12 h-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium">No project outcome data to display.</p>
        </div>
      )}
    </div>
  );
};

export default React.memo(ProjectOutcomeChart);