/**
 * shared-pure.ts
 * Browser-safe subset of shared.ts — no fs/path imports.
 * Imported by client-side preview builders.
 */

export const LOGO = 'https://i.postimg.cc/RFYdrpBC/Limperial-Technology-Logo01-png(004aad).png';

export function esc(s: unknown): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fmtDate(ds?: string): string {
    if (!ds) return '';
    const d = new Date(ds + 'T00:00:00');
    if (isNaN(d.getTime())) return ds;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtNum(v: number | string): string {
    const n = typeof v === 'number' ? v : parseFloat(String(v)) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function moneyInner(v: number | string, sym: string): string {
    return `<span style="display:flex;justify-content:space-between;white-space:nowrap"><span>${sym}</span><span>${fmtNum(v)}</span></span>`;
}

export function moneyTd(v: number | string, sym: string, extraStyle = ''): string {
    const style = extraStyle
        ? `padding:5px 6px;border:1px solid #000;${extraStyle}`
        : 'padding:5px 6px;border:1px solid #000';
    return `<td style="${style}">${moneyInner(v, sym)}</td>`;
}

export interface PdfItem {
    no: number | string;
    itemCode: string;
    modelName?: string;
    description?: string;
    qty: number | string;
    unitPrice?: number | string;
    commission?: number | string;
    amount?: number | string;
    serialNumber?: string;
    serialNumbers?: string[];
}

export interface PdfTotals {
    subTotal: number;
    tax?: number;
    vat?: number;
    grandTotal: number;
}
