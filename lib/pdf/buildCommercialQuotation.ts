/**
 * buildCommercialQuotation.ts
 * COMMERCIAL QUOTATION — Yanet Computer Shop format, matching the Commercial Invoice.
 * No VAT; total only. Fields follow the existing quotation builders so callers pass the
 * same header data.
 */
import { esc, fmtDate, PdfItem, PdfTotals } from './shared-pure';
import {
    COMMERCIAL_TERMS_HTML, commercialItemRows, commercialMoney, commercialTotalRow, renderCommercialDoc,
} from './commercialShared';

export function buildCommercialQuotation(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    _currency: string,
    sym: string,
    signaturePadding = 0,
    labelPadding?: number,
): string {
    const subTotal = totals.subTotal;
    const contact = hd['Contact Person'] || hd['Contact Name'] || '';
    const phone = hd['Contact Tel'] || hd['Phone Number'] || hd['Telephone'] || '';
    const email = hd['Contact Email'] || hd['Email'] || '';
    const status = hd['Stock Status'] || hd['Status'] || '';
    const payTerm = hd['Payment Term'] || '';

    const leftRows: [string, string][] = [['Customer Name', esc(hd['Company Name'] || hd['Customer'] || '')]];
    if (contact) leftRows.push(['Contact Person', esc(contact)]);
    leftRows.push(['Phone Number', esc(phone)]);
    if (email) leftRows.push(['E-mail', esc(email)]);
    leftRows.push(['Address', esc(hd['Company Address'] || hd['Address'] || '')]);

    const rightRows: [string, string][] = [
        ['Quotation N&#186;', esc(hd['Quotation ID'] || hd['Quote No'] || hd['Quotation No'] || '')],
        ['Date', esc(fmtDate(hd['Quote Date'] || hd['Quotation Date'] || ''))],
        ['Validity', esc(fmtDate(hd['Validity Date'] || hd['Validity'] || ''))],
    ];
    if (status) rightRows.push(['Status', esc(status)]);
    if (payTerm) rightRows.push(['Payment Term', esc(payTerm)]);

    return renderCommercialDoc({
        pageTitle: 'Commercial Quotation',
        title: 'QUOTATION',
        leftHeading: 'Customer :',
        leftRows,
        rightRows,
        rightLabelWidth: 112,
        // Quotations show the unit price including per-unit commission, like the other quotation layouts.
        itemRowsHtml: commercialItemRows(items, sym, { serials: false, price: 'unit+commission' }),
        totalRowsHtml: commercialTotalRow('Total', commercialMoney(sym, subTotal > 0 ? subTotal : null)),
        belowHtml: COMMERCIAL_TERMS_HTML,
        signatures: [
            { label: 'Prepared By', name: hd['Prepared By'] || hd['Created By'] || '', position: hd['Prepared By Position'] || '' },
            { label: 'Approved By', name: hd['Approved By'] || '', position: hd['Approved By Position'] || '' },
        ],
        signaturePadding,
        labelPadding,
    });
}
