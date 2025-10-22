import { EChartsOption } from 'echarts';

// Using the brand colors from the Tailwind config
const colors = {
  primary: '#004aad', // brand-600
  secondary: '#60a5fa', // brand-300
  accent: '#93c5fd', // brand-200
  light: '#dbeafe', // brand-50
  text: '#1f2937', // gray-800
  textSecondary: '#6b7280', // gray-500
  axisLine: '#d1d5db', // gray-300
  splitLine: '#e5e7eb', // gray-200
  bg: '#ffffff',
  tooltipBg: 'rgba(255, 255, 255, 0.95)',
};

export const limperialTheme: EChartsOption = {
  color: [
    colors.primary,
    '#5470c6',
    '#91cc75',
    '#fac858',
    '#ee6666',
    '#73c0de',
    '#3ba272',
    '#fc8452',
    '#9a60b4',
    '#ea7ccc',
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
      borderWidth: 1,
    },
    lineStyle: {
      width: 2,
    },
    symbolSize: 4,
    symbol: 'circle',
    smooth: true,
  },
  bar: {
    itemStyle: {
        borderRadius: [4, 4, 0, 0]
    }
  },
  pie: {
    itemStyle: {
      borderWidth: 0,
    },
  },
  gauge: {
    axisLine: {
        lineStyle: {
            width: 18,
            color: [[1, '#f3f4f6']]
        }
    },
    progress: {
        itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
        }
    }
  },
  tooltip: {
    trigger: 'axis',
    backgroundColor: colors.tooltipBg,
    borderColor: colors.splitLine,
    borderWidth: 1,
    textStyle: {
      color: colors.text,
      fontSize: 12,
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
    extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 8px; padding: 10px;',
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
    },
    dataBackground: {
        areaStyle: { color: colors.accent },
        lineStyle: { opacity: 0.8, color: colors.secondary }
    },
    selectedDataBackground: {
        areaStyle: { color: colors.secondary },
        lineStyle: { color: colors.primary }
    },
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
