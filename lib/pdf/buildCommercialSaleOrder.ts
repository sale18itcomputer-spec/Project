/**
 * buildCommercialSaleOrder.ts
 * COMMERCIAL SALE ORDER — Yanet Computer Shop format, matching the Commercial Invoice.
 * Internal-use document: no serial numbers, no terms block; keeps the set-up software list
 * and remark that the standard sale order carries.
 */
import { esc, fmtDate, PdfItem, PdfTotals } from './shared-pure';
import { commercialItemRows, commercialMoney, commercialTotalRow, renderCommercialDoc } from './commercialShared';

export function buildCommercialSaleOrder(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    _currency: string,
    sym: string,
    signaturePadding = 0,
    labelPadding?: number,
): string {
    const subTotal = totals.subTotal;
    const contact = hd['Contact Name'] || '';
    const tel = hd['Contact Tel'] || '';
    const email = hd['Email'] || '';
    const payTerm = hd['Payment Term'] || '';

    const leftRows: [string, string][] = [['Customer Name', esc(hd['Company Name'] || '')]];
    if (contact) leftRows.push(['Contact Person', esc(contact)]);
    leftRows.push(['Phone Number', esc(tel)]);
    if (email) leftRows.push(['E-mail', esc(email)]);
    leftRows.push(['Address', esc(hd['Company Address'] || '')]);

    const rightRows: [string, string][] = [
        ['SO N&#186;', esc(hd['Sale Order ID'] || '')],
        ['SO Date', esc(fmtDate(hd['Order Date'] || ''))],
        ['Delivery Date', esc(fmtDate(hd['Delivery Date'] || ''))],
        ['Bill Invoice', esc(hd['Bill Invoice'] || '')],
    ];
    if (payTerm) rightRows.push(['Payment Term', esc(payTerm)]);

    const software = String(hd['Install Software'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const softwareHtml = software.length ? `
      <h4>Set up software:</h4>
      <ul>${software.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '';
    const remarkHtml = hd['Remark'] ? `
      <p style="margin:6px 0 0"><b>Remark:</b></p><div style="white-space:pre-wrap">${esc(hd['Remark'])}</div>` : '';

    return renderCommercialDoc({
        pageTitle: 'Commercial Sale Order',
        title: `SALE ORDER (${hd['_isB2B'] ? 'B2B' : 'B2C'})`,
        leftHeading: 'Customer :',
        leftRows,
        rightRows,
        rightLabelWidth: 112,
        // Sale orders print the unit price as amount / qty (commission folded in), like the standard layout.
        itemRowsHtml: commercialItemRows(items, sym, { serials: false, price: 'amount/qty' }),
        totalRowsHtml: commercialTotalRow('Total', commercialMoney(sym, subTotal > 0 ? subTotal : null)),
        belowHtml: (softwareHtml || remarkHtml) ? `<div class="terms">${softwareHtml}${remarkHtml}</div>` : '',
        signatures: [{ label: 'Ordered By:' }, { label: 'Received By:' }],
        signaturePadding,
        labelPadding,
    });
}
