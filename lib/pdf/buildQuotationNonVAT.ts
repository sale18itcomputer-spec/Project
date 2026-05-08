/**
 * buildQuotationNonVAT.ts
 * QUOTATION PDF builder — bilingual Khmer/English, Non-VAT version.
 * Fonts, sizing, colours, layout, terms, signatures aligned to buildTaxInvoice.ts.
 */
import { esc, fmtDate, fmtNum, LOGO, PdfItem, PdfTotals } from './shared';

export function buildQuotationNonVAT(
    hd: Record<string, any>,
    items: PdfItem[],
    totals: PdfTotals,
    currency: string,
    sym: string,
    signaturePadding = 0, // px — supports negative values
    labelPadding = 200,
): string {
    // ── Derived values ────────────────────────────────────────────────────────
    const quoteNo   = esc(hd['Quotation ID'] || hd['Quote No'] || hd['Quotation No'] || '');
    const quoteDate = esc(fmtDate(hd['Quote Date'] || hd['Quotation Date'] || ''));
    const validity  = esc(fmtDate(hd['Validity Date'] || hd['Validity'] || ''));
    const status    = esc(hd['Stock Status'] || hd['Status'] || '');
    const payTerm   = esc(hd['Payment Term'] || '');
    const customer  = esc(hd['Company Name'] || hd['Customer'] || '');
    const address   = esc(hd['Company Address'] || hd['Address'] || '');
    const contact   = esc(hd['Contact Person'] || hd['Contact Name'] || '');
    const phone     = esc(hd['Contact Tel'] || hd['Phone Number'] || hd['Telephone'] || '');
    const email     = esc(hd['Contact Email'] || hd['Email'] || '');

    const subTotal = totals.subTotal;
    const grandUsd = subTotal; // No VAT for Non-VAT

    // ── Item rows (pad to at least 3) ─────────────────────────────────────────
    const dataItems = items.filter(i => Number(i.no) > 0);

    const makeItemRow = (item: typeof dataItems[0]) => {
        const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
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
              <td class="align-top py-2">${esc(item.no)}</td>
              <td class="align-top py-2">${esc(item.itemCode)}</td>
              <td class="text-left font-bold align-top py-2">${esc(item.modelName ?? '')}</td>
              <td class="align-top py-2">${esc(item.qty)}</td>
              <td class="align-top py-2">${priceDisplay}</td>
              <td class="align-top py-2">${amtDisplay}</td>
            </tr>`;
        }

        const descLines = item.description.split('\n');
        let rows = ``;

        rows += `
            <tr class="text-center break-inside-avoid">
              <td class="align-top py-2" style="border-bottom:none !important;">${esc(item.no)}</td>
              <td class="align-top py-2" style="border-bottom:none !important;">${esc(item.itemCode)}</td>
              <td class="text-left font-bold align-top py-2" style="border-bottom:none !important;">${esc(item.modelName ?? '')}</td>
              <td class="align-top py-2" style="border-bottom:none !important;">${esc(item.qty)}</td>
              <td class="align-top py-2" style="border-bottom:none !important;">${priceDisplay}</td>
              <td class="align-top py-2" style="border-bottom:none !important;">${amtDisplay}</td>
            </tr>`;

        descLines.forEach((line, idx) => {
            const isLast = idx === descLines.length - 1;
            const tdStyle = isLast ? 'border-top:none !important;' : 'border-bottom:none !important; border-top:none !important;';
            const padStyle = isLast ? 'padding-bottom: 8px;' : 'padding-bottom: 0;';
            rows += `
            <tr class="text-center break-inside-avoid">
              <td class="align-top py-0" style="${tdStyle}"></td>
              <td class="align-top py-0" style="${tdStyle}"></td>
              <td class="text-left font-normal text-[12px] align-top whitespace-pre-wrap" style="${tdStyle} padding-top: 2px; ${padStyle}">${esc(line)}</td>
              <td class="align-top py-0" style="${tdStyle}"></td>
              <td class="align-top py-0" style="${tdStyle}"></td>
              <td class="align-top py-0" style="${tdStyle}"></td>
            </tr>`;
        });
        
        return rows;
    };

    const itemRows = dataItems.map(makeItemRow).join('');

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
  <!-- Header -->
  <header class="mb-6">
    <div class="border-b-[3px] border-brand-blue pb-4 text-center header-info relative pt-12">
      <div class="absolute left-0 top-0">
        <img alt="L'IMPERIAL Logo" class="h-10 w-auto object-contain" src="${LOGO}"/>
      </div>
      <h1 class="text-xl font-bold mb-1" style="font-family:'Moul',serif;">លីមភើរៀលថេកណឡជីឯ.ក</h1>
      <h2 class="text-lg font-bold mb-1" style="font-family:'Times New Roman',serif;">LIMPERIAL TECHNOLOGY CO., LTD.</h2>
      <p class="text-[10px]">អាសយដ្ឋាន៖ #B១៥ (ជាន់ផ្ទាល់ដី ជាន់ទី១ ជាន់ទី២ ជាន់ទី៣ និង ជាន់ទី៤) ផ្លូវ អយស្ម័យយានបូព៍ (១៣៩) ភូមិ ១ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</p>
      <p class="text-[10px]">Address: #B15 (Ground Floor 1st Floor 2nd Floor 3rd Floor and 4th Floor), East Railway (139), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</p>
      <p class="text-[10px]">E-mail: info@limperialtech.com || លេខទូរស័ព្ទ (Telephone): +855 92 218 333</p>
    </div>
  </header>

  <!-- Title -->
  <div class="text-center mb-6">
    <h3 class="text-xl font-bold" style="font-family:'Moul',serif;">សម្រង់តម្លៃ</h3>
    <h4 class="text-lg font-bold">QUOTATION</h4>
  </div>

  <!-- Customer / Quotation Info -->
  <div class="flex justify-between gap-0 mb-6">
    <!-- Left: Customer Details -->
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
    <!-- Right: Quotation Details -->
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
  </div><!-- end no-break -->

  <!-- Items Table -->
  <div class="mb-4">
    <table class="items-table w-full mx-auto" style="table-layout:fixed;">
      <colgroup>
        <col style="width:4%"/>
        <col style="width:16%"/>
        <col style="width:33%"/>
        <col style="width:12%"/>
        <col style="width:16%"/>
        <col style="width:19%"/>
      </colgroup>
      <thead>
        <tr class="bg-brand-blue text-white text-center text-[12px]">
          <th class="w-[4%] py-2 whitespace-nowrap leading-tight text-center"><div>ល.រ</div><div>N&#176;</div></th>
          <th class="w-[16%] py-2 whitespace-nowrap leading-tight text-center"><div>លេខកូដទំនិញ</div><div>Part Number</div></th>
          <th class="w-[33%] py-2 whitespace-nowrap leading-tight text-center"><div>បរិយាយទំនិញ</div><div>Description</div></th>
          <th class="w-[12%] py-2 whitespace-nowrap leading-tight text-center"><div>បរិមាណ</div><div>Quantity</div></th>
          <th class="w-[16%] py-2 whitespace-nowrap leading-tight text-center"><div>តម្លៃឯកតា</div><div>Unit Price</div></th>
          <th class="w-[19%] py-2 whitespace-nowrap leading-tight text-center"><div>តម្លៃសរុប</div><div>Amount</div></th>
        </tr>
      </thead>
      <tfoot style="display: table-footer-group;">
        <tr><td colspan="6" style="padding:0 !important; border:none !important; border-top:1px solid #000 !important; height:0;"></td></tr>
      </tfoot>
      <tbody>
        ${itemRows}
      </tbody>
      <tbody class="break-inside-avoid">
        <tr>
          <td class="align-top p-4" colspan="3" rowspan="2" style="border:none;">
            <div class="w-full text-[10px] space-y-4">
              <div>
                <h4 class="font-bold text-[11px] underline uppercase mb-1">Terms &amp; Conditions:</h4>
                <ul class="list-disc list-inside space-y-0.5">
                  <li><span class="font-bold">Payment Terms:</span> Full payment is required as per the agreed terms. Late payments may result in order suspension.</li>
                  <li><span class="font-bold">Goods Sold:</span> All goods sold are non-refundable and exchangeable. Please inspect all goods carefully before signing.</li>
                  <li><span class="font-bold">Warranty:</span> All goods sold are covered under Limperial Technology's warranty policy. Warranty does not cover unauthorized repairs or broken seals.</li>
                </ul>
              </div>

            </div>
          </td>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="2" style="width: 22%; border:1px solid #000;">Sub Total</td>
          <td class="align-middle" style="width: 13%; border:1px solid #000;">${moneyCellUsd(subTotal > 0 ? subTotal : null)}</td>
        </tr>
        <tr>
          <td class="font-bold whitespace-nowrap text-[12px] py-1.5 leading-tight text-right" colspan="2" style="border:1px solid #000;">Grand Total in Dollar</td>
          <td class="align-middle" style="border:1px solid #000;">${moneyCellUsd(grandUsd > 0 ? grandUsd : null)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Signatures -->
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
