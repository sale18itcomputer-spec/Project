/**
 * buildQuotationVAT.ts
 * QUOTATION PDF builder — bilingual Khmer/English, VAT version.
 * columnWidths: [no%, code%, desc%, qty%, unitPrice%, amount%]  — 0 = omit column
 */
import { esc, fmtDate, fmtNum, LOGO, PdfItem, PdfTotals } from './shared-pure';

const DEFAULT_WIDTHS = [4, 16, 33, 12, 16, 19];

export function buildQuotationVAT(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    currency: string,
    sym: string,
    tax: number,
    signaturePadding = 0,
    labelPadding = 200,
    columnWidths?: number[],
): string {
    const cw = (columnWidths && columnWidths.length === 6) ? columnWidths : DEFAULT_WIDTHS;
    const [wNo, wCode, wDesc, wQty, wPrice, wAmt] = cw;

    const quoteNo   = esc(hd['Quotation ID'] || hd['Quote No'] || hd['Quotation No'] || '');
    const quoteDate = esc(fmtDate(hd['Quote Date'] || hd['Quotation Date'] || ''));
    const validity  = esc(fmtDate(hd['Validity Date'] || hd['Validity'] || ''));
    const status    = esc(hd['Stock Status'] || hd['Status'] || '');
    const payTerm   = esc(hd['Payment Term'] || '');
    const customer  = esc(hd['Company Name'] || hd['Customer'] || '');
    const address   = esc(hd['Company Address'] || hd['Address'] || '');
    const vatTin    = esc(hd['Tin No.'] || hd['Tin No'] || hd['VAT TIN'] || '');
    const contact   = esc(hd['Contact Person'] || hd['Contact Name'] || '');
    const phone     = esc(hd['Contact Tel'] || hd['Phone Number'] || hd['Telephone'] || '');
    const email     = esc(hd['Contact Email'] || hd['Email'] || '');

    const subTotal  = totals.subTotal;
    const vatAmount = tax > 0 ? tax : 0;
    const grandUsd  = subTotal + vatAmount;
    const totalRows = vatAmount > 0 ? 3 : 2;

    const visibleCols = cw.filter(w => w > 0).length;
    // Footer: left Terms cell spans first 3 visible columns (No+Code+Desc area)
    const footerLeftSpan = Math.max([wNo, wCode, wDesc].filter(w => w > 0).length, 1);
    const footerRightSpan = visibleCols - footerLeftSpan;

    const dataItems = items.filter(i => Number(i.no) > 0 || i.isPromotion);

    const makeItemRow = (item: typeof dataItems[0]) => {
        if (item.isPromotion) {
            const amt = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0;
            const amtAbs = Math.abs(amt);
            const promoAmt = `<div class="flex justify-between"><span>${sym}</span><span>(${fmtNum(amtAbs)})</span></div>`;
            const descText = (item.description || item.modelName || '').trim();
            if (!descText.includes('\n')) {
                return `
            <tr class="text-center break-inside-avoid">
              ${wNo>0   ? `<td class="align-top py-2"></td>` : ''}
              ${wCode>0 ? `<td class="align-top py-2"></td>` : ''}
              ${wDesc>0 ? `<td class="text-left italic align-top py-2 text-[12px]" style="color:#666;">${esc(descText || 'Cashback / Promotion')}</td>` : ''}
              ${wQty>0  ? `<td class="align-top py-2"></td>` : ''}
              ${wPrice>0? `<td class="align-top py-2"></td>` : ''}
              ${wAmt>0  ? `<td class="align-top py-2" style="color:#c00000;">${promoAmt}</td>` : ''}
            </tr>`;
            }
            const lines = descText.split('\n');
            let promoRows = `
            <tr class="text-center break-inside-avoid">
              ${wNo>0   ? `<td class="align-top py-2" style="border-bottom:none !important;"></td>` : ''}
              ${wCode>0 ? `<td class="align-top py-2" style="border-bottom:none !important;"></td>` : ''}
              ${wDesc>0 ? `<td class="text-left italic align-top py-2 text-[12px]" style="border-bottom:none !important;color:#666;">${esc(lines[0])}</td>` : ''}
              ${wQty>0  ? `<td class="align-top py-2" style="border-bottom:none !important;"></td>` : ''}
              ${wPrice>0? `<td class="align-top py-2" style="border-bottom:none !important;"></td>` : ''}
              ${wAmt>0  ? `<td class="align-top py-2" style="border-bottom:none !important;color:#c00000;">${promoAmt}</td>` : ''}
            </tr>`;
            lines.slice(1).forEach((line, idx) => {
                const isLast = idx === lines.length - 2;
                const tdStyle = isLast ? 'border-top:none !important;' : 'border-bottom:none !important;border-top:none !important;';
                const padStyle = isLast ? 'padding-bottom:8px;' : 'padding-bottom:0;';
                promoRows += `
            <tr class="text-center break-inside-avoid">
              ${wNo>0   ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wCode>0 ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wDesc>0 ? `<td class="text-left italic text-[12px] align-top whitespace-pre-wrap" style="${tdStyle}padding-top:2px;${padStyle}color:#666;">${esc(line)}</td>` : ''}
              ${wQty>0  ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wPrice>0? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wAmt>0  ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
            </tr>`;
            });
            return promoRows;
        }

        const uPrice = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
        const comm   = typeof item.commission === 'number' ? item.commission : parseFloat(String(item.commission)) || 0;
        const price  = uPrice + comm;
        const amt   = typeof item.amount    === 'number' ? item.amount    : parseFloat(String(item.amount))    || 0;
        const amtDisplay = amt > 0
            ? `<div class="flex justify-between"><span>${sym}</span><span>${fmtNum(amt)}</span></div>`
            : `<div class="flex justify-between"><span>${sym}</span><span>-</span></div>`;
        const priceDisplay = price > 0
            ? `<div class="flex justify-between"><span>${sym}</span><span>${fmtNum(price)}</span></div>`
            : '';

        if (!item.description) {
            return `
            <tr class="text-center break-inside-avoid">
              ${wNo>0   ? `<td class="align-top py-2">${esc(item.no)}</td>` : ''}
              ${wCode>0 ? `<td class="align-top py-2">${esc(item.itemCode)}</td>` : ''}
              ${wDesc>0 ? `<td class="text-left font-bold align-top py-2">${esc(item.modelName ?? '')}</td>` : ''}
              ${wQty>0  ? `<td class="align-top py-2">${esc(item.qty)}</td>` : ''}
              ${wPrice>0? `<td class="align-top py-2">${priceDisplay}</td>` : ''}
              ${wAmt>0  ? `<td class="align-top py-2">${amtDisplay}</td>` : ''}
            </tr>`;
        }

        const descLines = item.description.split('\n');
        let rows = `
            <tr class="text-center break-inside-avoid">
              ${wNo>0   ? `<td class="align-top py-2" style="border-bottom:none !important;">${esc(item.no)}</td>` : ''}
              ${wCode>0 ? `<td class="align-top py-2" style="border-bottom:none !important;">${esc(item.itemCode)}</td>` : ''}
              ${wDesc>0 ? `<td class="text-left font-bold align-top py-2" style="border-bottom:none !important;">${esc(item.modelName ?? '')}</td>` : ''}
              ${wQty>0  ? `<td class="align-top py-2" style="border-bottom:none !important;">${esc(item.qty)}</td>` : ''}
              ${wPrice>0? `<td class="align-top py-2" style="border-bottom:none !important;">${priceDisplay}</td>` : ''}
              ${wAmt>0  ? `<td class="align-top py-2" style="border-bottom:none !important;">${amtDisplay}</td>` : ''}
            </tr>`;

        descLines.forEach((line, idx) => {
            const isLast = idx === descLines.length - 1;
            const tdStyle = isLast ? 'border-top:none !important;' : 'border-bottom:none !important; border-top:none !important;';
            const padStyle = isLast ? 'padding-bottom: 8px;' : 'padding-bottom: 0;';
            rows += `
            <tr class="text-center break-inside-avoid">
              ${wNo>0   ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wCode>0 ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wDesc>0 ? `<td class="text-left font-normal text-[12px] align-top whitespace-pre-wrap" style="${tdStyle} padding-top: 2px; ${padStyle}">${esc(line)}</td>` : ''}
              ${wQty>0  ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wPrice>0? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wAmt>0  ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
            </tr>`;
        });

        return rows;
    };

    // Each item gets its own <tbody class="break-inside-avoid"> so a page
    // break can only fall BETWEEN items — every item's last row carries the
    // closing bottom border, so the table is never left open at a page cut
    // (Chromium does not reliably paint the repeated-tfoot collapsed border).
    const itemRows = dataItems
        .map(item => `<tbody class="break-inside-avoid">${makeItemRow(item)}</tbody>`)
        .join('');

    const moneyCellUsd = (v: number | null) =>
        v !== null && v > 0
            ? `<div class="flex justify-between"><span>${sym}</span><span>${fmtNum(v)}</span></div>`
            : `<div class="flex justify-between"><span>${sym}</span><span>-</span></div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Quotation - LIMPERIAL TECHNOLOGY CO., LTD.</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Koh+Santepheap:wght@400;700&family=Moul&display=swap');
  body { font-family: 'Koh Santepheap', sans-serif; font-size: 11px; color: #000; }
  .brand-blue { color: #004aad; }
  .bg-brand-blue { background-color: #004aad; }
  .border-brand-blue { border-color: #004aad; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 8px; }
  .items-table th, .items-table td { border: 1px solid #000 !important; }
  /* Break long unbroken strings (e.g. a pasted code with no spaces) so a
     description can never overflow its fixed-width column and spill across the
     table. */
  .items-table td { overflow-wrap: anywhere; word-break: break-word; }
  .items-table thead { break-after: avoid; page-break-after: avoid; }
  .items-table tbody:first-of-type tr:first-child { break-before: avoid; page-break-before: avoid; }
  .header-info p { margin-bottom: 2px; }
  .addr-clamp { white-space: normal; word-break: break-word; }
  @page { size:A4; margin:10mm 8mm; }
  .no-break { page-break-inside:avoid; break-inside:avoid; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; padding: 0 !important; }
  }
</style>
</head>
<body>

<div style="width:210mm;margin:0 auto;padding:0 8px;">

  <div class="no-break">
  <header class="mb-6">
    <div class="border-b-[3px] border-brand-blue pb-4 text-center header-info relative pt-12">
      <div class="absolute left-0 top-0">
        <img alt="L'IMPERIAL Logo" class="h-10 w-auto object-contain" src="${LOGO}"/>
      </div>
      <h1 class="text-xl font-bold mb-1" style="font-family:'Moul',serif;">លីមភើរៀលថេកណឡជីឯ.ក</h1>
      <h2 class="text-lg font-bold mb-1" style="font-family:'Times New Roman',serif;">LIMPERIAL TECHNOLOGY CO., LTD.</h2>
      <p class="font-bold">លេខអត្តសញ្ញាណកម្មអាករ (VAT TIN) : K003-902201968</p>
      <p class="text-[10px]">អាសយដ្ឋាន៖ #B១៥ (ជាន់ផ្ទាល់ដី ជាន់ទី១ ជាន់ទី២ ជាន់ទី៣ និង ជាន់ទី៤) ផ្លូវ អយស្ម័យយានបូព៍ (១៣៩) ភូមិ ១ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</p>
      <p class="text-[10px]">Address: #B15 (Ground Floor 1st Floor 2nd Floor 3rd Floor and 4th Floor), East Railway (139), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</p>
      <p class="text-[10px]">E-mail: info@limperialtech.com || លេខទូរស័ព្ទ (Telephone): +855 92 218 333</p>
    </div>
  </header>

  <div class="text-center mb-6">
    <h3 class="text-xl font-bold" style="font-family:'Moul',serif;">សម្រង់តម្លៃ</h3>
    <h4 class="text-lg font-bold" style="font-family:'Times New Roman',serif;">QUOTATION</h4>
  </div>

  <div class="flex justify-between gap-0 mb-6">
    <div class="w-[62%]">
      <table class="w-full border-none">
        <tbody class="text-[12px]">
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">Customer</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
            <td class="border-none py-1">${customer}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;vertical-align:top;">Address</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;vertical-align:top;">:</td>
            <td class="border-none py-1" style="min-width:320px;"><div class="addr-clamp">${address}</div></td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">VAT TIN</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
            <td class="border-none py-1">${vatTin}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">Contact Person</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
            <td class="border-none py-1">${contact}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">Telephone</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
            <td class="border-none py-1">${phone}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">E-mail</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
            <td class="border-none py-1">${email}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="w-[38%] flex flex-col">
      <table class="w-auto ml-auto border-none table-fixed">
        <tbody class="text-[12px]">
          <tr>
            <td class="w-[90px] font-bold border-none py-1 whitespace-nowrap">Quotation N&#176;</td>
            <td class="w-[10px] border-none py-1 text-center">:</td>
            <td class="w-auto border-none py-1 align-middle">${quoteNo}</td>
          </tr>
          <tr>
            <td class="w-[90px] font-bold border-none py-1 whitespace-nowrap">Date</td>
            <td class="w-[10px] border-none py-1 text-center">:</td>
            <td class="w-auto border-none py-1 align-middle">${quoteDate}</td>
          </tr>
          <tr>
            <td class="w-[90px] font-bold border-none py-1 whitespace-nowrap">Validity</td>
            <td class="w-[10px] border-none py-1 text-center">:</td>
            <td class="w-auto border-none py-1 align-middle">${validity}</td>
          </tr>
          <tr>
            <td class="w-[90px] font-bold border-none py-1 whitespace-nowrap">Status</td>
            <td class="w-[10px] border-none py-1 text-center">:</td>
            <td class="w-auto border-none py-1 align-middle">${status}</td>
          </tr>
          <tr>
            <td class="w-[90px] font-bold border-none py-1 whitespace-nowrap">Payment Term</td>
            <td class="w-[10px] border-none py-1 text-center">:</td>
            <td class="w-auto border-none py-1 align-middle">${payTerm}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  </div>

  <div class="mb-4">
    <table class="items-table w-full mx-auto" style="table-layout:fixed;">
      <colgroup>
        ${wNo>0   ? `<col style="width:${wNo}%"/>` : ''}
        ${wCode>0 ? `<col style="width:${wCode}%"/>` : ''}
        ${wDesc>0 ? `<col style="width:${wDesc}%"/>` : ''}
        ${wQty>0  ? `<col style="width:${wQty}%"/>` : ''}
        ${wPrice>0? `<col style="width:${wPrice}%"/>` : ''}
        ${wAmt>0  ? `<col style="width:${wAmt}%"/>` : ''}
      </colgroup>
      <thead>
        <tr class="bg-brand-blue text-white text-center text-[12px]">
          ${wNo>0   ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>ល.រ</div><div>N&#176;</div></th>` : ''}
          ${wCode>0 ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>លេខកូដទំនិញ</div><div>Part Number</div></th>` : ''}
          ${wDesc>0 ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>បរិយាយទំនិញ</div><div>Description</div></th>` : ''}
          ${wQty>0  ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>បរិមាណ</div><div>Quantity</div></th>` : ''}
          ${wPrice>0? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>តម្លៃឯកតា</div><div>Unit Price</div></th>` : ''}
          ${wAmt>0  ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>តម្លៃសរុប</div><div>Amount</div></th>` : ''}
        </tr>
      </thead>
      <tfoot style="display: table-footer-group;">
        <tr><td colspan="${visibleCols}" style="padding:0 !important; border:none !important; border-top:1px solid #000 !important; height:0;"></td></tr>
      </tfoot>
      ${itemRows}
      <tbody class="break-inside-avoid">
        <tr>
          <td class="align-top p-4" colspan="${footerLeftSpan}" rowspan="${totalRows}" style="border:none !important; border-top:1px solid #000 !important; border-left-style:hidden !important; border-bottom-style:hidden !important;">
            <div class="w-full" style="font-size:10px;">
              <h4 style="font-weight:bold;font-size:10px;text-decoration:underline;text-transform:uppercase;margin-bottom:4px;">Terms &amp; Conditions:</h4>
              <ul style="padding-left:14px;margin:0;list-style-type:disc;">
                <li style="margin-bottom:3px;"><strong>Payment Terms:</strong> Full payment is required as per the agreed terms. Late payments may result in order suspension.</li>
                <li style="margin-bottom:3px;"><strong>Goods Sold:</strong> All goods sold are non-refundable and exchangeable. Please inspect all goods carefully before signing.</li>
                <li style="margin-bottom:3px;"><strong>Warranty:</strong> All goods sold are covered under Limperial Technology's warranty policy. Warranty does not cover unauthorized repairs or broken seals.</li>
              </ul>
            </div>
          </td>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="border:1px solid #000; border-left:none;">Sub Total</td>
          <td class="align-middle" style="border:1px solid #000;">${moneyCellUsd(subTotal > 0 ? subTotal : null)}</td>
        </tr>
        ${vatAmount > 0 ? `<tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="border:1px solid #000; border-left:none;">VAT (10%)</td>
          <td class="align-middle" style="border:1px solid #000;">${moneyCellUsd(vatAmount)}</td>
        </tr>` : ''}
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="border:1px solid #000; border-left:none;">Grand Total in Dollar</td>
          <td class="align-middle" style="border:1px solid #000;">${moneyCellUsd(grandUsd > 0 ? grandUsd : null)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="flex justify-between px-4 pb-8 mx-auto w-full break-inside-avoid" style="margin-top:${signaturePadding}px;">
    <div class="w-[35%] text-center">
      <p class="font-bold text-[11px]" style="margin-bottom:${labelPadding}px;">Prepared By:</p>
      <div class="border-t-2 border-black mb-1"></div>
      <p class="text-[11px]">${esc(hd['Prepared By'] || hd['Created By'] || '')}</p>
      <p class="text-[11px]">${esc(hd['Prepared By Position'] || '')}</p>
    </div>
    <div class="w-[35%] text-center">
      <p class="font-bold text-[11px]" style="margin-bottom:${labelPadding}px;">Approved By:</p>
      <div class="border-t-2 border-black mb-1"></div>
      <p class="text-[11px]">${esc(hd['Approved By'] || '')}</p>
      <p class="text-[11px]">${esc(hd['Approved By Position'] || '')}</p>
    </div>
  </div>

</div>
</body>
</html>`;
}
