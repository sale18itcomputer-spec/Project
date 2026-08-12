'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Canonical "this module failed to load" panel.
 *
 * Replaces 14 copies of
 *   `bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg`
 * — hardcoded light-mode reds that were close to unreadable on any of the
 * eleven dark themes, and which offered the user no way forward.
 */
export interface ErrorStateProps {
    /** What failed, in the user's terms: "Could not load receipts". */
    title?: string;
    /** The underlying error message, if there is one worth showing. */
    message?: string | null;
    /** Wire this up to refetch. Renders a Try again button when provided. */
    onRetry?: () => void;
    className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    title = 'Something went wrong',
    message,
    onRetry,
    className,
}) => (
    <div className={cn('p-6 sm:p-8', className)}>
        <div
            role="alert"
            className="mx-auto flex max-w-xl items-start gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-5"
        >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/15">
                <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-foreground">{title}</p>
                {message && (
                    <p className="break-words text-sm text-muted-foreground">{message}</p>
                )}
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        Try again
                    </button>
                )}
            </div>
        </div>
    </div>
);

export default ErrorState;
