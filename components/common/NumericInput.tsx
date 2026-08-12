'use client';

import React, { useState } from 'react';
import { cn } from '../../lib/utils';

/**
 * Amount input that can actually be typed into.
 *
 * The pattern this replaces —
 *
 *   <input type="number" value={line.debit || ''}
 *          onChange={e => update(parseFloat(e.target.value) || 0)} />
 *
 * — cannot accept `0.07`, and fails in three compounding ways:
 *
 *  1. `value || ''` treats 0 as empty, so the field wipes itself the instant
 *     the value is zero. A leading "0" can never stay on screen.
 *  2. `parseFloat(...) || 0` parses every keystroke, so the intermediate
 *     states "0", "0." and "0.0" all collapse to 0 — and then render as ''.
 *  3. With `type="number"`, Chrome reports `e.target.value` as "" while the
 *     text is "0.", because that isn't a valid number. The decimal point is
 *     dropped before the handler even runs.
 *
 * Typing "0.07" therefore yielded "7": 0 wiped, "." discarded, 0 wiped, 7 kept.
 * Every amount below 0.1 was unenterable, as was any value typed through zero.
 *
 * The fix is to keep the user's raw text while they are typing and only
 * surface a number to the model, using `inputMode="decimal"` so mobile still
 * gets a numeric keypad without the browser sanitising partial input.
 */
export interface NumericInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
    value: number;
    onValueChange: (value: number) => void;
    /** Render 0 as an empty field (the usual look for an amount column). */
    blankZero?: boolean;
    /** Decimal places to normalise to on blur. Omit to leave as typed. */
    precision?: number;
}

/** Digits with at most one dot, optionally leading "-". Allows "", "0.", "-". */
const PARTIAL_NUMBER = /^-?\d*\.?\d*$/;

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
    ({ value, onValueChange, blankZero = true, precision, className, onBlur, onFocus, ...props }, ref) => {
        // While focused, `draft` holds exactly what the user typed so partial
        // input survives re-render. null means "show the model value".
        const [draft, setDraft] = useState<string | null>(null);

        // Coerce defensively: a null/undefined amount arriving from the API
        // would otherwise render as the literal text "undefined" in a field
        // the user is about to post to the ledger.
        const safe = Number.isFinite(value as number) ? (value as number) : 0;
        const modelText = blankZero && safe === 0 ? '' : String(safe);
        const display = draft ?? modelText;

        return (
            <input
                ref={ref}
                type="text"
                inputMode="decimal"
                value={display}
                onFocus={e => { setDraft(modelText); onFocus?.(e); }}
                onChange={e => {
                    const raw = e.target.value;
                    // Reject characters that could never form a number, so the
                    // field can't be left in a state the model can't represent.
                    if (!PARTIAL_NUMBER.test(raw)) return;
                    setDraft(raw);
                    const parsed = parseFloat(raw);
                    onValueChange(Number.isFinite(parsed) ? parsed : 0);
                }}
                onBlur={e => {
                    const parsed = parseFloat(draft ?? '');
                    const next = Number.isFinite(parsed) ? parsed : 0;
                    onValueChange(precision != null ? Number(next.toFixed(precision)) : next);
                    setDraft(null);
                    onBlur?.(e);
                }}
                className={cn(className)}
                {...props}
            />
        );
    },
);
NumericInput.displayName = 'NumericInput';

export default NumericInput;
