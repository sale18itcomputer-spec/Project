import React from 'react';
import ReactApexChart from 'react-apexcharts';
// The 'ApexAxisChartSeries' type is not reliably exported; removing the explicit type annotation for broader compatibility.
import type { ApexOptions } from 'apexcharts';
import { BarChart2 } from 'lucide-react';

interface MonthlyWinValueData {
  name: string; // e.g., "Apr 2024", "Q2 2024", "2024"
  winValue: number;
}

type Period = 'monthly' | 'quarterly' | 'yearly';

interface MonthlyWinValueChartProps {
    data: MonthlyWinValueData[];
    period: Period;
    onPeriodChange: (period: Period) => void;
}

const formatCurrency = (value: number) => {
    if (!value) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
};

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

const MonthlyWinValueChart: React.FC<MonthlyWinValueChartProps> = ({ data, period, onPeriodChange }) => {
  
  // Remove explicit ApexAxisChartSeries type annotation to prevent potential build errors.
  const series = [
    {
      name: 'Revenue',
      type: 'column',
      data: data.map(d => Math.round(d.winValue)),
    },
  ];

  const options: ApexOptions = {
    chart: {
      type: 'line',
      height: '100%',
      toolbar: { show: false },
      selection: {
        enabled: true,
        type: 'x',
        fill: {
          color: '#004aad',
          opacity: 0.1
        },
      },
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        horizontal: false,
        columnWidth: '60%',
        dataLabels: {
          position: 'top',
        },
      }
    },
    dataLabels: {
        enabled: true,
        enabledOnSeries: [0],
        formatter: (val) => new Intl.NumberFormat('en-US').format(val as number),
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
      width: [0],
      curve: 'smooth',
    },
    colors: ['#004aad'],
    xaxis: {
      categories: data.map(d => d.name),
      tickPlacement: 'on',
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
        formatter: (val) => formatCurrency(val),
        style: {
            colors: '#6b7280',
            fontSize: '12px',
        }
      }
    },
    tooltip: {
      theme: 'light',
      shared: true,
      intersect: false,
      custom: function({ series, seriesIndex, dataPointIndex, w }) {
          const periodName = w.globals.labels[dataPointIndex];
          const revenue = series[0][dataPointIndex];
          if (revenue === undefined) return '';
          
          const revenueColor = w.globals.colors[0];
          
          return `
              <div class="p-2.5 shadow-lg rounded-lg bg-white border border-gray-200 text-sm">
                  <div class="font-bold text-gray-800 mb-2">${periodName}</div>
                  <div class="flex items-center mb-1">
                      <span class="w-3 h-3 rounded-full mr-2" style="background-color: ${revenueColor};"></span>
                      <span class="text-gray-600">Revenue:</span>
                      <span class="font-semibold text-gray-800 ml-auto">${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(revenue)}</span>
                  </div>
              </div>`;
      }
    },
    grid: {
      borderColor: '#f3f4f6',
      strokeDashArray: 3,
    },
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
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
        <div className="flex justify-between items-start mb-4 flex-shrink-0">
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">{chartTitle}</h2>
                <p className="text-sm text-gray-500">Revenue from won projects. Click and drag to zoom.</p>
            </div>
            <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                <ToggleButton period='monthly' label='Monthly' activePeriod={period} onClick={onPeriodChange} />
                <ToggleButton period='quarterly' label='Quarterly' activePeriod={period} onClick={onPeriodChange} />
                <ToggleButton period='yearly' label='Yearly' activePeriod={period} onClick={onPeriodChange} />
            </div>
        </div>
      {data && data.length > 0 ? (
        <div className="w-full flex-grow">
            <ReactApexChart options={options} series={series} type="line" height="100%" />
        </div>
      ) : (
         <div className="flex flex-col items-center justify-center flex-grow text-gray-500">
            <BarChart2 className="w-12 h-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium">No revenue data to display for the selected filters.</p>
        </div>
      )}
    </div>
  );
};

export default MonthlyWinValueChart;