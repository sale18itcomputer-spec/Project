/**
 * buildTaxInvoice.ts
 * TAX INVOICE HTML builder — bilingual Khmer/English.
 * columnWidths: [no%, code%, desc%, qty%, unitPrice%, amount%]  — 0 = omit column
 */
import { esc, fmtDate, fmtNum, LOGO, PdfItem, PdfTotals } from './shared-pure';

const DEFAULT_WIDTHS = [4, 12, 38, 14, 17, 15];

export function buildTaxInvoice(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    currency: string,
    sym: string,
    tax: number,
    showVat = true,
    signaturePadding = 0,
    labelPadding = 200,
    columnWidths?: number[],
    hideKhmer = false,
    docTitle?: { en: string; km: string },
): string {
    const cw = (columnWidths && columnWidths.length === 6) ? columnWidths : DEFAULT_WIDTHS;
    const [wNo, wCode, wDesc, wQty, wPrice, wAmt] = cw;
    // English-only mode is only meaningful for NON-VAT invoices (VAT invoices keep Khmer).
    const noKhmer = !showVat && hideKhmer;
    // docTitle is only passed for Service Invoices — switches terms and signature labels.
    const isService = !!docTitle;

    const invNo      = esc(hd['Inv No.'] || hd['Inv No'] || hd['Invoice No'] || '');
    const invDate    = esc(fmtDate(hd['Inv Date'] || hd['Invoice Date'] || ''));
    const dueDate    = esc(fmtDate(hd['Due Date'] || ''));
    const customerKh = esc(hd['Company Name (Khmer)'] || '');
    const customer   = esc(hd['Company Name'] || hd['Customer'] || '');
    const address    = esc(hd['Company Address'] || hd['Address'] || '');
    const vatTin     = esc(hd['Tin No.'] || hd['Tin No'] || hd['VAT TIN'] || '');
    const email      = esc(hd['Email'] || '');
    const contact    = esc(hd['Contact Name'] || hd['Contact Person'] || '');
    const phone      = esc(hd['Phone Number'] || hd['Telephone'] || '');

    // English-only label variants (used when noKhmer is true)
    const lblAddress   = noKhmer ? 'Address'         : 'អាសយដ្ឋាន (Address)';
    const lblContact   = noKhmer ? 'Contact Person'  : 'ទំនាក់ទំនង (Contact Person)';
    const lblTelephone = noKhmer ? 'Telephone'       : 'លេខទូរស័ព្ទ (Telephone)';
    const lblEmail     = noKhmer ? 'E-mail'          : 'អ៊ីម៉ែល (E-mail)';
    const lblInvoiceNo = noKhmer ? 'Invoice N&#186;' : 'លេខវិក្កយបត្រ (Invoice N&#186;)';
    const lblDate      = noKhmer ? 'Date'            : 'កាលបរិច្ឆេទ (Date)';
    const lblDueDate   = noKhmer ? 'Due Date'        : 'កាលបរិច្ឆេទផុតកំណត់ (Due Date)';
    const lblTotal     = noKhmer ? 'Total'           : 'សរុប (Total)';
    const lblDeposit   = noKhmer ? 'Deposit'         : 'ប្រាក់កក់ (Deposit)';
    const th2 = (kh: string, en: string) => noKhmer ? `<div>${en}</div>` : `<div>${kh}</div><div>${en}</div>`;

    const deposit      = parseFloat(String(hd['Deposit'] || 0)) || 0;
    const exchangeRate = hd['Exchange Rate'] || hd['ExchangeRate'] || '';
    const rateNum      = parseFloat(String(exchangeRate).replace(/,/g, '')) || 0;

    const subTotal  = totals.subTotal;
    const hasDeposit = deposit > 0;
    const depositPercent = hasDeposit && subTotal > 0 ? Math.round((deposit / subTotal) * 100) : 0;
    const totalLessDeposit = subTotal - deposit;
    // When a deposit is present, this VAT invoice bills only the deposit portion now —
    // VAT and Grand Total are computed on the deposit amount, not the full subtotal.
    const vatBase   = hasDeposit ? deposit : subTotal;
    const vatAmount = showVat ? (hasDeposit ? vatBase * 0.1 : (tax > 0 ? tax : vatBase * 0.1)) : 0;
    const grandUsd  = vatBase + vatAmount;
    const grandRiel = rateNum > 0 ? Math.round(grandUsd * rateNum) : 0;
    // Non-VAT footer is simplified to just a "Total" row (+ Deposit/Less Deposit when present).
    // VAT footer keeps the full breakdown: Sub Total, [Deposit], VAT, Grand USD, Exchange Rate, Grand Riel.
    const footerRows = showVat
        ? (hasDeposit ? 6 : 5)
        : (hasDeposit ? 3 : 1);

    const dataItems = items.filter(i => Number(i.no) > 0 || i.isPromotion);

    const makeItemRow = (item: PdfItem): string => {
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

        const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
        const amt   = typeof item.amount    === 'number' ? item.amount    : parseFloat(String(item.amount))    || 0;
        const amtDisplay  = amt > 0   ? `<div class="flex justify-between"><span>${sym}</span><span>${fmtNum(amt)}</span></div>`   : `<div class="flex justify-between"><span>${sym}</span><span>-</span></div>`;
        const priceDisplay = price > 0 ? `<div class="flex justify-between"><span>${sym}</span><span>${fmtNum(price)}</span></div>` : '';

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

        // Header row for a multi-line description — bottom border suppressed
        // because a description-line row always follows.
        let rows = `
        <tr class="text-center break-inside-avoid">
          ${wNo>0   ? `<td class="align-top pt-2 pb-0" style="border-bottom:none !important;">${esc(item.no)}</td>` : ''}
          ${wCode>0 ? `<td class="align-top pt-2 pb-0" style="border-bottom:none !important;">${esc(item.itemCode)}</td>` : ''}
          ${wDesc>0 ? `<td class="text-left font-bold align-top pt-2 pb-0" style="border-bottom:none !important;">${esc(item.modelName ?? '')}</td>` : ''}
          ${wQty>0  ? `<td class="align-top pt-2 pb-0" style="border-bottom:none !important;">${esc(item.qty)}</td>` : ''}
          ${wPrice>0? `<td class="align-top pt-2 pb-0" style="border-bottom:none !important;">${priceDisplay}</td>` : ''}
          ${wAmt>0  ? `<td class="align-top pt-2 pb-0" style="border-bottom:none !important;">${amtDisplay}</td>` : ''}
        </tr>`;

        // Multi-line descriptions get their own row per line (each marked
        // break-inside-avoid) so a page break can fall between lines instead
        // of forcing the whole item block onto the next page and leaving a
        // large blank gap at the bottom of the previous page.
        const descLines = item.description.split('\n');
        descLines.forEach((line, idx) => {
            const isLastLine = idx === descLines.length - 1;
            const borderStyle = isLastLine ? 'border-top:none !important;' : 'border-top:none !important; border-bottom:none !important;';
            const padStyle = isLastLine ? 'padding-bottom:8px;' : 'padding-bottom:0;';
            rows += `
        <tr class="text-center break-inside-avoid">
          ${wNo>0   ? `<td class="align-top py-0" style="${borderStyle}"></td>` : ''}
          ${wCode>0 ? `<td class="align-top py-0" style="${borderStyle}"></td>` : ''}
          ${wDesc>0 ? `<td class="text-left font-normal text-[12px] align-top whitespace-pre-wrap" style="${borderStyle} padding-top:2px; ${padStyle}">${esc(line)}</td>` : ''}
          ${wQty>0  ? `<td class="align-top py-0" style="${borderStyle}"></td>` : ''}
          ${wPrice>0? `<td class="align-top py-0" style="${borderStyle}"></td>` : ''}
          ${wAmt>0  ? `<td class="align-top py-0" style="${borderStyle}"></td>` : ''}
        </tr>`;
        });

        return rows;
    };

    const itemRows = dataItems.map(makeItemRow).join('');

    const moneyCellUsd = (v: number | null) =>
        v !== null && v > 0
            ? `<div class="flex justify-between"><span>${sym}</span><span>${fmtNum(v)}</span></div>`
            : `<div class="flex justify-between"><span>${sym}</span><span>-</span></div>`;

    // Number of visible non-footer columns (used for colspan in footer left cell)
    const visibleItemCols = cw.filter(w => w > 0).length;
    // The footer uses colspan="3" for the left Terms cell — keep that fixed as it
    // references the first 3 columns (No, Code, Desc). Adjust if some are hidden.
    const footerLeftSpan = [wNo, wCode, wDesc].filter(w => w > 0).length || 1;
    const footerRightSpan = visibleItemCols - footerLeftSpan;

    // VAT footer label cells: no left border (T&C rowspan cell sits to the left)
    const lblCellStyle = `border-top:1px solid #000 !important; border-bottom:1px solid #000 !important; border-right:1px solid #000 !important; border-left:none !important;`;
    // Non-VAT footer label cells: full border (label IS the leftmost column)
    const nonVatLblCellStyle = `border:1px solid #000 !important;`;

    const colgroupHtml = `<colgroup>
        ${wNo>0   ? `<col style="width:${wNo}%"/>` : ''}
        ${wCode>0 ? `<col style="width:${wCode}%"/>` : ''}
        ${wDesc>0 ? `<col style="width:${wDesc}%"/>` : ''}
        ${wQty>0  ? `<col style="width:${wQty}%"/>` : ''}
        ${wPrice>0? `<col style="width:${wPrice}%"/>` : ''}
        ${wAmt>0  ? `<col style="width:${wAmt}%"/>` : ''}
      </colgroup>`;

    const theadHtml = `<thead>
        <tr class="bg-brand-blue text-white text-center text-[12px]">
          ${wNo>0   ? `<th class="py-2 whitespace-nowrap leading-tight">${th2('ល.រ', 'N&#186;')}</th>` : ''}
          ${wCode>0 ? `<th class="py-2 whitespace-nowrap leading-tight">${th2('លេខសម្គាល់ទំនិញ', 'Part Number')}</th>` : ''}
          ${wDesc>0 ? `<th class="py-2 whitespace-nowrap leading-tight">${th2('បរិយាយទំនិញ', 'Description')}</th>` : ''}
          ${wQty>0  ? `<th class="py-2 whitespace-nowrap leading-tight">${th2('បរិមាណ', 'Qty')}</th>` : ''}
          ${wPrice>0? `<th class="py-2 whitespace-nowrap leading-tight">${th2('តម្លៃឯកតា', 'Unit Price')}</th>` : ''}
          ${wAmt>0  ? `<th class="py-2 whitespace-nowrap leading-tight">${th2('តម្លៃទំនិញ', 'Amount')}</th>` : ''}
        </tr>
      </thead>`;

    // Zero-height row with border-top only — Chromium repeats <thead> and
    // <tfoot> on every printed page when a table spans multiple pages, so
    // this supplies the missing closing bottom border on every page break.
    const tfootHtml = `<tfoot style="display: table-footer-group;">
        <tr><td colspan="${visibleItemCols}" style="padding:0 !important; border:none !important; border-top:1px solid #000 !important; height:0;"></td></tr>
      </tfoot>`;

    const footerTbodyHtml = showVat ? `<tbody class="break-inside-avoid">
        <tr>
          <td class="align-top p-4" colspan="${footerLeftSpan}" rowspan="${footerRows}" style="border-top:1px solid #000 !important; border-bottom:none !important; border-left:1px solid #000 !important; border-right:1px solid #000 !important;">
            <div class="w-full" style="font-size:10px;">
              <h4 style="font-weight:bold;font-size:10px;text-decoration:underline;text-transform:uppercase;margin-bottom:4px;">Terms &amp; Conditions:</h4>
              <ul style="padding-left:14px;margin:0;list-style-type:disc;">
                <li style="margin-bottom:3px;"><strong>Payment Terms:</strong> Full payment is required as per the agreed terms. Late payments may result in order suspension.</li>
                <li style="margin-bottom:3px;"><strong>Goods Sold:</strong> All goods sold are non-refundable and exchangeable. Please inspect all goods carefully before signing.</li>
                <li style="margin-bottom:3px;"><strong>Warranty:</strong> All goods sold are covered under Limperial Technology&apos;s warranty policy. Warranty does not cover unauthorized repairs or broken seals.</li>
              </ul>
            </div>
          </td>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="${lblCellStyle}">សរុប (Sub Total)</td>
          <td class="align-middle" style="border:1px solid #000 !important;">${moneyCellUsd(subTotal > 0 ? subTotal : null)}</td>
        </tr>
        ${hasDeposit ? `
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="${lblCellStyle}">កក់ប្រាក់${depositPercent}% (Deposit ${depositPercent}%)</td>
          <td class="align-middle" style="border:1px solid #000 !important;">${moneyCellUsd(deposit)}</td>
        </tr>` : ''}
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="${lblCellStyle}">អាករ (VAT 10%)</td>
          <td class="align-middle" style="border:1px solid #000 !important;">${moneyCellUsd(vatAmount > 0 ? vatAmount : null)}</td>
        </tr>
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="${lblCellStyle}">សរុបរួម (Grand Total in Dollar)</td>
          <td class="align-middle" style="border:1px solid #000 !important;">${moneyCellUsd(grandUsd > 0 ? grandUsd : null)}</td>
        </tr>
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="${lblCellStyle}">អត្រាប្តូរប្រាក់ (Exchange Rate)</td>
          <td class="text-right pr-2 align-middle" style="border:1px solid #000 !important;">${exchangeRate ? esc(String(exchangeRate)) : '-'}</td>
        </tr>
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="${lblCellStyle}">សរុបរួមជាប្រាក់រៀល (Grand Total in Riel)</td>
          <td class="align-middle" style="border:1px solid #000 !important;">${grandRiel > 0 ? `<div class="flex justify-between"><span>&#x17DB;</span><span>${fmtNum(grandRiel)}</span></div>` : `<div class="flex justify-between"><span>&#x17DB;</span><span>-</span></div>`}</td>
        </tr>
      </tbody>` : `<tbody class="break-inside-avoid">
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${visibleItemCols - 1}" style="${nonVatLblCellStyle}">${lblTotal}</td>
          <td class="align-middle" style="border:1px solid #000 !important;">${moneyCellUsd(subTotal > 0 ? subTotal : null)}</td>
        </tr>
        ${hasDeposit ? `
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${visibleItemCols - 1}" style="${nonVatLblCellStyle}">${lblDeposit}</td>
          <td class="align-middle" style="border:1px solid #000 !important;">${moneyCellUsd(deposit)}</td>
        </tr>
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${visibleItemCols - 1}" style="${nonVatLblCellStyle}">Total Less Deposit</td>
          <td class="align-middle" style="border:1px solid #000 !important;">${moneyCellUsd(totalLessDeposit > 0 ? totalLessDeposit : null)}</td>
        </tr>` : ''}
      </tbody>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>${docTitle ? docTitle.en : showVat ? 'Tax Invoice' : 'Invoice'} - LIMPERIAL TECHNOLOGY CO., LTD.</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Koh+Santepheap:wght@400;700&family=Moul&display=swap');
  body { font-family:'Koh Santepheap',sans-serif; font-size:11px; color:#000; }
  .brand-blue { color:#004aad; }
  .bg-brand-blue { background-color:#004aad; }
  .border-brand-blue { border-color:#004aad; }
  table { width:100%; border-collapse:collapse; }
  th, td { padding:4px 8px; }
  .items-table th, .items-table td { border:1px solid #000 !important; }
  .items-table thead { break-after:avoid; page-break-after:avoid; }
  .items-table tbody tr:first-child { break-before:avoid; page-break-before:avoid; }
  .header-info p { margin-bottom:2px; }
  .addr-clamp { white-space:normal; word-break:break-word; }
  @page { size:A4; margin:10mm 8mm 18mm 8mm; }
  .no-break { page-break-inside:avoid; break-inside:avoid; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>
<div style="width:210mm;margin:0 auto;padding:0 8px;">
  <div class="no-break">
  ${showVat ? `<header class="mb-6">
    <div class="border-b-[3px] border-brand-blue pb-4 text-center header-info relative pt-12">
      <div class="absolute left-0 top-0"><img alt="Logo" class="h-10 w-auto object-contain" src="${LOGO}"/></div>
      <h1 class="text-xl font-bold mb-1" style="font-family:'Moul',serif;">លីមភើរៀលថេកណឡជីឯ.ក</h1>
      <h2 class="text-lg font-bold mb-1" style="font-family:'Times New Roman',serif;">LIMPERIAL TECHNOLOGY CO., LTD.</h2>
      <p class="font-bold">លេខអត្តសញ្ញាណកម្មអាករ (VAT TIN) : K003-902201968</p>
      <p class="text-[10px]">អាសយដ្ឋាន៖ #B១៥ ផ្លូវ អយស្ម័យយានបូព៍ (១៣៩) ភូមិ ១ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</p>
      <p class="text-[10px]">Address: #B15, East Railway (139), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</p>
      <p class="text-[10px]">E-mail: info@limperialtech.com || លេខទូរស័ព្ទ (Telephone): +855 92 218 333</p>
    </div>
  </header>` : ''}
  <div class="text-center mb-6${showVat ? '' : ' pt-6'}">
    ${noKhmer ? '' : `<h3 class="text-xl font-bold" style="font-family:'Moul',serif;line-height:1.6;">${docTitle ? docTitle.km : showVat ? 'វិក្កយបត្រអាករ' : 'វិក្កយបត្រ'}</h3>`}
    <h4 class="text-lg font-bold" style="font-family:'Times New Roman',serif;">${docTitle ? docTitle.en : showVat ? 'TAX INVOICE' : 'INVOICE'}</h4>
  </div>
  <div class="flex justify-between gap-0 mb-6">
    <div class="w-[55%]">
      <table class="w-full border-none"><tbody class="text-[12px]">
        ${noKhmer ? '' : `<tr><td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">អតិថិជន</td><td class="border-none py-1 w-[5%] text-center">:</td><td class="border-none py-1 w-[60%]">${customerKh || customer}</td></tr>`}
        <tr><td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">Customer</td><td class="border-none py-1 w-[5%] text-center">:</td><td class="border-none py-1 w-[60%]">${customer}</td></tr>
        <tr><td class="font-bold border-none py-1 align-top whitespace-nowrap w-[25%]">${lblAddress}</td><td class="border-none py-1 align-top w-[5%] text-center">:</td><td class="border-none py-1" style="min-width:320px;"><div class="addr-clamp">${address}</div></td></tr>
        ${vatTin ? `<tr><td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">VAT TIN</td><td class="border-none py-1 w-[5%] text-center">:</td><td class="border-none py-1 w-[60%]">${vatTin}</td></tr>` : ''}
        <tr><td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">${lblContact}</td><td class="border-none py-1 w-[5%] text-center">:</td><td class="border-none py-1 w-[55%] align-middle">${contact}</td></tr>
        <tr><td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">${lblTelephone}</td><td class="border-none py-1 w-[5%] text-center">:</td><td class="border-none py-1 w-[55%] align-middle">${phone}</td></tr>
        <tr><td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">${lblEmail}</td><td class="border-none py-1 w-[5%] text-center">:</td><td class="border-none py-1 w-[55%]">${email}</td></tr>
      </tbody></table>
    </div>
    <div class="w-[45%] flex flex-col">
      <table class="w-auto ml-auto border-none table-fixed"><tbody class="text-[12px]">
        <tr><td class="w-[150px] font-bold border-none py-1 whitespace-nowrap">${lblInvoiceNo}</td><td class="w-[10px] border-none py-1 text-center">:</td><td class="w-auto border-none py-1 align-middle">${invNo}</td></tr>
        <tr><td class="w-[150px] font-bold border-none py-1 whitespace-nowrap">${lblDate}</td><td class="w-[10px] border-none py-1 text-center">:</td><td class="w-auto border-none py-1 align-middle">${invDate}</td></tr>
        <tr><td class="w-[150px] font-bold border-none py-1 whitespace-nowrap">${lblDueDate}</td><td class="w-[10px] border-none py-1 text-center">:</td><td class="w-auto border-none py-1 align-middle">${dueDate}</td></tr>
      </tbody></table>
    </div>
  </div>
  </div>

  <div class="mb-4">
    <table class="items-table w-full mx-auto" style="table-layout:fixed;">
      ${colgroupHtml}
      ${theadHtml}
      ${tfootHtml}
      <tbody>${itemRows}</tbody>
      ${footerTbodyHtml}
    </table>
    ${showVat ? `<div class="mt-4 text-[10px] no-break">
      <h4 class="font-bold text-[11px] underline uppercase mb-1">Payment Information:</h4>
      <p><span class="font-bold">Bank:</span> Advanced Bank of Asia Ltd (ABA Bank)</p>
      <p><span class="font-bold">Account Name:</span> LIMPERIAL TECHNOLOGY CO., LTD.</p>
      <p><span class="font-bold">Account Number:</span> 003916564</p>
    </div>` : `<div class="mt-4 text-[10px] no-break">
      <h4 class="font-bold text-[11px] underline uppercase mb-1">Term Condition:</h4>
      <ul class="list-disc list-inside space-y-0.5">
        ${isService ? `
        <li><span class="font-bold">Payment Terms:</span> Full payment is required upon completion of service unless otherwise agreed.</li>
        <li><span class="font-bold">Service &amp; Parts:</span> All service charges and replaced parts are non-refundable. Please test the device carefully upon receipt.</li>
        <li><span class="font-bold">Service Warranty:</span> Repair work and replaced parts are covered under our service warranty policy. Warranty does not cover physical or liquid damage, unauthorized repairs, or broken seals.</li>
        ` : `
        <li><span class="font-bold">Payment Terms:</span> Full payment is required as per the agreed terms. Late payments may result in order suspension.</li>
        <li><span class="font-bold">Goods Sold:</span> All goods sold are non-refundable and exchangeable. Please inspect all goods carefully before signing.</li>
        <li><span class="font-bold">Warranty:</span> All goods sold are covered under our warranty policy. Warranty does not cover unauthorized repairs or broken seals.</li>
        `}
      </ul>
    </div>`}
  </div>

  <div class="flex justify-between px-4 pb-8 mx-auto w-full break-inside-avoid" style="margin-top:${signaturePadding}px;">
    <div class="w-[${showVat ? '35' : '28'}%] text-center">
      <div style="margin-bottom:${labelPadding}px"></div>
      <div class="border-t-2 border-black mb-2"></div>
      ${hd['Prepared By'] ? `<p class="font-bold text-[11px] mb-0.5">${esc(hd['Prepared By'])}</p>` : ''}
      ${hd['Prepared By Position'] ? `<p class="text-[12px] mb-1">${esc(hd['Prepared By Position'])}</p>` : ''}
      ${noKhmer ? '' : `<p class="text-[11px] mb-1">ហត្ថលេខា និងឈ្មោះអ្នកលក់</p>`}
      <p class="font-bold text-[11px]">${isService ? "Receiver's" : "Seller's"} Signature &amp; Name</p>
    </div>
    ${!showVat ? `<div class="w-[28%] text-center">
      <div style="margin-bottom:${labelPadding}px"></div>
      <div class="border-t-2 border-black mb-2"></div>
      ${noKhmer ? '' : `<p class="text-[11px] mb-1">ហត្ថលេខា និងឈ្មោះអ្នកដឹកជញ្ជូន</p>`}
      <p class="font-bold text-[11px]">${isService ? "Technician's" : "Deliverer's"} Signature &amp; Name</p>
    </div>` : ''}
    <div class="w-[${showVat ? '35' : '28'}%] text-center">
      <div style="margin-bottom:${labelPadding}px"></div>
      <div class="border-t-2 border-black mb-2"></div>
      ${noKhmer ? '' : `<p class="text-[11px] mb-1">ហត្ថលេខា និងឈ្មោះអ្នកទិញ</p>`}
      <p class="font-bold text-[11px]">Customer's Signature &amp; Name</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
