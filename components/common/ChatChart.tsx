'use client';

import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

/**
 * Renders a chart the AI emitted as a ```chart fenced block, e.g.
 *   { "type": "bar", "title": "Quote amounts",
 *     "data": [ { "label": "Q-95", "value": 621.5 }, … ] }
 * Lazy-loaded by ChatMarkdown so recharts only loads when a chart is present.
 */
const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

interface Spec { type?: string; title?: string; xKey?: string; data?: any[] }

const ChatChart: React.FC<{ spec: string }> = ({ spec }) => {
  let parsed: Spec;
  try { parsed = JSON.parse(spec); } catch { return <p className="text-xs text-destructive">Couldn’t read chart data.</p>; }
  const data = Array.isArray(parsed.data) ? parsed.data : [];
  if (data.length === 0) return <p className="text-xs text-muted-foreground">No chart data.</p>;

  const type = (parsed.type || 'bar').toLowerCase();
  const keys = Object.keys(data[0]);
  const xKey = parsed.xKey || keys.find(k => typeof data[0][k] === 'string') || keys[0];
  const numeric = keys.filter(k => k !== xKey && data.some(d => typeof d[k] === 'number'));
  const series = numeric.length ? numeric : keys.filter(k => k !== xKey);

  return (
    <div className="my-1 rounded-lg border border-border p-2 bg-card">
      {parsed.title && <p className="text-xs font-semibold mb-1 text-foreground">{parsed.title}</p>}
      <div className="w-full h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey={series[0]} nameKey={xKey} outerRadius={80} label={{ fontSize: 10 } as any}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : type === 'line' ? (
            <LineChart data={data} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, i) => <Line key={s} dataKey={s} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />)}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, i) => <Bar key={s} dataKey={s} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />)}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChatChart;
