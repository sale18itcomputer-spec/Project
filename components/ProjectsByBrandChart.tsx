import React from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { BarChartHorizontal } from 'lucide-react';
import { FilterState } from '../contexts/FilterContext';

interface BrandData {
  name: string;
  count: number;
}

interface ProjectsByBrandChartProps {
    data: BrandData[];
    setFilter: (key: keyof FilterState, value: string) => void;
}

const ProjectsByBrandChart: React.FC<ProjectsByBrandChartProps> = ({ data, setFilter }) => {
  const totalProjects = data.reduce((sum, item) => sum + item.count, 0);
  
  const series = [{
    name: 'Pipeline Count',
    data: data.map(d => d.count),
  }];

  const options: ApexOptions = {
    chart: { 
        type: 'bar', 
        toolbar: { show: false },
        events: {
            dataPointSelection: (event, chartContext, config) => {
                const selectedBrand = config.w.globals.labels[config.dataPointIndex];
                setFilter('brand1', selectedBrand);
            }
        }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        barHeight: '50%',
        distributed: false,
      }
    },
    dataLabels: { 
        enabled: true,
        textAnchor: 'start',
        style: {
            colors: ['#fff'],
            fontWeight: 600,
        },
        offsetX: 10,
    },
    xaxis: {
      categories: data.map(d => d.name),
      labels: {
        style: {
            colors: '#6b7280',
            fontSize: '12px',
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        show: true,
        maxWidth: 160,
        style: {
            fontSize: '12px',
            colors: ['#4b5563'],
            fontWeight: 500,
        }
      }
    },
    tooltip: {
        theme: 'light',
        custom: function({ series, seriesIndex, dataPointIndex, w }) {
            const value = series[seriesIndex][dataPointIndex];
            const name = w.globals.labels[dataPointIndex];
            const percentage = totalProjects > 0 ? ((value / totalProjects) * 100).toFixed(1) : 0;
            const color = Array.isArray(w.globals.colors) ? w.globals.colors[0] : w.globals.colors;
            return `<div class="p-2 shadow-lg rounded-lg bg-white border border-gray-200">
                        <div class="flex items-center mb-1">
                           <span class="w-3 h-3 rounded-full mr-2" style="background-color: ${color};"></span>
                           <span class="font-bold text-gray-800">${name}</span>
                        </div>
                        <div class="text-sm text-gray-600 pl-5">Pipelines: <strong>${value}</strong> (${percentage}%)</div>
                    </div>`;
        }
    },
    grid: {
      borderColor: '#f3f4f6',
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    colors: ['#004aad'],
    legend: { show: false },
  };


  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
      <div className="flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Pipelines by Brand</h2>
        <p className="text-sm text-gray-500 mb-4">Distribution of pipelines across different brands.</p>
      </div>
      {data && data.length > 0 ? (
        <div className="w-full flex-grow min-h-0">
          <ReactApexChart options={options} series={series} type="bar" height="100%" />
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