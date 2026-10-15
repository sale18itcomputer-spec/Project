/**
 * commercialShared.ts
 * Shared pieces of the Commercial Invoice document family (Yanet Computer Shop format):
 * the Commercial Invoice, Commercial Quotation and Commercial Sale Order all print with the
 * same header, grid table, totals and signature blocks, so they look like one family.
 *
 * Pure string builders (no browser/server APIs): safe to call from the server PDF route and
 * the client-side preview alike.
 */
import { esc, fmtNum, PdfItem } from './shared-pure';

/** Seller block printed in the header. Change here only. */
export const COMMERCIAL_SELLER = {
    name: 'Yanet Computer Shop',
    address: 'House # 97, St 128, Phnom Penh Cambodia',
    tel: '017253399',
};

const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v)) || 0);

/** Terms printed under the table. Single source for the PDF builders and the browser-print layout. */
export const COMMERCIAL_TERMS: { label: string; text: string }[] = [
    { label: 'Payment Terms', text: 'Full payment is required as per the agreed terms. Late payments may result in order suspension.' },
    { label: 'Goods Sold', text: 'All goods sold are non-refundable and exchangeable. Please inspect all goods carefully before signing.' },
    { label: 'Warranty', text: 'All goods sold are covered under our warranty policy. Warranty does not cover unauthorized repairs or broken seals.' },
];

export const COMMERCIAL_TERMS_HTML = `
  <div class="terms">
    <h4>Terms and Condition:</h4>
    <ul>
      ${COMMERCIAL_TERMS.map(t => `<li><b>${esc(t.label)}:</b> ${esc(t.text)}</li>`).join('\n      ')}
    </ul>
  </div>`;

export interface CommercialItemRowOptions {
    /** Print serial numbers under each item (invoice only). */
    serials: boolean;
    /** How the printed Unit Price is derived. */
    price: 'unit' | 'unit+commission' | 'amount/qty';
}

/**
 * Item rows for the 5-column table: No | Description | Qty | Unit Price | Amount.
 * Description column = model name (bold) + description lines + PC Build components + serials.
 * Sub-rows drop their inner borders so an item reads as one block; every row avoids page breaks.
 */
export function commercialItemRows(items: PdfItem[], sym: string, o: CommercialItemRowOptions): string {
    const open  = 'border-bottom:none;';
    const inner = 'border-top:none;border-bottom:none;';
    const close = 'border-top:none;';
    const cell = (content: string, style = '', cls = '') => `<td class="${cls}" style="${style}">${content}</td>`;
    const blank = (style: string) => cell('', style);
    const money = (v: number, bracket = false, red = false) =>
        `<div class="money"${red ? ' style="color:#c00000"' : ''}><span>${sym}</span><span>${bracket ? `(${fmtNum(v)})` : fmtNum(v)}</span></div>`;

    const rowsFor = (item: PdfItem): string => {
        // Cashback / promotion line: description + red bracketed negative amount.
        if (item.isPromotion) {
            const amt = Math.abs(num(item.amount));
            const text = (item.description || item.modelName || '').trim() || 'Cashback / Promotion';
            const lines = text.split('\n');
            return lines.map((ln, i) => {
                const last = i === lines.length - 1;
                const st = lines.length === 1 ? '' : (i === 0 ? open : last ? close : inner);
                return `<tr class="brk">
                  ${blank(st)}
                  ${cell(esc(ln), `${st}text-align:left;font-style:italic;color:#666;`, 'desc')}
                  ${blank(st)}${blank(st)}
                  ${last ? cell(money(amt, true, true), st) : blank(st)}
                </tr>`;
            }).join('');
        }

        const qty = num(item.qty);
        const amt = num(item.amount);
        const uPrice = num(item.unitPrice);
        const comm = num(item.commission);
        const price = o.price === 'amount/qty' ? (qty > 0 ? amt / qty : uPrice + comm)
            : o.price === 'unit+commission' ? uPrice + comm : uPrice;
        const priceCell = price > 0 ? money(price) : '';
        const amtCell = amt > 0 ? money(amt) : `<div class="money"><span>${sym}</span><span>-</span></div>`;

        // Sub-lines under the item: description lines, PC Build components, serial numbers.
        const subs: { html: string; serial?: boolean }[] = [];
        if (item.isPCBuild && item.buildComponents?.length) {
            item.buildComponents.forEach(c => {
                const warranty = c.warrantyMonths ? `${c.warrantyMonths} months warranty` : '';
                const sn = o.serials ? (c.serialNumber || '').trim() : '';
                const meta = [warranty, sn ? `S/N: ${sn}` : ''].filter(Boolean).join(' · ');
                subs.push({ html: `${esc(c.qty)} × ${esc((c as any).description || c.modelName || c.itemCode)}${meta ? `<div style="font-size:9px;color:#666">${esc(meta)}</div>` : ''}` });
            });
        } else {
            (item.description ? item.description.split('\n') : []).forEach(t => subs.push({ html: esc(t) }));
            const serials = !o.serials ? [] : (item.serialNumbers && item.serialNumbers.length > 0
                ? item.serialNumbers : (item.serialNumber || '').split('\n')).map(s => s.trim()).filter(Boolean);
            serials.forEach(s => subs.push({ html: `S/N: ${esc(s)}`, serial: true }));
        }

        const head = subs.length ? open : '';
        let out = `<tr class="brk">
          ${cell(esc(item.no), head)}
          ${cell(`<b>${esc(item.modelName || item.itemCode || '')}</b>`, `${head}text-align:left;`, 'desc')}
          ${cell(esc(item.qty), head)}
          ${cell(priceCell, head)}
          ${cell(amtCell, head)}
        </tr>`;
        subs.forEach((s, i) => {
            const st = i === subs.length - 1 ? close : inner;
            const font = s.serial ? 'font-size:10px;color:#555;' : 'font-size:11px;';
            out += `<tr class="brk">
              ${blank(st)}
              ${cell(s.html, `${st}text-align:left;${font}white-space:pre-wrap;padding-top:1px;`, 'desc')}
              ${blank(st)}${blank(st)}${blank(st)}
            </tr>`;
        });
        return out;
    };

    return items.filter(i => Number(i.no) > 0 || i.isPromotion).map(rowsFor).join('');
}

/** A total / deposit row: label spans the first 4 columns, the amount sits in the last. */
export function commercialTotalRow(label: string, amountHtml: string): string {
    return `<tr class="brk"><td class="lbl" colspan="4">${label}</td><td>${amountHtml}</td></tr>`;
}

export const commercialMoney = (sym: string, v: number | null): string =>
    `<div class="money"><span>${sym}</span><span>${v !== null && v > 0 ? fmtNum(v) : '-'}</span></div>`;

export interface CommercialSignature { label: string; name?: string; position?: string; labelAbove?: boolean }

export interface CommercialDocOptions {
    /** Browser tab title, e.g. "Commercial Invoice". */
    pageTitle: string;
    /** Big centred title, e.g. INVOICE / QUOTATION / SALE ORDER. */
    title: string;
    /** Small underlined heading above the left block, e.g. "Buyer :". */
    leftHeading: string;
    /** Left block rows [label, already-escaped value]. */
    leftRows: [string, string][];
    /** Right block rows [label, already-escaped value]. */
    rightRows: [string, string][];
    rightLabelWidth?: number;
    itemRowsHtml: string;
    totalRowsHtml: string;
    /** Block under the table (terms, notes). */
    belowHtml: string;
    /** Two signature blocks. */
    signatures: [CommercialSignature, CommercialSignature];
    signaturePadding?: number;
    labelPadding?: number;
}

const kv = (rows: [string, string][], cls = '', labelStyle = '') =>
    `<table class="kv ${cls}">${rows.map(([k, v], i) =>
        `<tr><td class="k"${i === 0 && labelStyle ? ` style="${labelStyle}"` : ''}>${k}</td><td class="c">:</td><td style="white-space:pre-line">${v}</td></tr>`).join('')}</table>`;

/** The full HTML page shared by the Commercial Invoice / Quotation / Sale Order. */
export function renderCommercialDoc(o: CommercialDocOptions): string {
    const sigs = o.signatures.map(s => `
    <div class="sig"><div class="gap"></div><div class="line"></div>
      ${s.name ? `<p class="b">${esc(s.name)}</p>` : ''}${s.position ? `<p>${esc(s.position)}</p>` : ''}
      <p class="b">${esc(s.label)}</p></div>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>${esc(o.pageTitle)} - ${esc(COMMERCIAL_SELLER.name)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Koh+Santepheap:wght@400;700&display=swap');
  @page { size: A4; margin: 10mm 8mm 18mm 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Koh Santepheap', 'Tinos', 'Times New Roman', sans-serif; font-size: 11px; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; margin: 0 auto; padding: 0 8px; }
  header { border-bottom: 3px solid #004aad; padding: 14px 0 12px; text-align: center; margin-bottom: 18px; }
  header h2 { font-family: 'Times New Roman', Tinos, serif; font-size: 20px; font-weight: bold; margin: 0 0 6px; }
  header p { margin: 0 0 3px; font-size: 10.5px; }
  h4.title { font-family: 'Times New Roman', Tinos, serif; font-size: 20px; font-weight: bold; text-align: center; margin: 0 0 18px; letter-spacing: .5px; }
  .info { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 18px; page-break-inside: avoid; }
  .info .l { width: 58%; }
  .info .r { width: 40%; }
  .buyer-h { font-weight: bold; font-size: 12px; margin: 0 0 4px; text-decoration: underline; }
  table.kv { border-collapse: collapse; width: auto; font-size: 12px; }
  table.kv td { padding: 3px 0; vertical-align: top; overflow-wrap: anywhere; }
  table.kv td.k { font-weight: bold; white-space: nowrap; padding-right: 6px; }
  table.kv td.c { width: 14px; text-align: center; }
  table.kv.right { margin-left: auto; }
  table.items { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.items th, table.items td { border: 1px solid #000; padding: 4px 8px; }
  table.items th { background: #004aad; color: #fff; font-size: 12px; padding: 7px 8px; text-align: center; }
  table.items thead { display: table-header-group; }
  table.items td { font-size: 12px; text-align: center; vertical-align: top; }
  table.items td.desc { overflow-wrap: anywhere; }
  table.items tr.brk { break-inside: avoid; page-break-inside: avoid; }
  .money { display: flex; justify-content: space-between; white-space: nowrap; }
  td.lbl { font-weight: bold; text-align: right; vertical-align: middle; padding: 6px 8px; }
  .terms { margin-top: 14px; font-size: 10.5px; page-break-inside: avoid; }
  .terms h4 { font-size: 11.5px; font-weight: bold; text-decoration: underline; text-transform: uppercase; margin: 0 0 6px; }
  .terms ul { margin: 0; padding-left: 16px; list-style-type: disc; }
  .terms li { margin-bottom: 3px; line-height: 1.4; }
  .sigs { display: flex; justify-content: space-between; padding: 0 16px; margin-top: ${o.signaturePadding ?? 0}px; page-break-inside: avoid; }
  .sig { width: 36%; text-align: center; }
  .sig .gap { height: ${o.labelPadding ?? 70}px; }
  .sig .line { border-top: 2px solid #000; margin-bottom: 6px; }
  .sig p { margin: 0; font-size: 11.5px; }
  .sig p.b { font-weight: bold; }
</style>
</head>
<body>
<div class="page">
  <header>
    <h2>${esc(COMMERCIAL_SELLER.name)}</h2>
    <p>Address : ${esc(COMMERCIAL_SELLER.address)}</p>
    <p>Tel : ${esc(COMMERCIAL_SELLER.tel)}</p>
  </header>

  <h4 class="title">${o.title}</h4>

  <div class="info">
    <div class="l">
      <p class="buyer-h">${esc(o.leftHeading)}</p>
      ${kv(o.leftRows)}
    </div>
    <div class="r">
      ${kv(o.rightRows, 'right', `width:${o.rightLabelWidth ?? 112}px`)}
    </div>
  </div>

  <table class="items">
    <colgroup><col style="width:6%"/><col style="width:50%"/><col style="width:12%"/><col style="width:16%"/><col style="width:16%"/></colgroup>
    <thead>
      <tr><th>No.</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>
    </thead>
    <tbody>${o.itemRowsHtml}</tbody>
    <tfoot>${o.totalRowsHtml}</tfoot>
  </table>

  ${o.belowHtml}

  <div class="sigs">${sigs}
  </div>
</div>
</body>
</html>`;
}
