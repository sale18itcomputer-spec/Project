'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * The state machine behind a searchable select.
 *
 * `FormControls.FormSearchSelect` (desktop) and
 * `MobileFormBase.MobileSearchSelect` (touch) each reimplemented this: open
 * state, a query string, case-insensitive substring filtering, and a select
 * handler that commits the value then closes and clears. The two presentations
 * are genuinely different — a desktop input that doubles as the search box, vs
 * a touch trigger with a separate search field in the sheet — so they stay as
 * separate components. Only the logic is shared, which is the part that drifted:
 *
 *   - the mobile version declared a container ref but never attached an
 *     outside-click handler, so tapping away left the dropdown open;
 *   - neither closed on Escape.
 *
 * Both are handled here, once.
 */
export interface UseSearchSelectOptions {
    /** Full candidate list. */
    options: readonly string[];
    /** Committed value, used to mark the active row. */
    value: string;
    /** Called with the chosen option. */
    onChange: (value: string) => void;
    /** Cap the rendered list (the touch sheet caps at 60). */
    limit?: number;
    /** Fired after a successful selection — e.g. haptic feedback on mobile. */
    onSelected?: () => void;
}

export function useSearchSelect({
    options,
    value,
    onChange,
    limit,
    onSelected,
}: UseSearchSelectOptions) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const close = useCallback(() => {
        setIsOpen(false);
        setQuery('');
    }, []);

    const open = useCallback(() => {
        setQuery('');
        setIsOpen(true);
    }, []);

    const toggle = useCallback(() => {
        setIsOpen(prev => {
            if (prev) {
                setQuery('');
                return false;
            }
            setQuery('');
            return true;
        });
    }, []);

    const select = useCallback((option: string) => {
        onChange(option);
        close();
        onSelected?.();
    }, [onChange, close, onSelected]);

    // Dismiss on outside click and on Escape. Only bound while open.
    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (e: MouseEvent | TouchEvent) => {
            const el = containerRef.current;
            if (el && !el.contains(e.target as Node)) close();
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen, close]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const matched = q ? options.filter(o => o.toLowerCase().includes(q)) : options;
        return limit ? matched.slice(0, limit) : matched;
    }, [options, query, limit]);

    return {
        isOpen,
        query,
        setQuery,
        containerRef,
        filtered,
        open,
        close,
        toggle,
        select,
        /** What the trigger input should display: the query while searching. */
        displayValue: isOpen ? query : (value || ''),
    };
}

export default useSearchSelect;
