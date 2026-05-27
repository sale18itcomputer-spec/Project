'use client';

import React from 'react';
import { cn } from "../../lib/utils";
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  changeLabel?: string;
  onClick?: () => void;
  icon?: React.ReactElement<{ className?: string }>;
  className?: string;
  accentColor?: 'blue' | 'teal' | 'purple' | 'amber' | 'coral' | 'pink' | 'green';
  isEmpty?: boolean;
}

const accentMap: Record<string, { bar: string; iconBg: string; iconColor: string; badgeBg: string; badgeText: string }> = {
  blue:   { bar: 'bg-blue-500',   iconBg: 'bg-blue-50 dark:bg-blue-950',   iconColor: 'text-blue-600 dark:text-blue-400',   badgeBg: 'bg-blue-50 dark:bg-blue-950',   badgeText: 'text-blue-700 dark:text-blue-300' },
  teal:   { bar: 'bg-teal-500',   iconBg: 'bg-teal-50 dark:bg-teal-950',   iconColor: 'text-teal-600 dark:text-teal-400',   badgeBg: 'bg-teal-50 dark:bg-teal-950',   badgeText: 'text-teal-700 dark:text-teal-300' },
  purple: { bar: 'bg-purple-500', iconBg: 'bg-purple-50 dark:bg-purple-950', iconColor: 'text-purple-600 dark:text-purple-400', badgeBg: 'bg-purple-50 dark:bg-purple-950', badgeText: 'text-purple-700 dark:text-purple-300' },
  amber:  { bar: 'bg-amber-500',  iconBg: 'bg-amber-50 dark:bg-amber-950',  iconColor: 'text-amber-600 dark:text-amber-400',  badgeBg: 'bg-amber-50 dark:bg-amber-950',  badgeText: 'text-amber-700 dark:text-amber-300' },
  coral:  { bar: 'bg-orange-500', iconBg: 'bg-orange-50 dark:bg-orange-950', iconColor: 'text-orange-600 dark:text-orange-400', badgeBg: 'bg-orange-50 dark:bg-orange-950', badgeText: 'text-orange-700 dark:text-orange-300' },
  pink:   { bar: 'bg-pink-500',   iconBg: 'bg-pink-50 dark:bg-pink-950',   iconColor: 'text-pink-600 dark:text-pink-400',   badgeBg: 'bg-pink-50 dark:bg-pink-950',   badgeText: 'text-pink-700 dark:text-pink-300' },
  green:  { bar: 'bg-green-500',  iconBg: 'bg-green-50 dark:bg-green-950',  iconColor: 'text-green-600 dark:text-green-400',  badgeBg: 'bg-green-50 dark:bg-green-950',  badgeText: 'text-green-700 dark:text-green-300' },
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  change,
  changeType = 'neutral',
  changeLabel,
  onClick,
  icon,
  className,
  accentColor = 'blue',
  isEmpty = false,
}) => {
  const accent = accentMap[accentColor] ?? accentMap.blue;

  const ChangeIcon = changeType === 'increase' ? TrendingUp : changeType === 'decrease' ? TrendingDown : Minus;
  const changeBg = changeType === 'increase'
    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
    : changeType === 'decrease'
    ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
    : 'bg-muted text-muted-foreground';

  const card = (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-border/80',
        className
      )}
    >
      {/* Accent bar */}
      <div className={cn('h-0.5 w-full', accent.bar)} />

      <div className="flex flex-col gap-3 p-4 sm:p-5 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-none pt-0.5">
            {title}
          </p>
          {icon && (
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', accent.iconBg)}>
              {React.isValidElement(icon) &&
                React.cloneElement(icon as React.ReactElement<any>, {
                  className: cn('h-4 w-4', accent.iconColor),
                })}
            </div>
          )}
        </div>

        {/* Value */}
        <div className={cn(
          'font-bold tracking-tight leading-none',
          isEmpty ? 'text-2xl text-muted-foreground/40' : 'text-2xl sm:text-3xl text-foreground'
        )}>
          {value}
        </div>

        {/* Footer: subValue or change badge */}
        <div className="mt-auto flex items-center gap-2 min-h-[22px]">
          {change ? (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', changeBg)}>
              <ChangeIcon className="h-3 w-3" />
              {change}
              {changeLabel && <span className="font-normal opacity-70">{changeLabel}</span>}
            </span>
          ) : subValue ? (
            <span className="text-xs text-muted-foreground">{subValue}</span>
          ) : isEmpty ? (
            <span className="text-xs text-muted-foreground/50 italic">Not set up yet</span>
          ) : null}
        </div>
      </div>
    </div>
  );

  return onClick ? (
    <button onClick={onClick} className="w-full text-left">
      {card}
    </button>
  ) : card;
};

export default React.memo(MetricCard);
