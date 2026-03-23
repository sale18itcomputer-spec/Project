/**
 * pdfTemplate.ts
 * Builds a self-contained HTML string for each document type.
 * Runs on the server (Node.js) only — imported by the API route.
 *
 * ─── LAYOUT CONFIG ───────────────────────────────────────────────────────────
 * All sizing/positioning values sourced from pdfGenerator.ts defaultLayoutConfig.
 * Change numbers here only; no other code needs to change.
 */
import fs from 'fs';
import path from 'path';

const MM = 3.7795; // px per mm at 96 dpi
const mm = (v: number) => `${v * MM}px`;
const pt = (v: number) => `${v}pt`;

const LAYOUT = {
  // ── Logo ─────────────────────────────────────────────────────────────────
  // Source: defaultLayoutConfig.header.logo  { x:10, y:5, width:36 }
  // Height = separatorLine.y(18.5) - logo.y(5) = 13.5mm
  logo: {
    width:  40,   // mm
    height: 15,   // mm
  },

  // ── Company name / contact block ─────────────────────────────────────────
  company: {
    nameFontSize:    12,  // pt
    contactFontSize:  8,  // pt
    addressFontSize:  8.5,// pt
  },

  // ── Separator & title ────────────────────────────────────────────────────
  separator: {
    paddingBottom: 3,   // mm
    marginBottom:  3,   // mm  — close gap between separator and title
  },
  title: {
    fontSize:     16,   // pt
    marginTop:     3,   // mm  — tight to separator line
    marginBottom:  5,   // mm
  },

  // ── Customer info grid ───────────────────────────────────────────────────
  // Source: defaultLayoutConfig.info  { startY:33.5, fontSize:9, rowHeight:8 }
  customerInfo: {
    fontSize:      9,   // pt
    rowGap:        5,   // px  — 1.5 spacing
    colLabel:     90,   // px  — wide enough for 'Company Name' on 1 line
    colColon:     12,   // px
    colRightLabel:110,  // px
    colRightValue:120,  // px
  },

  // ── Item table ───────────────────────────────────────────────────────────
  // Source: defaultLayoutConfig.table
  // margins: left=11, right=11 → usable width = 188mm
  // columnWidths: no=13, itemCode=23, qty=12, unitPrice=18, total=26
  // description = 188-13-23-12-18-26 = 96mm
  // Unit Price and Total each split into sym + num columns
  table: {
    headerFontSize:  9,    // pt
    contentFontSize: 9,    // pt
    subFontSize:     8.5,  // pt — descriptionFontSize
    colNo:    7,   // %  13/188
    colCode: 17,   // %  23/188
    colDesc: 46,   // %  96/188
    colQty:   6,   // %  12/188
    colPrice:10,   // %  18/188 — single cell, $ left + number right via flex
    colTotal:14,   // %  26/188 — single cell, $ left + number right via flex
  },

  // ── Terms & Conditions ───────────────────────────────────────────────────
  // Source: defaultLayoutConfig.terms
  terms: {
    spacingAbove:    7,   // mm
    titleFontSize:   9,   // pt
    contentFontSize: 9,   // pt
  },

  // ── Signatures ───────────────────────────────────────────────────────────
  // Source: defaultLayoutConfig.footer { y:220, preparedBy.x:50, approvedBy.x:160 }
  signatures: {
    marginTop:   40,   // px
    padding:     30,   // px
    labelBottom: 120,  // px — enough space for stamp + signature
    fontSize:     9,   // pt
    lineFontSize: 9,   // pt
  },

  // ── Page margins ─────────────────────────────────────────────────────────
  // Source: defaultLayoutConfig.table.margins { left:11, right:11 }
  margins: {
    top:    10,   // mm
    right:  11,   // mm
    bottom: 14,   // mm
    left:   11,   // mm
  },
};
// ─────────────────────────────────────────────────────────────────────────────

// ── Font embedding ────────────────────────────────────────────────────────────
function getFontsB64(): { khmer: string; times: string; timesBold: string } {
    const khmer     = fs.readFileSync(path.join(process.cwd(), 'public', 'KhmerOS.ttf')).toString('base64');
    const times     = fs.readFileSync(path.join(process.cwd(), 'public', 'times.ttf')).toString('base64');
    const timesBold = fs.readFileSync(path.join(process.cwd(), 'public', 'timesbd.ttf')).toString('base64');
    return { khmer, times, timesBold };
}

// ── Base CSS ──────────────────────────────────────────────────────────────────
function baseStyle(): string {
    const L = LAYOUT;
    const T = L.table;
    const fonts = getFontsB64();
    return `
    <style>
      @font-face {
        font-family: 'KhmerOS';
        src: url('data:font/truetype;base64,${fonts.khmer}') format('truetype');
        font-weight: normal; font-style: normal;
      }
      @font-face {
        font-family: 'Times New Roman';
        src: url('data:font/truetype;base64,${fonts.times}') format('truetype');
        font-weight: normal; font-style: normal;
      }
      @font-face {
        font-family: 'Times New Roman';
        src: url('data:font/truetype;base64,${fonts.timesBold}') format('truetype');
        font-weight: bold; font-style: normal;
      }
      @page { size: A4; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: 'Times New Roman', 'KhmerOS', serif;
        font-size: 9pt;
        color: #000; background: #fff;
        -webkit-font-smoothing: antialiased;
      }
      .page { margin: 0; padding: 0; box-sizing: border-box; }
      /* ── Page margins ── */
      .page-inner {
        box-sizing: border-box;
      }
      /* ── Header ── */
      .hdr {
        display: flex; align-items: center;
        border-bottom: 1px solid #000;
        padding-bottom: ${mm(L.separator.paddingBottom)};
        margin-bottom: ${mm(L.separator.marginBottom)};
        gap: 14px;
      }
      .hdr img  { width: ${mm(L.logo.width)}; height: ${mm(L.logo.height)}; object-fit: contain; flex-shrink: 0; }
      .hdr-info { text-align: left; font-size: ${pt(L.company.contactFontSize)}; line-height: 1.6; }
      .hdr-name { font-weight: bold; color: #004aad; font-size: ${pt(L.company.nameFontSize)}; margin-bottom: 3px; letter-spacing: 0.3px; }
      .hdr-addr { white-space: nowrap; font-size: ${pt(L.company.addressFontSize)}; overflow: hidden; }
      /* ── Title ── */
      h1.doc-title {
        text-align: center; font-size: ${pt(L.title.fontSize)}; font-weight: bold;
        text-decoration: underline;
        margin: ${mm(L.title.marginTop)} 0 ${mm(L.title.marginBottom)};
        letter-spacing: 0.5px;
      }
      /* ── Info grid ── */
      .info-grid {
        display: grid;
        grid-template-columns: ${L.customerInfo.colLabel}px ${L.customerInfo.colColon}px 1fr ${L.customerInfo.colRightLabel}px ${L.customerInfo.colColon}px ${L.customerInfo.colRightValue}px;
        gap: ${L.customerInfo.rowGap}px 0;
        margin-bottom: 10px;
        font-size: ${pt(L.customerInfo.fontSize)};
      }
      .info-grid .lbl       { font-weight: normal; white-space: nowrap; }
      .info-grid .cln       { text-align: center; }
      .info-grid .val       { white-space: pre-line; line-height: 1.5; font-weight: normal; padding-right: 20px; }
      .info-grid .lbl-right { padding-left: 24px; }
      /* ── Table ── */
      table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: ${pt(T.contentFontSize)}; table-layout: fixed; }
      th {
        background: #004aad; color: #fff; padding: 5px 6px; text-align: center;
        font-weight: bold; border: 1px solid #004aad; font-size: ${pt(T.headerFontSize)};
      }
      td { padding: 5px 6px; border: 1px solid #000; vertical-align: top; word-wrap: break-word; }
      td.center  { text-align: center; }
      td.right   { text-align: right; }
      /* Split currency columns */
      td.money   { padding: 5px 6px; }
      td.sub     { font-size: ${pt(T.contentFontSize)}; white-space: pre-wrap; }
      /* ── Tfoot ── */
      tfoot td { font-size: ${pt(T.contentFontSize)}; padding: 4px 6px; }
      tfoot tr.grand td { background: #f0f0f0; font-weight: bold; border-top: 2px solid #000; }
      /* ── Terms ── */
      .terms { margin-top: ${mm(L.terms.spacingAbove)}; font-size: ${pt(L.terms.contentFontSize)}; line-height: 1.4; page-break-inside: avoid; }
      .terms h4 { font-weight: bold; font-size: ${pt(L.terms.titleFontSize)}; margin-bottom: 2px; }
      .terms p  { white-space: pre-wrap; margin-top: 2px; }
      /* ── Signatures ── */
      .sigs {
        display: flex; justify-content: space-between;
        margin-top: 50px;
        padding: 0 ${L.signatures.padding}px;
        page-break-inside: avoid;
      }
      .sig-box   { text-align: center; flex: 0 0 160px; }
      .sig-label { font-weight: bold; font-size: ${pt(L.signatures.fontSize)}; margin-bottom: ${L.signatures.labelBottom}px; }
      .sig-line  { border-top: 1px solid #000; padding-top: 5px; font-size: ${pt(L.signatures.lineFontSize)}; font-weight: bold; line-height: 1.5; }
      /* ── PO bands ── */
      .po-band { display: flex; background: #004aad; color: #fff; font-weight: bold; font-size: 8pt; padding: 3px 5px; margin-bottom: 2px; }
      .po-band span { flex: 1; }
      .po-row  { display: flex; font-size: 8pt; padding: 3px 5px 6px; }
      .po-row span { flex: 1; white-space: pre-line; }
      /* ── Checklist ── */
      .checklist { display: flex; flex-wrap: wrap; gap: 10px; margin: 5px 0 12px; }
      .check-item { display: flex; align-items: center; gap: 4px; font-size: 9pt; }
      .check-box  { width: 11px; height: 11px; border: 1px solid #000; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
      @media print { @page { size: A4; } body { margin: 0; } }
    </style>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s: unknown): string {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(ds?: string): string {
    if (!ds) return '';
    const d = new Date(ds + 'T00:00:00');
    if (isNaN(d.getTime())) return ds;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtNum(v: number | string): string {
    const n = typeof v === 'number' ? v : parseFloat(String(v)) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Inner content for a money cell: $ left, number right, no wrap
function moneyInner(v: number | string, sym: string): string {
    const n = fmtNum(v);
    return `<span style="display:flex;justify-content:space-between;white-space:nowrap"><span>${sym}</span><span>${n}</span></span>`;
}

// Full <td> money cell for tbody rows
function moneyTd(v: number | string, sym: string, extraStyle = ''): string {
    const style = extraStyle ? `padding:5px 6px;border:1px solid #000;${extraStyle}` : 'padding:5px 6px;border:1px solid #000';
    return `<td style="${style}">${moneyInner(v, sym)}</td>`;
}

const LOGO = 'https://i.postimg.cc/RFYdrpBC/Limperial-Technology-Logo01-png(004aad).png';

function companyHeader(): string {
    return `
    <div class="hdr">
      <img src="${LOGO}" alt="L'Imperial Technology Logo" />
      <div class="hdr-info">
        <div class="hdr-name">LIMPERIAL TECHNOLOGY CO., LTD.</div>
        <div>Tel : (+855) 92 218 333 || Email : info@limperialtech.com || Website : www.limperialtech.com</div>
        <div class="hdr-addr">Address : Building #15, Street Ayeaksmaiyean Bo (139), Sangkat Srah Chak, Khan Daun Penh, Phnom Penh, Cambodia.</div>
      </div>
    </div>`;
}

function infoRow(l1: string, v1: string, l2: string, v2: string): string {
    return `
      <div class="lbl">${esc(l1)}</div><div class="cln">:</div>
      <div class="val">${esc(v1)}</div>
      <div class="lbl-right">${esc(l2)}</div><div class="cln">:</div><div class="val">${esc(v2)}</div>`;
}

function sigBlock(label: string, name: string, pos: string): string {
    return `
    <div class="sig-box">
      <div class="sig-label">${esc(label)}</div>
      <div class="sig-line">${esc(name) || '&nbsp;'}<br/>${esc(pos) || '&nbsp;'}</div>
    </div>`;
}

// Table has 6 columns: no | code | desc | qty | price | total
function tableHeader(priceLabel: string, totalLabel: string): string {
    const T = LAYOUT.table;
    return `<tr>
      <th style="width:${T.colNo}%">No.</th>
      <th style="width:${T.colCode}%">Item Code</th>
      <th style="width:${T.colDesc}%">Description</th>
      <th style="width:${T.colQty}%">Qty</th>
      <th style="width:${T.colPrice}%">${priceLabel}</th>
      <th style="width:${T.colTotal}%">${totalLabel}</th>
    </tr>`;
}

// Tfoot: 6 columns — label spans cols 1-5 (right-aligned) | money is col 6
function stdTfoot(currency: string, sym: string, sub: number, tax: number, grand: number): string {
    const b = 'border:1px solid #000';
    const labelStyle = `${b};text-align:right;white-space:nowrap;padding:4px 8px`;
    const moneyStyle = `${b};padding:4px 8px;white-space:nowrap`;
    return `
    <tfoot>
      <tr>
        <td colspan="5" style="${labelStyle}">Sub Total (${esc(currency)})</td>
        <td style="${moneyStyle}">${moneyInner(sub, sym)}</td>
      </tr>
      ${tax > 0 ? `<tr>
        <td colspan="5" style="${labelStyle}">VAT 10% (${esc(currency)})</td>
        <td style="${moneyStyle}">${moneyInner(tax, sym)}</td>
      </tr>` : ''}
      <tr class="grand">
        <td colspan="5" style="${labelStyle}">Grand Total (${esc(currency)})</td>
        <td style="${moneyStyle}">${moneyInner(grand, sym)}</td>
      </tr>
    </tfoot>`;
}

// ── Document builders ─────────────────────────────────────────────────────────

export interface PdfTemplateOptions {
    type: 'Quotation' | 'Sale Order' | 'Invoice' | 'Delivery Order' | 'Purchase Order';
    headerData: Record<string, any>;
    items: Array<{
        no: number | string;
        itemCode: string;
        modelName?: string;
        description?: string;
        qty: number | string;
        unitPrice?: number | string;
        commission?: number | string;
        amount?: number | string;
    }>;
    totals: { subTotal: number; tax?: number; vat?: number; grandTotal: number };
    currency: 'USD' | 'KHR';
}

export function buildHtml(opts: PdfTemplateOptions): string {
    const sym = opts.currency === 'KHR' ? '៛' : '$';
    const { headerData: hd, items, totals } = opts;
    const tax = totals.tax ?? totals.vat ?? 0;

    let body = '';
    switch (opts.type) {
        case 'Quotation':      body = buildQuotation(hd, items, totals, opts.currency, sym, tax); break;
        case 'Sale Order':     body = buildSaleOrder(hd, items, totals, opts.currency, sym, tax); break;
        case 'Invoice':        body = buildInvoice(hd, items, totals, opts.currency, sym, tax); break;
        case 'Delivery Order': body = buildDO(hd, items); break;
        case 'Purchase Order': body = buildPO(hd, items, totals, opts.currency, sym, tax); break;
    }

    return `<!DOCTYPE html>
<html lang="km">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  ${baseStyle()}
</head>
<body>
  <div class="page">
    <div class="page-inner">
      ${body}
    </div>
  </div>
</body>
</html>`;
}

// ── Quotation ─────────────────────────────────────────────────────────────────
function buildQuotation(hd: any, items: any[], totals: any, currency: string, sym: string, tax: number): string {
    const rows = items.filter(i => i.no > 0).map(item => {
        const hasSub = item.description;
        const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
        const amt   = typeof item.amount    === 'number' ? item.amount    : parseFloat(String(item.amount))    || 0;
        return `
        <tr>
          <td class="center">${esc(item.no)}</td>
          <td>${esc(item.itemCode)}</td>
          <td>${esc(item.modelName)}</td>
          <td class="center">${esc(item.qty)}</td>
          ${price ? moneyTd(price, sym) : `<td></td>`}
          ${amt   ? moneyTd(amt,   sym) : `<td></td>`}
        </tr>
        ${hasSub ? `<tr>
          <td></td><td></td>
          <td class="sub">${esc(item.description)}</td>
          <td></td><td></td><td></td>
        </tr>` : ''}`;
    }).join('');

    return `
    ${companyHeader()}
    <h1 class="doc-title">QUOTATION</h1>
    <div class="info-grid">
      ${infoRow('Company Name', hd['Company Name'] || '', 'Quotation No', hd['Quotation ID'] || '')}
      ${infoRow('Address', hd['Company Address'] || '', 'Quote Date', fmtDate(hd['Quote Date']))}
      ${infoRow('Contact Person', hd['Contact Person'] || '', 'Validity', fmtDate(hd['Validity Date']))}
      ${infoRow('Tel', hd['Contact Tel'] || '', 'Status', hd['Stock Status'] || '')}
      ${infoRow('Email', hd['Contact Email'] || '', 'Payment Term', hd['Payment Term'] || '')}
    </div>
    <table>
      <thead>${tableHeader('Unit Price', 'Total')}</thead>
      <tbody>${rows}</tbody>
      ${stdTfoot(currency, sym, totals.subTotal, tax, totals.grandTotal)}
    </table>
    <div class="terms">
      <h4>Terms and Conditions</h4>
      <p>${esc(hd['Terms and Conditions'] || '')}</p>
    </div>
    <div class="sigs">
      ${sigBlock('PREPARED BY', hd['Prepared By'] || hd['Created By'] || '', hd['Prepared By Position'] || '')}
      ${sigBlock('APPROVED BY', hd['Approved By'] || '', hd['Approved By Position'] || '')}
    </div>`;
}

// ── Sale Order ────────────────────────────────────────────────────────────────
function buildSaleOrder(hd: any, items: any[], totals: any, currency: string, sym: string, tax: number): string {
    const rows = items.filter(i => i.no > 0).map(item => {
        const qty        = typeof item.qty        === 'number' ? item.qty        : parseFloat(String(item.qty))        || 0;
        const amt        = typeof item.amount     === 'number' ? item.amount     : parseFloat(String(item.amount))     || 0;
        const commission = typeof item.commission === 'number' ? item.commission : parseFloat(String(item.commission)) || 0;
        const uPrice     = typeof item.unitPrice  === 'number' ? item.unitPrice  : parseFloat(String(item.unitPrice))  || 0;
        const displayPrice = qty > 0 ? (amt / qty) : (uPrice + commission);
        const combined = item.modelName
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

    return `
    <h1 class="doc-title">SALE ORDER (B2C)</h1>
    <div class="info-grid">
      ${infoRow('Company Name', hd['Company Name'] || '', 'SO No', hd['Sale Order ID'] || '')}
      ${infoRow('Address', hd['Company Address'] || '', 'SO Date', fmtDate(hd['Order Date']))}
      ${infoRow('Contact Person', hd['Contact Name'] || '', 'Delivery Date', fmtDate(hd['Delivery Date']))}
      ${infoRow('Tel', hd['Contact Tel'] || '', 'Bill Invoice', hd['Bill Invoice'] || '')}
      ${infoRow('Email', hd['Email'] || '', 'Payment Term', hd['Payment Term'] || '')}
    </div>
    <table>
      <thead>${tableHeader('Unit Price', 'Amount')}</thead>
      <tbody>${rows}</tbody>
      ${stdTfoot(currency, sym, totals.subTotal, tax, totals.grandTotal)}
    </table>
    ${checkboxes}${remark}
    <div class="sigs">
      ${sigBlock('ORDERED BY', '', '')}
      ${sigBlock('RECEIVED BY', '', '')}
    </div>`;
}

// ── Invoice ───────────────────────────────────────────────────────────────────
function buildInvoice(hd: any, items: any[], totals: any, currency: string, sym: string, tax: number): string {
    const rows = items.filter(i => i.no > 0).map(item => {
        const hasSub = item.description;
        const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
        const amt   = typeof item.amount    === 'number' ? item.amount    : parseFloat(String(item.amount))    || 0;
        return `
        <tr>
          <td class="center">${esc(item.no)}</td>
          <td>${esc(item.itemCode)}</td>
          <td>${esc(item.modelName)}</td>
          <td class="center">${esc(item.qty)}</td>
          ${price ? moneyTd(price, sym) : `<td></td>`}
          ${amt   ? moneyTd(amt,   sym) : `<td></td>`}
        </tr>
        ${hasSub ? `<tr>
          <td></td><td></td>
          <td class="sub">${esc(item.description)}</td>
          <td></td><td></td><td></td>
        </tr>` : ''}`;
    }).join('');

    return `
    ${companyHeader()}
    <h1 class="doc-title">INVOICE</h1>
    <div class="info-grid">
      ${infoRow('Company Name', hd['Company Name'] || '', 'Inv No', hd['Inv No.'] || '')}
      ${infoRow('Address', hd['Company Address'] || '', 'Inv Date', fmtDate(hd['Inv Date']))}
      ${infoRow('Contact Person', hd['Contact Name'] || '', 'SO Ref.', hd['SO No.'] || '')}
      ${infoRow('Tel', hd['Phone Number'] || '', 'Tin No.', hd['Tin No.'] || '')}
      ${infoRow('Email', hd['Email'] || '', 'Payment Term', hd['Payment Term'] || '')}
    </div>
    <table>
      <thead>${tableHeader('Unit Price', 'Amount')}</thead>
      <tbody>${rows}</tbody>
      ${stdTfoot(currency, sym, totals.subTotal, tax, totals.grandTotal)}
    </table>
    <div class="sigs">
      ${sigBlock('PREPARED BY', hd['Prepared By'] || hd['Created By'] || '', hd['Prepared By Position'] || '')}
      ${sigBlock('RECEIVED BY', hd['Approved By'] || '', hd['Approved By Position'] || '')}
    </div>`;
}

// ── Delivery Order ────────────────────────────────────────────────────────────
function buildDO(hd: any, items: any[]): string {
    const T = LAYOUT.table;
    const rows = items.filter(i => i.no > 0).map(item => {
        const hasSub = item.description;
        return `
        <tr>
          <td class="center">${esc(item.no)}</td>
          <td>${esc(item.itemCode)}</td>
          <td>${esc(item.modelName)}</td>
          <td class="center">${esc(item.qty)}</td>
        </tr>
        ${hasSub ? `<tr>
          <td></td><td></td>
          <td class="sub">${esc(item.description)}</td>
          <td></td>
        </tr>` : ''}`;
    }).join('');

    const doNo = hd['Inv No.'] ? hd['Inv No.'].replace('INV', 'DO') : '';

    return `
    ${companyHeader()}
    <h1 class="doc-title">DELIVERY ORDER</h1>
    <div class="info-grid">
      ${infoRow('Company Name', hd['Company Name'] || '', 'DO No', doNo)}
      ${infoRow('Address', hd['Company Address'] || '', 'DO Date', fmtDate(hd['Inv Date']))}
      ${infoRow('Contact Person', hd['Contact Name'] || '', 'SO Ref.', hd['SO No.'] || '')}
      ${infoRow('Tel', hd['Phone Number'] || '', 'Email', hd['Email'] || '')}
    </div>
    <table>
      <thead><tr>
        <th style="width:${T.colNo}%">No.</th>
        <th style="width:${T.colCode}%">Item Code</th>
        <th>Description</th>
        <th style="width:${T.colQty}%">Qty</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sigs">
      ${sigBlock('PREPARED BY', hd['Prepared By'] || hd['Created By'] || '', hd['Prepared By Position'] || '')}
      ${sigBlock('DELIVERED BY', '', '')}
      ${sigBlock('RECEIVED BY', hd['Approved By'] || '', hd['Approved By Position'] || '')}
    </div>`;
}

// ── Purchase Order ────────────────────────────────────────────────────────────
function buildPO(hd: any, items: any[], totals: any, currency: string, sym: string, tax: number): string {
    const rows = items.filter(i => i.itemCode || i.description || i.modelName).map(item => {
        const uPrice = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
        const amt    = typeof item.amount    === 'number' ? item.amount    : parseFloat(String(item.amount))    || 0;
        return `
        <tr>
          <td class="center">${esc(item.no)}</td>
          <td>${esc(item.itemCode)}</td>
          <td>${esc(item.description || item.modelName || '')}</td>
          <td class="center">${esc(item.qty)}</td>
          ${moneyTd(uPrice, sym)}
          ${moneyTd(amt, sym)}
        </tr>`;
    }).join('');

    return `
    <h1 class="doc-title" style="color:#004aad">PURCHASE ORDER</h1>
    <div class="po-band">
      <span>Vendor Name:</span><span>Address:</span><span>Order Date:</span><span>PO Number #:</span>
    </div>
    <div class="po-row">
      <span>${esc(hd['Vendor Name'] || '')}\n${esc(hd['Vendor Contact'] || '')}\n${esc(hd['Vendor Phone'] || '')}</span>
      <span>${esc(hd['Vendor Address'] || '')}</span>
      <span>${fmtDate(hd['Order Date'])}</span>
      <span>${esc(hd['PO Number'] || '')}</span>
    </div>
    <div class="po-band" style="margin-top:6px">
      <span>Order by:</span><span>Ship to:</span><span>Delivery Date:</span><span>Payment Term:</span>
    </div>
    <div class="po-row">
      <span>${esc(hd['ordered_by_name'] || '')}\n${esc(hd['ordered_by_phone'] || '')}</span>
      <span>${esc(hd['Ship To'] || '')}</span>
      <span>${fmtDate(hd['Delivery Date'])}</span>
      <span>${esc(hd['Payment Term'] || '')}</span>
    </div>
    <table style="margin-top:10px">
      <thead>${tableHeader('Unit Price', 'Total')}</thead>
      <tbody>${rows}</tbody>
      ${stdTfoot(currency, sym, totals.subTotal, tax, totals.grandTotal)}
    </table>
    <div class="sigs">
      ${sigBlock('PREPARED BY', hd['Prepared By'] || '', hd['Prepared By Position'] || '')}
      ${sigBlock('APPROVED BY', hd['Approved By'] || '', hd['Approved By Position'] || '')}
    </div>`;
}