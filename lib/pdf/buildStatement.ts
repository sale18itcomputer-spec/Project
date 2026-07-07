/**
 * buildStatement.ts
 * Customer Account Statement — English-only, self-contained HTML.
 * Lists a customer's invoices with invoiced / paid / outstanding and a
 * grand outstanding balance. Not item-based like the other document types.
 */
import { esc, fmtDate, fmtNum, LOGO } from './shared-pure';

export interface StatementRow {
    invNo: string;
    invDate?: string;
    dueDate?: string;
    invoiced: number;
    paid: number;
    outstanding: number;
    status: string;
    daysPastDue: number;
}

export interface StatementHeader {
    companyName: string;
    companyAddress?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    statementDate?: string;
}

export function buildStatement(
    hd: StatementHeader,
    rows: StatementRow[],
    sym: string,
): string {
    const totalInvoiced = rows.reduce((s, r) => s + r.invoiced, 0);
    const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
    const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
    const overdueOutstanding = rows.reduce((s, r) => s + (r.daysPastDue > 0 ? r.outstanding : 0), 0);

    const money = (v: number) => `<span style="display:flex;justify-content:space-between;white-space:nowrap"><span>${sym}</span><span>${fmtNum(v)}</span></span>`;

    const bodyRows = rows.length ? rows.map(r => {
        const overdue = r.outstanding > 0.005 && r.daysPastDue > 0;
        const statusCell = overdue
            ? `<span style="color:#c00000;font-weight:bold">${r.daysPastDue}d overdue</span>`
            : esc(r.status);
        return `<tr>
      <td style="border:1px solid #000;padding:5px 6px;">${esc(fmtDate(r.invDate))}</td>
      <td style="border:1px solid #000;padding:5px 6px;font-weight:bold;">${esc(r.invNo)}</td>
      <td style="border:1px solid #000;padding:5px 6px;">${r.dueDate ? esc(fmtDate(r.dueDate)) : '—'}</td>
      <td style="border:1px solid #000;padding:5px 6px;">${money(r.invoiced)}</td>
      <td style="border:1px solid #000;padding:5px 6px;">${r.paid > 0 ? money(r.paid) : '<span style="color:#999">—</span>'}</td>
      <td style="border:1px solid #000;padding:5px 6px;${overdue ? 'color:#c00000;font-weight:bold;' : ''}">${money(r.outstanding)}</td>
      <td style="border:1px solid #000;padding:5px 6px;text-align:center;font-size:10px;">${statusCell}</td>
    </tr>`;
    }).join('') : `<tr><td colspan="7" style="border:1px solid #000;padding:20px;text-align:center;color:#666;">No invoices on record for this customer.</td></tr>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Statement - ${esc(hd.companyName)}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: 'Times New Roman', serif; font-size: 11px; color: #000; }
  @page { size:A4; margin:12mm 12mm; }
  table { width:100%; border-collapse:collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>
<div style="max-width:190mm;margin:0 auto;">

  <div style="display:flex;align-items:center;border-bottom:3px solid #004aad;padding-bottom:8px;margin-bottom:14px;gap:14px;">
    <img src="${LOGO}" alt="Logo" style="height:40px;width:auto;object-fit:contain;"/>
    <div style="font-size:9px;line-height:1.6;">
      <div style="font-weight:bold;color:#004aad;font-size:13px;">LIMPERIAL TECHNOLOGY CO., LTD.</div>
      <div>Tel : (+855) 92 218 333 || Email : info@limperialtech.com || Website : www.limperialtech.com</div>
      <div>Address : Building #15, Street Ayeaksmaiyean Bo (139), Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</div>
    </div>
  </div>

  <div style="text-align:center;margin-bottom:16px;">
    <div style="font-size:16px;font-weight:bold;text-decoration:underline;">ACCOUNT STATEMENT</div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:14px;">
    <div style="width:60%;">
      <div><strong>Customer:</strong> ${esc(hd.companyName)}</div>
      ${hd.companyAddress ? `<div><strong>Address:</strong> ${esc(hd.companyAddress)}</div>` : ''}
      ${hd.contactName ? `<div><strong>Contact:</strong> ${esc(hd.contactName)}</div>` : ''}
      ${hd.phone ? `<div><strong>Tel:</strong> ${esc(hd.phone)}</div>` : ''}
      ${hd.email ? `<div><strong>E-mail:</strong> ${esc(hd.email)}</div>` : ''}
    </div>
    <div style="width:40%;text-align:right;">
      <div><strong>Statement Date:</strong> ${esc(fmtDate(hd.statementDate))}</div>
      <div style="margin-top:8px;font-size:13px;"><strong>Balance Due:</strong> <span style="font-weight:bold;color:#c00000;">${sym}${fmtNum(totalOutstanding)}</span></div>
    </div>
  </div>

  <table style="margin-bottom:14px;">
    <thead>
      <tr style="background:#004aad;color:#fff;text-align:left;">
        <th style="border:1px solid #000;padding:6px;">Date</th>
        <th style="border:1px solid #000;padding:6px;">Invoice No</th>
        <th style="border:1px solid #000;padding:6px;">Due Date</th>
        <th style="border:1px solid #000;padding:6px;">Invoiced</th>
        <th style="border:1px solid #000;padding:6px;">Paid</th>
        <th style="border:1px solid #000;padding:6px;">Outstanding</th>
        <th style="border:1px solid #000;padding:6px;text-align:center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
    <tfoot>
      <tr style="font-weight:bold;background:#f0f0f0;">
        <td style="border:1px solid #000;padding:6px;" colspan="3">TOTAL</td>
        <td style="border:1px solid #000;padding:6px;">${money(totalInvoiced)}</td>
        <td style="border:1px solid #000;padding:6px;">${money(totalPaid)}</td>
        <td style="border:1px solid #000;padding:6px;color:#c00000;">${money(totalOutstanding)}</td>
        <td style="border:1px solid #000;padding:6px;"></td>
      </tr>
    </tfoot>
  </table>

  ${overdueOutstanding > 0.005 ? `<div style="border:1px solid #c00000;background:#fff5f5;color:#c00000;padding:8px 12px;border-radius:4px;margin-bottom:14px;font-size:11px;">
    <strong>Overdue balance: ${sym}${fmtNum(overdueOutstanding)}</strong> — kindly arrange settlement of past-due invoices at your earliest convenience.
  </div>` : ''}

  <div style="font-size:10px;color:#333;margin-top:20px;">
    <p style="margin:2px 0;"><strong>Payment Information:</strong></p>
    <p style="margin:2px 0;">Bank: Advanced Bank of Asia Ltd (ABA Bank) &nbsp;|&nbsp; Account Name: LIMPERIAL TECHNOLOGY CO., LTD. &nbsp;|&nbsp; Account Number: 003916564</p>
    <p style="margin:8px 0 2px;color:#666;">This statement reflects invoices recorded as of the statement date. Please contact us if you believe any entry is incorrect.</p>
  </div>

</div>
</body>
</html>`;
}
