// buildDO.ts
/**
 * buildDO.ts
 * Self-contained Delivery Order PDF builder.
 * Edit LAYOUT here without affecting any other document type.
 */
import { esc, fmtDate, getFontsB64, LOGO, PdfItem } from './shared';

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
        colCode: 18,
        colQty: 8,
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
      td.sub { font-size:${pt(T.contentFontSize)}; white-space:pre-wrap; }
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

function sigBlock(label: string, name: string, pos: string, labelPadding = 100): string {
    return `<div class="sig-box">
      <div class="sig-label" style="margin-bottom:${labelPadding}px;">${esc(label)}</div>
      <div class="sig-line">${esc(name) || '&nbsp;'}<br/>${esc(pos) || '&nbsp;'}</div>
    </div>`;
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildDO(
    hd: Record<string, any>,
    items: PdfItem[],
    signaturePadding = 0,  // px — margin-top of .sigs block
    labelPadding = 100,    // px — margin-bottom of .sig-label
): string {
    const T = LAYOUT.table;
    const doNo = (hd['Inv No.'] || hd['Inv No'] || '').replace('INV', 'DO');

    const rows = items.filter(i => Number(i.no) > 0 || i.isPromotion).map(item => {
        if (item.isPromotion) {
            const descText = (item.description || item.modelName || 'Cashback / Promotion').trim();
            return `
        <tr>
          <td class="center"></td>
          <td></td>
          <td style="font-style:italic;color:#666;">${esc(descText)}</td>
          <td class="center"></td>
        </tr>`;
        }
        const hasSub = item.description;
        return `
        <tr>
          <td class="center">${esc(item.no)}</td>
          <td>${esc(item.itemCode)}</td>
          <td style="font-weight:bold">${esc(item.modelName)}</td>
          <td class="center">${esc(item.qty)}</td>
        </tr>
        ${hasSub ? `<tr>
          <td></td><td></td>
          <td class="sub">${esc(item.description)}</td>
          <td></td>
        </tr>` : ''}`;
    }).join('');

    const body = `
    ${header()}
    <h1 class="doc-title"><span style="font-family:'Moul',serif;font-size:14pt;display:block;margin-bottom:2px">លិខិតប្រគល់ទំនិញ</span>DELIVERY ORDER</h1>
    <div class="info-grid">
      ${infoRow('Company Name', hd['Company Name'] || '', 'DO No.', doNo)}
      ${infoRow('Address', hd['Company Address'] || '', 'DO Date', fmtDate(hd['Inv Date']))}
      ${infoRow('Contact Person', hd['Contact Name'] || '', 'SO Ref.', hd['SO No.'] || hd['SO No'] || '')}
      ${infoRow('Tel', hd['Phone Number'] || '', 'Email', hd['Email'] || '')}
    </div>
    <table>
      <thead><tr>
        <th style="width:${T.colNo}%">No.</th>
        <th style="width:${T.colCode}%">Item Code</th>
        <th>Item Description</th>
        <th style="width:${T.colQty}%">Qty</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sigs" style="margin-top:${signaturePadding || 50}px;">
      ${sigBlock('PREPARED BY', hd['Prepared By'] || hd['Created By'] || '', hd['Prepared By Position'] || '', labelPadding)}
      ${sigBlock('DELIVERED BY', '', '', labelPadding)}
      ${sigBlock('RECEIVED BY', hd['Approved By'] || '', hd['Approved By Position'] || '', labelPadding)}
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
