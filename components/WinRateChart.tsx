import React from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { Target } from 'lucide-react';

interface WinRateChartProps {
  winRate: number;
  won: number;
  total: number;
}

const WinRateChart: React.FC<WinRateChartProps> = ({ winRate, won, total }) => {
  const series = [winRate];
  
  const options: ApexOptions = {
    chart: {
      type: 'radialBar',
      height: '100%',
    },
    plotOptions: {
      radialBar: {
        hollow: {
          margin: 15,
          size: '70%',
        },
        track: {
          background: '#f3f4f6',
          strokeWidth: '100%',
        },
        dataLabels: {
          show: true,
          // Cast dataLabels.name to 'any' to bypass a TypeScript error with an outdated ApexCharts type definition for the 'formatter' property.
          name: {
            show: true,
            offsetY: 28,
            formatter: () => `${won} won of ${total}`,
            color: '#4b5563',
            fontSize: '1rem',
            fontWeight: 500,
          } as any,
          value: {
            formatter: (val) => `${val.toFixed(1)}%`,
            offsetY: -10,
            color: '#111827',
            fontSize: '2.5rem',
            fontWeight: '700',
            show: true,
          },
        },
      }
    },
    colors: ['#004aad'],
    stroke: {
      lineCap: 'round'
    },
    tooltip: {
      enabled: true,
      theme: 'light',
      y: {
        formatter: (val) => `${val.toFixed(1)}%`,
        title: {
          formatter: (seriesName) => seriesName,
        },
      },
      style: { fontSize: '12px' }
    },
    labels: ['Win Rate'],
  };
  
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Pipeline Win Rate</h2>
      <p className="text-sm text-gray-500 mb-2">Percentage of deals won vs. lost.</p>
      {total > 0 ? (
        <div className="h-56 w-full -mt-4">
          <ReactApexChart options={options} series={series} type="radialBar" height="100%" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-56 text-gray-500">
          <Target className="w-12 h-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium">No win/loss data to display.</p>
        </div>
      )}
    </div>
  );
};

export default WinRateChart;