import React, { useRef, useEffect, useMemo, useId } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { BarChartHorizontal } from 'lucide-react';
import { useFilter } from '../contexts/FilterContext';
import { useWindowSize } from '../hooks/useWindowSize';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { limperialTheme } from './charts/echartsTheme';

echarts.registerTheme('limperial', limperialTheme);

const ECharts = ReactECharts as any;

interface CustomerData {
    name: string;
    winValue: number;
    projectCount: number;
}

interface TopCustomersChartProps {
    data: CustomerData[];
    totalWinValue: number;
    currency: 'USD' | 'KHR';
}

const TopCustomersChart: React.FC<TopCustomersChartProps> = ({ data, totalWinValue, currency }) => {
    const { width } = useWindowSize();
    const isMobile = width ? width < 768 : false;
    const chartRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { filters, setFilter } = useFilter();
    const titleId = useId();

    const formatFullCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            currencyDisplay: currency === 'KHR' ? 'code' : 'symbol',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value).replace('KHR', '៛');
    };

    const formatShortCurrency = (val: number | string) => {
        const num = Number(val);
        const prefix = currency === 'KHR' ? '៛' : '$';
        if (num >= 1000000) return `${prefix}${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${prefix}${Math.round(num / 1000)}k`;
        return `${prefix}${num}`;
    }

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

    const onEvents = {
        'click': (params: any) => {
            if (params.name) {
                // Remove the ranking number before filtering
                const clickedCompany = params.name.replace(/^\d+\.\s*/, '');
                const currentCompanyFilter = (filters.companyName || []) as string[];

                if (currentCompanyFilter.length === 1 && currentCompanyFilter[0] === clickedCompany) {
                    setFilter('companyName', []);
                } else {
                    setFilter('companyName', [clickedCompany]);
                }
            }
        }
    };

    // Sort data descending by winValue to establish ranking
    const rankedData = useMemo(() =>
        [...data]
            .sort((a, b) => b.winValue - a.winValue)
            .map((d, i) => ({ ...d, rank: i + 1 })),
        [data]);

    const option = {
        grid: {
            left: '1%',
            right: '12%',
            bottom: '3%',
            top: '8%',
            containLabel: true,
        },
        toolbox: {
            show: true,
            orient: 'vertical',
            right: 10,
            top: 'center',
            feature: {
                dataView: { show: true, readOnly: false, title: "Data View" },
                saveAsImage: { show: true, title: "Save Image" }
            },
            iconStyle: {
                borderColor: '#9ca3af' // slate-400
            },
        },
        xAxis: {
            type: 'value',
            axisLabel: {
                formatter: (val: number) => formatShortCurrency(val),
                color: '#64748b' // slate-500
            },
            splitLine: {
                lineStyle: {
                    color: '#f1f5f9' // slate-100
                }
            }
        },
        yAxis: {
            type: 'category',
            data: rankedData.map(d => `${d.rank}. ${d.name}`).reverse(),
            axisLabel: {
                fontWeight: 600,
                color: '#334155', // slate-700
                inside: false,
                formatter: (value: string) => {
                    if (isMobile && value.length > 20) {
                        return value.substring(0, 20) + '...';
                    }
                    return value;
                }
            },
            axisTick: { show: false },
            axisLine: { show: false },
        },
        series: [{
            name: 'Total Revenue',
            type: 'bar',
            cursor: 'pointer',
            barMaxWidth: 30,
            data: rankedData.map(d => ({
                value: d.winValue,
                projectCount: d.projectCount,
                name: `${d.rank}. ${d.name}`,
                itemStyle: {
                    color: d.rank <= 3
                        ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                            { offset: 0, color: '#2563eb' }, // blue-600
                            { offset: 1, color: '#004aad' }  // brand-600
                        ])
                        : new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                            { offset: 0, color: '#93c5fd' }, // blue-300
                            { offset: 1, color: '#3b82f6' }  // blue-500
                        ])
                }
            })).reverse(),
            itemStyle: {
                borderRadius: [0, 8, 8, 0],
            },
            emphasis: {
                focus: 'series',
                blur: {
                    itemStyle: {
                        opacity: 0.5,
                    },
                },
            },
            label: {
                show: true,
                position: 'right',
                formatter: (params: any) => new Intl.NumberFormat('en-US').format(params.value),
                color: 'var(--foreground)',
                fontWeight: 'bold',
                distance: 8,
                textShadowBlur: 4,
                textShadowColor: 'var(--background)',
            },
            animationEasing: 'cubicOut',
            animationDelay: (idx: number) => {
                return idx * 50;
            }
        }],
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any) => {
                const param = Array.isArray(params) ? params[0] : params;
                if (!param || param.value === undefined) return '';

                const { value, name, data } = param;
                const { projectCount } = data; // Note: using projectCount property but labeling as Orders

                const percentage = totalWinValue > 0 ? ((value / totalWinValue) * 100).toFixed(1) : 0;

                const color = param.color.colorStops ? param.color.colorStops[1].color : param.color;
                const marker = `<span class="w-3 h-3 rounded-full mr-2 inline-block" style="background-color: ${color};"></span>`;

                return `
                        <div class="font-sans p-2 w-64">
                            <div class="flex items-center mb-2 font-bold text-foreground text-base">
                               ${marker}
                               <span class="truncate">${name.replace(/^\d+\.\s*/, '')}</span>
                            </div>
                            <div class="space-y-1 text-sm pl-5">
                                <div class="flex justify-between items-center">
                                    <span class="text-muted-foreground">Revenue:</span>
                                    <span class="font-semibold text-foreground">${formatFullCurrency(value)}</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-muted-foreground">Orders:</span>
                                    <span class="font-semibold text-foreground">${projectCount}</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-muted-foreground">Contribution:</span>
                                    <span class="font-semibold text-foreground">${percentage}%</span>
                                </div>
                            </div>
                        </div>`;
            }
        },
        legend: { show: false },
    };


    return (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm h-full flex flex-col" ref={containerRef}>
            <div className="flex-shrink-0">
                <h2 id={titleId} className="text-lg font-semibold text-foreground mb-1">Top 10 Customers by Revenue</h2>
                <p className="text-sm text-muted-foreground mb-4">Highest revenue-generating clients from sales orders.</p>
            </div>
            {data && data.length > 0 ? (
                <div className="w-full flex-grow min-h-0" role="figure" aria-labelledby={titleId}>
                    <ECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} onEvents={onEvents} notMerge={true} lazyUpdate={true} theme="limperial" />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center flex-grow text-slate-600">
                    <BarChartHorizontal className="w-12 h-12 text-gray-300" />
                    <p className="mt-4 text-sm font-medium">No customer data to display.</p>
                </div>
            )}
        </div>
    );
};

export default TopCustomersChart;