/**
 * shared.ts
 * Pure utility functions with NO layout opinion.
 * Imported by every builder — do not put layout/CSS here.
 */
import fs from 'fs';
import path from 'path';

export const LOGO = 'https://i.postimg.cc/RFYdrpBC/Limperial-Technology-Logo01-png(004aad).png';

// ── String helpers ────────────────────────────────────────────────────────────
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

// ── Font embedding ────────────────────────────────────────────────────────────
export function getFontsB64(): { khmer: string; times: string; timesBold: string; bokor: string; muol: string } {
    const khmer     = fs.readFileSync(path.join(process.cwd(), 'public', 'KhmerOS.ttf')).toString('base64');
    const times     = fs.readFileSync(path.join(process.cwd(), 'public', 'times.ttf')).toString('base64');
    const timesBold = fs.readFileSync(path.join(process.cwd(), 'public', 'timesbd.ttf')).toString('base64');
    const bokor     = fs.readFileSync(path.join(process.cwd(), 'public', 'KhmerOS_bokor.ttf')).toString('base64');
    const muol      = fs.readFileSync(path.join(process.cwd(), 'public', 'KhmerOS_muol.ttf')).toString('base64');
    return { khmer, times, timesBold, bokor, muol };
}

// ── Shared types ──────────────────────────────────────────────────────────────
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
    isPromotion?: boolean;
}

export interface PdfTotals {
    subTotal: number;
    tax?: number;
    vat?: number;
    grandTotal: number;
}
