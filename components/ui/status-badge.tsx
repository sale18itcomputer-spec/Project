import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Canonical status badge for the whole app.
 *
 * Before this existed, most list/detail dashboards each declared their own local
 * `StatusBadge` + `statusConfig` map. The colors drifted (e.g. "Cancel" was rose
 * in Invoices/Sale Orders but violet in Quotations) and the padding/radius varied
 * between modules. This component is the single source of truth: a status string
 * resolves to a semantic tone, and every tone renders identically everywhere.
 *
 * Usage:
 *   <StatusBadge status={invoice.Status} />        // tone inferred from the word
 *   <StatusBadge status="Custom" tone="warning" /> // explicit tone override
 *   <StatusBadge status="Active" dot size="sm" />  // with leading dot, compact
 */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

/** Background + text classes per tone. Matches the app's long-standing
 *  `bg-{color}-500/10 text-{color}-500` convention so no existing badge shifts color. */
const TONE_CLASSES: Record<StatusTone, string> = {
    success: 'bg-emerald-500/10 text-emerald-500',
    warning: 'bg-amber-500/10 text-amber-500',
    danger:  'bg-rose-500/10 text-rose-500',
    info:    'bg-sky-500/10 text-sky-500',
    accent:  'bg-violet-500/10 text-violet-500',
    neutral: 'bg-muted text-muted-foreground',
};

const DOT_CLASSES: Record<StatusTone, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger:  'bg-rose-500',
    info:    'bg-sky-500',
    accent:  'bg-violet-500',
    neutral: 'bg-muted-foreground/60',
};

/**
 * Canonical status → tone map (keys are lowercased). This is where the "what
 * color is 'Pending'?" question is answered once for the entire app. Add new
 * domain statuses here rather than in individual dashboards.
 */
export const STATUS_TONE_MAP: Record<string, StatusTone> = {
    // ── Positive / done ──
    'completed': 'success',
    'complete': 'success',
    'close (win)': 'success',
    'win': 'success',
    'won': 'success',
    'issued': 'success',
    'delivered': 'success',
    'active': 'success',
    'paid': 'success',
    'confirmed': 'success',
    'approved': 'success',
    'done': 'success',
    'received': 'success',
    'in stock': 'success',

    // ── In progress / awaiting action ──
    'pending': 'warning',
    'processing': 'warning',
    'in progress': 'warning',
    'partial': 'warning',
    'partially paid': 'warning',
    'on hold': 'warning',
    'low stock': 'warning',

    // ── Informational / new / draft ──
    'draft': 'info',
    'open': 'info',
    'new': 'info',
    'submitted': 'info',

    // ── Negative ──
    'close (lose)': 'danger',
    'lose': 'danger',
    'lost': 'danger',
    'cancel': 'danger',
    'cancelled': 'danger',
    'canceled': 'danger',
    'rejected': 'danger',
    'overdue': 'danger',
    'void': 'danger',
    'out of stock': 'danger',

    // ── Muted / inactive ──
    'inactive': 'neutral',
    'closed': 'neutral',
    'archived': 'neutral',
};

/** Resolve a raw status string to a semantic tone. Unknown statuses fall back to neutral. */
export function resolveStatusTone(status: string | null | undefined): StatusTone {
    if (!status) return 'neutral';
    return STATUS_TONE_MAP[status.trim().toLowerCase()] ?? 'neutral';
}

export interface StatusBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
    /** The raw status text. Also used as the label unless `children` is provided. */
    status?: string | null;
    /** Force a tone instead of inferring it from `status`. */
    tone?: StatusTone;
    /** `md` (default) matches the historical dashboard badge; `sm` is compact for dense tables. */
    size?: 'sm' | 'md';
    /** Show a leading colored dot. */
    dot?: boolean;
    /** Override the visible label (defaults to `status`). */
    children?: React.ReactNode;
}

export function StatusBadge({
    status,
    tone,
    size = 'md',
    dot = false,
    className,
    children,
    ...rest
}: StatusBadgeProps) {
    const resolvedTone = tone ?? resolveStatusTone(status);
    const label = children ?? status ?? '—';
    const sizeCls = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 font-semibold rounded-md whitespace-nowrap',
                sizeCls,
                TONE_CLASSES[resolvedTone],
                className,
            )}
            {...rest}
        >
            {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASSES[resolvedTone])} />}
            {label}
        </span>
    );
}

export default StatusBadge;
