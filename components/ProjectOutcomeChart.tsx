import React from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ProjectStatusData } from '../types';
import { PieChart } from 'lucide-react';
import { FilterState } from '../contexts/FilterContext';

const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('win')) return '#10b981'; // emerald-500
    if (s.includes('quote submitted')) return '#0ea5e9'; // sky-500
    if (s.includes('lose')) return '#f43f5e'; // rose-500
    return '#94a3b8'; // slate-400
};


interface ProjectOutcomeChartProps {
  data: ProjectStatusData[];
  setFilter: (key: keyof FilterState, value: string) => void;
}

const ProjectOutcomeChart: React.FC<ProjectOutcomeChartProps> = ({ data, setFilter }) => {
  const totalProjects = data.reduce((sum, entry) => sum + entry.value, 0);

  const series = data.map(d => d.value);
  const options: ApexOptions = {
    chart: { 
        type: 'donut', 
        height: '100%',
        events: {
            dataPointSelection: (event, chartContext, config) => {
              const selectedStatus = config.w.globals.labels[config.dataPointIndex];
              setFilter('status', selectedStatus);
            }
        }
    },
    labels: data.map(d => d.name),
    colors: data.map(d => getStatusColor(d.name)),
    plotOptions: {
      pie: {
        expandOnClick: true,
        donut: {
          size: '75%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total Pipelines',
              formatter: () => `${totalProjects}`,
              color: '#1f2937',
              fontWeight: 600,
            }
          }
        }
      }
    },
    legend: { show: false },
    dataLabels: { enabled: false },
    tooltip: {
        theme: 'light',
        custom: function({ series, seriesIndex, w }) {
            const value = series[seriesIndex];
            const name = w.globals.labels[seriesIndex];
            const percentage = totalProjects > 0 ? ((value / totalProjects) * 100).toFixed(1) : 0;
            const color = w.globals.colors[seriesIndex];
            return `<div class="p-2 shadow-lg rounded-lg bg-white border border-gray-200">
                        <div class="flex items-center mb-1">
                           <span class="w-3 h-3 rounded-full mr-2" style="background-color: ${color};"></span>
                           <span class="font-bold text-gray-800">${name}</span>
                        </div>
                        <div class="text-sm text-gray-600 pl-5">Pipelines: <strong>${value}</strong> (${percentage}%)</div>
                    </div>`;
        }
    },
    states: {
      hover: {
        filter: {
          type: 'lighten',
          value: 0.05,
        } as any
      },
      active: {
        filter: {
            type: 'none',
        }
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Pipeline Status</h2>
      <p className="text-sm text-gray-500 mb-4">A summary of all pipelines by their current status.</p>
      {data && data.length > 0 ? (
        <div className="flex flex-col md:flex-row items-center h-full -mt-4">
          <div className="w-full md:w-3/5 h-56 md:h-full">
            <ReactApexChart options={options} series={series} type="donut" height="100%" />
          </div>
          <div className="w-full md:w-2/5 space-y-2 mt-2 md:mt-0 md:pl-2">
            {data.sort((a,b) => b.value - a.value).map(entry => {
                const percentage = totalProjects > 0 ? ((entry.value / totalProjects) * 100).toFixed(0) : 0;
                return (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center truncate">
                            <span className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: getStatusColor(entry.name) }}></span>
                            <span className="text-gray-600 truncate" title={entry.name}>{entry.name}</span>
                        </div>
                        <div className="font-semibold text-gray-800 text-right ml-2">
                            {entry.value} <span className="text-gray-400 font-normal">({percentage}%)</span>
                        </div>
                    </div>
                );
            })}
        </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-56 text-gray-500">
            <PieChart className="w-12 h-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium">No project outcome data to display.</p>
        </div>
      )}
    </div>
  );
};

export default ProjectOutcomeChart;