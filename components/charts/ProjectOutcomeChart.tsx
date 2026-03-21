'use client';

import React, { useMemo, useRef, useId } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { ProjectStatusData } from "../../types";
import { PieChart } from 'lucide-react';
import { useFilter } from "../../contexts/FilterContext";
import { limperialTheme, useChartReady } from "../charts/echartsTheme";

echarts.registerTheme('limperial', limperialTheme);

const ECharts = ReactECharts as any;

const STATUS_COLORS: Record<string, string> = {
  'close (win)':    '#10b981', // emerald
  'close (lose)':   '#94a3b8', // slate
  'price request':  '#f43f5e', // rose
  'revising specs': '#f97316', // orange
  'pending po':     '#3b82f6', // blue
  'ordering':       '#6366f1', // indigo
  'qualification':  '#8b5cf6', // violet
  'quote submitted':'#0ea5e9', // sky
  'pipeline':       '#f59e0b', // amber
};



interface ProjectOutcomeChartProps {
  data: ProjectStatusData[];
}

const ProjectOutcomeChart: React.FC<ProjectOutcomeChartProps> = ({ data }) => {
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { filters, setFilter } = useFilter();
  const titleId = useId();

  const isReady = useChartReady(containerRef, chartRef, [data]);



  const onEvents = {
    click: (params: any) => {
      if (!params.name) return;
      const current = (filters.status || []) as string[];
      if (current.length === 1 && current[0] === params.name) {
        setFilter('status', []);
      } else {
        setFilter('status', [params.name]);
      }
    },
  };

  const option = useMemo(() => {
        if (!data || data.length === 0) return {};
        const total = data.reduce((sum, entry) => sum + entry.value, 0);

        return {
            tooltip: {
                trigger: 'item',
                borderRadius: 12,
                padding: [12, 16],
                formatter: (params: any) => {
                    return `
                        <div style="font-weight:700;margin-bottom:8px;opacity:0.6;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${params.name}</div>
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color}"></span>
                                <span style="font-weight:800;font-size:16px;">${params.value}</span>
                            </div>
                            <span style="color:#3b82f6;font-size:12px;font-weight:700;background:rgba(59,130,246,0.1);padding:2px 8px;border-radius:6px;">${params.percent}%</span>
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
            series: [{
                name: 'Pipeline Status',
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
                data: data.map(item => ({
                    value: item.value,
                    name: item.name,
                    itemStyle: { color: STATUS_COLORS[item.name as keyof typeof STATUS_COLORS] || '#94a3b8' }
                }))
            }],
            graphic: [
                {
                    type: 'text',
                    left: 'center',
                    top: '35%',
                    style: {
                        text: total,
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
                        text: 'TOTAL PIPELINES',
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
    }, [data]);

    return (
        <div className="bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden" style={{ height: '900px' }}>
            <div className="p-6 pb-0 flex-shrink-0">
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Pipeline Analytics</h4>
                <h3 id={titleId} className="text-lg font-extrabold text-foreground">Pipeline Status</h3>
                <p className="text-xs text-muted-foreground mt-1">Distribution of all pipelines by status. Click a segment to filter.</p>
            </div>

            <div className="p-4 flex-grow min-h-0" ref={containerRef}>
                {data && data.length > 0 ? (
                    isReady && (
                        <ECharts
                            ref={chartRef}
                            option={option}
                            style={{ height: '100%', width: '100%' }}
                            onEvents={onEvents}
                            notMerge={true}
                            lazyUpdate={false}
                            theme="limperial"
                        />
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-2">
                        <PieChart className="w-12 h-12 text-muted-foreground/30" />
                        <p className="mt-2 text-sm font-medium">No pipeline data to display.</p>
                        <p className="text-xs text-muted-foreground max-w-[180px] border-t border-border/50 pt-3 mt-2">Pipelines will appear here once they are added to the CRM.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(ProjectOutcomeChart);
