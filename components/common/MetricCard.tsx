'use client';

import React from 'react';
import { cn } from "../../lib/utils";

/**
 * Dashboard stat card. Same design as the KPI cards on the Collection screen:
 * bordered card, tracked uppercase label with a small line icon at the right,
 * bold figure, one line of context. Colour is reserved for status (tone), never
 * used to tell cards apart.
 */

export type MetricTone = 'default' | 'warn' | 'danger' | 'good';

interface MetricCardProps {
  title: string;
  value: string;
  /** One quiet line under the figure: a real comparison or a count, not decoration. */
  context?: string;
  icon?: React.ReactNode;
  tone?: MetricTone;
  onClick?: () => void;
  /** True when there is nothing to measure yet (renders the figure muted). */
  isEmpty?: boolean;
}

const TONES: Record<MetricTone, string> = {
  default: 'text-foreground',
  warn: 'text-amber-600 dark:text-amber-400',
  danger: 'text-rose-600 dark:text-rose-400',
  good: 'text-emerald-600 dark:text-emerald-400',
};

const COLUMNS = {
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
} as const;

interface StatGroupProps {
  label: string;
  columns: keyof typeof COLUMNS;
  children: React.ReactNode;
  className?: string;
}

/** A titled row of metric cards. */
export const StatGroup: React.FC<StatGroupProps> = ({ label, columns, children, className }) => (
  <section aria-label={label} className={className}>
    <h2 className="mb-2 text-sm font-semibold text-foreground">{label}</h2>
    <div className={cn('grid gap-3', COLUMNS[columns])}>{children}</div>
  </section>
);

const MetricCard: React.FC<MetricCardProps> = ({ title, value, context, icon, tone = 'default', onClick, isEmpty = false }) => {
  const body = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
        {icon && <span className={cn('shrink-0 [&>svg]:h-4 [&>svg]:w-4', TONES[tone])}>{icon}</span>}
      </div>
      <div className={cn('text-2xl font-black tabular-nums', isEmpty ? 'text-muted-foreground/50' : TONES[tone])}>{value}</div>
      {context && <div className="mt-1 text-xs text-muted-foreground">{context}</div>}
    </>
  );

  const card = 'block w-full rounded-lg border border-border bg-card p-4 text-left';

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(card, 'cursor-pointer transition-[border-color,box-shadow] duration-150 ease-out-strong hover:border-primary/60 hover:shadow-sm')}
    >
      {body}
    </button>
  ) : (
    <div className={card}>{body}</div>
  );
};

export default React.memo(MetricCard);
