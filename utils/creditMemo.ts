/**
 * Credit memo helpers — pure derivations, same spirit as utils/collection.ts.
 *
 * A credit memo is an invoice row with a NEGATIVE Amount (e.g. 05SJ0000304, -$240). Its own
 * journal entry already credits AR, so applying it against another invoice of the same customer
 * moves no cash and posts no journal entry. The application is recorded as a Receipt:
 *
 *   Payment Method = 'Credit Memo', credit_memo_no = <memo Inv No>, Amount = amount applied.
 *
 * That receipt reduces the target invoice's Outstanding through the normal AR derivation, and
 * consumes the memo:  remaining = |memo.Amount| - SUM(non-cancelled applications).
 */
import { Invoice, Receipt } from '../types';

export const CREDIT_MEMO_METHOD = 'Credit Memo';

const toNum = (v: unknown): number => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
};

/** A receipt that settles an invoice with a credit memo instead of cash. */
export const isCreditApplication = (r: Pick<Receipt, 'Payment Method'>): boolean =>
    r['Payment Method'] === CREDIT_MEMO_METHOD;

/** An issued invoice with a negative Amount. Drafts and cancelled rows are not usable credit. */
export const isCreditMemo = (inv: Invoice): boolean =>
    toNum(inv.Amount) < -0.005 && (inv.Status === 'Completed' || inv.Status === 'Processing');

/**
 * Company names are free text and drift between documents ("ECAM SOLUTION CO., LTD." vs
 * "ECAM SOLUTION CO., LTD") — compare on letters and digits only. An empty key never matches.
 */
export const companyKey = (name: unknown): string =>
    String(name ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Total already applied from a memo (cancelled applications give the credit back). */
export function creditApplied(memoNo: string, receipts: Receipt[] | null | undefined): number {
    return (receipts ?? [])
        .filter(r => r['credit_memo_no'] === memoNo && r['Status'] !== 'Cancelled')
        .reduce((s, r) => s + toNum(r.Amount), 0);
}

export interface AvailableCredit {
    memo: Invoice;
    total: number;
    applied: number;
    remaining: number;
}

export function creditStanding(memo: Invoice, receipts: Receipt[] | null | undefined): AvailableCredit {
    const total = Math.abs(toNum(memo.Amount));
    const applied = creditApplied(memo['Inv No'], receipts);
    return { memo, total, applied, remaining: Math.max(0, Math.round((total - applied) * 100) / 100) };
}

/** Every credit memo that still has credit left. */
export function openCreditMemos(
    invoices: Invoice[] | null | undefined,
    receipts: Receipt[] | null | undefined,
): AvailableCredit[] {
    return (invoices ?? [])
        .filter(isCreditMemo)
        .map(m => creditStanding(m, receipts))
        .filter(c => c.remaining > 0.005);
}

/** The open credits that can be applied to `invoice`: same customer, same currency. */
export function creditsForInvoice(invoice: Invoice, memos: AvailableCredit[]): AvailableCredit[] {
    if (isCreditMemo(invoice)) return [];
    const key = companyKey(invoice['Company Name']);
    if (!key) return [];
    const ccy = invoice.Currency === 'KHR' ? 'KHR' : 'USD';
    return memos.filter(c =>
        companyKey(c.memo['Company Name']) === key &&
        (c.memo.Currency === 'KHR' ? 'KHR' : 'USD') === ccy,
    );
}
