import { EChartsOption } from 'echarts';
import * as React from 'react';

// Call this each time you need a fresh theme that reflects current dark/light mode.
// Charts re-register on theme toggle via AppProviders.
export function buildLimperialTheme(): EChartsOption {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  const colors = {
    primary: '#0d9488',   // teal-600
    secondary: '#f59e0b', // amber-500
    accent: '#6366f1',    // indigo-500
    text: isDark ? 'rgba(240,236,228,0.90)' : 'rgba(0,0,0,0.85)',
    textSecondary: isDark ? '#a09a8e' : '#64748b',
    axisLine: isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1',
    splitLine: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    bg: 'transparent',
    tooltipBg: isDark ? '#2f2f2c' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.10)' : '#e2e8f0',
    shadow: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.08)',
  };

  return {
    color: [
      colors.primary,
      colors.secondary,
      colors.accent,
      '#ec4899', // pink-500
      '#84cc16', // lime-500
      '#3b82f6', // blue-500
    ],
    backgroundColor: colors.bg,
    textStyle: {
      fontFamily: 'Inter var, Inter, sans-serif',
      color: colors.text,
    },
    title: {
      textStyle: {
        color: colors.text,
        fontWeight: 'bold',
      },
      subtextStyle: {
        color: colors.textSecondary,
      },
    },
    line: {
      itemStyle: {
        borderWidth: 2,
      },
      lineStyle: {
        width: 3,
        shadowColor: colors.shadow,
        shadowBlur: 8,
        shadowOffsetY: 4,
      },
      symbolSize: 8,
      symbol: 'circle',
      smooth: true,
    },
    bar: {
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
      },
      barMaxWidth: 40,
    },
    pie: {
      itemStyle: {
        borderRadius: 8,
        borderColor: colors.bg,
        borderWidth: 2,
        shadowColor: colors.shadow,
        shadowBlur: 10,
      },
      label: {
        color: colors.textSecondary,
      },
    },
    gauge: {
      axisLine: {
        lineStyle: {
          width: 20,
          color: [[1, colors.splitLine]],
        },
      },
      progress: {
        show: true,
        roundCap: true,
        width: 20,
        itemStyle: {
          shadowBlur: 10,
          shadowColor: colors.shadow,
        },
      },
      pointer: { show: false },
      detail: {
        valueAnimation: true,
        fontSize: 40,
        fontWeight: 'bold',
        offsetCenter: [0, '0%'],
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: colors.text,
        fontSize: 13,
      },
      axisPointer: {
        type: 'cross',
        lineStyle: {
          color: colors.axisLine,
          width: 1,
          type: 'dashed',
        },
        crossStyle: {
          color: colors.axisLine,
          width: 1,
          type: 'dashed',
        },
        shadowStyle: {
          color: 'rgba(200,200,200,0.2)',
        },
      },
      extraCssText:
        'box-shadow: 0 8px 24px rgba(0,0,0,0.1); border-radius: 8px; padding: 12px; backdrop-filter: blur(4px);',
    },
    xAxis: {
      axisLine: {
        show: true,
        lineStyle: { color: colors.axisLine },
      },
      axisTick: { show: false },
      axisLabel: {
        color: colors.textSecondary,
        fontSize: 12,
        margin: 12,
      },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: colors.textSecondary,
        fontSize: 12,
        margin: 12,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: colors.splitLine,
          type: 'dashed',
        },
      },
    },
    dataZoom: {
      handleStyle: {
        borderColor: colors.primary,
        color: colors.bg,
      },
      dataBackground: {
        areaStyle: { color: colors.splitLine },
        lineStyle: { opacity: 0.8, color: colors.axisLine },
      },
      selectedDataBackground: {
        areaStyle: { color: colors.primary, opacity: 0.2 },
        lineStyle: { color: colors.primary },
      },
      textStyle: { color: colors.textSecondary },
    },
    legend: {
      textStyle: { color: colors.textSecondary },
      inactiveColor: '#ccc',
      pageTextStyle: { color: colors.textSecondary },
    },
    toolbox: {
      iconStyle: { borderColor: colors.textSecondary },
      emphasis: {
        iconStyle: { borderColor: colors.text },
      },
    },
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    animationThreshold: 2000,
  };
}

// Static export used for the initial echarts.registerTheme() call at module load time.
// AppProviders re-calls buildLimperialTheme() and re-registers on every dark/light toggle.
export const limperialTheme = buildLimperialTheme();

/**
 * Shared hook for chart resize + deferred render logic.
 * Fixes two bugs:
 *  1. ResizeObserver cleanup was skipped when containerRef was null at setup time.
 *  2. 50ms delay was too short for flex containers to settle their dimensions.
 *     We now use a two-phase approach: mark ready after 100ms, then trigger a
 *     resize after 200ms to catch any late layout shifts.
 */
export function useChartReady(
  containerRef: React.RefObject<HTMLDivElement | null> | React.MutableRefObject<HTMLDivElement | null>,
  chartRef: React.RefObject<any> | React.MutableRefObject<any>,
  extraDeps: any[] = []
) {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    const resize = () => {
      const instance = chartRef.current?.getEchartsInstance?.();
      if (instance) instance.resize();
    };

    // Phase 1: mark ready after flex layout has settled
    const t1 = setTimeout(() => {
      if (mounted) setIsReady(true);
    }, 100);

    // Phase 2: trigger a resize after the chart has rendered
    const t2 = setTimeout(() => {
      if (mounted) resize();
    }, 250);

    const observer = new ResizeObserver(resize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      mounted = false;
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
    };
  }, extraDeps);

  return isReady;
}
