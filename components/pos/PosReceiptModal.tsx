'use client';

import React from 'react';
import { PosCartItem, PosSessionForm } from '../../types';
import { formatDisplayDate } from '../../utils/time';
import { Printer, ArrowRight } from 'lucide-react';

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
}

const Divider = () => (
  <div style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }} />
);

const PosReceiptModal: React.FC<PosReceiptModalProps> = ({
  isOpen, onClose, sale, session, taxAmount, subTotal,
}) => {
  if (!isOpen || !sale) return null;

  const today = new Date().toISOString().split('T')[0];
  const customerName = session.contactName || 'Walk-In Customer';

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=420,height=700,scrollbars=yes');
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
      return;
    }

    const itemRows = sale.items.map(item => `
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <div style="flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.modelName || item.itemCode}</div>
          <div style="text-align:right;white-space:nowrap;">${item.qty} × $${item.unitPrice.toFixed(2)}</div>
        </div>
        ${item.brand ? `<div style="color:#888;font-size:10px;">${item.brand}</div>` : ''}
        <div style="text-align:right;font-weight:600;">$${item.amount.toFixed(2)}</div>
      </div>
    `).join('');

    const vatRow = session.taxType === 'VAT'
      ? `<div style="display:flex;justify-content:space-between;color:#666;"><span>VAT (10%)</span><span>$${taxAmount.toFixed(2)}</span></div>`
      : '';

    const khrRow = session.currency === 'KHR'
      ? `<div style="display:flex;justify-content:space-between;color:#666;"><span>≈ KHR</span><span>៛${(sale.grandTotal * session.exchangeRate).toLocaleString()}</span></div>`
      : '';

    const cashRows = session.paymentMethod === 'Cash' ? `
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      <div style="display:flex;justify-content:space-between;color:#666;"><span>Cash Tendered</span><span>$${session.amountTendered.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:600;"><span>Change</span><span>$${sale.changeAmount.toFixed(2)}</span></div>
    ` : '';

    const customerRow = customerName !== 'Walk-In Customer'
      ? `<div style="display:flex;justify-content:space-between;"><span style="color:#666;">Customer:</span><span>${customerName}</span></div>`
      : '';

    const phoneRow = session.phoneNumber
      ? `<div style="display:flex;justify-content:space-between;"><span style="color:#666;">Phone:</span><span>${session.phoneNumber}</span></div>`
      : '';

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
      color: #000;
      background: #fff;
      padding: 20px;
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

  <!-- Header -->
  <div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:15px;font-weight:900;letter-spacing:-0.5px;">L'IMPERIAL TECHNOLOGY</div>
    <div style="font-size:11px;color:#666;">Phnom Penh, Cambodia</div>
  </div>

  <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>

  <!-- Invoice info -->
  <div style="margin-bottom:4px;">
    <div style="display:flex;justify-content:space-between;"><span style="color:#666;">Invoice:</span><span style="font-weight:600;">${sale.invNo}</span></div>
    <div style="display:flex;justify-content:space-between;"><span style="color:#666;">Receipt:</span><span style="font-weight:600;">${sale.rvNo}</span></div>
    <div style="display:flex;justify-content:space-between;"><span style="color:#666;">Date:</span><span>${formatDisplayDate(today)}</span></div>
    <div style="display:flex;justify-content:space-between;"><span style="color:#666;">Cashier:</span><span>${session.createdBy}</span></div>
    ${customerRow}
    ${phoneRow}
  </div>

  <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>

  <!-- Items -->
  <div style="margin-bottom:4px;">
    ${itemRows}
  </div>

  <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>

  <!-- Totals -->
  <div style="margin-bottom:4px;">
    <div style="display:flex;justify-content:space-between;color:#666;"><span>Subtotal</span><span>$${subTotal.toFixed(2)}</span></div>
    ${vatRow}
    <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:900;margin-top:4px;padding-top:4px;border-top:1px solid #000;">
      <span>TOTAL</span><span>$${sale.grandTotal.toFixed(2)}</span>
    </div>
    ${khrRow}
  </div>

  ${cashRows}

  <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>

  <!-- Footer -->
  <div style="text-align:center;color:#666;font-size:11px;">
    <div>Payment: ${session.paymentMethod}</div>
    <div style="font-weight:700;color:#000;margin-top:4px;">Thank you for your purchase!</div>
  </div>

  <!-- Print button (hidden on print) -->
  <div class="no-print" style="margin-top:20px;text-align:center;">
    <button onclick="window.print()" style="padding:8px 24px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">
      🖨 Print Receipt
    </button>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`);

    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
        {/* Receipt preview */}
        <div className="p-6 font-mono text-sm text-gray-900 overflow-y-auto max-h-[70vh]">
          {/* Header */}
          <div className="text-center mb-3">
            <div className="text-base font-black tracking-tight">L'IMPERIAL TECHNOLOGY</div>
            <div className="text-xs text-gray-500">Phnom Penh, Cambodia</div>
          </div>
          <Divider />
          <div className="space-y-1 text-xs mb-2">
            <div className="flex justify-between"><span className="text-gray-500">Invoice:</span><span className="font-semibold">{sale.invNo}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Receipt:</span><span className="font-semibold">{sale.rvNo}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date:</span><span>{formatDisplayDate(today)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Cashier:</span><span>{session.createdBy}</span></div>
            {customerName !== 'Walk-In Customer' && (
              <div className="flex justify-between"><span className="text-gray-500">Customer:</span><span className="truncate max-w-[150px] text-right">{customerName}</span></div>
            )}
            {session.phoneNumber && (
              <div className="flex justify-between"><span className="text-gray-500">Phone:</span><span>{session.phoneNumber}</span></div>
            )}
          </div>
          <Divider />
          <div className="space-y-2 text-xs mb-2">
            {sale.items.map(item => (
              <div key={item.id} className="flex justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{item.modelName || item.itemCode}</div>
                  {item.brand && <div className="text-gray-400 text-[10px]">{item.brand}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div>{item.qty} × ${item.unitPrice.toFixed(2)}</div>
                  <div className="font-semibold">${item.amount.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
          <Divider />
          <div className="space-y-1 text-xs mb-2">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>${subTotal.toFixed(2)}</span></div>
            {session.taxType === 'VAT' && <div className="flex justify-between text-gray-500"><span>VAT (10%)</span><span>${taxAmount.toFixed(2)}</span></div>}
            <div className="flex justify-between font-black text-sm border-t border-gray-200 pt-1"><span>TOTAL</span><span>${sale.grandTotal.toFixed(2)}</span></div>
            {session.currency === 'KHR' && <div className="flex justify-between text-gray-500"><span>≈ KHR</span><span>៛{(sale.grandTotal * session.exchangeRate).toLocaleString()}</span></div>}
          </div>
          {session.paymentMethod === 'Cash' && (
            <>
              <Divider />
              <div className="space-y-1 text-xs mb-2">
                <div className="flex justify-between text-gray-500"><span>Cash Tendered</span><span>${session.amountTendered.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold"><span>Change</span><span>${sale.changeAmount.toFixed(2)}</span></div>
              </div>
            </>
          )}
          <Divider />
          <div className="text-center text-xs text-gray-500 space-y-0.5">
            <div>Payment: {session.paymentMethod}</div>
            <div className="font-semibold text-gray-700">Thank you for your purchase!</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 pt-3 flex gap-3 border-t border-gray-100">
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
            New Sale <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PosReceiptModal;
