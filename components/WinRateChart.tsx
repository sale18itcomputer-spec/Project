import React, { useRef, useEffect, useId } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Target } from 'lucide-react';
import { useWindowSize } from '../hooks/useWindowSize';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { limperialTheme } from './charts/echartsTheme';

echarts.registerTheme('limperial', limperialTheme);

const ECharts = ReactECharts as any;

interface WinRateChartProps {
  winRate: number;
  won: number;
  total: number;
}

const WinRateChart: React.FC<WinRateChartProps> = ({ winRate, won, total }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  const option = {
    series: [
      { // Background track
        type: 'gauge',
        center: ['50%', '60%'],
        radius: '90%',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        axisLine: {
          lineStyle: {
            width: 18,
            color: [[1, 'var(--muted)']],
            roundCap: true,
          }
        },
        detail: { show: false },
      },
      { // Main progress gauge
        type: 'gauge',
        center: ['50%', '60%'],
        radius: '90%',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        axisLine: {
          lineStyle: {
            width: 18,
            color: [
              [0.4, '#f43f5e'], // rose-500
              [0.6, '#f59e0b'], // amber-500
              [1, '#10b981']   // emerald-500
            ],
          }
        },
        progress: {
          show: true,
          roundCap: true,
          width: 18,
          itemStyle: {
            color: 'auto',
            shadowColor: 'rgba(0, 0, 0, 0.25)',
            shadowBlur: 10,
            shadowOffsetY: 4
          }
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        data: [{
          value: winRate,
          name: `${won} won of ${total}`,
          title: {
            offsetCenter: ['0%', '35%'],
            fontSize: 16,
            fontWeight: 500,
            color: 'var(--muted-foreground)'
          },
          detail: {
            valueAnimation: true,
            formatter: (value: number) => `${value.toFixed(1)}%`,
            fontSize: 40,
            fontWeight: '700',
            color: 'auto',
            offsetCenter: ['0%', '10%']
          },
        }],
      }
    ],
    tooltip: {
      formatter: (params: any) => {
        if (!params || params.value === undefined) return '';
        return `Win Rate: <strong>${params.value.toFixed(1)}%</strong><br/>(${won} won out of ${total} closed deals)`;
      }
    }
  };

  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm h-full flex flex-col" ref={containerRef}>
      <h2 id={titleId} className="text-lg font-semibold text-foreground mb-1 flex-shrink-0">Pipeline Win Rate</h2>
      <p className="text-sm text-muted-foreground mb-2 flex-shrink-0">Percentage of deals won vs. lost.</p>
      {total > 0 ? (
        <div className="h-full w-full flex-grow min-h-0 -mt-8" role="figure" aria-labelledby={titleId}>
          <ECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} theme="limperial" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-grow text-slate-600">
          <Target className="w-12 h-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium">No win/loss data to display.</p>
        </div>
      )}
    </div>
  );
};

export default React.memo(WinRateChart);