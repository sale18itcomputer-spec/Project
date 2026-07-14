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

export interface PdfBuildComponent {
    itemCode: string;
    modelName: string;
    qty: number | string;
    serialNumber?: string;
    warrantyMonths?: number;
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
    isPromotion?: boolean;
    /** PC Build: sold as one priced line, but printed with each real part as its own row. */
    isPCBuild?: boolean;
    buildComponents?: PdfBuildComponent[];
}

export interface PdfTotals {
    subTotal: number;
    tax?: number;
    vat?: number;
    grandTotal: number;
}

/**
 * Deposit as a percentage of the invoice's full VAT-inclusive value.
 *
 * MUST divide by `grandTotal` (subTotal + VAT), never `subTotal`. A 20%-of-total
 * deposit on a VAT invoice divides out to 22% against the pre-VAT subtotal —
 * that exact regression shipped once already (buildTaxInvoice.ts printed
 * "22%" on a real customer invoice for a deposit that was actually 20%).
 * Covered by scripts/regression-deposit-percent.ts — run it after touching
 * this function.
 */
export function depositPercentOf(deposit: number, grandTotal: number): number {
    return deposit > 0 && grandTotal > 0 ? Math.round((deposit / grandTotal) * 100) : 0;
}

/**
 * Splits a GROSS (VAT-inclusive) amount into its net and VAT components.
 *
 * `hd['Deposit']` on an invoice is always the gross amount actually collected
 * (see JE-2039's shape: Bank 41,773.60 = Deposit-net 37,976.00 + VAT Output
 * 3,797.60). It must be DECOMPOSED, never taxed again on top — that shipped
 * once already: buildTaxInvoice.ts treated the gross deposit as if it were
 * net and added another 10% VAT on top, inflating a genuine $41,773.60
 * deposit's printed Grand Total to $45,950.96.
 *
 * `net` is rounded to 2dp first and `vat` is derived by subtraction (not its
 * own independent rounding), so net + vat always sums back to `gross` exactly
 * — no rounding-drift cent left over on the printed invoice.
 *
 * Covered by scripts/regression-deposit-percent.ts — run it after touching this.
 */
export function decomposeGrossAmount(gross: number, vatRate = 0.1): { net: number; vat: number } {
    if (gross <= 0) return { net: 0, vat: 0 };
    const net = Math.round((gross / (1 + vatRate)) * 100) / 100;
    const vat = Math.round((gross - net) * 100) / 100;
    return { net, vat };
}

export interface VatDepositFooter {
    depositPercent: number;
    depositNet: number;
    depositVat: number;
    grandUsd: number;
    grandRiel: number;
}

/**
 * Computes every derived figure for a VAT invoice's deposit footer from one
 * set of ground-truth inputs, with a hard internal reconciliation check.
 *
 * This function exists because the two incidents above (22%-vs-20%, and the
 * gross deposit taxed a second time) both happened the same way: depositPercent,
 * vatBase, vatAmount and grandUsd used to be four SEPARATE local consts in
 * buildTaxInvoice.ts. Each was "obviously right" in isolation and each was
 * fixed once in isolation — but nothing ever checked that they were still
 * consistent WITH EACH OTHER, so a fix to one (the percent) shipped while a
 * neighbor (the dollar amounts) stayed broken for a second invoice cycle.
 *
 * Consolidating them here means: (a) there is exactly one call site to get
 * this wrong, (b) the reconciliation check below throws — not warns — the
 * next time ANY deposit invoice is generated with inconsistent figures, not
 * just when a developer remembers to run scripts/regression-deposit-percent.ts.
 * A thrown error on a financial document is the intended, serious failure
 * mode: it is preferable to a silently wrong number reaching a customer.
 */
export function computeVatDepositFooter(
    deposit: number,
    grandTotal: number,
    exchangeRate: number,
): VatDepositFooter {
    const depositPercent = depositPercentOf(deposit, grandTotal);
    const { net, vat } = decomposeGrossAmount(deposit);
    const grandUsd = deposit; // the amount due NOW is exactly what was collected — never re-taxed
    const grandRiel = exchangeRate > 0 ? Math.round(grandUsd * exchangeRate) : 0;

    if (Math.abs(net + vat - deposit) > 0.01) {
        throw new Error(
            `computeVatDepositFooter: net (${net}) + vat (${vat}) does not reconcile to the ` +
            `collected deposit (${deposit}). Refusing to print an inconsistent invoice — this means ` +
            `a future edit computed net or vat independently instead of deriving one from the other.`,
        );
    }

    return { depositPercent, depositNet: net, depositVat: vat, grandUsd, grandRiel };
}
