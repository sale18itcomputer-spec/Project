'use client';

import React, { useMemo, useRef, useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useB2BData } from "../../../hooks/useB2BData";
import { useAuth } from "../../../contexts/AuthContext";
import { useDebouncedCallback } from 'use-debounce';

const AnalyticsDashboard: React.FC = () => {
    const { quotations, saleOrders, projects, invoices, fetchModule } = useB2BData();
    const { currentUser } = useAuth();
    const chartRef1 = useRef<any>(null);
    const chartRef2 = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [shouldRender, setShouldRender] = useState(false);

    // Ensure needed lazy modules are loaded for analytics charts
    useEffect(() => {
        fetchModule('Quotations', 'Sale Orders', 'Invoices');
    }, [fetchModule]);

    const handleResize = useDebouncedCallback(() => {
        chartRef1.current?.getEchartsInstance().resize();
        chartRef2.current?.getEchartsInstance().resize();
    }, 150);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldRender(true);
            handleResize();
        }, 50);

        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(containerRef.current);

        return () => {
            clearTimeout(timer);
            resizeObserver.disconnect();
        };
    }, [handleResize]);

    // --- Data Preparation ---
    const data = useMemo(() => {
        // Filter Function relying on Role
        const canView = (itemUser?: string, itemPreparer?: string) => {
            if (currentUser?.Role === 'Admin') return true;
            if (itemUser && itemUser === currentUser?.Name) return true;
            if (itemPreparer && itemPreparer === currentUser?.Name) return true;
            return false;
        };

        const pendingCounts = {
            Quotations: 0,
            SaleOrders: 0,
            Projects: 0,
            Invoices: 0,
            Meetings: 0
        };

        const statusDistribution: Record<string, Record<string, number>> = {
            Quotations: {},
            SaleOrders: {},
            Projects: {},
            Invoices: {}
        };

        // Helper to add to status dist
        const addStatus = (type: string, status: string) => {
            if (!statusDistribution[type][status]) statusDistribution[type][status] = 0;
            statusDistribution[type][status]++;
        };

        // 1. Quotations
        quotations?.forEach(q => {
            if (!canView(q['Created By'], q['Prepared By'])) return;
            addStatus('Quotations', q.Status);
            if (q.Status === 'Open') {
                pendingCounts.Quotations++;
            }
        });

        // 2. Sale Orders
        saleOrders?.forEach(so => {
            if (!canView(so['Created By'], so['Prepared By'])) return;
            addStatus('SaleOrders', so.Status);
            if (so.Status === 'Pending') {
                pendingCounts.SaleOrders++;
            }
        });

        projects?.forEach(p => {
            if (currentUser?.Role !== 'Admin' && p['Responsible By'] !== currentUser?.Name) return;
            addStatus('Projects', p.Status);

            const status = (p.Status || '').toLowerCase();
            if (!status.includes('close')) {
                pendingCounts.Projects++;
            }
        });

        // 4. Invoices
        invoices?.forEach(inv => {
            if (currentUser?.Role !== 'Admin' && inv['Created By'] !== currentUser?.Name) return;
            addStatus('Invoices', inv.Status);
            if (['Draft', 'Processing'].includes(inv.Status)) {
                pendingCounts.Invoices++;
            }
        });

        return {
            pendingCounts,
            statusDistribution
        };

    }, [quotations, saleOrders, projects, invoices, currentUser]);

    // --- Chart Options ---

    const totalPending = Object.values(data.pendingCounts).reduce((a, b) => a + b, 0);

    const pendingOption = {
        title: { show: false },
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderColor: 'rgba(0, 74, 173, 0.12)',
            borderWidth: 1,
            padding: [12, 16],
            borderRadius: 12,
            textStyle: {
                color: 'hsl(var(--foreground))',
                fontSize: 12,
                fontFamily: 'Inter, sans-serif'
            },
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            formatter: (params: any) => {
                return `
                    <div style="font-weight: 700; margin-bottom: 8px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">${params.name}</div>
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 24px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${params.color}"></span>
                            <span style="font-weight: 800; font-size: 16px;">${params.value}</span>
                        </div>
                        <span style="color: #004aad; font-size: 12px; font-weight: 700; background: rgba(0, 74, 173, 0.05); padding: 2px 8px; border-radius: 6px;">${params.percent}%</span>
                    </div>
                `;
            }
        },
        legend: {
            bottom: '2%',
            left: 'center',
            icon: 'circle',
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 16,
            textStyle: {
                fontSize: 11,
                fontWeight: '600',
                color: 'hsl(var(--muted-foreground))',
                fontFamily: 'Inter, sans-serif'
            }
        },
        series: [
            {
                name: 'Pending Distribution',
                type: 'pie',
                radius: ['64%', '80%'],
                center: ['50%', '42%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 2,
                    borderColor: 'hsl(var(--card))',
                    borderWidth: 1
                },
                label: { show: false },
                emphasis: {
                    scale: true,
                    scaleSize: 4,
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                data: [
                    { value: data.pendingCounts.Projects, name: 'Projects', itemStyle: { color: '#004aad' } },
                    { value: data.pendingCounts.Quotations, name: 'Quotations', itemStyle: { color: '#3077d3' } },
                    { value: data.pendingCounts.SaleOrders, name: 'Orders', itemStyle: { color: '#60a5fa' } },
                    { value: data.pendingCounts.Invoices, name: 'Invoices', itemStyle: { color: '#94a3b8' } },
                    { value: data.pendingCounts.Meetings, name: 'Meetings', itemStyle: { color: '#cbd5e1' } }
                ]
            }
        ],
        graphic: [
            {
                type: 'text',
                left: 'center',
                top: '35%',
                style: {
                    text: totalPending,
                    textAlign: 'center',
                    fill: 'hsl(var(--foreground))',
                    fontSize: 44,
                    fontWeight: '900',
                    fontFamily: 'Inter, sans-serif'
                }
            },
            {
                type: 'text',
                left: 'center',
                top: '49%',
                style: {
                    text: 'TOTAL ITEMS',
                    textAlign: 'center',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 10,
                    fontWeight: '700',
                    letterSpacing: 2,
                    fontFamily: 'Inter, sans-serif'
                }
            }
        ]
    };

    const statusOption = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow',
                shadowStyle: {
                    color: 'rgba(0, 74, 173, 0.05)'
                }
            },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: 'rgba(0, 74, 173, 0.1)',
            borderWidth: 1,
            textStyle: { color: '#1a1a1a', fontSize: 12 },
            padding: [10, 15],
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        },
        legend: {
            bottom: 10,
            left: 'center',
            icon: 'circle',
            itemWidth: 10,
            itemHeight: 10,
            itemGap: 24,
            textStyle: {
                fontSize: 12,
                fontWeight: '600',
                color: 'hsl(var(--muted-foreground))',
                fontFamily: 'Inter, sans-serif'
            }
        },
        grid: {
            top: '10%',
            left: '4%',
            right: '4%',
            bottom: '18%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: ['Quotations', 'Orders', 'Projects'],
            axisTick: { show: false },
            axisLine: {
                show: true,
                lineStyle: { color: 'rgba(0,0,0,0.05)' }
            },
            axisLabel: {
                color: 'hsl(var(--muted-foreground))',
                fontSize: 11,
                fontWeight: '600',
                margin: 15
            }
        },
        yAxis: {
            type: 'value',
            splitLine: {
                show: true,
                lineStyle: {
                    type: 'dashed',
                    color: 'rgba(0,0,0,0.05)',
                    dashOffset: 5
                }
            },
            axisLine: { show: false },
            axisLabel: {
                color: 'hsl(var(--muted-foreground))',
                fontSize: 11,
                fontWeight: '500'
            }
        },
        series: [
            {
                name: 'Open/Pending',
                type: 'bar',
                stack: 'total',
                barWidth: '35%',
                itemStyle: {
                    borderRadius: [0, 0, 0, 0],
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#3077d3' },
                        { offset: 1, color: '#004aad' }
                    ])
                },
                emphasis: {
                    itemStyle: {
                        opacity: 0.9,
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 74, 173, 0.3)'
                    }
                },
                data: [
                    data.statusDistribution.Quotations['Open'] || 0,
                    data.statusDistribution.SaleOrders['Pending'] || 0,
                    data.pendingCounts.Projects
                ]
            },
            {
                name: 'Completed/Closed',
                type: 'bar',
                stack: 'total',
                barWidth: '35%',
                itemStyle: {
                    borderRadius: [6, 6, 0, 0],
                    color: '#e2e8f0'
                },
                emphasis: {
                    itemStyle: {
                        color: '#cbd5e1'
                    }
                },
                data: [
                    (data.statusDistribution.Quotations['Close (Win)'] || 0) + (data.statusDistribution.Quotations['Close (Lose)'] || 0),
                    data.statusDistribution.SaleOrders['Completed'] || 0,
                    (data.statusDistribution.Projects['Close (win)'] || 0) + (data.statusDistribution.Projects['Close (lose)'] || 0)
                ]
            }
        ]
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500" ref={containerRef}>
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h3 className="text-xl font-bold tracking-tight text-foreground">Operational Analytics</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Pending Distribution */}
                <div className="bg-card rounded-xl border shadow-sm flex flex-col h-full overflow-hidden">
                    <div className="p-6 pb-0">
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Workflow Status</h4>
                        <h3 className="text-lg font-extrabold text-foreground">Pending Distribution</h3>
                        <p className="text-xs text-muted-foreground mt-1">Breakdown of items currently awaiting action across all categories.</p>
                    </div>
                    <div className="p-4 flex-grow" style={{ minHeight: '320px' }}>
                        {shouldRender && (
                            <ReactECharts ref={chartRef1} option={pendingOption} style={{ height: '100%', width: '100%' }} />
                        )}
                    </div>
                </div>

                {/* 2. Core Status Breakdown */}
                <div className="bg-card rounded-xl border shadow-sm flex flex-col h-full overflow-hidden">
                    <div className="p-6 pb-0">
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Performance Metrics</h4>
                        <h3 className="text-lg font-extrabold text-foreground">Core Status Breakdown</h3>
                        <p className="text-xs text-muted-foreground mt-1">Comparison between active/pending items and successfully closed completions.</p>
                    </div>
                    <div className="p-4 flex-grow" style={{ minHeight: '320px' }}>
                        {shouldRender && (
                            <ReactECharts ref={chartRef2} option={statusOption} style={{ height: '100%', width: '100%' }} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;

