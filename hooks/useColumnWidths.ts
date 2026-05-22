/**
 * useColumnWidths.ts
 * Per-user, per-doc-type column width preferences stored in localStorage.
 * Returns [widths, setWidths, resetWidths].
 *
 * widths: number[6] — [No%, Code%, Desc%, Qty%, UnitPrice%, Amount%]
 * 0 = column omitted (only valid for Receipt/DO fixed schemas).
 */
'use client';

import { useState, useCallback, useEffect } from 'react';

const LS_PREFIX = 'limperial-col-widths-';

export type DocTypeKey =
    | 'quotation'
    | 'invoice'
    | 'sale-order'
    | 'receipt'
    | 'delivery-order'
    | 'commercial-invoice';

export const DOC_DEFAULT_WIDTHS: Record<DocTypeKey, number[]> = {
    'quotation':          [4, 16, 33, 12, 16, 19],
    'invoice':            [4, 12, 38, 14, 17, 15],
    'sale-order':         [4, 12, 38, 14, 17, 15],
    'receipt':            [5, 16, 64, 15,  0,  0],   // fixed 4-col: No|Ref|Desc|Amt
    'delivery-order':     [4, 12, 39, 15, 30,  0],   // fixed 5-col: No|Code|Desc|Qty|SN
    'commercial-invoice': [4, 12, 38, 14, 17, 15],
};

// Column labels per doc type (for the popover UI)
export const DOC_COL_LABELS: Record<DocTypeKey, string[]> = {
    'quotation':          ['No.', 'Part No.', 'Description', 'Qty', 'Unit Price', 'Amount'],
    'invoice':            ['No.', 'Part No.', 'Description', 'Qty', 'Unit Price', 'Amount'],
    'sale-order':         ['No.', 'Part No.', 'Description', 'Qty', 'Unit Price', 'Amount'],
    'receipt':            ['No.', 'Reference', 'Description', 'Amount', '', ''],
    'delivery-order':     ['No.', 'Part No.', 'Description', 'Qty', 'Serial No.', ''],
    'commercial-invoice': ['No.', 'Part No.', 'Description', 'Qty', 'Unit Price', 'Amount'],
};

// Which columns are editable per doc type (fixed-schema types lock some)
export const DOC_COL_EDITABLE: Record<DocTypeKey, boolean[]> = {
    'quotation':          [true, true, true, true, true, true],
    'invoice':            [true, true, true, true, true, true],
    'sale-order':         [true, true, true, true, true, true],
    'receipt':            [false, false, false, false, false, false], // fully fixed
    'delivery-order':     [false, false, false, false, false, false], // fully fixed
    'commercial-invoice': [true, true, true, true, true, true],
};

function lsKey(docType: DocTypeKey): string {
    return `${LS_PREFIX}${docType}`;
}

function load(docType: DocTypeKey): number[] {
    try {
        const raw = localStorage.getItem(lsKey(docType));
        if (!raw) return DOC_DEFAULT_WIDTHS[docType];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 6 && parsed.every(n => typeof n === 'number')) {
            return parsed;
        }
    } catch { /* ignore */ }
    return DOC_DEFAULT_WIDTHS[docType];
}

function save(docType: DocTypeKey, widths: number[]): void {
    try {
        localStorage.setItem(lsKey(docType), JSON.stringify(widths));
    } catch { /* ignore */ }
}

export function useColumnWidths(docType: DocTypeKey): [number[], (w: number[]) => void, () => void] {
    const [widths, setWidthsState] = useState<number[]>(() => DOC_DEFAULT_WIDTHS[docType]);

    // Hydrate from localStorage on mount (avoids SSR mismatch)
    useEffect(() => {
        setWidthsState(load(docType));
    }, [docType]);

    const setWidths = useCallback((w: number[]) => {
        setWidthsState(w);
        save(docType, w);
    }, [docType]);

    const resetWidths = useCallback(() => {
        const defaults = DOC_DEFAULT_WIDTHS[docType];
        setWidthsState(defaults);
        save(docType, defaults);
    }, [docType]);

    return [widths, setWidths, resetWidths];
}
