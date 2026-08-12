'use client';

import React from 'react';
import { ArrowRightToLine, WrapText, Scissors } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import type { CellWrapStyle } from './DataTable';

/**
 * Truncate / wrap / clip switch for DataTable cell overflow.
 *
 * This exact three-button group was inlined in 23 dashboards, each with its
 * own class string and none with accessible names — they were icon-only
 * buttons carrying no `title` or `aria-label` in most copies.
 */
const OPTIONS: { value: CellWrapStyle; icon: React.ReactNode; label: string }[] = [
    { value: 'overflow', icon: <ArrowRightToLine size={16} aria-hidden="true" />, label: 'Truncate long text' },
    { value: 'wrap', icon: <WrapText size={16} aria-hidden="true" />, label: 'Wrap long text' },
    { value: 'clip', icon: <Scissors size={16} aria-hidden="true" />, label: 'Clip long text' },
];

export interface CellWrapToggleProps {
    value: CellWrapStyle;
    onChange: (value: CellWrapStyle) => void;
    className?: string;
}

export const CellWrapToggle: React.FC<CellWrapToggleProps> = ({ value, onChange, className }) => (
    <div
        role="group"
        aria-label="Cell text overflow"
        className={cn(
            'flex flex-shrink-0 items-center overflow-hidden rounded-md border border-border bg-card shadow-sm',
            className,
        )}
    >
        {OPTIONS.map((opt, i) => {
            const isActive = value === opt.value;
            return (
                <Button
                    key={opt.value}
                    variant={isActive ? 'ghostPrimary' : 'ghostMuted'}
                    size="iconTouchSm"
                    title={opt.label}
                    aria-label={opt.label}
                    aria-pressed={isActive}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        'rounded-none',
                        isActive && 'bg-primary/10 text-primary',
                        i > 0 && 'border-l border-border',
                    )}
                >
                    {opt.icon}
                </Button>
            );
        })}
    </div>
);

export default CellWrapToggle;
