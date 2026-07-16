/**
 * buildDeliveryNote.ts
 * DELIVERY NOTE HTML builder — bilingual Khmer/English design template.
 * Delivery Note uses a 5-column layout: No | Part Number | Description | Qty | Serial Number
 * columnWidths param is accepted for API consistency; DO has its own 5-col schema (no price/amount).
 */
import { esc, fmtDate, LOGO, PdfItem } from './shared-pure';

export function buildDeliveryNote(
    hd: Record<string, any>,
    items: PdfItem[],
    showVat = true,
    signaturePadding = 160,
    labelPadding?: number,
    columnWidths?: number[], // accepted for API consistency; DO schema is fixed 5-col
): string {
    // The "Delivery Nº" field is this document's OWN number — must prefer DO No
    // over the linked invoice's number, which is a different document entirely.
    const doNo      = esc(hd['DO No'] || hd['Delivery No'] || hd['Inv No.'] || hd['Inv No'] || '');
    const doDate    = esc(fmtDate(hd['DO Date'] || hd['Delivery Date'] || hd['Inv Date'] || hd['Invoice Date'] || ''));
    // Cross-reference the linked invoice separately — only when the DO actually
    // has its own number AND a linked invoice, so a DO with no invoice yet
    // doesn't print a blank "Invoice Nº" row.
    const linkedInvNo = esc(hd['Inv No.'] || hd['Inv No'] || '');
    const invNoRow = (hd['DO No'] || hd['Delivery No']) && linkedInvNo
        ? `<tr>
             <td class="font-bold border-none py-1 whitespace-nowrap" style="width:90px;">Invoice N&#186;</td>
             <td class="border-none py-1 text-center" style="width:10px;">:</td>
             <td class="border-none py-1 align-middle">${linkedInvNo}</td>
           </tr>`
        : '';
    const customer  = esc(hd['Company Name'] || hd['Customer'] || '');
    const address   = esc(hd['Company Address'] || hd['Address'] || '');
    const contact   = esc(hd['Contact Name'] || hd['Contact Person'] || '');
    const phone     = esc(hd['Phone Number'] || hd['Telephone'] || '');
    const email     = esc(hd['Email'] || '');
    const vatTin    = esc(hd['Tin No.'] || hd['Tin No'] || hd['VAT TIN'] || '');

    const vatTinRow = vatTin
        ? `<tr>
             <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">VAT TIN</td>
             <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
             <td class="border-none py-1 font-bold">${vatTin}</td>
           </tr>`
        : '';

    const dataItems = items.filter(i => Number(i.no) > 0);

    const itemRows = dataItems.map(item => {
        const sns = (item.serialNumbers && item.serialNumbers.length > 0)
            ? item.serialNumbers
            : item.serialNumber ? [item.serialNumber] : [];
        const snCell = sns.filter(s => s.trim()).length > 0
            ? sns.filter(s => s.trim()).map(s => `<div style="line-height:1.6;">${esc(s)}</div>`).join('')
            : '';

        // PC Build: sold as one priced line (no price shown on a DO anyway),
        // but the delivery note must list each real part being handed over —
        // one row per component with its own item code, qty, and serial.
        if (item.isPCBuild && item.buildComponents && item.buildComponents.length > 0) {
            let rows = `
        <tr class="text-center">
          <td style="vertical-align:top;padding-top:6px;border-bottom:none !important;">${esc(item.no)}</td>
          <td style="vertical-align:top;padding-top:6px;border-bottom:none !important;">${esc(item.itemCode)}</td>
          <td class="text-left" style="vertical-align:top;padding-top:6px;border-bottom:none !important;">${esc(item.modelName ?? '')}</td>
          <td style="vertical-align:top;padding-top:6px;border-bottom:none !important;">${esc(item.qty)}</td>
          <td style="vertical-align:top;padding-top:6px;border-bottom:none !important;"></td>
        </tr>`;
            const comps = item.buildComponents;
            comps.forEach((c, idx) => {
                const isLast = idx === comps.length - 1;
                const borderStyle = isLast ? 'border-top:none !important;' : 'border-top:none !important; border-bottom:none !important;';
                const padStyle = isLast ? 'padding-bottom:6px;' : 'padding-bottom:0;';
                const warranty = c.warrantyMonths ? `<div style="font-size:9px;color:#666;">${c.warrantyMonths} months warranty</div>` : '';
                rows += `
        <tr class="text-center">
          <td style="${borderStyle}"></td>
          <td class="text-[11px]" style="vertical-align:top;padding-top:2px;${padStyle}${borderStyle}">${esc(c.itemCode)}</td>
          <td class="text-left text-[11px]" style="vertical-align:top;padding-top:2px;${padStyle}${borderStyle}">${esc(c.modelName)}${warranty}</td>
          <td class="text-[11px]" style="vertical-align:top;padding-top:2px;${padStyle}${borderStyle}">${esc(c.qty)}</td>
          <td class="text-left" style="font-size:9px;vertical-align:top;padding-top:2px;line-height:1.6;${padStyle}${borderStyle}">${esc(c.serialNumber ?? '')}</td>
        </tr>`;
            });
            return rows;
        }

        return `
        <tr class="text-center">
          <td style="vertical-align:top;padding-top:6px;">${esc(item.no)}</td>
          <td style="vertical-align:top;padding-top:6px;">${esc(item.itemCode)}</td>
          <td class="text-left" style="vertical-align:top;padding-top:6px;">${esc(item.modelName ?? '')}${item.description ? `<div class="font-normal text-[12px]">${esc(item.description)}</div>` : ''}</td>
          <td style="vertical-align:top;padding-top:6px;">${esc(item.qty)}</td>
          <td class="text-left" style="font-size:9px;vertical-align:top;padding-top:6px;line-height:1.6;">${snCell}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Delivery Note - LIMPERIAL TECHNOLOGY CO., LTD.</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Koh+Santepheap:wght@400;700&family=Moul&display=swap');
  body { font-family: 'Koh Santepheap', sans-serif; font-size: 11px; color: #000; }
  .brand-blue { color: #004aad; }
  .bg-brand-blue { background-color: #004aad; }
  .border-brand-blue { border-color: #004aad; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 8px; }
  table.items-table th, table.items-table td { border: 1px solid #000; padding: 4px 8px; }
  table.items-table td { overflow-wrap: anywhere; word-break: break-word; }
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
  ${showVat ? `<header class="mb-6">
    <div class="border-b-[3px] border-brand-blue pb-4 text-center header-info relative pt-12">
      <div class="absolute left-0 top-0">
        <img alt="L'IMPERIAL Logo" class="h-10 w-auto object-contain" src="${LOGO}"/>
      </div>
      <h1 class="text-xl font-bold mb-1" style="font-family:'Moul',serif;">លីមភើរៀលថេកណឡជីឯ.ក</h1>
      <h2 class="text-lg font-bold mb-1" style="font-family:'Times New Roman',serif;">LIMPERIAL TECHNOLOGY CO., LTD.</h2>
      <p class="font-bold">លេខអត្តសញ្ញាណកម្មអាករ (VAT TIN) : K003-902201968</p>
      <p class="text-[10px]">អាសយដ្ឋាន៖ #B១៥ (ជាន់ផ្ទាល់ដី ជាន់ទី ១ ជាន់ទី ២ ជាន់ទី ៣ និង ជាន់ទី ៤) ផ្លូវ អយស្ម័យយានបូព៌ (១៣៩), ភូមិ១ សង្កាត់ ស្រះចក ខណ្ឌ ដូនពេញ រាជធានីភ្នំពេញ</p>
      <p class="text-[10px]">Address: #B15 ( Ground Floor 1st Floor 2nd Floor 3rd Floor and 4th Floor ), East Railway ( 139), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</p>
      <p class="text-[10px]">E-mail: info@limperialtech.com || ទូរស័ព្ទ (Telephone): +855 92 218 333</p>
    </div>
  </header>` : ''}

  <div class="text-center mb-6${showVat ? '' : ' pt-6'}">
    <h3 class="text-xl font-bold" style="font-family:'Moul',serif;">លិខិតប្រគល់ទំនិញ</h3>
    <h4 class="text-lg font-bold uppercase">Delivery Note</h4>
  </div>

  <div class="flex justify-between gap-0 mb-6">
    <div class="w-[62%]">
      <table class="w-full border-none">
        <tbody class="text-[12px]">
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">Customer</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
            <td class="border-none py-1 font-bold">${customer}</td>
          </tr>
          ${vatTinRow}
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;vertical-align:top;">Address</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;vertical-align:top;">:</td>
            <td class="border-none py-1" style="min-width:320px;"><div class="addr-clamp">${address}</div></td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">Contact Person</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
            <td class="border-none py-1 font-bold">${contact}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">Telephone</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
            <td class="border-none py-1 font-bold">${phone}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:110px;padding-right:0;">E-mail</td>
            <td class="border-none py-1" style="width:14px;padding-left:2px;padding-right:8px;">:</td>
            <td class="border-none py-1 font-bold">${email}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="w-[38%] flex flex-col">
      <table class="w-auto ml-auto border-none table-fixed">
        <tbody class="text-[12px]">
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:90px;">Delivery N&#186;</td>
            <td class="border-none py-1 text-center" style="width:10px;">:</td>
            <td class="border-none py-1 align-middle">${doNo}</td>
          </tr>
          <tr>
            <td class="font-bold border-none py-1 whitespace-nowrap" style="width:90px;">Date</td>
            <td class="border-none py-1 text-center" style="width:10px;">:</td>
            <td class="border-none py-1 align-middle">${doDate}</td>
          </tr>
          ${invNoRow}
        </tbody>
      </table>
    </div>
  </div>
  </div>

  <div class="mb-4">
    <table class="items-table w-full mx-auto">
      <thead>
        <tr class="bg-brand-blue text-white text-center text-[12px]">
          <th class="w-[4%] py-2 whitespace-nowrap leading-tight text-center"><div>ល.រ</div><div>N&#176;</div></th>
          <th class="w-[12%] py-2 whitespace-nowrap leading-tight text-center"><div>លេខកូដទំនិញ</div><div>Part Number</div></th>
          <th class="w-[39%] py-2 whitespace-nowrap leading-tight text-center"><div>បរិយាយទំនិញ</div><div>Description</div></th>
          <th class="w-[15%] py-2 whitespace-nowrap leading-tight text-center"><div>បរិមាណ</div><div>Qty</div></th>
          <th class="w-[30%] py-2 whitespace-nowrap leading-tight text-center"><div>លេខស៊េរី</div><div>Serial Number</div></th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
  </div>

  <div class="mb-6 text-center text-[10px] font-bold" style="color:#ba1a1a;">
    <div>សូមផ្ដល់ពត៍មានចំពោះការខ្វះខាតផ្នែកសេវាដឹកជញ្ជូនទំនិញ</div>
    <div class="mt-1">Please call, in case of delivery's problem (+855 92 218 333)</div>
  </div>

  <div class="mb-12 border border-black p-4 text-[10px]">
    <div class="font-bold mb-2 uppercase underline">For Customer Only:</div>
    <div class="flex flex-col gap-2">
      <label class="flex items-center gap-2 cursor-pointer">
        <input class="h-4 w-4 border border-black" type="checkbox"/>
        <span>Checked &amp; accepted all received goods are in good condition.</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input class="h-4 w-4 border border-black" type="checkbox"/>
        <span>Received all goods as ordered</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input class="h-4 w-4 border border-black" type="checkbox"/>
        <span>Unaccepted</span>
      </label>
    </div>
  </div>

  <div class="flex justify-between px-4 pb-8 mx-auto w-full" style="margin-top:${signaturePadding}px;">
    <div class="w-[35%] text-center">
      <div class="border-t-2 border-black"></div>
      <div class="mt-4">
        <div class="text-[10px]">ហត្ថលេខា និងឈ្មោះអ្នកប្រគល់</div>
        <div class="text-[10px] font-bold">Deliverer's Signature &amp; Name</div>
      </div>
      <div class="mt-8 text-[10px]">Date: _____/_____/_______</div>
    </div>
    <div class="w-[35%] text-center">
      <div class="border-t-2 border-black"></div>
      <div class="mt-4">
        <div class="text-[10px]">ហត្ថលេខា និងឈ្មោះអ្នកទទួល</div>
        <div class="text-[10px] font-bold">Receiver's Signature &amp; Name</div>
      </div>
      <div class="mt-8 text-[10px]">Date: _____/_____/_______</div>
    </div>
  </div>

</div>
</body>
</html>`;
}
