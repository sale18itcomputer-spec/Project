import { EChartsOption } from 'echarts';

// A modern, sleek theme that adapts to B2B dark mode using CSS variables
const colors = {
  primary: '#0d9488',    // teal-600
  secondary: '#f59e0b',  // amber-500
  accent: '#6366f1',     // indigo-500
  text: 'rgba(0,0,0,0.85)', // Default, but overridden if possible or using CSS variables
  textSecondary: '#64748b',
  axisLine: '#cbd5e1',
  splitLine: 'rgba(0,0,0,0.05)',
  bg: 'transparent',
  tooltipBg: '#ffffff',
  shadow: 'rgba(0, 0, 0, 0.08)'
};

export const limperialTheme: EChartsOption = {
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
      shadowOffsetY: 4
    },
    symbolSize: 8,
    symbol: 'circle',
    smooth: true,
  },
  bar: {
    itemStyle: {
      borderRadius: [6, 6, 0, 0]
    },
    barMaxWidth: 40
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
      color: colors.textSecondary
    }
  },
  gauge: {
    axisLine: {
      lineStyle: {
        width: 20,
        color: [
          [1, colors.splitLine]
        ]
      }
    },
    progress: {
      show: true,
      roundCap: true,
      width: 20,
      itemStyle: {
        shadowBlur: 10,
        shadowColor: colors.shadow
      }
    },
    pointer: {
      show: false
    },
    detail: {
      valueAnimation: true,
      fontSize: 40,
      fontWeight: 'bold',
      offsetCenter: [0, '0%']
    },
  },
  tooltip: {
    trigger: 'axis',
    backgroundColor: colors.tooltipBg,
    borderColor: colors.splitLine,
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
        type: 'dashed'
      },
      crossStyle: {
        color: colors.axisLine,
        width: 1,
        type: 'dashed'
      },
      shadowStyle: {
        color: 'rgba(200,200,200,0.2)'
      }
    },
    extraCssText: 'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1); border-radius: 8px; padding: 12px; backdrop-filter: blur(4px);',
  },
  xAxis: {
    axisLine: {
      show: true,
      lineStyle: {
        color: colors.axisLine,
      },
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      margin: 12,
    },
    splitLine: {
      show: false,
    },
  },
  yAxis: {
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
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
      color: colors.bg
    },
    dataBackground: {
      areaStyle: { color: colors.splitLine },
      lineStyle: { opacity: 0.8, color: colors.axisLine }
    },
    selectedDataBackground: {
      areaStyle: { color: colors.primary, opacity: 0.2 },
      lineStyle: { color: colors.primary }
    },
    textStyle: {
      color: colors.textSecondary
    }
  },
  legend: {
    textStyle: {
      color: colors.textSecondary,
    },
    inactiveColor: '#ccc',
    pageTextStyle: {
      color: colors.textSecondary,
    }
  },
  toolbox: {
    iconStyle: {
      borderColor: colors.textSecondary,
    },
    emphasis: {
      iconStyle: {
        borderColor: colors.text,
      },
    },
  },
  animation: true,
  animationDuration: 1000,
  animationEasing: 'cubicOut',
  animationThreshold: 2000,
};
