import React from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { BarChartHorizontal } from 'lucide-react';
import { FilterState } from '../contexts/FilterContext';

interface CustomerData {
  name: string;
  winValue: number;
}

interface TopCustomersChartProps {
    data: CustomerData[];
    totalWinValue: number;
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

const formatShortCurrency = (val: number | string) => {
    const num = Number(val);
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${Math.round(num/1000)}k`;
    return `$${num}`;
}


const TopCustomersChart: React.FC<TopCustomersChartProps> = ({ data, totalWinValue, setFilter }) => {
    const series = [{
        name: 'Total Win Value',
        data: data.map(d => d.winValue)
    }];
    
    const options: ApexOptions = {
        chart: { 
            type: 'bar', 
            toolbar: { show: false },
            events: {
                dataPointSelection: (event, chartContext, config) => {
                    const selectedCustomer = config.w.globals.labels[config.dataPointIndex];
                    setFilter('companyName', selectedCustomer);
                }
            }
        },
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 4,
                barHeight: '60%',
                distributed: false,
            }
        },
        dataLabels: {
            enabled: true,
            formatter: (val: number) => {
                return new Intl.NumberFormat('en-US').format(val);
            },
            textAnchor: 'end',
            offsetX: -5,
            style: {
                fontSize: '12px',
                fontWeight: 600,
                colors: ['#fff']
            }
        },
        xaxis: {
            categories: data.map(d => d.name),
            labels: {
                formatter: (val: string) => formatShortCurrency(val),
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
                const percentage = totalWinValue > 0 ? ((value / totalWinValue) * 100).toFixed(1) : 0;
                const color = Array.isArray(w.globals.colors) ? w.globals.colors[0] : w.globals.colors;
                return `<div class="p-2 shadow-lg rounded-lg bg-white border border-gray-200">
                            <div class="flex items-center mb-1">
                               <span class="w-3 h-3 rounded-full mr-2" style="background-color: ${color};"></span>
                               <span class="font-bold text-gray-800">${name}</span>
                            </div>
                            <div class="text-sm text-gray-600 pl-5">Win Value: <strong>${formatCurrency(value)}</strong></div>
                            <div class="text-sm text-gray-600 pl-5">Contribution: <strong>${percentage}%</strong></div>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Top 10 Customers by Revenue</h2>
          <p className="text-sm text-gray-500 mb-4">Highest revenue-generating clients from won pipelines.</p>
      </div>
      {data && data.length > 0 ? (
        <div className="w-full flex-grow min-h-0">
            <ReactApexChart options={options} series={series} type="bar" height="100%" />
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