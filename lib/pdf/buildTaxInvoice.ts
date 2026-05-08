/**
 * buildTaxInvoice.ts
 * TAX INVOICE HTML builder — output is structurally identical to the
 * L'IMPERIAL TECHNOLOGY bilingual Khmer/English design template.
 * Uses Tailwind CDN + Koh Santepheap Google Font exactly as in the template.
 */
import { esc, fmtDate, fmtNum, getFontsB64, LOGO, PdfItem, PdfTotals } from './shared';

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildTaxInvoice(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    currency: string,
    sym: string,
    tax: number,
    showVat = true,   // false = Non-VAT Invoice (5-row footer, no VAT TIN)
    signaturePadding = 0, // px — supports negative values to pull sig block up
    labelPadding = 200,   // px — margin-bottom of sig label
): string {
    // ── Derived values ────────────────────────────────────────────────────────
    const fonts = getFontsB64();
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

    // VAT calculations
    const subTotal  = totals.subTotal;
    const vatAmount = showVat ? (tax > 0 ? tax : subTotal * 0.1) : 0;
    const grandUsd  = subTotal + vatAmount;
    const grandRiel = rateNum > 0 ? Math.round(grandUsd * rateNum) : 0;
    // rowspan: Tax Invoice = 7 rows (with deposit) or 5 (without), Non-VAT = 6 (with deposit) or 4 (without)
    // Deposit adds 2 rows: Deposit + Total Less Deposit
    const hasDeposit = deposit > 0;
    const grandUsdAfterDeposit = grandUsd; // Grand Total is always based on subTotal+VAT
    const totalLessDeposit = subTotal - deposit; // balance before VAT
    const footerRows = showVat ? (hasDeposit ? 7 : 5) : (hasDeposit ? 6 : 4);

    // ── Item rows (pad to at least 3) ─────────────────────────────────────────
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
        <tr class="text-center break-inside-avoid">
          <td class="align-top py-2">${esc(item.no)}</td>
          <td class="align-top py-2">${esc(item.itemCode)}</td>
          <td class="text-left font-bold align-top py-2">${esc(item.modelName ?? '')}${item.description ? `<div class="font-normal text-[12px] whitespace-pre-wrap mt-1">${esc(item.description)}</div>` : ''}</td>
          <td class="align-top py-2">${esc(item.qty)}</td>
          <td class="align-top py-2">${priceDisplay}</td>
          <td class="align-top py-2">${amtDisplay}</td>
        </tr>`;
    }).join('');

    // ── Money cell helper ─────────────────────────────────────────────────────
    const moneyCellUsd = (v: number | null) =>
        v !== null && v > 0
            ? `<div class="flex justify-between"><span>${sym}</span><span>${fmtNum(v)}</span></div>`
            : `<div class="flex justify-between"><span>${sym}</span><span>-</span></div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Tax Invoice - LIMPERIAL TECHNOLOGY CO., LTD.</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Koh+Santepheap:wght@400;700&family=Moul&display=swap');
  @font-face {
    font-family: 'KhmerOSBokor';
    src: url('data:font/truetype;base64,${fonts.bokor}') format('truetype');
    font-weight: normal;
  }
  @font-face {
    font-family: 'KhmerOSMuol';
    src: url('data:font/truetype;base64,${fonts.muol}') format('truetype');
    font-weight: normal;
  }
  body {
    font-family: 'Koh Santepheap', sans-serif;
    font-size: 11px;
    color: #000;
  }
  .brand-blue { color: #004aad; }
  .bg-brand-blue { background-color: #004aad; }
  .border-brand-blue { border-color: #004aad; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 8px; }
  .items-table th, .items-table td { border: 1px solid #000 !important; }
  .header-info p { margin-bottom: 2px; }
  .addr-clamp { white-space: normal; word-break: break-word; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; padding: 0 !important; }
    .a4-container { box-shadow: none !important; margin: 0 !important; }
  }
</style>
</head>
<body>

<div style="width:210mm;margin:0 auto;display:flex;flex-direction:column;min-height:267mm;padding: 0 8px;">

  <!-- Header -->
  <header class="mb-6">
    <div class="border-b-[3px] border-brand-blue pb-4 text-center header-info relative pt-12">
      <div class="absolute left-0 top-0">
        <img alt="L'IMPERIAL Logo" class="h-10 w-auto object-contain" src="${LOGO}"/>
      </div>
      <h1 class="text-xl font-bold mb-1" style="font-family:'Moul',serif;">លីមភើរៀលថេកណឡជីឯ.ក</h1>
      <h2 class="text-lg font-bold mb-1" style="font-family:'Times New Roman',serif;">LIMPERIAL TECHNOLOGY CO., LTD.</h2>
      ${showVat ? `<p class="font-bold">លេខអត្តសញ្ញាណកម្មអាករ (VAT TIN) : K003-902201968</p>` : ''}
      <p class="text-[10px]">អាសយដ្ឋាន៖ #B១៥ (ជាន់ផ្ទាល់ដី ជាន់ទី១ ជាន់ទី២ ជាន់ទី៣ និង ជាន់ទី៤) ផ្លូវ អយស្ម័យយានបូព៍ (១៣៩) ភូមិ ១ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</p>
      <p class="text-[10px]">Address: #B15 (Ground Floor 1st Floor 2nd Floor 3rd Floor and 4th Floor), East Railway (139), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</p>
      <p class="text-[10px]">E-mail: info@limperialtech.com || លេខទូរស័ព្ទ (Telephone): +855 92 218 333</p>
    </div>
  </header>

  <!-- Title -->
  <div class="text-center mb-6">
    <h3 class="text-xl font-bold" style="font-family:'Moul',serif;">${showVat ? 'វិក្កយបត្រអាករ' : 'វិក្កយបត្រ'}</h3>
    <h4 class="text-lg font-bold" style="font-family:'Times New Roman',serif;">${showVat ? 'TAX INVOICE' : 'INVOICE'}</h4>
  </div>

  <!-- Customer Info -->
  <div class="flex justify-between gap-0 mb-6">
    <!-- Left Column: Customer Details -->
    <div class="w-[55%]">
      <table class="w-full border-none">
        <tbody class="text-[12px]">
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">អតិថិជន</td>
            <td class="border-none py-1 w-[5%] text-center">:</td>
            <td class="border-none py-1 w-[60%]">${customerKh || customer}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">Customer</td>
            <td class="border-none py-1 w-[5%] text-center">:</td>
            <td class="border-none py-1 w-[60%]">${customer}</td>
          </tr>
          <tr>
            <td class="w-[80px] font-bold border-none py-1 align-top whitespace-nowrap w-[25%]">អាសយដ្ឋាន (Address)</td>
            <td class="border-none py-1 align-top w-[5%] text-center">:</td>
            <td class="border-none py-1" style="min-width:320px;"><div class="addr-clamp">${address}</div></td>
          </tr>
          ${vatTin ? `<tr>
            <td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">លេខអត្តសញ្ញាណកម្ម (VAT TIN)</td>
            <td class="border-none py-1 w-[5%] text-center">:</td>
            <td class="border-none py-1 w-[60%]">${vatTin}</td>
          </tr>` : ''}
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">ទំនាក់ទំនង (Contact Person)</td>
            <td class="border-none py-1 w-[5%] text-center">:</td>
            <td class="border-none py-1 w-[55%] align-middle">${contact}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">លេខទូរស័ព្ទ (Telephone)</td>
            <td class="border-none py-1 w-[5%] text-center">:</td>
            <td class="border-none py-1 w-[55%] align-middle">${phone}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap w-[25%]">អ៊ីម៉ែល (E-mail)</td>
            <td class="border-none py-1 w-[5%] text-center">:</td>
            <td class="border-none py-1 w-[55%]">${email}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- Right Column: Invoice Details -->
    <div class="w-[45%] flex flex-col">
      <table class="w-auto ml-auto border-none table-fixed">
        <tbody class="text-[12px]">
          <tr>
            <td class="w-[150px] font-bold border-none py-1 whitespace-nowrap">លេខរៀងវិក្កយបត្រ (Invoice N&#186;)</td>
            <td class="w-[10px] border-none py-1 text-center">:</td>
            <td class="w-auto border-none py-1 align-middle">${invNo}</td>
          </tr>
          <tr>
            <td class="w-[150px] font-bold border-none py-1 whitespace-nowrap">កាលបរិច្ឆេទ (Date)</td>
            <td class="w-[10px] border-none py-1 text-center">:</td>
            <td class="w-auto border-none py-1 align-middle">${invDate}</td>
          </tr>
          <tr>
            <td class="w-[150px] font-bold border-none py-1 whitespace-nowrap">ថ្ងៃផុតកំណត់ (Due Date)</td>
            <td class="w-[10px] border-none py-1 text-center">:</td>
            <td class="w-auto border-none py-1 align-middle">${dueDate}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Items Table -->
  <div class="flex-grow mb-12">
    <table class="items-table w-full mx-auto">
      <thead>
        <tr class="bg-brand-blue text-white text-center text-[12px]">
          <th class="w-[5%] py-2 whitespace-nowrap leading-tight text-center"><div>ល.រ</div><div>N&#186;</div></th>
          <th class="w-[15%] py-2 whitespace-nowrap leading-tight text-center"><div>លេខសម្គាល់ទំនិញ</div><div>Part Number</div></th>
          <th class="w-[45%] py-2 whitespace-nowrap leading-tight text-center"><div>បរិយាយទំនិញ</div><div>Description</div></th>
          <th class="w-[10%] py-2 whitespace-nowrap leading-tight text-center"><div>បរិមាណ</div><div>Qty</div></th>
          <th class="w-[12%] py-2 whitespace-nowrap leading-tight text-center"><div>តម្លៃឯកតា</div><div>Unit Price</div></th>
          <th class="w-[13%] py-2 whitespace-nowrap leading-tight text-center"><div>តម្លៃទំនិញ</div><div>Amount</div></th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
      <tbody class="break-inside-avoid">
        <tr>
          <td class="align-top p-4" colspan="3" rowspan="${footerRows}" style="border: none !important; border-right: 1px solid #000 !important;">
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
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="2" style="border: 1px solid #000;">សរុប (Sub Total)</td>
          <td class="align-middle" style="border: 1px solid #000;">${moneyCellUsd(subTotal > 0 ? subTotal : null)}</td>
        </tr>
        ${hasDeposit ? `<tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="2" style="border: 1px solid #000;">ប្រាក់កក់ (Deposit)</td>
          <td class="align-middle" style="border: 1px solid #000;">${moneyCellUsd(deposit)}</td>
        </tr>
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="2" style="border: 1px solid #000;">សរុបដកប្រាក់កក់ (Total Less Deposit)</td>
          <td class="align-middle" style="border: 1px solid #000;">${moneyCellUsd(totalLessDeposit > 0 ? totalLessDeposit : null)}</td>
        </tr>` : ''}
        ${showVat ? `<tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="2" style="border: 1px solid #000;">អាករលើតម្លៃបន្ថែម (VAT 10%)</td>
          <td class="align-middle" style="border: 1px solid #000;">${moneyCellUsd(vatAmount > 0 ? vatAmount : null)}</td>
        </tr>` : ''}
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="2" style="border: 1px solid #000;">សរុបរួមជាប្រាក់ដុល្លារ (Grand Total in Dollar)</td>
          <td class="align-middle" style="border: 1px solid #000;">${moneyCellUsd(grandUsd > 0 ? grandUsd : null)}</td>
        </tr>
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="2" style="border: 1px solid #000;">អត្រាប្តូរប្រាក់រៀល (Exchange Rate)</td>
          <td class="text-right pr-2 font-bold align-middle" style="border: 1px solid #000;">${exchangeRate ? `&#x17DB;${esc(String(exchangeRate))}` : '-'}</td>
        </tr>
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="2" style="border: 1px solid #000;">សរុបរួមជាប្រាក់រៀល (Grand Total in Riel)</td>
          <td class="align-middle" style="border: 1px solid #000;">${grandRiel > 0
            ? `<div class="flex justify-between"><span>&#x17DB;</span><span>${fmtNum(grandRiel)}</span></div>`
            : `<div class="flex justify-between"><span>&#x17DB;</span><span>-</span></div>`}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Signatures -->
  <div class="flex justify-between px-4 pb-8 mx-auto w-full break-inside-avoid" style="margin-top:${signaturePadding}px;">
    <div class="w-[35%] text-center">
      <div style="margin-bottom:${labelPadding}px"></div>
      <div class="border-t-2 border-black mb-2"></div>
      <p class="text-[11px] mb-1">ហត្ថលេខា និងឈ្មោះអ្នកទិញ</p>
      <p class="font-bold text-[11px]">Customer's Signature &amp; Name</p>
    </div>
    <div class="w-[35%] text-center">
      <div style="margin-bottom:${labelPadding}px"></div>
      <div class="border-t-2 border-black mb-2"></div>
      ${hd['Prepared By'] ? `<p class="font-bold text-[11px] mb-0.5">${esc(hd['Prepared By'])}</p>` : ''}
      ${hd['Prepared By Position'] ? `<p class="text-[12px] mb-1">${esc(hd['Prepared By Position'])}</p>` : ''}
      <p class="text-[11px] mb-1">ហត្ថលេខា និងឈ្មោះអ្នកលក់</p>
      <p class="font-bold text-[11px]">Seller's Signature &amp; Name</p>
    </div>
  </div>

</div>
</body>
</html>`;
}
