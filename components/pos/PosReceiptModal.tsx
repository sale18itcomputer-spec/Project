'use client';

import React from 'react';
import { PosCartItem, PosSessionForm } from '../../types';
import { formatDisplayDate } from '../../utils/time';
import { useToast } from '../../contexts/ToastContext';
import { Printer, ArrowRight, X } from 'lucide-react';

export interface CompletedSale {
  invNo: string;
  rvNo: string;
  grandTotal: number;
  changeAmount: number;
  items: PosCartItem[];
}

interface PosReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: CompletedSale | null;
  session: PosSessionForm;
  taxAmount: number;
  subTotal: number;
  isReprint?: boolean;
}

const Divider = () => (
  <div style={{ borderTop: '1px dashed #d1d5db', margin: '10px 0' }} />
);

const PosReceiptModal: React.FC<PosReceiptModalProps> = ({
  isOpen, onClose, sale, session, taxAmount, subTotal, isReprint = false,
}) => {
  const { addToast } = useToast();
  if (!isOpen || !sale) return null;

  const today = new Date().toISOString().split('T')[0];
  const customerName = session.contactName?.trim() || 'Walk-In Customer';
  const isWalkIn = customerName === 'Walk-In Customer';

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=420,height=760,scrollbars=yes');
    if (!win) {
      addToast('Pop-up blocked. Please allow pop-ups for this site and try again.', 'error');
      return;
    }

    const itemRows = sale.items.map((item, idx) => `
      <tr>
        <td style="padding:6px 0;vertical-align:top;color:#6b7280;font-size:11px;width:16px;">${idx + 1}.</td>
        <td style="padding:6px 4px;vertical-align:top;">
          <div style="font-weight:600;line-height:1.3;">${item.modelName || item.itemCode}</div>
          ${item.brand ? `<div style="color:#9ca3af;font-size:10px;margin-top:1px;">${item.brand}</div>` : ''}
        </td>
        <td style="padding:6px 0;text-align:right;white-space:nowrap;vertical-align:top;color:#6b7280;">${item.qty} × $${item.unitPrice.toFixed(2)}</td>
        <td style="padding:6px 0 6px 12px;text-align:right;white-space:nowrap;vertical-align:top;font-weight:600;">$${item.amount.toFixed(2)}</td>
      </tr>
    `).join('');

    const vatRow = session.taxType === 'VAT'
      ? `<tr><td style="padding:3px 0;color:#6b7280;">VAT (10%)</td><td style="padding:3px 0;text-align:right;color:#6b7280;">$${taxAmount.toFixed(2)}</td></tr>`
      : '';

    const khrRow = session.currency === 'KHR'
      ? `<tr><td style="padding:3px 0;color:#6b7280;">≈ KHR</td><td style="padding:3px 0;text-align:right;color:#6b7280;">៛${(sale.grandTotal * session.exchangeRate).toLocaleString()}</td></tr>`
      : '';

    const cashRows = session.paymentMethod === 'Cash' ? `
      <div style="border-top:1px dashed #d1d5db;margin:10px 0;"></div>
      <table style="width:100%;font-size:12px;border-collapse:collapse;">
        <tr><td style="padding:3px 0;color:#6b7280;">Cash Tendered</td><td style="text-align:right;color:#6b7280;">$${session.amountTendered.toFixed(2)}</td></tr>
        <tr><td style="padding:3px 0;font-weight:600;">Change Due</td><td style="text-align:right;font-weight:600;">$${sale.changeAmount.toFixed(2)}</td></tr>
      </table>
    ` : '';

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Receipt ${sale.invNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #111827;
      background: #fff;
      padding: 24px 20px;
      max-width: 320px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 8px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Invoice meta -->
  <table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:4px;">
    <tr>
      <td style="padding:3px 0;color:#6b7280;">Invoice</td>
      <td style="padding:3px 0;text-align:right;font-weight:700;">${sale.invNo}</td>
    </tr>
    <tr>
      <td style="padding:3px 0;color:#6b7280;">Receipt</td>
      <td style="padding:3px 0;text-align:right;font-weight:700;">${sale.rvNo}</td>
    </tr>
    <tr>
      <td style="padding:3px 0;color:#6b7280;">Date</td>
      <td style="padding:3px 0;text-align:right;">${formatDisplayDate(today)}</td>
    </tr>
    <tr>
      <td style="padding:3px 0;color:#6b7280;">Cashier</td>
      <td style="padding:3px 0;text-align:right;">${session.createdBy}</td>
    </tr>
    <tr>
      <td style="padding:3px 0;color:#6b7280;">Customer</td>
      <td style="padding:3px 0;text-align:right;${isWalkIn ? 'color:#9ca3af;font-style:italic;' : 'font-weight:600;'}">${customerName}</td>
    </tr>
    ${session.phoneNumber ? `<tr><td style="padding:3px 0;color:#6b7280;">Phone</td><td style="padding:3px 0;text-align:right;">${session.phoneNumber}</td></tr>` : ''}
  </table>

  <div style="border-top:1px dashed #d1d5db;margin:10px 0;"></div>

  <!-- Items -->
  <table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:4px;">
    ${itemRows}
  </table>

  <div style="border-top:1px dashed #d1d5db;margin:10px 0;"></div>

  <!-- Totals -->
  <table style="width:100%;font-size:12px;border-collapse:collapse;">
    <tr><td style="padding:3px 0;color:#6b7280;">Subtotal</td><td style="text-align:right;color:#6b7280;">$${subTotal.toFixed(2)}</td></tr>
    ${vatRow}
    <tr>
      <td colspan="2" style="padding:2px 0;"><div style="border-top:2px solid #111827;margin:6px 0;"></div></td>
    </tr>
    <tr>
      <td style="padding:3px 0;font-size:14px;font-weight:900;letter-spacing:-0.3px;">TOTAL</td>
      <td style="text-align:right;font-size:14px;font-weight:900;">$${sale.grandTotal.toFixed(2)}</td>
    </tr>
    ${khrRow}
  </table>

  ${cashRows}

  <div style="border-top:1px dashed #d1d5db;margin:10px 0;"></div>

  <!-- Footer -->
  <div style="text-align:center;font-size:11px;">
    <div style="color:#6b7280;margin-bottom:2px;">Payment: <strong style="color:#111827;">${session.paymentMethod}</strong></div>
    <div style="font-weight:800;font-size:13px;letter-spacing:0.3px;margin-top:6px;">Thank you for your purchase!</div>
  </div>

  <!-- Print button -->
  <div class="no-print" style="margin-top:24px;text-align:center;">
    <button onclick="window.print()" style="padding:9px 28px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.3px;">
      Print Receipt
    </button>
  </div>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);

    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden border border-border" onClick={e => e.stopPropagation()}>
        {/* Close button (always visible) */}
        <div className="flex justify-end px-4 pt-4 pb-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Receipt preview */}
        <div className="p-6 font-mono text-sm text-gray-900 dark:text-gray-100 overflow-y-auto max-h-[72vh]">

          {/* Invoice meta */}
          <div className="space-y-1 text-xs mb-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice</span>
              <span className="font-bold">{sale.invNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Receipt</span>
              <span className="font-bold">{sale.rvNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span>{formatDisplayDate(today)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cashier</span>
              <span>{session.createdBy}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Customer</span>
              <span className={isWalkIn ? 'text-gray-400 italic' : 'font-semibold truncate max-w-[150px] text-right'}>
                {customerName}
              </span>
            </div>
            {session.phoneNumber && (
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span>{session.phoneNumber}</span>
              </div>
            )}
          </div>

          <Divider />

          {/* Items */}
          <div className="space-y-2.5 text-xs mb-2">
            {sale.items.map((item, idx) => (
              <div key={item.id} className="flex gap-2">
                <span className="text-gray-400 w-4 shrink-0">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-snug truncate">{item.modelName || item.itemCode}</div>
                  {item.brand && <div className="text-gray-400 text-[10px]">{item.brand}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-gray-500">{item.qty} × ${item.unitPrice.toFixed(2)}</div>
                  <div className="font-semibold">${item.amount.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>

          <Divider />

          {/* Totals */}
          <div className="space-y-1 text-xs mb-2">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>${subTotal.toFixed(2)}</span>
            </div>
            {session.taxType === 'VAT' && (
              <div className="flex justify-between text-gray-500">
                <span>VAT (10%)</span><span>${taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t-2 border-gray-800 dark:border-gray-200 pt-1.5 flex justify-between font-black text-sm">
              <span>TOTAL</span><span>${sale.grandTotal.toFixed(2)}</span>
            </div>
            {session.currency === 'KHR' && (
              <div className="flex justify-between text-gray-500">
                <span>≈ KHR</span><span>៛{(sale.grandTotal * session.exchangeRate).toLocaleString()}</span>
              </div>
            )}
          </div>

          {session.paymentMethod === 'Cash' && (
            <>
              <Divider />
              <div className="space-y-1 text-xs mb-2">
                <div className="flex justify-between text-gray-500">
                  <span>Cash Tendered</span><span>${session.amountTendered.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Change Due</span><span>${sale.changeAmount.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}

          <Divider />

          {/* Footer */}
          <div className="text-center text-xs space-y-1">
            <div className="text-gray-500">
              Payment: <span className="font-semibold text-gray-700 dark:text-gray-300">{session.paymentMethod}</span>
            </div>
            <div className="font-bold text-sm text-gray-800 dark:text-gray-200 tracking-wide pt-1">
              Thank you for your purchase!
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-3 flex gap-3 border-t border-gray-100 dark:border-border">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition"
          >
            <Printer size={16} /> Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold transition"
          >
            {isReprint ? 'Close' : (<>New Sale <ArrowRight size={16} /></>)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PosReceiptModal;
