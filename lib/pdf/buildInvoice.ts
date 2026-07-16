/**
 * buildInvoice.ts
 * TAX INVOICE PDF builder — matches the L'IMPERIAL TECHNOLOGY bilingual (Khmer/English) template.
 * Edit LAYOUT constants here without affecting any other document type.
 */
import { esc, fmtDate, fmtNum, getFontsB64, LOGO, PdfItem, PdfTotals } from './shared';

// ─── BRAND ───────────────────────────────────────────────────────────────────
const BRAND_BLUE = '#0056b3';

// ─── LAYOUT ──────────────────────────────────────────────────────────────────
const LAYOUT = {
    logo:    { width: '42mm', height: '16mm' },
    margins: { top: 10, right: 11, bottom: 14, left: 11 }, // mm
    table: {
        colNo:    '5%',
        colCode:  '15%',
        colDesc:  '44%',
        colQty:   '9%',
        colPrice: '13%',
        colAmt:   '14%',
    },
};
// ─────────────────────────────────────────────────────────────────────────────

function baseStyle(khmerB64: string, timesB64: string, timesBoldB64: string): string {
    const M = LAYOUT.margins;
    return `<style>
      @font-face { font-family:'KhmerOS'; src:url('data:font/truetype;base64,${khmerB64}') format('truetype'); font-weight:normal; }
      @font-face { font-family:'CustomTimes'; src:url('data:font/truetype;base64,${timesB64}') format('truetype'); font-weight:normal; }
      @font-face { font-family:'CustomTimes'; src:url('data:font/truetype;base64,${timesBoldB64}') format('truetype'); font-weight:bold; }
      @page { size:A4; margin:${M.top}mm ${M.right}mm ${M.bottom}mm ${M.left}mm; }
      html,body { margin:0; padding:0; background:#fff; }
      body { font-family:'KhmerOS','CustomTimes',serif; font-size:10pt; color:#000; }

      /* ── Header ── */
      .hdr { position:relative; text-align:center; border-bottom:3px solid ${BRAND_BLUE}; padding-bottom:8px; margin-bottom:14px; }
      .hdr-logo { position:absolute; left:0; top:0; }
      .hdr-logo img { width:${LAYOUT.logo.width}; height:${LAYOUT.logo.height}; object-fit:contain; }
      .hdr-name-kh  { font-size:13pt; font-weight:bold; margin-bottom:2px; }
      .hdr-name-en  { font-size:12pt; font-weight:bold; margin-bottom:2px; }
      .hdr-tin      { font-size:10pt; font-weight:bold; margin-bottom:2px; }
      .hdr-addr-kh  { font-size:8pt; margin-bottom:1px; }
      .hdr-addr-en  { font-size:7pt; white-space:nowrap; overflow:hidden; margin-bottom:2px; }
      .hdr-contact  { font-size:9pt; }

      /* ── Title ── */
      .doc-title { text-align:center; margin:10px 0 12px; }
      .doc-title .kh { font-size:14pt; font-weight:bold; }
      .doc-title .en { font-size:13pt; font-weight:bold; }

      /* ── Info tables (customer / invoice details) ── */
      .info-wrap { display:flex; gap:3%; margin-bottom:12px; }
      .info-left  { width:60%; }
      .info-right { width:37%; display:flex; flex-direction:column; gap:6px; }
      .info-table { width:100%; border-collapse:collapse; font-size:9pt; }
      .info-table td { border:2px solid #000; padding:3px 6px; }
      .info-table td.lbl { font-weight:bold; white-space:nowrap; width:42%; font-size:8.5pt; line-height:1.4; }
      .info-table td.val { width:58%; }

      /* ── Items table ── */
      .items-table { width:100%; border-collapse:collapse; font-size:8.5pt; margin-bottom:0; }
      .items-table th { background:${BRAND_BLUE}; color:#fff; border:2px solid #000; padding:5px 4px; text-align:center; font-size:8pt; line-height:1.3; }
      .items-table td { border:2px solid #000; padding:4px 6px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; }
      .items-table td.center { text-align:center; }
      .items-table .money { display:flex; justify-content:space-between; white-space:nowrap; }

      /* ── Footer rows (inside items-table) ── */
      .tot-lbl { font-weight:bold; white-space:nowrap; text-align:right; font-size:8.5pt; line-height:1.4; border:2px solid #000; padding:4px 8px; }
      .tot-val { white-space:nowrap; border:2px solid #000; padding:4px 8px; }
      .tot-val .money { display:flex; justify-content:space-between; }

      /* ── Signatures ── */
      .sigs { display:flex; justify-content:space-between; padding:0 16px 32px; margin-top:auto; }
      .sig-box { width:38%; text-align:center; }
      .sig-box .sig-line { border-top:2px solid #000; margin-bottom:4px; }
      .sig-box .sig-kh   { font-size:9pt; margin-bottom:2px; }
      .sig-box .sig-en   { font-size:9pt; font-weight:bold; }

      @media print {
        body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .no-break { page-break-inside:avoid; }
      }
    </style>`;
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildHeader(): string {
    return `
    <div class="hdr">
      <div class="hdr-logo"><img src="${LOGO}" alt="Limperial Logo"/></div>
      <div class="hdr-name-kh">លីមភឺរៀល ថេកណូឡូជី ឯ.ក</div>
      <div class="hdr-name-en">LIMPERIAL TECHNOLOGY CO., LTD.</div>
      <div class="hdr-tin">លេខអត្តសញ្ញាណកម្មអតប (VAT TIN) : K003-902201968</div>
      <div class="hdr-addr-kh">អាសយដ្ឋាន៖ #B១៥ (ជាន់ផ្ទាល់ដី ជាន់ទី ១ ជាន់ទី ២ ជាន់ទី ៣ និង ជាន់ទី ៤) ផ្លូវ អយស្ម័យយានបូព៌ (១៣៩), ភូមិ១ សង្កាត់ ស្រះចក ខណ្ឌ ដូនពេញ រាជធានីភ្នំពេញ</div>
      <div class="hdr-addr-en">Address: #B15 (Ground Floor 1st Floor 2nd Floor 3rd Floor and 4th Floor), East Railway (139), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</div>
      <div class="hdr-contact">E-mail: linfo@limperialtech.com &nbsp;||&nbsp; ទូរស័ព្ទ (Telephone): +855 92 218 333</div>
    </div>`;
}

function buildTitle(): string {
    return `
    <div class="doc-title">
      <div class="kh">វិក្កយបត្រអាករ</div>
      <div class="en">TAX INVOICE</div>
    </div>`;
}

function infoTd(label: string, value: string): string {
    return `<tr><td class="lbl">${label}</td><td class="val">${esc(value)}</td></tr>`;
}

function buildInfoSection(hd: Record<string, any>): string {
    const invNo   = hd['Inv No.'] || hd['Inv No'] || hd['Invoice No'] || '';
    const invDate = fmtDate(hd['Inv Date'] || hd['Invoice Date'] || '');
    const contact = hd['Contact Name'] || hd['Contact Person'] || '';
    const phone   = hd['Phone Number'] || hd['Telephone'] || '';
    const address = hd['Company Address'] || hd['Address'] || '';
    const vatTin  = hd['Tin No.'] || hd['Tin No'] || hd['VAT TIN'] || '';
    const email   = hd['Email'] || '';
    const customerKh = hd['Company Name (Khmer)'] || '';
    const customer = hd['Company Name'] || hd['Customer'] || '';
    const customerCell = customerKh
        ? `<div>${esc(customerKh)}</div><div>${esc(customer)}</div>`
        : esc(customer);

    return `
    <div class="info-wrap">
      <!-- Left: Customer details -->
      <div class="info-left">
        <table class="info-table">
          ${infoTd('អតិថិជន', customerKh || customer)}
          ${infoTd('Customer', customer)}
          ${infoTd('អាសយដ្ឋាន / Address :', address)}
          ${infoTd('លេខអត្តសញ្ញាណកម្ម / VAT TIN :', vatTin)}
          ${infoTd('អ៊ីម៉ែល / E-mail :', email)}
        </table>
      </div>
      <!-- Right: Invoice details -->
      <div class="info-right">
        <table class="info-table">
          ${infoTd('លេខរៀងវិក្កយបត្រ / Invoice N\u00ba :', invNo)}
          ${infoTd('កាលបរិច្ឆេទ / Date :', invDate)}
        </table>
        <table class="info-table">
          ${infoTd('ទំនាក់ទំនង / Contact Person :', contact)}
          ${infoTd('លេខទូរស័ព្ទ / Telephone :', phone)}
        </table>
      </div>
    </div>`;
}

function buildItemRows(items: PdfItem[], sym: string, footerHtml: string): string {
    const T = LAYOUT.table;
    const dataRows = items.filter(i => Number(i.no) > 0).map(item => {
        const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
        const amt   = typeof item.amount    === 'number' ? item.amount    : parseFloat(String(item.amount))    || 0;
        const priceCell = price
            ? `<td><div class="money"><span>${sym}</span><span>${fmtNum(price)}</span></div></td>`
            : `<td></td>`;
        const amtCell = amt
            ? `<td class="money-cell"><div class="money"><span>${sym}</span><span>${fmtNum(amt)}</span></div></td>`
            : `<td><div class="money"><span>${sym}</span><span>-</span></div></td>`;

        const descLine = item.description
            ? `<tr><td></td><td></td><td style="font-size:8pt;white-space:pre-wrap">${esc(item.description)}</td><td></td><td></td><td></td></tr>`
            : '';

        return `
        <tr style="height:56px">
          <td class="center">${esc(item.no)}</td>
          <td>${esc(item.itemCode)}</td>
          <td style="font-weight:bold">${esc(item.modelName ?? '')}</td>
          <td class="center">${esc(item.qty)}</td>
          ${priceCell}
          ${amtCell}
        </tr>${descLine}`;
    });

    // No minimum row padding — only render actual item rows

    const colgroup = `
      <colgroup>
        <col style="width:${T.colNo}"/>
        <col style="width:${T.colCode}"/>
        <col style="width:${T.colDesc}"/>
        <col style="width:${T.colQty}"/>
        <col style="width:${T.colPrice}"/>
        <col style="width:${T.colAmt}"/>
      </colgroup>`;

    return `
    <table class="items-table">
      ${colgroup}
      <thead>
        <tr>
          <th><div>ល.រ</div><div>N\u00ba</div></th>
          <th><div>លេខសម្គាល់ទំនិញ</div><div>Part Number</div></th>
          <th><div>បរិយាយទំនិញ</div><div>Description</div></th>
          <th><div>បរិមាណ</div><div>Qty</div></th>
          <th><div>តម្លៃឯកតា</div><div>Unit Price</div></th>
          <th><div>តម្លៃទំនិញ</div><div>Amount</div></th>
        </tr>
      </thead>
      <tbody>${dataRows.join('')}
        ${footerHtml}
      </tbody>
    </table>`;
}

function buildFooterRows(
    sym: string,
    deposit: number,
    subTotal: number,
    taxAmount: number,
    grandTotalUsd: number,
    exchangeRate: string,
    grandTotalRiel: number,
): string {
    const money = (s: string, v: number | null) =>
        v !== null
            ? `<div class="money"><span>${s}</span><span>${fmtNum(v)}</span></div>`
            : `<div class="money"><span>${s}</span><span>-</span></div>`;

    return `
        <tr>
          <td style="border:none; vertical-align:top; padding:12px; font-size:9pt;" colspan="3" rowspan="6">
            <div style="margin-bottom:8px;">
              <p style="font-weight:bold;text-decoration:underline;text-transform:uppercase;margin:0 0 4px;font-size:9pt;">Term Condition:</p>
              <ul style="padding-left:14px;margin:0;list-style-type:disc;font-size:8.5pt;">
                <li style="margin-bottom:3px;"><span style="font-weight:bold">Payment Terms:</span> Full payment is required as per the agreed terms. Late payments may result in order suspension.</li>
                <li style="margin-bottom:3px;"><span style="font-weight:bold">Goods Sold:</span> All goods sold are non-refundable and exchangeable. Please inspect all goods carefully before signing.</li>
                <li style="margin-bottom:3px;"><span style="font-weight:bold">Warranty:</span> All goods sold are covered under Limperial Technology&apos;s warranty policy. Warranty does not cover unauthorized repairs or broken seals.</li>
              </ul>
            </div>
            <div>
              <p style="font-weight:bold;text-decoration:underline;text-transform:uppercase;margin:0 0 4px;font-size:9pt;">Payment Information:</p>
              <p style="margin:0 0 3px;font-size:8.5pt;"><span style="font-weight:bold">Bank:</span> Advanced Bank of Asia Ltd (ABA Bank)</p>
              <p style="margin:0 0 3px;font-size:8.5pt;"><span style="font-weight:bold">Account Name:</span> LIMPERIAL TECHNOLOGY CO., LTD.</p>
              <p style="margin:0;font-size:8.5pt;"><span style="font-weight:bold">Account Number:</span> 003 916 564</p>
            </div>
          </td>
          <td class="tot-lbl" colspan="2">ប្រាក់កក់ / Deposit</td>
          <td class="tot-val">${money(sym, deposit > 0 ? deposit : null)}</td>
        </tr>
        <tr>
          <td class="tot-lbl" colspan="2">សរុប / Sub Total</td>
          <td class="tot-val">${money(sym, subTotal > 0 ? subTotal : null)}</td>
        </tr>
        <tr>
          <td class="tot-lbl" colspan="2">អាករលើតម្លៃបន្ថែម / VAT (10%)</td>
          <td class="tot-val">${money(sym, taxAmount > 0 ? taxAmount : null)}</td>
        </tr>
        <tr>
          <td class="tot-lbl" colspan="2">សរុបរួមជាប្រាក់ដុល្លារ / Grand Total in Dollar</td>
          <td class="tot-val">${money(sym, grandTotalUsd > 0 ? grandTotalUsd : null)}</td>
        </tr>
        <tr>
          <td class="tot-lbl" colspan="2">អត្រាប្តូរប្រាក់រៀល / Exchange Rate</td>
          <td class="tot-val">${esc(exchangeRate)}</td>
        </tr>
        <tr>
          <td class="tot-lbl" colspan="2">សរុបរួមជាប្រាក់រៀល / Grand Total in Riel</td>
          <td class="tot-val">${money('R', grandTotalRiel > 0 ? grandTotalRiel : null)}</td>
        </tr>`;
}

function buildSignatures(signaturePadding = 0, labelPadding = 200): string {
    return `
    <div class="sigs" style="margin-top:${signaturePadding}px;">
      <div class="sig-box">
        <div style="margin-bottom:${labelPadding}px"></div>
        <div class="sig-line"></div>
        <div class="sig-kh">ហត្ថលេខា និងឈ្មោះអ្នកទិញ</div>
        <div class="sig-en">Customer's Signature &amp; Name</div>
      </div>
      <div class="sig-box">
        <div style="margin-bottom:${labelPadding}px"></div>
        <div class="sig-line"></div>
        <div class="sig-kh">ហត្ថលេខា និងឈ្មោះអ្នកលក់</div>
        <div class="sig-en">Seller's Signature &amp; Name</div>
      </div>
    </div>`;
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildInvoice(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    currency: string,
    sym: string,
    tax: number,
    signaturePadding = 0,  // px — margin-top of sig block
    labelPadding = 200,    // px — space above sig line
): string {
    const fonts = getFontsB64();

    // Derive deposit, exchange rate, and KHR grand total from header (if provided)
    const deposit      = parseFloat(String(hd['Deposit'] || 0)) || 0;
    const exchangeRate = hd['Exchange Rate'] || hd['ExchangeRate'] || '';
    const rateNum      = parseFloat(String(exchangeRate).replace(/,/g, '')) || 0;
    const grandRiel    = rateNum > 0 ? Math.round(totals.grandTotal * rateNum) : 0;

    const style = baseStyle(fonts.khmer, fonts.times, fonts.timesBold);

    const body = `
    ${buildHeader()}
    ${buildTitle()}
    ${buildInfoSection(hd)}
    ${buildItemRows(items, sym, buildFooterRows(sym, deposit, totals.subTotal, tax, totals.grandTotal, exchangeRate, grandRiel))}
    ${buildSignatures(signaturePadding, labelPadding)}`;

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/>${style}</head>
<body><div class="page"><div class="page-inner">${body}</div></div></body>
</html>`;
}
