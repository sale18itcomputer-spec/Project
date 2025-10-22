import React from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { BarChart2 } from 'lucide-react';
import { FilterState } from '../contexts/FilterContext';

interface PerformanceData {
  name: string;
  winValue: number;
  projects: number;
}

interface AssigneePerformanceChartProps {
    data: PerformanceData[];
    setFilter: (key: keyof FilterState, value: string) => void;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const AssigneePerformanceChart: React.FC<AssigneePerformanceChartProps> = ({ data, setFilter }) => {
  const series = [
    {
      name: 'Total Win Value',
      type: 'column',
      data: data.map(d => d.winValue),
    },
    {
      name: 'Pipelines Won',
      type: 'line',
      data: data.map(d => d.projects),
    },
  ];

  const options: ApexOptions = {
    chart: {
      height: 320,
      type: 'line',
      stacked: false,
      toolbar: { show: false },
      events: {
        dataPointSelection: (event, chartContext, config) => {
            const selectedAssignee = config.w.globals.labels[config.dataPointIndex];
            setFilter('responsibleBy', selectedAssignee);
        }
      }
    },
    colors: ['#004aad', '#9ca3af'],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '60%',
        borderRadius: 4,
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: true,
      enabledOnSeries: [0], // Only for the first series (columns)
      formatter: function (val) {
        return new Intl.NumberFormat('en-US').format(val as number);
      },
      offsetY: -20,
      style: {
        fontSize: '12px',
        colors: ["#000000"],
      },
      background: {
        enabled: false,
      }
    },
    stroke: {
      width: [0, 3],
      curve: 'smooth',
    },
    xaxis: {
      categories: data.map(d => d.name),
      labels: {
        style: {
            fontWeight: 500,
        }
      }
    },
    yaxis: [
      {
        seriesName: 'Total Win Value',
        axisTicks: { show: true },
        axisBorder: { show: true, color: '#004aad' },
        labels: {
          style: { colors: '#004aad' },
          formatter: (val) => {
              if (val >= 1000000) return `$${(val/1000000).toFixed(0)}M`;
              if (val >= 1000) return `$${(val/1000).toFixed(0)}K`;
              return `$${val}`;
          },
        },
        title: {
          text: "Total Win Value",
          style: { color: '#004aad', fontWeight: 600 },
        },
      },
      {
        seriesName: 'Pipelines Won',
        opposite: true,
        min: 0,
        max: Math.max(...data.map(d => d.projects)) + 2, // give some padding
        tickAmount: 5,
        axisTicks: { show: true },
        axisBorder: { show: true, color: '#9ca3af' },
        labels: {
          style: { colors: '#9ca3af' },
          formatter: (val) => val.toFixed(0),
        },
        title: {
          text: "Pipelines Won",
          style: { color: '#9ca3af', fontWeight: 600 },
        },
      },
    ],
  };
  
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Assignee Performance</h2>
        <p className="text-sm text-gray-500 mb-4">Pipeline value and count won by each assignee.</p>
        {data && data.length > 0 ? (
            <div className="w-full flex-grow">
                <ReactApexChart options={options} series={series} type="line" height="100%" />
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center flex-grow text-gray-500">
                <BarChart2 className="w-12 h-12 text-gray-300" />
                <p className="mt-4 text-sm font-medium">No performance data to display.</p>
            </div>
        )}
    </div>
  );
};

export default AssigneePerformanceChart;