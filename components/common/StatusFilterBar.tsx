'use client';

import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Z } from '../../lib/zIndex';

/**
 * The status-filter strip that sits in every list dashboard's footer.
 *
 * Twelve-plus copies of this existed with three different horizontal paddings
 * (px-4 / px-5 / px-6) and inconsistent overflow handling — Receipts and
 * Delivery Orders in particular laid their chips out in a plain flex row with
 * no scroll container, so on a narrow screen the last chips were simply
 * unreachable. This always scrolls horizontally and never overflows the page.
 *
 * It is also sticky to the bottom: on a phone the dashboard is one long scroll,
 * so an unpinned footer left the filters below a hundred rows of table.
 *
 * Clicking the active chip clears the filter, matching the previous behaviour.
 */
export interface StatusFilterOption {
    /** Value written to state. `null` means "no filter". */
    value: string | null;
    label: string;
    /** Optional count badge. */
    count?: number;
}

export interface StatusFilterBarProps {
    options: readonly (StatusFilterOption | string)[];
    active: string | null;
    onChange: (value: string | null) => void;
    /** Right-aligned summary, e.g. "128 records". */
    summary?: React.ReactNode;
    /** Accessible name for the group. */
    label?: string;
    className?: string;
}

const normalize = (o: StatusFilterOption | string): StatusFilterOption =>
    typeof o === 'string' ? { value: o, label: o } : o;

export const StatusFilterBar: React.FC<StatusFilterBarProps> = ({
    options,
    active,
    onChange,
    summary,
    label = 'Filter by status',
    className,
}) => (
    <footer
        style={{ zIndex: Z.HEADER }}
        className={cn(
            'sticky bottom-0 flex flex-shrink-0 items-center gap-3 border-t border-border bg-card p-3',
            className,
        )}
    >
        <div
            role="group"
            aria-label={label}
            className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
        >
            {options.map(opt => {
                const { value, label: text, count } = normalize(opt);
                const isActive = active === value;
                return (
                    <Button
                        key={value ?? '__all__'}
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        aria-pressed={isActive}
                        onClick={() => onChange(isActive ? null : value)}
                        className={cn('font-semibold', !isActive && 'text-muted-foreground')}
                    >
                        {text}
                        {typeof count === 'number' && (
                            <span
                                className={cn(
                                    'rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                                    isActive ? 'bg-primary-foreground/20' : 'bg-muted',
                                )}
                            >
                                {count}
                            </span>
                        )}
                    </Button>
                );
            })}
        </div>
        {summary != null && (
            <span className="flex-shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                {summary}
            </span>
        )}
    </footer>
);

export default StatusFilterBar;
