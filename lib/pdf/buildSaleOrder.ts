/**
 * buildSaleOrder.ts
 * Self-contained Sale Order PDF builder.
 * Edit LAYOUT here without affecting any other document type.
 */
import { esc, fmtDate, moneyInner, moneyTd, getFontsB64, LOGO, PdfItem, PdfTotals } from './shared';

// ─── LAYOUT ──────────────────────────────────────────────────────────────────
const MM = 3.7795;
const mm = (v: number) => `${v * MM}px`;
const pt = (v: number) => `${v}pt`;

const LAYOUT = {
    logo:        { width: 42, height: 16 },
    company:     { nameFontSize: 12, contactFontSize: 8, addressFontSize: 8.5 },
    separator:   { paddingBottom: 3, marginBottom: 3 },
    title:       { fontSize: 16, marginTop: 3, marginBottom: 5 },
    customerInfo: {
        fontSize: 9,
        rowGap: 10,
        colLabel: 100,
        colColon: 12,
        colRightLabel: 90,
        colRightValue: 120,
    },
    table: {
        headerFontSize: 9,
        contentFontSize: 9,
        colNo: 5,
        colCode: 16,
        colDesc: 47,
        colQty: 6,
        colPrice: 12,
        colTotal: 14,
    },
    signatures: { labelBottom: 100, fontSize: 9 },
    margins: { top: 10, right: 11, bottom: 14, left: 11 },
};
// ─────────────────────────────────────────────────────────────────────────────

function baseStyle(): string {
    const L = LAYOUT;
    const T = L.table;
    const fonts = getFontsB64();
    return `<style>
      @font-face { font-family:'KhmerOS'; src:url('data:font/truetype;base64,${fonts.khmer}') format('truetype'); font-weight:normal; }
      @font-face { font-family:'Custom Times'; src:url('data:font/truetype;base64,${fonts.times}') format('truetype'); font-weight:normal; }
      @font-face { font-family:'Custom Times'; src:url('data:font/truetype;base64,${fonts.timesBold}') format('truetype'); font-weight:bold; }
      @import url('https://fonts.googleapis.com/css2?family=Moul&display=swap');
      @page { size:A4; }
      html,body { margin:0; padding:0; }
      body { font-family:'Custom Times','KhmerOS',serif; font-size:9pt; color:#000; background:#fff; }
      .page-inner { box-sizing:border-box; }
      .hdr { display:flex; align-items:center; border-bottom:1.5px solid #000; padding-bottom:${mm(L.separator.paddingBottom)}; margin-bottom:${mm(L.separator.marginBottom)}; gap:14px; }
      .hdr img { width:${mm(L.logo.width)}; height:${mm(L.logo.height)}; object-fit:contain; flex-shrink:0; }
      .hdr-info { font-size:${pt(L.company.contactFontSize)}; line-height:1.6; }
      .hdr-name { font-weight:bold; color:#004aad; font-size:${pt(L.company.nameFontSize)}; margin-bottom:3px; }
      .hdr-addr { white-space:nowrap; font-size:${pt(L.company.addressFontSize)}; overflow:hidden; }
      h1.doc-title { text-align:center; font-size:${pt(L.title.fontSize)}; font-weight:bold; text-decoration:underline; margin:${mm(L.title.marginTop)} 0 ${mm(L.title.marginBottom)}; letter-spacing:0.5px; }
      .info-grid { display:grid; grid-template-columns:${L.customerInfo.colLabel}px ${L.customerInfo.colColon}px 1fr ${L.customerInfo.colRightLabel}px ${L.customerInfo.colColon}px ${L.customerInfo.colRightValue}px; gap:${L.customerInfo.rowGap}px 0; margin-bottom:10px; font-size:${pt(L.customerInfo.fontSize)}; }
      .info-grid .lbl, .info-grid .lbl-right { white-space:nowrap; }
      .info-grid .cln { text-align:center; }
      .info-grid .val { white-space:pre-line; line-height:1.5; padding-left:8px; }
      .info-grid .val-left { padding-right:40px; }
      table { width:100%; border-collapse:collapse; margin:6px 0; font-size:${pt(T.contentFontSize)}; table-layout:fixed; }
      th { background:#004aad; color:#fff; padding:5px 6px; text-align:center; font-weight:bold; border:1px solid #000; font-size:${pt(T.headerFontSize)}; }
      td { padding:5px 6px; border:1px solid #000; vertical-align:top; word-wrap:break-word; }
      td.center { text-align:center; }
      tfoot td { font-size:${pt(T.contentFontSize)}; padding:4px 8px; }
      tfoot tr.grand td { font-weight:bold; border-top:2px solid #000; }
      .checklist { display:flex; flex-wrap:wrap; gap:10px; margin:5px 0 12px; }
      .check-item { display:flex; align-items:center; gap:4px; font-size:9pt; }
      .check-box { width:11px; height:11px; border:1px solid #000; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
      .sigs { display:flex; justify-content:space-around; page-break-inside:avoid; }
      .sig-box { text-align:center; min-width:160px; }
      .sig-label { font-weight:bold; font-size:${pt(L.signatures.fontSize)}; }
      .sig-line { border-top:1px solid #000; padding-top:5px; font-size:${pt(L.signatures.fontSize)}; line-height:1.5; }
      @media print { @page { size:A4; } body { margin:0; } }
    </style>`;
}

function header(): string {
    return `<div class="hdr">
      <img src="${LOGO}" alt="Limperial Technology Logo" />
      <div class="hdr-info">
        <div class="hdr-name">LIMPERIAL TECHNOLOGY CO., LTD.</div>
        <div>Tel : (+855) 92 218 333 &nbsp;||&nbsp; Email : info@limperialtech.com &nbsp;||&nbsp; Website : www.limperialtech.com</div>
        <div class="hdr-addr">Address : Building #15, Street Ayeaksmaiyean Bo (139), Sangkat Srah Chak, Khan Daun Penh, Phnom Penh, Cambodia.</div>
      </div>
    </div>`;
}

function infoRow(l1: string, v1: string, l2: string, v2: string): string {
    return `
      <div class="lbl">${esc(l1)}</div><div class="cln">:</div>
      <div class="val val-left">${esc(v1)}</div>
      <div class="lbl-right">${esc(l2)}</div><div class="cln">:</div>
      <div class="val">${esc(v2)}</div>`;
}

function tfoot(currency: string, sym: string, sub: number, tax: number, grand: number): string {
    const ls = 'border:1px solid #000;text-align:right;white-space:nowrap;padding:4px 8px';
    const ms = 'border:1px solid #000;padding:4px 8px;white-space:nowrap';
    return `<tfoot>
      <tr><td colspan="5" style="${ls}">Sub Total (${esc(currency)})</td><td style="${ms}">${moneyInner(sub, sym)}</td></tr>
      ${tax > 0 ? `<tr><td colspan="5" style="${ls}">VAT 10% (${esc(currency)})</td><td style="${ms}">${moneyInner(tax, sym)}</td></tr>` : ''}
      <tr class="grand"><td colspan="5" style="${ls}">Grand Total (${esc(currency)})</td><td style="${ms}">${moneyInner(grand, sym)}</td></tr>
    </tfoot>`;
}

function sigBlock(label: string, name: string, pos: string, labelPadding = 100): string {
    return `<div class="sig-box">
      <div class="sig-label" style="margin-bottom:${labelPadding}px;">${esc(label)}</div>
      <div class="sig-line">${esc(name) || '&nbsp;'}<br/>${esc(pos) || '&nbsp;'}</div>
    </div>`;
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildSaleOrder(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    currency: string,
    sym: string,
    tax: number,
    signaturePadding = 0,  // px — margin-top of .sigs block
    labelPadding = 100,    // px — margin-bottom of .sig-label
): string {
    const T = LAYOUT.table;

    const rows = items.filter(i => Number(i.no) > 0).map(item => {
        const qty          = typeof item.qty        === 'number' ? item.qty        : parseFloat(String(item.qty))        || 0;
        const amt          = typeof item.amount     === 'number' ? item.amount     : parseFloat(String(item.amount))     || 0;
        const commission   = typeof item.commission === 'number' ? item.commission : parseFloat(String(item.commission)) || 0;
        const uPrice       = typeof item.unitPrice  === 'number' ? item.unitPrice  : parseFloat(String(item.unitPrice))  || 0;
        const displayPrice = qty > 0 ? amt / qty : uPrice + commission;
        const combined     = item.modelName
            ? (item.description ? `${item.modelName} - ${item.description}` : item.modelName)
            : (item.description || '');
        return `
        <tr>
          <td class="center">${esc(item.no)}</td>
          <td>${esc(item.itemCode)}</td>
          <td>${esc(combined)}</td>
          <td class="center">${esc(item.qty)}</td>
          ${moneyTd(displayPrice, sym)}
          ${moneyTd(amt, sym)}
        </tr>`;
    }).join('');

    const softwareList = (hd['Install Software'] || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const checkboxes = softwareList.length > 0 ? `
    <div style="margin-top:10px">
      <div style="font-weight:bold;font-size:9pt;margin-bottom:5px">Set up software:</div>
      <div class="checklist">
        ${softwareList.map((opt: string) => `
        <div class="check-item">
          <div class="check-box">
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 5L4.5 7.5L8.5 2.5" stroke="black" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
            </svg>
          </div>
          <span>${esc(opt)}</span>
        </div>`).join('')}
      </div>
    </div>` : '';

    const remark = hd['Remark'] ? `
    <div style="margin-top:10px;font-size:9pt">
      <div style="font-weight:bold">Remark:</div>
      <div style="white-space:pre-wrap">${esc(hd['Remark'])}</div>
    </div>` : '';

    const body = `
    <h1 class="doc-title"><span style="font-family:'Moul',serif;font-size:14pt;display:block;margin-bottom:2px">សាលសន្ថាប់លក់</span>SALE ORDER (B2C)</h1>
    <div class="info-grid">
      ${infoRow('Company Name', hd['Company Name'] || '', 'SO No', hd['Sale Order ID'] || '')}
      ${infoRow('Address', hd['Company Address'] || '', 'SO Date', fmtDate(hd['Order Date']))}
      ${infoRow('Contact Person', hd['Contact Name'] || '', 'Delivery Date', fmtDate(hd['Delivery Date']))}
      ${infoRow('Tel', hd['Contact Tel'] || '', 'Bill Invoice', hd['Bill Invoice'] || '')}
      ${infoRow('Email', hd['Email'] || '', 'Payment Term', hd['Payment Term'] || '')}
    </div>
    <table>
      <thead><tr>
        <th style="width:${T.colNo}%">No.</th>
        <th style="width:${T.colCode}%">Item Code</th>
        <th style="width:${T.colDesc}%">Item Description</th>
        <th style="width:${T.colQty}%">Qty</th>
        <th style="width:${T.colPrice}%">Unit Price</th>
        <th style="width:${T.colTotal}%">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      ${tfoot(currency, sym, totals.subTotal, tax, totals.grandTotal)}
    </table>
    ${checkboxes}${remark}
    <div class="sigs" style="margin-top:${signaturePadding || 50}px;">
      ${sigBlock('ORDERED BY', '', '', labelPadding)}
      ${sigBlock('RECEIVED BY', '', '', labelPadding)}
    </div>`;

    return wrapHtml(baseStyle(), body);
}

function wrapHtml(style: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/>${style}</head>
<body><div class="page"><div class="page-inner">${body}</div></div></body>
</html>`;
}
