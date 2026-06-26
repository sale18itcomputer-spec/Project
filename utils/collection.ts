/**
 * Accounts Receivable helpers — pure derivations from Invoices + Receipts.
 *
 * No new DB tables. AR is always computed on the fly:
 *   Paid        = SUM(Receipts.Amount where Inv No matches and Status != Cancelled)
 *   Outstanding = Invoice.Amount - Invoice.Deposit - Paid
 *
 * Receipts with `Status: 'Cancelled'` do NOT count as paid. Negative amounts
 * are allowed (for future reversal receipts).
 */
import { Invoice, Receipt } from '../types';
import { parseDate } from './time';

export type CollectionStatus = 'Paid' | 'Partial' | 'Pending' | 'Overdue' | 'Cancelled';

export type AgingBucket = 'Current' | '1-30' | '31-60' | '61-90' | '90+';

export interface InvoiceAR {
    invoice: Invoice;
    invoiced: number;
    deposit: number;
    paid: number;
    outstanding: number;
    dueDate: Date | null;
    daysPastDue: number; // negative = upcoming, 0 = due today, positive = overdue
    collectionStatus: CollectionStatus;
    agingBucket: AgingBucket;
    receipts: Receipt[]; // matching receipts (Status != Cancelled), oldest first
    created_at: string | undefined;
}

/** Parse payment-term strings like "Net 30", "30 days", "COD", "60" → number of days */
export function parseCreditDays(term?: string): number {
    if (!term) return 0;
    const cleaned = term.trim().toLowerCase();
    if (cleaned === '' || cleaned === 'cod' || cleaned === 'cash on delivery') return 0;
    const match = cleaned.replace(/,/g, '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

/** Calculate due date from invoice date + credit days. Returns null if Inv Date is invalid.
 *
 * Invoice dates are stored as "M/D/YYYY" strings (e.g. "5/25/2026"). We use the
 * shared parseDate() helper which handles both M/D/YYYY and YYYY-MM-DD formats,
 * so the due-date calculation works regardless of how the date was saved.
 */
export function calcDueDate(invDate: string | undefined, paymentTerm: string | undefined): Date | null {
    if (!invDate) return null;
    const parsed = parseDate(invDate);
    if (!parsed) return null;
    const days = parseCreditDays(paymentTerm);
    // Clone the parsed date so we don't mutate it, then apply credit days
    const d = new Date(parsed.getTime());
    d.setDate(d.getDate() + days);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Convert any numeric-ish value to a finite number. NaN/null/undefined → 0. */
function toNum(v: unknown): number {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
}

/** Days between two dates, ignoring time of day. Positive = a is after b. */
function dayDiff(a: Date, b: Date): number {
    const ms = a.getTime() - b.getTime();
    return Math.floor(ms / 86_400_000);
}

function getAgingBucket(daysPastDue: number): AgingBucket {
    if (daysPastDue <= 0) return 'Current';
    if (daysPastDue <= 30) return '1-30';
    if (daysPastDue <= 60) return '31-60';
    if (daysPastDue <= 90) return '61-90';
    return '90+';
}

/**
 * Compute AR snapshot for a single invoice.
 *
 * `now` is injectable for tests; defaults to today at 00:00.
 */
export function computeInvoiceAR(
    invoice: Invoice,
    allReceipts: Receipt[] | null | undefined,
    now: Date = startOfToday(),
): InvoiceAR {
    const invNo = invoice['Inv No'];
    const invoiced = toNum(invoice.Amount);
    const deposit = toNum(invoice.Deposit);

    // Active receipts = same Inv No, Status != Cancelled
    const matching = (allReceipts ?? []).filter(
        r => r['Inv No'] === invNo && r['Status'] !== 'Cancelled',
    );
    matching.sort((a, b) => String(a['RV Date'] || '').localeCompare(String(b['RV Date'] || '')));

    const paid = matching.reduce((sum, r) => sum + toNum(r.Amount), 0);
    const outstanding = invoiced - deposit - paid;

    const dueDate = calcDueDate(invoice['Inv Date'], invoice['Payment Term']);
    const daysPastDue = dueDate ? dayDiff(now, dueDate) : 0;

    let collectionStatus: CollectionStatus;
    if (invoice.Status === 'Cancel') {
        collectionStatus = 'Cancelled';
    } else if (outstanding <= 0.005) {
        // Tolerance for float math — fully paid (or overpaid)
        collectionStatus = 'Paid';
    } else if (paid > 0) {
        collectionStatus = 'Partial';
    } else if (dueDate && daysPastDue > 0) {
        collectionStatus = 'Overdue';
    } else {
        collectionStatus = 'Pending';
    }

    // Partial-but-overdue is still surfaced as Overdue so it doesn't fall off the radar
    if (collectionStatus === 'Partial' && dueDate && daysPastDue > 0) {
        collectionStatus = 'Overdue';
    }

    return {
        invoice,
        invoiced,
        deposit,
        paid,
        outstanding: Math.max(0, outstanding), // never show negative outstanding
        dueDate,
        daysPastDue,
        collectionStatus,
        agingBucket: getAgingBucket(daysPastDue),
        receipts: matching,
        created_at: invoice.created_at,
    };
}

/**
 * Compute AR for every invoice eligible for the Collection tab.
 * Eligible = Status in (Processing, Completed). Drafts and Cancelled are hidden.
 */
export function computeCollectionRows(
    invoices: Invoice[] | null | undefined,
    receipts: Receipt[] | null | undefined,
    now: Date = startOfToday(),
): InvoiceAR[] {
    if (!invoices) return [];
    return invoices
        .filter(inv => inv.Status === 'Processing' || inv.Status === 'Completed')
        .map(inv => computeInvoiceAR(inv, receipts, now));
}

function startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Sum Outstanding across all rows (used for KPI cards). */
export function totalOutstanding(rows: InvoiceAR[]): number {
    return rows.reduce((s, r) => s + r.outstanding, 0);
}

/** Sum Paid where the receipt date falls in [from, to] inclusive. */
export function paidInRange(rows: InvoiceAR[], from: Date, to: Date): number {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    let sum = 0;
    for (const row of rows) {
        for (const r of row.receipts) {
            const rd = r['RV Date'] ? new Date(r['RV Date'] + 'T00:00:00').getTime() : NaN;
            if (!isFinite(rd)) continue;
            if (rd >= fromMs && rd <= toMs) sum += toNum(r.Amount);
        }
    }
    return sum;
}

/** Sum Outstanding within an aging bucket. */
export function outstandingByBucket(rows: InvoiceAR[]): Record<AgingBucket, number> {
    const out: Record<AgingBucket, number> = { 'Current': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const row of rows) {
        if (row.outstanding <= 0) continue;
        out[row.agingBucket] += row.outstanding;
    }
    return out;
}
