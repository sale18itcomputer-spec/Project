/**
 * buildCommercialInvoice.ts
 * COMMERCIAL INVOICE — the Yanet Computer Shop format.
 *
 * Its own document type (neither VAT nor Non-VAT), same entity as LPT. English only, no VAT,
 * no Part Number column. The Commercial Quotation and Sale Order share the same look through
 * commercialShared.ts. The signature is kept identical to the other builders so callers need no
 * changes; VAT-TIN, exchange-rate and column-width options do not apply to this format.
 */
import { esc, fmtDate, PdfItem, PdfTotals } from './shared-pure';
import {
    COMMERCIAL_SELLER, COMMERCIAL_TERMS_HTML, commercialItemRows, commercialMoney,
    commercialTotalRow, renderCommercialDoc,
} from './commercialShared';

export { COMMERCIAL_SELLER };

export function buildCommercialInvoice(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    _currency: string,
    sym: string,
    _tax: number,
    _showVatTin = false,
    signaturePadding = 0,
    labelPadding?: number,
    _columnWidths?: number[],
    hideSerials = false,
): string {
    const deposit = parseFloat(String(hd['Deposit'] || 0)) || 0;
    const subTotal = totals.subTotal;
    const lessDeposit = subTotal - deposit;

    const totalRowsHtml =
        commercialTotalRow('Total', commercialMoney(sym, subTotal > 0 ? subTotal : null)) +
        (deposit > 0
            ? commercialTotalRow('Deposit', commercialMoney(sym, deposit)) +
              commercialTotalRow('Total Less Deposit', commercialMoney(sym, lessDeposit > 0 ? lessDeposit : null))
            : '');

    return renderCommercialDoc({
        pageTitle: 'Commercial Invoice',
        title: 'INVOICE',
        leftHeading: 'Buyer :',
        leftRows: [
            ['Customer Name', esc(hd['Company Name'] || hd['Customer'] || '')],
            ['Phone Number', esc(hd['Phone Number'] || hd['Telephone'] || '')],
            ['Address', esc(hd['Company Address'] || hd['Address'] || '')],
        ],
        rightRows: [
            ['Invoice N&#186;', esc(hd['Inv No.'] || hd['Inv No'] || hd['Invoice No'] || '')],
            ['Date', esc(fmtDate(hd['Inv Date'] || hd['Invoice Date'] || ''))],
            ['Due Date', esc(fmtDate(hd['Due Date'] || ''))],
        ],
        itemRowsHtml: commercialItemRows(items, sym, { serials: !hideSerials, price: 'unit' }),
        totalRowsHtml,
        belowHtml: COMMERCIAL_TERMS_HTML,
        signatures: [
            { label: "Seller's Signature & Name", name: hd['Prepared By'] || '', position: hd['Prepared By Position'] || '' },
            { label: "Customer's Signature & Name" },
        ],
        signaturePadding,
        labelPadding,
    });
}
