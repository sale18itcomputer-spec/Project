import React, { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Target } from 'lucide-react';
import { useWindowSize } from '../hooks/useWindowSize';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { limperialTheme } from './charts/echartsTheme';

echarts.registerTheme('limperial', limperialTheme);

interface WinRateChartProps {
  winRate: number;
  won: number;
  total: number;
}

const WinRateChart: React.FC<WinRateChartProps> = ({ winRate, won, total }) => {
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const option = {
    series: [
      {
        type: 'gauge',
        center: ['50%', isMobile ? '70%' : '60%'],
        radius: '100%',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        axisLine: {
          lineStyle: {
            width: isMobile ? 14 : 18,
            color: [
              [0.25, '#f43f5e'], // Red for 0-25%
              [0.5, '#f59e0b'], // Amber for 25-50%
              [1, '#10b981']   // Emerald for 50-100%
            ]
          }
        },
        pointer: {
          itemStyle: {
            color: 'auto'
          },
          length: '75%',
          width: 6,
        },
        axisTick: {
          distance: -25,
          length: 6,
          lineStyle: {
            color: '#fff',
            width: 1
          }
        },
        splitLine: {
          distance: -25,
          length: 12,
          lineStyle: {
            color: '#fff',
            width: 2
          }
        },
        axisLabel: {
          color: '#6b7280',
          distance: isMobile ? 10 : 25,
          fontSize: 10,
          formatter: function (value: number) {
            if ([0, 25, 50, 75, 100].includes(value)) {
              return value + '%';
            }
            return '';
          }
        },
        anchor: {
            show: true,
            showAbove: true,
            size: 16,
            itemStyle: {
                borderColor: '#fff',
                borderWidth: 4,
                shadowBlur: 10,
                shadowColor: 'rgba(0,0,0,0.2)'
            }
        },
        data: [{
          value: winRate,
          name: `${won} won of ${total}`,
          title: {
            offsetCenter: ['0%', isMobile ? '20%' : '35%'],
            fontSize: isMobile ? 12 : 16,
            fontWeight: 500,
            color: '#6b7280'
          },
          detail: {
            valueAnimation: true,
            formatter: (value: number) => `${value.toFixed(1)}%`,
            fontSize: isMobile ? 32 : 40,
            fontWeight: '700',
            color: 'auto',
            offsetCenter: ['0%', isMobile ? '-5%' : '10%']
          },
        }],
      }
    ],
    tooltip: {
        formatter: (params: any) => {
            if (!params || params.value === undefined) return '';
            return `Win Rate: <strong>${params.value.toFixed(1)}%</strong>`;
        }
    }
  };
  
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col" ref={containerRef}>
      <h2 className="text-lg font-semibold text-gray-900 mb-1 flex-shrink-0">Pipeline Win Rate</h2>
      <p className="text-sm text-gray-500 mb-2 flex-shrink-0">Percentage of deals won vs. lost.</p>
      {total > 0 ? (
        <div className="h-full w-full flex-grow min-h-0 -mt-4">
          <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} theme="limperial" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-grow text-gray-500">
          <Target className="w-12 h-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium">No win/loss data to display.</p>
        </div>
      )}
    </div>
  );
};

export default WinRateChart;