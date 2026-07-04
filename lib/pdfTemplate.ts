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
import { buildTaxInvoice }          from './pdf/buildTaxInvoice';
import { buildCommercialInvoice }   from './pdf/buildCommercialInvoice';
import { buildDeliveryNote }        from './pdf/buildDeliveryNote';
import { buildQuotationVAT }        from './pdf/buildQuotationVAT';
import { buildQuotationNonVAT }     from './pdf/buildQuotationNonVAT';
import { buildReceipt }             from './pdf/buildReceipt';
import { buildSaleOrder as buildSaleOrderPdf } from './pdf/buildSaleOrder';

const MM = 3.7795; // px per mm at 96 dpi
const mm = (v: number) => `${v * MM}px`;
const pt = (v: number) => `${v}pt`;

const LAYOUT = {
  logo: { width: 40, height: 15 },
  company: { nameFontSize: 12, contactFontSize: 8, addressFontSize: 8.5 },
  separator: { paddingBottom: 3, marginBottom: 3 },
  title: { fontSize: 16, marginTop: 3, marginBottom: 5 },
  customerInfo: { fontSize: 9, rowGap: 10, colLabel: 90, colColon: 12, colRightLabel: 90, colRightValue: 120 },
  table: {
    headerFontSize: 9, contentFontSize: 9, subFontSize: 8.5,
    colNo: 7, colCode: 17, colDesc: 46, colQty: 6, colPrice: 10, colTotal: 14,
  },
  terms: { spacingAbove: 7, titleFontSize: 9, contentFontSize: 9 },
  signatures: { marginTop: 40, padding: 30, labelBottom: 120, fontSize: 9, lineFontSize: 9 },
  margins: { top: 10, right: 11, bottom: 14, left: 11 },
};

let _fontsCache: { khmer: string; times: string; timesBold: string } | null = null;
let _logoCache: string | null = null;

function getFontsB64(): { khmer: string; times: string; timesBold: string } {
    if (_fontsCache) return _fontsCache;
    const khmer     = fs.readFileSync(path.join(process.cwd(), 'public', 'KhmerOS.ttf')).toString('base64');
    const times     = fs.readFileSync(path.join(process.cwd(), 'public', 'times.ttf')).toString('base64');
    const timesBold = fs.readFileSync(path.join(process.cwd(), 'public', 'timesbd.ttf')).toString('base64');
    _fontsCache = { khmer, times, timesBold };
    return _fontsCache;
}

function getLogoB64(): string {
    if (_logoCache) return _logoCache;
    const logo = fs.readFileSync(path.join(process.cwd(), 'public', 'Limperial Technology Logo01.png(004aad).png')).toString('base64');
    _logoCache = `data:image/png;base64,${logo}`;
    return _logoCache;
}

function baseStyle(): string {
    const L = LAYOUT;
    const T = L.table;
    const fonts = getFontsB64();
    return `
    <style>
      @font-face { font-family:'KhmerOS'; src:url('data:font/truetype;base64,${fonts.khmer}') format('truetype'); font-weight:normal; }
      @font-face { font-family:'Custom Times'; src:url('data:font/truetype;base64,${fonts.times}') format('truetype'); font-weight:normal; }
      @font-face { font-family:'Custom Times'; src:url('data:font/truetype;base64,${fonts.timesBold}') format('truetype'); font-weight:bold; }
      @page { size: A4; }
      html, body { margin: 0; padding: 0; }
      body { font-family:'Custom Times','KhmerOS',serif; font-size:9pt; color:#000; background:#fff; }
      .page-inner { box-sizing:border-box; }
      .hdr { display:flex; align-items:center; border-bottom:1px solid #000; padding-bottom:${mm(L.separator.paddingBottom)}; margin-bottom:${mm(L.separator.marginBottom)}; gap:14px; }
      .hdr img { width:${mm(L.logo.width)}; height:${mm(L.logo.height)}; object-fit:contain; flex-shrink:0; }
      .hdr-info { font-size:${pt(L.company.contactFontSize)}; line-height:1.6; }
      .hdr-name { font-weight:bold; color:#004aad; font-size:${pt(L.company.nameFontSize)}; margin-bottom:3px; }
      .hdr-addr { white-space:nowrap; font-size:${pt(L.company.addressFontSize)}; overflow:hidden; }
      h1.doc-title { text-align:center; font-size:${pt(L.title.fontSize)}; font-weight:bold; text-decoration:underline; margin:${mm(L.title.marginTop)} 0 ${mm(L.title.marginBottom)}; }
      .info-grid { display:grid; grid-template-columns:${L.customerInfo.colLabel}px ${L.customerInfo.colColon}px 1fr ${L.customerInfo.colRightLabel}px ${L.customerInfo.colColon}px ${L.customerInfo.colRightValue}px; gap:${L.customerInfo.rowGap}px 0; margin-bottom:10px; font-size:${pt(L.customerInfo.fontSize)}; }
      .info-grid .lbl,.info-grid .lbl-right { white-space:nowrap; }
      .info-grid .cln { text-align:center; }
      .info-grid .val { white-space:pre-line; line-height:1.5; padding-left:8px; }
      .info-grid .val-left { padding-right:60px; }
      table { width:100%; border-collapse:collapse; margin:8px 0; font-size:${pt(T.contentFontSize)}; table-layout:fixed; }
      th { background:#004aad; color:#fff; padding:5px 6px; text-align:center; font-weight:bold; border:1px solid #000; font-size:${pt(T.headerFontSize)}; }
      td { padding:5px 6px; border:1px solid #000; vertical-align:top; word-wrap:break-word; }
      td.center { text-align:center; }
      td.sub { white-space:pre-wrap; }
      tfoot td { padding:4px 6px; }
      tfoot tr.grand td { font-weight:bold; border-top:2px solid #000; }
      .terms { margin-top:${mm(L.terms.spacingAbove)}; font-size:${pt(L.terms.contentFontSize)}; line-height:1.4; page-break-inside:avoid; }
      .terms h4 { font-weight:bold; font-size:${pt(L.terms.titleFontSize)}; margin-bottom:2px; }
      .terms p { white-space:pre-wrap; margin-top:2px; }
      .sigs { display:flex; justify-content:space-between; margin-top:50px; padding:0 ${L.signatures.padding}px; page-break-inside:avoid; }
      .sig-box { text-align:center; flex:0 0 160px; }
      .sig-label { font-weight:bold; font-size:${pt(L.signatures.fontSize)}; margin-bottom:${L.signatures.labelBottom}px; }
      .sig-line { border-top:1px solid #000; padding-top:5px; font-size:${pt(L.signatures.lineFontSize)}; line-height:1.5; }
      .po-band { display:flex; background:#004aad; color:#fff; font-weight:bold; font-size:8pt; padding:3px 5px; margin-bottom:2px; }
      .po-band span { flex:1; }
      .po-row { display:flex; font-size:8pt; padding:3px 5px 6px; }
      .po-row span { flex:1; white-space:pre-line; }
      .checklist { display:flex; flex-wrap:wrap; gap:10px; margin:5px 0 12px; }
      .check-item { display:flex; align-items:center; gap:4px; font-size:9pt; }
      .check-box { width:11px; height:11px; border:1px solid #000; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
      @media print { @page { size:A4; } body { margin:0; } }
    </style>`;
}

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
function moneyInner(v: number | string, sym: string): string {
    return `<span style="display:flex;justify-content:space-between;white-space:nowrap"><span>${sym}</span><span>${fmtNum(v)}</span></span>`;
}
function moneyTd(v: number | string, sym: string, extraStyle = ''): string {
    const style = extraStyle ? `padding:5px 6px;border:1px solid #000;${extraStyle}` : 'padding:5px 6px;border:1px solid #000';
    return `<td style="${style}">${moneyInner(v, sym)}</td>`;
}

const LOGO = getLogoB64();

// ── Default column widths (%) for each doc type ───────────────────────────────
const DEFAULT_WIDTHS: Record<string, number[]> = {
    'Quotation':       [4, 16, 33, 12, 16, 19],
    'Sale Order':      [7, 17, 46,  6, 10, 14],
    'Tax Invoice':     [4, 12, 38, 14, 17, 15],
    'Invoice':         [4, 12, 38, 14, 17, 15],
    'Service Invoice': [4, 12, 38, 14, 17, 15],
    'Commercial Invoice': [4, 12, 38, 14, 17, 15],
    'Delivery Order':  [7, 17, 70,  6,  0,  0],
    'Receipt':         [4, 16, 33, 12, 16, 19],
    'Purchase Order':  [7, 17, 46,  6, 10, 14],
};

/** Resolve column widths from override or defaults. Returns [no, code, desc, qty, price, amount] */
function resolveWidths(type: string, override?: number[]): number[] {
    if (override && override.length === 6) return override;
    return DEFAULT_WIDTHS[type] ?? [7, 17, 46, 6, 10, 14];
}


function companyHeader(): string {
    return `<div class="hdr">
      <img src="${LOGO}" alt="Logo"/>
      <div class="hdr-info">
        <div class="hdr-name">LIMPERIAL TECHNOLOGY CO., LTD.</div>
        <div>Tel : (+855) 92 218 333 || Email : info@limperialtech.com || Website : www.limperialtech.com</div>
        <div class="hdr-addr">Address : Building #15, Street Ayeaksmaiyean Bo (139), Sangkat Srah Chak, Khan Daun Penh, Phnom Penh, Cambodia.</div>
      </div>
    </div>`;
}

function infoRow(l1: string, v1: string, l2: string, v2: string): string {
    return `<div class="lbl">${esc(l1)}</div><div class="cln">:</div><div class="val val-left">${esc(v1)}</div><div class="lbl-right">${esc(l2)}</div><div class="cln">:</div><div class="val">${esc(v2)}</div>`;
}
function sigBlock(label: string, name: string, pos: string): string {
    return `<div class="sig-box"><div class="sig-label">${esc(label)}</div><div class="sig-line">${esc(name)||'&nbsp;'}<br/>${esc(pos)||'&nbsp;'}</div></div>`;
}


// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdfTemplateOptions {
    type: 'Quotation' | 'Sale Order' | 'Invoice' | 'Tax Invoice' | 'Service Invoice' | 'Delivery Order' | 'Purchase Order' | 'Commercial Invoice' | 'Receipt';
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
    signaturePadding?: number;
    labelPadding?: number;
    /** When true, NON-VAT Invoice PDFs omit Khmer text (English-only). Ignored for VAT/Tax Invoices. */
    hideKhmer?: boolean;
    /** Optional column width overrides (%) — [No, Code, Desc, Qty, UnitPrice, Amount]. 0 = omit. */
    columnWidths?: number[];
    /** When true the caller wants HTML for in-browser preview, not a PDF. */
    previewMode?: boolean;
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function buildHtml(opts: PdfTemplateOptions): string {
    const sym = opts.currency === 'KHR' ? '\u17db' : '$';
    const { headerData: hd, items, totals } = opts;
    const tax = totals.tax ?? totals.vat ?? 0;
    const cw = resolveWidths(opts.type, opts.columnWidths);

    // Self-contained bilingual builders — pass columnWidths
    if (opts.type === 'Receipt') {
        return buildReceipt(hd, items as any, totals as any, opts.currency, sym, opts.signaturePadding, opts.labelPadding, cw);
    }
    if (opts.type === 'Tax Invoice') {
        return buildTaxInvoice(hd, items as any, totals as any, opts.currency, sym, tax, true, opts.signaturePadding, opts.labelPadding, cw, opts.hideKhmer);
    }
    if (opts.type === 'Service Invoice') {
        // NON-VAT invoice layout with a Service Invoice title.
        return buildTaxInvoice(hd, items as any, totals as any, opts.currency, sym, tax, false, opts.signaturePadding, opts.labelPadding, cw, opts.hideKhmer,
            { en: 'SERVICE INVOICE', km: 'វិក្កយបត្រសេវាកម្ម' });
    }
    if (opts.type === 'Commercial Invoice') {
        const showVatTin = !!(hd['Tin No.'] || hd['Tin No'] || hd['VAT TIN']);
        return buildCommercialInvoice(hd, items as any, totals as any, opts.currency, sym, tax, showVatTin, opts.signaturePadding, opts.labelPadding, cw);
    }
    if (opts.type === 'Delivery Order') {
        // NON-VAT delivery notes omit the company header, mirroring the NON-VAT Invoice template.
        const showVat = (hd['Tax Type'] || hd['Taxable'] || '').toUpperCase() !== 'NON-VAT';
        return buildDeliveryNote(hd, items as any, showVat, opts.signaturePadding, undefined, cw);
    }
    if (opts.type === 'Quotation') {
        const isNonVat = (hd['Tax Type'] || '').toUpperCase() === 'NON-VAT';
        if (isNonVat) {
            return buildQuotationNonVAT(hd, items as any, totals as any, opts.currency, sym, opts.signaturePadding, opts.labelPadding, cw);
        }
        return buildQuotationVAT(hd, items as any, totals as any, opts.currency, sym, tax, opts.signaturePadding, opts.labelPadding, cw);
    }
    // Inline builders
    let body = '';
    switch (opts.type) {
        case 'Invoice': return buildTaxInvoice(hd, items as any, totals as any, opts.currency, sym, tax, false, opts.signaturePadding, opts.labelPadding, cw, opts.hideKhmer);
        case 'Sale Order': return buildSaleOrderPdf(hd, items as any, totals as any, opts.currency, sym, tax, opts.signaturePadding, opts.labelPadding, cw);
        case 'Purchase Order': body = buildPO(hd, items, totals, opts.currency, sym, tax, cw); break;
    }
    return `<!DOCTYPE html><html lang="km"><head><meta charset="UTF-8"/>${baseStyle()}</head><body><div class="page"><div class="page-inner">${body}</div></div></body></html>`;
}

// ── Purchase Order ────────────────────────────────────────────────────────────
function buildPO(hd: any, items: any[], totals: any, currency: string, sym: string, tax: number, cw: number[]): string {
    const [wNo, wCode, wDesc, wQty, wPrice, wAmt] = cw;
    const visibleCols = cw.filter(w => w > 0).length;
    const rows = items.filter(i => i.itemCode || i.description || i.modelName).map(item => {
        const uPrice = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
        const amt    = typeof item.amount    === 'number' ? item.amount    : parseFloat(String(item.amount))    || 0;
        return `<tr>
          ${wNo>0?`<td class="center">${esc(item.no)}</td>`:''}
          ${wCode>0?`<td>${esc(item.itemCode)}</td>`:''}
          ${wDesc>0?`<td>${esc(item.description||item.modelName||'')}</td>`:''}
          ${wQty>0?`<td class="center">${esc(item.qty)}</td>`:''}
          ${wPrice>0?moneyTd(uPrice, sym):''}
          ${wAmt>0?moneyTd(amt, sym):''}
        </tr>`;
    }).join('');

    return `${companyHeader()}
    <h1 class="doc-title" style="color:#004aad">PURCHASE ORDER</h1>
    <div class="po-band"><span>Vendor Name:</span><span>Address:</span><span>Order Date:</span><span>PO Number #:</span></div>
    <div class="po-row"><span>${esc(hd['Vendor Name']||'')}\n${esc(hd['Vendor Contact']||'')}\n${esc(hd['Vendor Phone']||'')}</span><span>${esc(hd['Vendor Address']||'')}</span><span>${fmtDate(hd['Order Date'])}</span><span>${esc(hd['PO Number']||'')}</span></div>
    <div class="po-band" style="margin-top:6px"><span>Order by:</span><span>Ship to:</span><span>Delivery Date:</span><span>Payment Term:</span></div>
    <div class="po-row"><span>${esc(hd['ordered_by_name']||'')}\n${esc(hd['ordered_by_phone']||'')}</span><span>${esc(hd['Ship To']||'')}</span><span>${fmtDate(hd['Delivery Date'])}</span><span>${esc(hd['Payment Term']||'')}</span></div>
    <table style="margin-top:10px">
      <colgroup>
        ${wNo>0?`<col style="width:${wNo}%"/>`:''}
        ${wCode>0?`<col style="width:${wCode}%"/>`:''}
        ${wDesc>0?`<col style="width:${wDesc}%"/>`:''}
        ${wQty>0?`<col style="width:${wQty}%"/>`:''}
        ${wPrice>0?`<col style="width:${wPrice}%"/>`:''}
        ${wAmt>0?`<col style="width:${wAmt}%"/>`:''}
      </colgroup>
      <thead><tr>
        ${wNo>0?'<th>No.</th>':''}
        ${wCode>0?'<th>Item Code</th>':''}
        ${wDesc>0?'<th>Description</th>':''}
        ${wQty>0?'<th>Qty</th>':''}
        ${wPrice>0?'<th>Unit Price</th>':''}
        ${wAmt>0?'<th>Total</th>':''}
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
    </div>`;
}
