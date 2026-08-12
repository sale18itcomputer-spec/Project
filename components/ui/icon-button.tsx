import * as React from 'react';
import { Button, type ButtonProps } from './button';
import { cn } from '../../lib/utils';

/**
 * Icon-only button with a guaranteed accessible name and a touch-safe hit area.
 *
 * The dashboards had 348 <button> elements and 10 aria-labels between them;
 * icon-only row actions relied on `title=` alone, which screen readers treat
 * inconsistently and which never appears on touch. Sizes were also routinely
 * `p-1.5` — roughly a 30px target against the 44px guidance.
 *
 * This is a thin wrapper over <Button>, not a parallel implementation: focus
 * rings, disabled handling, transitions and the press animation all come from
 * `buttonVariants`, so icon buttons can never drift from regular buttons.
 *
 * `label` is required, not optional.
 */
export interface IconButtonProps extends Omit<ButtonProps, 'aria-label' | 'variant' | 'size'> {
    /** Required. Becomes both the tooltip and the accessible name. */
    label: string;
    /** `danger` for destructive row actions, `primary` for the main one. */
    tone?: 'default' | 'primary' | 'danger';
    size?: 'sm' | 'md';
}

const TONE_VARIANT = {
    default: 'ghostMuted',
    primary: 'ghostPrimary',
    danger: 'ghostDanger',
} as const;

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ label, tone = 'default', size = 'md', className, type = 'button', ...props }, ref) => (
        <Button
            ref={ref}
            type={type}
            title={label}
            aria-label={label}
            variant={TONE_VARIANT[tone]}
            size={size === 'md' ? 'iconTouch' : 'iconTouchSm'}
            className={cn('rounded-md', className)}
            {...props}
        />
    ),
);
IconButton.displayName = 'IconButton';

export default IconButton;
