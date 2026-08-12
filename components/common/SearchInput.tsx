'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * The app's one search box.
 *
 * 24 dashboards each hand-rolled this control and they had visibly diverged —
 * two different heights, `rounded-md` vs `rounded-lg`, `border-border` vs
 * `border-transparent`, with/without `shadow-sm`, and nine of them still drew
 * the magnifier as an inline <svg> (two of those hardcoded `text-gray-400`,
 * which vanishes against several themes). None had an accessible name; they
 * were placeholder-only.
 *
 * Pair with `useDebouncedValue` for the filtering pass — bind `value` to raw
 * state so typing stays instant, and filter on the debounced copy.
 */
export interface SearchInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
    value: string;
    onValueChange: (value: string) => void;
    /** Accessible name. Defaults to the placeholder, which is better than nothing. */
    label?: string;
    /** Hide the clear button (shown by default once there's a value). */
    hideClear?: boolean;
    containerClassName?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
    (
        {
            value,
            onValueChange,
            label,
            hideClear = false,
            placeholder = 'Search…',
            className,
            containerClassName,
            id,
            ...props
        },
        ref,
    ) => {
        const accessibleName = label ?? placeholder;

        return (
            <div className={cn('relative w-full lg:w-64 flex-shrink-0', containerClassName)}>
                <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <input
                    ref={ref}
                    id={id}
                    type="search"
                    value={value}
                    onChange={e => onValueChange(e.target.value)}
                    placeholder={placeholder}
                    aria-label={accessibleName}
                    className={cn(
                        'h-9 w-full rounded-md border border-border bg-muted pl-9 text-sm text-foreground shadow-sm',
                        'placeholder:text-muted-foreground/60',
                        'transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background',
                        // Suppress the browser's own clear affordance — we render our own.
                        '[&::-webkit-search-cancel-button]:appearance-none',
                        value && !hideClear ? 'pr-9' : 'pr-3',
                        className,
                    )}
                    {...props}
                />
                {/* Deliberately a raw <button> rather than <IconButton>: this sits
                    *inside* the input's 36px box, so IconButton's 44px touch
                    target would not fit. The input itself is the large target. */}
                {value && !hideClear && (
                    <button
                        type="button"
                        onClick={() => onValueChange('')}
                        aria-label={`Clear ${accessibleName.toLowerCase()}`}
                        className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                )}
            </div>
        );
    },
);
SearchInput.displayName = 'SearchInput';

export default SearchInput;
