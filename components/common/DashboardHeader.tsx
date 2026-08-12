'use client';

import React from 'react';
import { cn } from '../../lib/utils';
import { Z } from '../../lib/zIndex';

/**
 * Canonical page header for list dashboards.
 *
 * Page titles had drifted into nine different treatments for the same role —
 * `text-xl font-bold`, `text-2xl font-bold`, `text-2xl font-bold mb-2`,
 * `text-xl sm:text-2xl md:text-3xl font-black tracking-tight`, and one
 * `text-sm font-bold text-gray-800` that rendered a page <h1> *smaller* than
 * the body text around it. `PageTitle` is the single treatment.
 *
 * The header is sticky: on a phone the dashboard chrome used to scroll away
 * above a hundred rows, leaving search and filters unreachable mid-list.
 */

export const PageTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className,
}) => (
    <h1
        className={cn(
            'truncate text-lg font-bold leading-tight tracking-tight text-foreground sm:text-xl',
            className,
        )}
    >
        {children}
    </h1>
);

export interface DashboardHeaderProps {
    title: React.ReactNode;
    /** Leading icon — rendered at a consistent size and colour. */
    icon?: React.ReactElement<{ className?: string }>;
    /** Optional line under the title. */
    subtitle?: React.ReactNode;
    /** Search box, view toggles, column picker, primary CTA — in that order. */
    children?: React.ReactNode;
    className?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    title,
    icon,
    subtitle,
    children,
    className,
}) => (
    <header
        style={{ zIndex: Z.HEADER }}
        className={cn(
            'sticky top-0 flex flex-shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6',
            className,
        )}
    >
        <div className="flex min-w-0 items-center gap-2.5">
            {icon &&
                React.isValidElement(icon) &&
                React.cloneElement(icon, {
                    className: cn('h-5 w-5 flex-shrink-0 text-primary', icon.props.className),
                })}
            <div className="min-w-0">
                <PageTitle>{title}</PageTitle>
                {subtitle && (
                    <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                )}
            </div>
        </div>

        {children && (
            <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto lg:w-auto lg:overflow-visible">
                {children}
            </div>
        )}
    </header>
);

export default DashboardHeader;
