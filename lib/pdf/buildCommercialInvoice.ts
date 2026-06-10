/**
 * buildCommercialInvoice.ts
 * COMMERCIAL INVOICE HTML builder — bilingual Khmer/English design template.
 * Matches commercial_invoice_refined_terms_conditions and commercial_invoice_non_vat_no_vat_tin.
 * Variant: showVatTin controls whether VAT TIN line appears in header + customer info.
 * columnWidths: [no%, code%, desc%, qty%, unitPrice%, amount%]  — 0 = omit column
 */
import { esc, fmtDate, fmtNum, LOGO, PdfItem, PdfTotals } from './shared-pure';

const DEFAULT_WIDTHS = [4, 12, 38, 14, 17, 15];

export function buildCommercialInvoice(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    currency: string,
    sym: string,
    tax: number,
    showVatTin = true,
    signaturePadding = 0,
    labelPadding?: number,
    columnWidths?: number[],
): string {
    const cw = (columnWidths && columnWidths.length === 6) ? columnWidths : DEFAULT_WIDTHS;
    const [wNo, wCode, wDesc, wQty, wPrice, wAmt] = cw;

    const visibleCols = cw.filter(w => w > 0).length;
    const footerLeftSpan = Math.max([wNo, wCode, wDesc].filter(w => w > 0).length, 1);
    const footerRightSpan = visibleCols - footerLeftSpan;
    const footerLabelSpan = footerRightSpan > 1 ? footerRightSpan - 1 : 1;

    // ── Derived values ────────────────────────────────────────────────────────
    const invNo    = esc(hd['Inv No.'] || hd['Inv No'] || hd['Invoice No'] || '');
    const invDate  = esc(fmtDate(hd['Inv Date'] || hd['Invoice Date'] || ''));
    const dueDate  = esc(fmtDate(hd['Due Date'] || ''));
    const customerKh = esc(hd['Company Name (Khmer)'] || '');
    const customer    = esc(hd['Company Name'] || hd['Customer'] || '');
    const address  = esc(hd['Company Address'] || hd['Address'] || '');
    const vatTin   = esc(hd['Tin No.'] || hd['Tin No'] || hd['VAT TIN'] || '');
    const email    = esc(hd['Email'] || '');
    const contact  = esc(hd['Contact Name'] || hd['Contact Person'] || '');
    const phone    = esc(hd['Phone Number'] || hd['Telephone'] || '');

    const deposit      = parseFloat(String(hd['Deposit'] || 0)) || 0;
    const exchangeRate = hd['Exchange Rate'] || hd['ExchangeRate'] || '';
    const rateNum      = parseFloat(String(exchangeRate).replace(/,/g, '')) || 0;

    const subTotal    = totals.subTotal;
    const comSubTotal = subTotal - deposit;
    const grandRiel   = rateNum > 0 ? Math.round(comSubTotal * rateNum) : 0;

    // ── Item rows ─────────────────────────────────────────────────────────────
    const dataItems = items.filter(i => Number(i.no) > 0);

    const itemRows = dataItems.map(item => {
        const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
        const amt   = typeof item.amount    === 'number' ? item.amount    : parseFloat(String(item.amount))    || 0;
        const amtDisplay = amt > 0
            ? `<div class="flex justify-between"><span>${sym}</span><span>${fmtNum(amt)}</span></div>`
            : `<div class="flex justify-between"><span>${sym}</span><span>-</span></div>`;
        const priceDisplay = price > 0
            ? `<div class="flex justify-between"><span>${sym}</span><span>${fmtNum(price)}</span></div>`
            : '';

        return `
        <tr class="h-10 text-center">
          ${wNo>0   ? `<td>${esc(item.no)}</td>` : ''}
          ${wCode>0 ? `<td>${esc(item.itemCode)}</td>` : ''}
          ${wDesc>0 ? `<td class="text-left">${esc(item.modelName ?? '')}${item.description ? `<div class="font-normal text-[12px]">${esc(item.description)}</div>` : ''}</td>` : ''}
          ${wQty>0  ? `<td>${esc(item.qty)}</td>` : ''}
          ${wPrice>0? `<td>${priceDisplay}</td>` : ''}
          ${wAmt>0  ? `<td class="align-top">${amtDisplay}</td>` : ''}
        </tr>`;
    }).join('');

    const hasDeposit = deposit > 0;
    const footerRowspan = hasDeposit ? 6 : 4;
    const grandTotalUsd = hasDeposit ? comSubTotal : subTotal;
    const moneyCell = (s: string, v: number | null) =>
        v !== null && v > 0
            ? `<div class="flex justify-between"><span>${s}</span><span>${fmtNum(v)}</span></div>`
            : `<div class="flex justify-between"><span>${s}</span><span>-</span></div>`;

    const vatTinHeader = showVatTin
        ? `<p class="font-bold">លេខអត្តសញ្ញាណកម្មអាករ (VAT TIN) : K003-902201968</p>`
        : '';
    const vatTinCustomer = showVatTin
        ? `<tr>
             <td class="font-bold border-none py-1 w-[25%] text-[12px] whitespace-nowrap">លេខអត្តសញ្ញាណកម្ម (VAT TIN)</td>
             <td class="border-none py-1 w-[5%] text-center">:</td>
             <td class="border-none py-1 w-[55%]">${vatTin}</td>
           </tr>`
        : '';

    // Footer right-side rows (shared between VAT / non-VAT branches)
    const footerRows = `
        ${hasDeposit ? `<tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right pr-2" colspan="${footerLabelSpan}">ប្រាក់កក់ (Deposit)</td>
          <td class="text-right pr-2 font-bold">${sym}${fmtNum(deposit)}</td>
        </tr>
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right pr-2" colspan="${footerLabelSpan}">សរុបដកប្រាក់កក់ (Total Less Deposit)</td>
          <td class="text-right pr-2 font-bold">${comSubTotal > 0 ? `${sym}${fmtNum(comSubTotal)}` : '-'}</td>
        </tr>` : ''}
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right pr-2" colspan="${footerLabelSpan}">សរុបរួមជាប្រាក់ដុល្លារ (Grand Total in Dollar)</td>
          <td class="text-right pr-2 font-bold">${sym}${fmtNum(grandTotalUsd)}</td>
        </tr>
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right pr-2" colspan="${footerLabelSpan}">អត្រាប្តូរប្រាក់ (Exchange Rate)</td>
          <td class="text-right pr-2 font-bold">${exchangeRate ? `៛${esc(String(exchangeRate))}` : '-'}</td>
        </tr>
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right pr-2" colspan="${footerLabelSpan}">សរុបរួមជាប្រាក់រៀល (Grand Total in Riel)</td>
          <td class="text-right pr-2 font-bold bg-white">${grandRiel > 0 ? `៛${fmtNum(grandRiel)}` : '-'}</td>
        </tr>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Commercial Invoice - LIMPERIAL TECHNOLOGY CO., LTD.</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Koh+Santepheap:wght@400;700&family=Moul&display=swap');
  body { font-family: 'Koh Santepheap', sans-serif; font-size: 11px; color: #000; }
  .brand-blue { color: #004aad; }
  .bg-brand-blue { background-color: #004aad; }
  .border-brand-blue { border-color: #004aad; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 8px; }
  table.items-table th, table.items-table td { border: 1px solid #000 !important; padding: 4px 8px; }
  .items-table thead { break-after: avoid; page-break-after: avoid; }
  .items-table tbody tr:first-child { break-before: avoid; page-break-before: avoid; }
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
      ${vatTinHeader}
      <p class="text-[10px]">អាសយដ្ឋាន៖ #B១៥ (ជាន់ផ្ទាល់ដី ជាន់ទី១ ជាន់ទី២ ជាន់ទី៣ និង ជាន់ទី៤) ផ្លូវ អយស្ម័យយានបូព៍ (១៣៩) ភូមិ ១ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</p>
      <p class="text-[10px]">Address: #B15 (Ground Floor 1st Floor 2nd Floor 3rd Floor and 4th Floor), East Railway (139), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</p>
      <p class="text-[10px]">E-mail: info@limperialtech.com || លេខទូរស័ព្ទ (Telephone): +855 92 218 333</p>
    </div>
  </header>

  <div class="text-center mb-6">
    <h3 class="text-xl font-bold" style="font-family:'Moul',serif;">វិក្កយបត្រ</h3>
    <h4 class="text-lg font-bold" style="font-family:'Times New Roman',serif;">COMMERCIAL INVOICE</h4>
  </div>

  <div class="flex justify-between gap-0 mb-6">
    <div class="w-[55%]">
      <table class="w-full border-none">
        <tbody class="text-[12px]">
          <tr>
            <td class="font-bold border-none py-1 w-[25%] whitespace-nowrap">អតិថិជន</td>
            <td class="border-none py-1 w-[5%] text-center">:</td>
            <td class="border-none py-1 w-[60%]">${customerKh || customer}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 w-[25%] whitespace-nowrap">Customer</td>
            <td class="border-none py-1 w-[5%] text-center">:</td>
            <td class="border-none py-1 w-[60%]">${customer}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 align-top w-[25%] whitespace-nowrap">អាសយដ្ឋាន (Address)</td>
            <td class="border-none py-1 align-top w-[5%] text-center">:</td>
            <td class="border-none py-1" style="min-width:320px;"><div class="addr-clamp">${address}</div></td>
          </tr>
          ${vatTinCustomer}
          <tr>
            <td class="font-bold border-none py-1 w-[25%] whitespace-nowrap">ទំនាក់ទំនង (Contact Person)</td>
            <td class="border-none py-1 w-[5%] text-center">:</td>
            <td class="border-none py-1 w-[60%]">${contact}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 w-[25%] whitespace-nowrap">លេខទូរស័ព្ទ (Telephone)</td>
            <td class="border-none py-1 w-[5%] text-center">:</td>
            <td class="border-none py-1 w-[60%]">${phone}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 w-[25%] whitespace-nowrap">អ៊ីម៉ែល (E-mail)</td>
            <td class="border-none py-1 w-[5%] text-center">:</td>
            <td class="border-none py-1 w-[60%]">${email}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="w-[45%]">
      <table class="w-auto ml-auto border-none table-fixed">
        <tbody class="text-[12px]">
          <tr>
            <td class="w-[150px] font-bold border-none py-1 whitespace-nowrap">លេខរៀងវិក្កយបត្រ (Invoice N&#186;)</td>
            <td class="w-[10px] border-none py-1 text-center">:</td>
            <td class="w-auto border-none py-1">${invNo}</td>
          </tr>
          <tr>
            <td class="w-[150px] font-bold border-none py-1 whitespace-nowrap">កាលបរិច្ឆេទ (Date)</td>
            <td class="w-[10px] border-none py-1 text-center">:</td>
            <td class="w-auto border-none py-1">${invDate}</td>
          </tr>
          <tr>
            <td class="w-[150px] font-bold border-none py-1 whitespace-nowrap">ថ្ងៃផុតកំណត់ (Due Date)</td>
            <td class="w-[10px] border-none py-1 text-center">:</td>
            <td class="w-auto border-none py-1">${dueDate}</td>
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
        <tr class="bg-brand-blue text-white text-center text-[10px]">
          ${wNo>0   ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>ល.រ</div><div>N&#186;</div></th>` : ''}
          ${wCode>0 ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>លេខកូដទំនិញ</div><div>Part Number</div></th>` : ''}
          ${wDesc>0 ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>បរិយាយទំនិញ</div><div>Description</div></th>` : ''}
          ${wQty>0  ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>បរិមាណ</div><div>Quantity</div></th>` : ''}
          ${wPrice>0? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>តម្លៃឯកតា</div><div>Unit Price</div></th>` : ''}
          ${wAmt>0  ? `<th class="py-2 whitespace-nowrap leading-tight text-center"><div>តម្លៃសរុប</div><div>Amount</div></th>` : ''}
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr>
          <td class="align-top p-4" colspan="${footerLeftSpan}" rowspan="${footerRowspan}" style="border:none !important; border-top:1px solid #000 !important; border-left-style:hidden !important;">
            <div class="w-full text-[10px] space-y-4">
              <div>
                <h4 class="font-bold text-[11px] underline uppercase mb-1">Term Condition:</h4>
                <ul class="list-disc list-inside space-y-0.5">
                  <li><span class="font-bold">Payment Terms:</span> Full payment is required as per the agreed terms. Late payments may result in order suspension.</li>
                  <li><span class="font-bold">Goods Sold:</span> All goods sold are non-refundable and exchangeable. Please inspect all goods carefully before signing.</li>
                  <li><span class="font-bold">Warranty:</span> All goods sold are covered under Limperial Technology&apos;s warranty policy. Warranty does not cover unauthorized repairs or broken seals.</li>
                </ul>
              </div>
              <div>
                <h4 class="font-bold text-[11px] underline uppercase mb-1">Payment Information:</h4>
                <p><span class="font-bold">Bank:</span> Advanced Bank of Asia Ltd (ABA Bank)</p>
                <p><span class="font-bold">Account Name:</span> LIMPERIAL TECHNOLOGY CO., LTD.</p>
                <p><span class="font-bold">Account Number:</span> 003 916 564</p>
              </div>
            </div>
          </td>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right pr-2" colspan="${footerLabelSpan}">សរុប (Sub Total)</td>
          <td class="text-right pr-2 font-bold">${sym}${fmtNum(subTotal)}</td>
        </tr>
        ${footerRows}
      </tbody>
    </table>
  </div>

  <div class="flex justify-between px-16 pb-8 w-full break-inside-avoid" style="margin-top:${signaturePadding}px;">
    <div class="w-[35%] text-center">
      <div style="margin-bottom:${labelPadding ?? 200}px"></div>
      <div class="border-t-2 border-black mb-4"></div>
      <div class="text-[11px] leading-tight">
        ${hd['Prepared By'] ? `<div class="font-bold">${esc(hd['Prepared By'])}</div>` : ''}
        ${hd['Prepared By Position'] ? `<div class="text-[12px]">${esc(hd['Prepared By Position'])}</div>` : ''}
        <div>ហត្ថលេខា និងឈ្មោះអ្នកលក់</div>
        <div class="font-normal">Seller's Signature &amp; Name</div>
      </div>
    </div>
    <div class="w-[35%] text-center">
      <div style="margin-bottom:${labelPadding ?? 200}px"></div>
      <div class="border-t-2 border-black mb-4"></div>
      <div class="text-[11px] leading-tight">
        <div>ហត្ថលេខា និងឈ្មោះអ្នកទិញ</div>
        <div class="font-normal">Customer's Signature &amp; Name</div>
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}
