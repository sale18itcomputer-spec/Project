/**
 * buildSaleOrder.ts
 * Sale Order PDF builder — bilingual Khmer/English.
 * Visual style mirrors buildQuotationNonVAT.ts (Tailwind CDN + Google Fonts).
 * columnWidths: [no%, code%, desc%, qty%, unitPrice%, amount%]
 */
import { esc, fmtDate, fmtNum, PdfItem, PdfTotals } from './shared-pure';

const DEFAULT_WIDTHS = [5, 16, 47, 6, 12, 14];

export function buildSaleOrder(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    currency: string,
    sym: string,
    tax: number,
    signaturePadding = 0,
    labelPadding = 100,
    columnWidths?: number[],
): string {
    const cw = (columnWidths && columnWidths.length === 6) ? columnWidths : DEFAULT_WIDTHS;
    const [wNo, wCode, wDesc, wQty, wPrice, wAmt] = cw;

    const soNo      = esc(hd['Sale Order ID'] || '');
    const soDate    = esc(fmtDate(hd['Order Date'] || ''));
    const delDate   = esc(fmtDate(hd['Delivery Date'] || ''));
    const billInv   = esc(hd['Bill Invoice'] || '');
    const payTerm   = esc(hd['Payment Term'] || '');
    const company   = esc(hd['Company Name'] || '');
    const address   = esc(hd['Company Address'] || '');
    const contact   = esc(hd['Contact Name'] || '');
    const tel       = esc(hd['Contact Tel'] || '');
    const email     = esc(hd['Email'] || '');

    const visibleCols    = cw.filter(w => w > 0).length;
    const footerLeftSpan = Math.max([wNo, wCode, wDesc].filter(w => w > 0).length, 1);
    const footerRightSpan = visibleCols - footerLeftSpan;
    const footerRows     = 2 + (tax > 0 ? 1 : 0);

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
              ${wNo>0    ? `<td class="align-top py-2"></td>` : ''}
              ${wCode>0  ? `<td class="align-top py-2"></td>` : ''}
              ${wDesc>0  ? `<td class="text-left italic align-top py-2 text-[12px]" style="color:#666;">${esc(descText || 'Cashback / Promotion')}</td>` : ''}
              ${wQty>0   ? `<td class="align-top py-2"></td>` : ''}
              ${wPrice>0 ? `<td class="align-top py-2"></td>` : ''}
              ${wAmt>0   ? `<td class="align-top py-2" style="color:#c00000;">${promoAmt}</td>` : ''}
            </tr>`;
            }
            const lines = descText.split('\n');
            let promoRows = `
            <tr class="text-center break-inside-avoid">
              ${wNo>0    ? `<td class="align-top py-2" style="border-bottom:none !important;"></td>` : ''}
              ${wCode>0  ? `<td class="align-top py-2" style="border-bottom:none !important;"></td>` : ''}
              ${wDesc>0  ? `<td class="text-left italic align-top py-2 text-[12px]" style="border-bottom:none !important;color:#666;">${esc(lines[0])}</td>` : ''}
              ${wQty>0   ? `<td class="align-top py-2" style="border-bottom:none !important;"></td>` : ''}
              ${wPrice>0 ? `<td class="align-top py-2" style="border-bottom:none !important;"></td>` : ''}
              ${wAmt>0   ? `<td class="align-top py-2" style="border-bottom:none !important;color:#c00000;">${promoAmt}</td>` : ''}
            </tr>`;
            lines.slice(1).forEach((line, idx) => {
                const isLast = idx === lines.length - 2;
                const tdStyle = isLast ? 'border-top:none !important;' : 'border-bottom:none !important;border-top:none !important;';
                const padStyle = isLast ? 'padding-bottom:8px;' : 'padding-bottom:0;';
                promoRows += `
            <tr class="text-center break-inside-avoid">
              ${wNo>0    ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wCode>0  ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wDesc>0  ? `<td class="text-left italic text-[12px] align-top whitespace-pre-wrap" style="${tdStyle}padding-top:2px;${padStyle}color:#666;">${esc(line)}</td>` : ''}
              ${wQty>0   ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wPrice>0 ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wAmt>0   ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
            </tr>`;
            });
            return promoRows;
        }

        const qty      = typeof item.qty        === 'number' ? item.qty        : parseFloat(String(item.qty))        || 0;
        const amt      = typeof item.amount     === 'number' ? item.amount     : parseFloat(String(item.amount))     || 0;
        const comm     = typeof item.commission === 'number' ? item.commission : parseFloat(String(item.commission)) || 0;
        const uPrice   = typeof item.unitPrice  === 'number' ? item.unitPrice  : parseFloat(String(item.unitPrice))  || 0;
        const dispPrice = qty > 0 ? amt / qty : uPrice + comm;

        const amtDisplay   = `<div class="flex justify-between"><span>${sym}</span><span>${amt > 0 ? fmtNum(amt) : '-'}</span></div>`;
        const priceDisplay = dispPrice > 0 ? `<div class="flex justify-between"><span>${sym}</span><span>${fmtNum(dispPrice)}</span></div>` : '';

        // PC Build: sold as one priced line, but printed with each real
        // component as its own row (itemCode + qty) — no serial numbers here,
        // the Sale Order is internal-use only (see Invoice/DO for serials).
        if (item.isPCBuild && item.buildComponents && item.buildComponents.length > 0) {
            let rows = `
            <tr class="text-center break-inside-avoid">
              ${wNo>0    ? `<td class="align-top py-2" style="border-bottom:none !important;">${esc(item.no)}</td>` : ''}
              ${wCode>0  ? `<td class="align-top py-2" style="border-bottom:none !important;">${esc(item.itemCode)}</td>` : ''}
              ${wDesc>0  ? `<td class="text-left font-bold align-top py-2" style="border-bottom:none !important;">${esc(item.modelName ?? '')}</td>` : ''}
              ${wQty>0   ? `<td class="align-top py-2" style="border-bottom:none !important;">${esc(item.qty)}</td>` : ''}
              ${wPrice>0 ? `<td class="align-top py-2" style="border-bottom:none !important;">${priceDisplay}</td>` : ''}
              ${wAmt>0   ? `<td class="align-top py-2" style="border-bottom:none !important;">${amtDisplay}</td>` : ''}
            </tr>`;
            const comps = item.buildComponents;
            comps.forEach((c, idx) => {
                const isLast = idx === comps.length - 1;
                const tdStyle = isLast ? 'border-top:none !important;' : 'border-bottom:none !important; border-top:none !important;';
                const padStyle = isLast ? 'padding-bottom:8px;' : 'padding-bottom:0;';
                rows += `
            <tr class="text-center break-inside-avoid">
              ${wNo>0    ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wCode>0  ? `<td class="align-top py-0 text-[11px]" style="${tdStyle} padding-top:2px; ${padStyle}">${esc(c.itemCode)}</td>` : ''}
              ${wDesc>0  ? `<td class="text-left font-normal text-[11px] align-top" style="${tdStyle} padding-top:2px; ${padStyle}">${esc(c.modelName)}</td>` : ''}
              ${wQty>0   ? `<td class="align-top py-0 text-[11px]" style="${tdStyle} padding-top:2px; ${padStyle}">${esc(c.qty)}</td>` : ''}
              ${wPrice>0 ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wAmt>0   ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
            </tr>`;
            });
            return rows;
        }

        if (!item.description) {
            return `
            <tr class="text-center break-inside-avoid">
              ${wNo>0    ? `<td class="align-top py-2">${esc(item.no)}</td>` : ''}
              ${wCode>0  ? `<td class="align-top py-2">${esc(item.itemCode)}</td>` : ''}
              ${wDesc>0  ? `<td class="text-left font-bold align-top py-2">${esc(item.modelName ?? '')}</td>` : ''}
              ${wQty>0   ? `<td class="align-top py-2">${esc(item.qty)}</td>` : ''}
              ${wPrice>0 ? `<td class="align-top py-2">${priceDisplay}</td>` : ''}
              ${wAmt>0   ? `<td class="align-top py-2">${amtDisplay}</td>` : ''}
            </tr>`;
        }

        const descLines = item.description.split('\n');
        let rows = `
            <tr class="text-center break-inside-avoid">
              ${wNo>0    ? `<td class="align-top py-2" style="border-bottom:none !important;">${esc(item.no)}</td>` : ''}
              ${wCode>0  ? `<td class="align-top py-2" style="border-bottom:none !important;">${esc(item.itemCode)}</td>` : ''}
              ${wDesc>0  ? `<td class="text-left font-bold align-top py-2" style="border-bottom:none !important;">${esc(item.modelName ?? '')}</td>` : ''}
              ${wQty>0   ? `<td class="align-top py-2" style="border-bottom:none !important;">${esc(item.qty)}</td>` : ''}
              ${wPrice>0 ? `<td class="align-top py-2" style="border-bottom:none !important;">${priceDisplay}</td>` : ''}
              ${wAmt>0   ? `<td class="align-top py-2" style="border-bottom:none !important;">${amtDisplay}</td>` : ''}
            </tr>`;

        descLines.forEach((line, idx) => {
            const isLast = idx === descLines.length - 1;
            const tdStyle = isLast ? 'border-top:none !important;' : 'border-bottom:none !important; border-top:none !important;';
            const padStyle = isLast ? 'padding-bottom:8px;' : 'padding-bottom:0;';
            rows += `
            <tr class="text-center break-inside-avoid">
              ${wNo>0    ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wCode>0  ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wDesc>0  ? `<td class="text-left font-normal text-[12px] align-top whitespace-pre-wrap" style="${tdStyle} padding-top:2px; ${padStyle}">${esc(line)}</td>` : ''}
              ${wQty>0   ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wPrice>0 ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
              ${wAmt>0   ? `<td class="align-top py-0" style="${tdStyle}"></td>` : ''}
            </tr>`;
        });

        return rows;
    };

    const itemRows = dataItems.map(makeItemRow).join('');

    const moneyCellUsd = (v: number) =>
        `<div class="flex justify-between"><span>${sym}</span><span>${v > 0 ? fmtNum(v) : '-'}</span></div>`;

    const softwareList = (hd['Install Software'] || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const softwareHtml = softwareList.length > 0 ? `
      <h4 style="font-weight:bold;font-size:10px;text-decoration:underline;text-transform:uppercase;margin-bottom:4px;">Set up software:</h4>
      <ul style="padding-left:14px;margin:0;list-style-type:disc;">
        ${softwareList.map((s: string) => `<li style="margin-bottom:3px;">${esc(s)}</li>`).join('')}
      </ul>` : '';

    const remarkHtml = hd['Remark'] ? `
      <div style="margin-top:6px;"><strong>Remark:</strong>
        <div style="white-space:pre-wrap;">${esc(hd['Remark'])}</div>
      </div>` : '';

    const footerLeftContent = (softwareHtml || remarkHtml)
        ? `<div style="font-size:10px;">${softwareHtml}${remarkHtml}</div>`
        : '';

    const colgroup = `
      ${wNo>0    ? `<col style="width:${wNo}%"/>` : ''}
      ${wCode>0  ? `<col style="width:${wCode}%"/>` : ''}
      ${wDesc>0  ? `<col style="width:${wDesc}%"/>` : ''}
      ${wQty>0   ? `<col style="width:${wQty}%"/>` : ''}
      ${wPrice>0 ? `<col style="width:${wPrice}%"/>` : ''}
      ${wAmt>0   ? `<col style="width:${wAmt}%"/>` : ''}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Sale Order - LIMPERIAL TECHNOLOGY CO., LTD.</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Koh+Santepheap:wght@400;700&display=swap');
  body { font-family:'Koh Santepheap',sans-serif; font-size:11px; color:#000; }
  .brand-blue { color:#004aad; }
  .bg-brand-blue { background-color:#004aad; }
  .border-brand-blue { border-color:#004aad; }
  table { width:100%; border-collapse:collapse; }
  th, td { padding:4px 8px; }
  .items-table th, .items-table td { border:1px solid #000 !important; }
  .items-table td { overflow-wrap: anywhere; word-break: break-word; }
  .items-table thead { break-after:avoid; page-break-after:avoid; }
  .items-table tbody tr:first-child { break-before:avoid; page-break-before:avoid; }
  .addr-clamp { white-space:normal; word-break:break-word; }
  @page { size:A4; margin:10mm 8mm; }
  .no-break { page-break-inside:avoid; break-inside:avoid; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; background-color:white !important; padding:0 !important; }
  }
</style>
</head>
<body>

<div style="width:210mm;margin:0 auto;padding:0 8px;">

  <div class="no-break">

    <div class="text-center mb-6 pt-6">
      <h4 class="text-lg font-bold">SALE ORDER (${hd['_isB2B'] ? 'B2B' : 'B2C'})</h4>
    </div>

    <div class="flex justify-between gap-0 mb-6">
      <div class="w-[62%]">
        <table class="w-full border-none">
          <tbody class="text-[12px]">
            <tr>
              <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">Company Name</td>
              <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
              <td class="border-none py-1">${company}</td>
            </tr>
            <tr>
              <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;vertical-align:top;">Address</td>
              <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;vertical-align:top;">:</td>
              <td class="border-none py-1" style="min-width:320px;"><div class="addr-clamp">${address}</div></td>
            </tr>
            <tr>
              <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">Contact Person</td>
              <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
              <td class="border-none py-1">${contact}</td>
            </tr>
            <tr>
              <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">Tel</td>
              <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
              <td class="border-none py-1">${tel}</td>
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
              <td class="w-[100px] font-bold border-none py-1 whitespace-nowrap">SO No</td>
              <td class="w-[10px] border-none py-1 text-center">:</td>
              <td class="w-auto border-none py-1 align-middle">${soNo}</td>
            </tr>
            <tr>
              <td class="w-[100px] font-bold border-none py-1 whitespace-nowrap">SO Date</td>
              <td class="w-[10px] border-none py-1 text-center">:</td>
              <td class="w-auto border-none py-1 align-middle">${soDate}</td>
            </tr>
            <tr>
              <td class="w-[100px] font-bold border-none py-1 whitespace-nowrap">Delivery Date</td>
              <td class="w-[10px] border-none py-1 text-center">:</td>
              <td class="w-auto border-none py-1 align-middle">${delDate}</td>
            </tr>
            <tr>
              <td class="w-[100px] font-bold border-none py-1 whitespace-nowrap">Bill Invoice</td>
              <td class="w-[10px] border-none py-1 text-center">:</td>
              <td class="w-auto border-none py-1 align-middle">${billInv}</td>
            </tr>
            <tr>
              <td class="w-[100px] font-bold border-none py-1 whitespace-nowrap">Payment Term</td>
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
      <colgroup>${colgroup}</colgroup>
      <thead>
        <tr class="bg-brand-blue text-white text-center text-[12px]">
          ${wNo>0    ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>ល.រ</div><div>No.</div></th>` : ''}
          ${wCode>0  ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>លេខកូដទំនិញ</div><div>Item Code</div></th>` : ''}
          ${wDesc>0  ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>បរិយាយទំនិញ</div><div>Description</div></th>` : ''}
          ${wQty>0   ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>បរិមាណ</div><div>Qty</div></th>` : ''}
          ${wPrice>0 ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>តម្លៃឯកតា</div><div>Unit Price</div></th>` : ''}
          ${wAmt>0   ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>តម្លៃសរុប</div><div>Amount</div></th>` : ''}
        </tr>
      </thead>
      <tfoot style="display:table-footer-group;">
        <tr><td colspan="${visibleCols}" style="padding:0 !important;border:none !important;border-top:1px solid #000 !important;height:0;"></td></tr>
      </tfoot>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <table class="w-full mx-auto" style="border-collapse:collapse;margin-top:-1px;table-layout:fixed;">
      <colgroup>${colgroup}</colgroup>
      <tbody class="break-inside-avoid">
        <tr>
          <td class="align-top p-4" colspan="${footerLeftSpan}" rowspan="${footerRows}" style="border:none;">
            ${footerLeftContent}
          </td>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="border:1px solid #000;">Sub Total (${esc(currency)})</td>
          <td class="align-middle" style="border:1px solid #000;">${moneyCellUsd(totals.subTotal)}</td>
        </tr>
        ${tax > 0 ? `
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="border:1px solid #000;">VAT 10% (${esc(currency)})</td>
          <td class="align-middle" style="border:1px solid #000;">${moneyCellUsd(tax)}</td>
        </tr>` : ''}
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="${footerRightSpan > 1 ? footerRightSpan - 1 : 1}" style="border:1px solid #000;">Grand Total (${esc(currency)})</td>
          <td class="align-middle" style="border:1px solid #000;">${moneyCellUsd(totals.grandTotal)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="flex justify-between px-4 pb-8 mx-auto w-full break-inside-avoid" style="margin-top:${signaturePadding}px;">
    <div class="w-[35%] text-center">
      <p class="font-bold text-[11px]" style="margin-bottom:${labelPadding}px;">Ordered By:</p>
      <div class="border-t-2 border-black mb-1"></div>
      <p class="text-[11px]">&nbsp;</p>
    </div>
    <div class="w-[35%] text-center">
      <p class="font-bold text-[11px]" style="margin-bottom:${labelPadding}px;">Received By:</p>
      <div class="border-t-2 border-black mb-1"></div>
      <p class="text-[11px]">&nbsp;</p>
    </div>
  </div>

</div>
</body>
</html>`;
}
