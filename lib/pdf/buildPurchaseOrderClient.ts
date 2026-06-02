/**
 * buildPurchaseOrderClient.ts — CLIENT-SAFE
 * Same layout as the inline buildPO in pdfTemplate.ts.
 * Uses system serif fonts instead of base64-embedded fonts (preview only).
 * PDF download still goes through pdfTemplate.ts with embedded fonts.
 */
import { esc, fmtDate, moneyInner, moneyTd, LOGO, PdfItem, PdfTotals } from './shared-pure';

const MM = 3.7795;
const mm = (v: number) => `${v * MM}px`;
const pt = (v: number) => `${v}pt`;

const L = {
    logo:       { width: 40, height: 15 },
    company:    { nameFontSize: 12, contactFontSize: 8, addressFontSize: 8.5 },
    separator:  { paddingBottom: 3, marginBottom: 3 },
    title:      { fontSize: 16, marginTop: 3, marginBottom: 5 },
    table:      { headerFontSize: 9, contentFontSize: 9 },
    signatures: { labelBottom: 100, fontSize: 9, lineFontSize: 9, padding: 30 },
};

function sigBlock(label: string, name: string, pos: string): string {
    return `<div class="sig-box"><div class="sig-label">${esc(label)}</div><div class="sig-line">${esc(name)||'&nbsp;'}<br/>${esc(pos)||'&nbsp;'}</div></div>`;
}

export function buildPurchaseOrderClient(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    currency: string,
    sym: string,
    tax: number,
    columnWidths?: number[],
): string {
    const cw = columnWidths ?? [7, 17, 46, 6, 10, 14];
    const [wNo, wCode, wDesc, wQty, wPrice, wAmt] = cw;
    const visibleCols = cw.filter(w => w > 0).length;

    const rows = items.filter(i => i.itemCode || i.description || i.modelName).map(item => {
        const uPrice = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
        const amt    = typeof item.amount    === 'number' ? item.amount    : parseFloat(String(item.amount))    || 0;
        return `<tr>
          ${wNo>0   ? `<td class="center">${esc(item.no)}</td>` : ''}
          ${wCode>0 ? `<td>${esc(item.itemCode)}</td>` : ''}
          ${wDesc>0 ? `<td>${esc(item.description||item.modelName||'')}</td>` : ''}
          ${wQty>0  ? `<td class="center">${esc(item.qty)}</td>` : ''}
          ${wPrice>0 ? moneyTd(uPrice, sym) : ''}
          ${wAmt>0   ? moneyTd(amt, sym) : ''}
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
  @page { size:A4; margin:10mm 11mm 14mm 11mm; }
  html,body { margin:0; padding:0; }
  body { font-family:Georgia,'Times New Roman',serif; font-size:9pt; color:#000; background:#fff; }
  .page-inner { box-sizing:border-box; }
  .hdr { display:flex; align-items:center; border-bottom:1px solid #000; padding-bottom:${mm(L.separator.paddingBottom)}; margin-bottom:${mm(L.separator.marginBottom)}; gap:14px; }
  .hdr img { width:${mm(L.logo.width)}; height:${mm(L.logo.height)}; object-fit:contain; flex-shrink:0; }
  .hdr-info { font-size:${pt(L.company.contactFontSize)}; line-height:1.6; }
  .hdr-name { font-weight:bold; color:#004aad; font-size:${pt(L.company.nameFontSize)}; margin-bottom:3px; }
  .hdr-addr { white-space:nowrap; font-size:${pt(L.company.addressFontSize)}; overflow:hidden; }
  h1.doc-title { text-align:center; font-size:${pt(L.title.fontSize)}; font-weight:bold; text-decoration:underline; margin:${mm(L.title.marginTop)} 0 ${mm(L.title.marginBottom)}; color:#004aad; }
  table { width:100%; border-collapse:collapse; margin:10px 0; font-size:${pt(L.table.contentFontSize)}; table-layout:fixed; }
  th { background:#004aad; color:#fff; padding:5px 6px; text-align:center; font-weight:bold; border:1px solid #000; font-size:${pt(L.table.headerFontSize)}; }
  td { padding:5px 6px; border:1px solid #000; vertical-align:top; word-wrap:break-word; }
  td.center { text-align:center; }
  tfoot tr.grand td { font-weight:bold; }
  .po-band { display:flex; background:#004aad; color:#fff; font-weight:bold; font-size:8pt; padding:3px 5px; margin-bottom:2px; }
  .po-band span { flex:1; }
  .po-row { display:flex; font-size:8pt; padding:3px 5px 6px; }
  .po-row span { flex:1; white-space:pre-line; }
  .sigs { display:flex; justify-content:space-between; margin-top:50px; padding:0 ${L.signatures.padding}px; page-break-inside:avoid; }
  .sig-box { text-align:center; flex:0 0 160px; }
  .sig-label { font-weight:bold; font-size:${pt(L.signatures.fontSize)}; margin-bottom:${L.signatures.labelBottom}px; }
  .sig-line { border-top:1px solid #000; padding-top:5px; font-size:${pt(L.signatures.lineFontSize)}; line-height:1.5; }
</style>
</head>
<body>
<div class="page-inner">
  <div class="hdr">
    <img src="${LOGO}" alt="Logo"/>
    <div class="hdr-info">
      <div class="hdr-name">LIMPERIAL TECHNOLOGY CO., LTD.</div>
      <div>Tel : (+855) 92 218 333 || Email : info@limperialtech.com || Website : www.limperialtech.com</div>
      <div class="hdr-addr">Address : Building #15, Street Ayeaksmaiyean Bo (139), Sangkat Srah Chak, Khan Daun Penh, Phnom Penh, Cambodia.</div>
    </div>
  </div>
  <h1 class="doc-title">PURCHASE ORDER</h1>
  <div class="po-band"><span>Vendor Name:</span><span>Address:</span><span>Order Date:</span><span>PO Number #:</span></div>
  <div class="po-row"><span>${esc(hd['Vendor Name']||'')}\n${esc(hd['Vendor Contact']||'')}\n${esc(hd['Vendor Phone']||'')}</span><span>${esc(hd['Vendor Address']||'')}</span><span>${fmtDate(hd['Order Date'])}</span><span>${esc(hd['PO Number']||'')}</span></div>
  <div class="po-band" style="margin-top:6px"><span>Order by:</span><span>Ship to:</span><span>Delivery Date:</span><span>Payment Term:</span></div>
  <div class="po-row"><span>${esc(hd['ordered_by_name']||'')}\n${esc(hd['ordered_by_phone']||'')}</span><span>${esc(hd['Ship To']||'')}</span><span>${fmtDate(hd['Delivery Date'])}</span><span>${esc(hd['Payment Term']||'')}</span></div>
  <table>
    <colgroup>
      ${wNo>0   ? `<col style="width:${wNo}%"/>` : ''}
      ${wCode>0 ? `<col style="width:${wCode}%"/>` : ''}
      ${wDesc>0 ? `<col style="width:${wDesc}%"/>` : ''}
      ${wQty>0  ? `<col style="width:${wQty}%"/>` : ''}
      ${wPrice>0? `<col style="width:${wPrice}%"/>` : ''}
      ${wAmt>0  ? `<col style="width:${wAmt}%"/>` : ''}
    </colgroup>
    <thead><tr>
      ${wNo>0   ? '<th>No.</th>' : ''}
      ${wCode>0 ? '<th>Item Code</th>' : ''}
      ${wDesc>0 ? '<th>Description</th>' : ''}
      ${wQty>0  ? '<th>Qty</th>' : ''}
      ${wPrice>0? '<th>Unit Price</th>' : ''}
      ${wAmt>0  ? '<th>Total</th>' : ''}
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="${visibleCols-1}" style="border:1px solid #000;text-align:right;white-space:nowrap;padding:4px 8px">Sub Total (${esc(currency)})</td><td style="border:1px solid #000;padding:4px 8px">${moneyInner(totals.subTotal,sym)}</td></tr>
      ${tax>0?`<tr><td colspan="${visibleCols-1}" style="border:1px solid #000;text-align:right;padding:4px 8px">VAT 10%</td><td style="border:1px solid #000;padding:4px 8px">${moneyInner(tax,sym)}</td></tr>`:''}
      <tr class="grand"><td colspan="${visibleCols-1}" style="border:1px solid #000;text-align:right;padding:4px 8px">Grand Total (${esc(currency)})</td><td style="border:1px solid #000;padding:4px 8px">${moneyInner(totals.grandTotal,sym)}</td></tr>
    </tfoot>
  </table>
  <div class="sigs">
    ${sigBlock('PREPARED BY', hd['Prepared By']||'', hd['Prepared By Position']||'')}
    ${sigBlock('APPROVED BY', hd['Approved By']||'', hd['Approved By Position']||'')}
  </div>
</div>
</body>
</html>`;
}
