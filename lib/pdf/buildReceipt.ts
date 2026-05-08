/**
 * buildReceipt.ts
 * OFFICIAL RECEIPT PDF builder — bilingual title (Khmer + English).
 * Font sizes and structure aligned with buildQuotationVAT / buildTaxInvoice / buildDeliveryNote.
 */
import { esc, fmtDate, fmtNum, LOGO, PdfItem, PdfTotals } from './shared';

// ── Amount-in-words (USD) ─────────────────────────────────────────────────────
const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function wordsUnder1000(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + wordsUnder1000(n % 100) : '');
}

function amountInWords(amount: number): string {
    const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (isNaN(num) || num < 0) return '';
    const dollars = Math.floor(num);
    const cents = Math.round((num - dollars) * 100);

    function toWords(n: number): string {
        if (n === 0) return 'Zero';
        let result = '';
        if (n >= 1000000) {
            result += wordsUnder1000(Math.floor(n / 1000000)) + ' Million';
            n %= 1000000;
            if (n > 0) result += ' ';
        }
        if (n >= 1000) {
            result += wordsUnder1000(Math.floor(n / 1000)) + ' Thousand';
            n %= 1000;
            if (n > 0) result += ' ';
        }
        if (n > 0) result += wordsUnder1000(n);
        return result;
    }

    const dollarWord = toWords(dollars);
    const dollarPart = `${dollarWord} Dollar${dollars !== 1 ? 's' : ''}`;
    if (cents === 0) return dollarPart + ' Only';
    const centPart = `${wordsUnder1000(cents)} Cent${cents !== 1 ? 's' : ''}`;
    return `${dollarPart} and ${centPart} Only`;
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildReceipt(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    currency: string,
    sym: string,
    signaturePadding = 0,
    labelPadding = 200,
): string {
    const rvNo      = esc(hd['RV No'] || hd['Receipt No'] || '');
    const rvDate    = esc(fmtDate(hd['RV Date'] || hd['Receipt Date'] || ''));
    const customer  = esc(hd['Company Name'] || hd['Customer'] || '');
    const address   = esc(hd['Company Address'] || hd['Address'] || '');
    const vatTin    = esc(hd['Tin No'] || hd['Tin No.'] || hd['VAT TIN'] || '');
    const contact   = esc(hd['Contact Name'] || hd['Contact Person'] || '');
    const phone     = esc(hd['Phone Number'] || hd['Telephone'] || '');
    const email     = esc(hd['Email'] || '');
    const payMethod = String(hd['Payment Method'] || '');

    const grandTotal = parseFloat(String(totals.grandTotal || totals.subTotal)) || 0;
    const words = currency === 'USD' ? amountInWords(grandTotal) : '';

    // ── Payment method checkboxes ─────────────────────────────────────────────
    // Match: Cash / Bank Transfer / Check
    const pmOptions = ['Cash', 'Bank Transfer', 'Check'];
    const checkboxes = pmOptions.map(opt => {
        const checked = payMethod.toLowerCase().includes(opt.toLowerCase());
        const box = checked
            ? `<span class="inline-block w-3 h-3 border border-black text-center leading-3 text-[10px]">&#10003;</span>`
            : `<span class="inline-block w-3 h-3 border border-black"></span>`;
        return `<div class="flex items-center gap-1.5 mb-1">${box}<span>${esc(opt)}</span></div>`;
    }).join('');

    // ── Item rows ─────────────────────────────────────────────────────────────
    const dataItems = items.filter(i => Number(i.no) > 0);

    const itemRows = dataItems.map((item) => {
        const amt   = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0;
        const ref   = esc(item.itemCode || '');
        const isReal = !!(item.modelName || item.description || item.itemCode);
        const desc  = item.modelName
            ? (item.description
                ? `<span class="font-bold">${esc(item.modelName)}</span><div class="font-normal text-[10px] whitespace-pre-wrap mt-1">${esc(item.description)}</div>`
                : `<span class="font-bold">${esc(item.modelName)}</span>`)
            : esc(item.description || '');

        return `<tr class="text-center">
          <td class="align-top">${isReal ? esc(item.no) : ''}</td>
          <td class="align-top text-left">${ref}</td>
          <td class="align-top text-left">${desc}</td>
          <td class="align-top">
            ${isReal && amt !== 0
                ? `<div class="flex justify-between whitespace-nowrap"><span>${sym}</span><span>${fmtNum(amt)}</span></div>`
                : ''}
          </td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Official Receipt - LIMPERIAL TECHNOLOGY CO., LTD.</title>
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
  .header-info p { margin-bottom: 2px; }
  .addr-clamp { white-space: normal; word-break: break-word; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; padding: 0 !important; }
  }
</style>
</head>
<body>

<div style="width:210mm;margin:0 auto;display:flex;flex-direction:column;min-height:267mm;padding:0 8px;">

  <!-- ── Header ── -->
  <header class="mb-6">
    <div class="border-b-[3px] border-brand-blue pb-4 text-center header-info relative pt-12">
      <div class="absolute left-0 top-0">
        <img src="${LOGO}" alt="Logo" class="h-10 w-auto object-contain"/>
      </div>
      <h1 class="text-xl font-bold mb-1" style="font-family:'Moul',serif;">លីមភើរៀលថេកណឡជីឯ.ក</h1>
      <h2 class="text-lg font-bold mb-1" style="font-family:'Times New Roman',serif;">LIMPERIAL TECHNOLOGY CO., LTD.</h2>
      <p class="font-bold">លេខអត្តសញ្ញាណកម្មអាករ (VAT TIN) : K003-902201968</p>
      <p class="text-[10px]">អាសយដ្ឋាន៖ #B១៥ (ជាន់ផ្ទាល់ដី ជាន់ទី១ ជាន់ទី២ ជាន់ទី៣ និង ជាន់ទី៤) ផ្លូវ អយស្ម័យយានបូព៍ (១៣៩) ភូមិ ១ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</p>
      <p class="text-[10px]">Address: #B15 (Ground Floor 1st Floor 2nd Floor 3rd Floor and 4th Floor), East Railway (139), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</p>
      <p class="text-[10px]">E-mail: info@limperialtech.com || លេខទូរស័ព្ទ (Telephone): +855 92 218 333</p>
    </div>
  </header>

  <!-- ── Document Title ── -->
  <div class="text-center mb-6">
    <h3 class="text-xl font-bold" style="font-family:'Moul',serif;">ប័ណ្ណទទួលប្រាក់</h3>
    <h4 class="text-lg font-bold">OFFICIAL RECEIPT</h4>
  </div>

  <!-- ── Customer Info + Doc Info ── -->
  <div class="flex justify-between gap-0 mb-6">

    <!-- Left: Customer Details -->
    <div class="w-[62%]">
      <table class="w-full border-none">
        <tbody class="text-[10px]">
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">Customer</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
            <td class="border-none py-1 font-bold">${customer}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;vertical-align:top;">Address</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;vertical-align:top;">:</td>
            <td class="border-none py-1" style="min-width:260px;"><div class="addr-clamp">${address}</div></td>
          </tr>
          ${vatTin ? `<tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">VAT TIN</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
            <td class="border-none py-1">${vatTin}</td>
          </tr>` : ''}
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

    <!-- Right: Receipt No / Date / Payment Method -->
    <div class="w-[38%] flex flex-col">
      <table class="w-auto ml-auto border-none table-fixed">
        <tbody class="text-[10px]">
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;">Receipt N&#186;</td>
            <td class="border-none py-1 text-center" style="width:10px;">:</td>
            <td class="border-none py-1 align-middle">${rvNo}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap">Date</td>
            <td class="border-none py-1 text-center">:</td>
            <td class="border-none py-1 align-middle">${rvDate}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap align-top" style="padding-top:6px;">Payment Method</td>
            <td class="border-none py-1 text-center align-top" style="padding-top:6px;">:</td>
            <td class="border-none py-1 text-[10px]" style="padding-top:6px;">
              ${checkboxes}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── Items Table ── -->
  <div class="flex-grow mb-12">
    <table class="items-table w-full mx-auto">
      <colgroup>
        <col style="width:5%;"/>
        <col style="width:16%;"/>
        <col style="width:64%;"/>
        <col style="width:15%;"/>
      </colgroup>
      <thead>
        <tr class="bg-brand-blue text-white text-center text-[10px]">
          <th class="py-2 whitespace-nowrap leading-tight text-center"><div>ល.រ</div><div>N&#186;</div></th>
          <th class="py-2 whitespace-nowrap leading-tight text-center"><div>យោង</div><div>Reference</div></th>
          <th class="py-2 whitespace-nowrap leading-tight text-center"><div>បរិយាយទំនិញ</div><div>Description</div></th>
          <th class="py-2 whitespace-nowrap leading-tight text-center"><div>ចំនួនទឹកប្រាក់</div><div>Amount</div></th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" class="font-bold whitespace-nowrap text-[10px] py-2 leading-tight text-right" style="border:1px solid #000;">
            សរុបរួម/Total Amount
          </td>
          <td class="text-[10px] py-2 align-middle" style="border:1px solid #000;">
            <span class="font-bold">Amount In word:</span>
            <span class="italic"> ${esc(words)}</span>
          </td>
          <td class="align-middle" style="border:1px solid #000;">
            <div class="flex justify-between whitespace-nowrap font-bold">
              <span>${sym}</span><span>${fmtNum(grandTotal)}</span>
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- ── Signature Block ── -->
  <div class="flex justify-between px-4 pb-8 mx-auto w-full break-inside-avoid" style="margin-top:${signaturePadding}px;">
    <div class="w-[35%] text-center">
      <p class="font-bold text-[11px]" style="margin-bottom:${labelPadding}px;">Payment By:</p>
      <div class="border-t-2 border-black mb-1"></div>
    </div>
    <div class="w-[35%] text-center">
      <p class="font-bold text-[11px]" style="margin-bottom:${labelPadding}px;">Received By:</p>
      <div class="border-t-2 border-black mb-1"></div>
      ${hd['Prepared By'] ? `<p class="font-bold text-[11px]">${esc(hd['Prepared By'])}</p>` : ''}
      ${hd['Prepared By Position'] ? `<p class="text-[10px]">${esc(hd['Prepared By Position'])}</p>` : ''}
    </div>
  </div>

</div>
</body>
</html>`;
}
