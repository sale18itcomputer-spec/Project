'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { formatDisplayDate } from '../../utils/time';
import { X, ShoppingBag, TrendingUp, DollarSign, Receipt } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  week:  'This Week',
  month: 'This Month',
  all:   'All Time',
};

const PAYMENT_COLORS: Record<string, string> = {
  Cash:            'bg-emerald-500/10 text-emerald-600',
  ABA:             'bg-blue-500/10 text-blue-600',
  KHQR:            'bg-purple-500/10 text-purple-600',
  Card:            'bg-sky-500/10 text-sky-600',
  'Bank Transfer': 'bg-amber-500/10 text-amber-600',
};

interface PosSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PosSalesModal: React.FC<PosSalesModalProps> = ({ isOpen, onClose }) => {
  const { invoices, receipts } = useData();
  const [period, setPeriod] = useState<Period>('today');
  const [expandedInvNo, setExpandedInvNo] = useState<string | null>(null);

  const year = new Date().getFullYear();
  const POS_PREFIX = `POS-${year}-`;

  // Build payment method lookup from receipts (keyed by Inv No)
  const paymentByInvNo = useMemo(() => {
    const map = new Map<string, string>();
    (receipts ?? []).forEach(r => {
      if (r['Inv No'] && r['Payment Method']) {
        map.set(r['Inv No'], r['Payment Method']);
      }
    });
    return map;
  }, [receipts]);

  // All POS invoices, sorted newest first
  const posInvoices = useMemo(() => {
    return (invoices ?? [])
      .filter(inv => inv['Inv No']?.startsWith(POS_PREFIX))
      .sort((a, b) => {
        const da = a['Inv Date'] ?? '';
        const db = b['Inv Date'] ?? '';
        return db.localeCompare(da);
      });
  }, [invoices, POS_PREFIX]);

  // Date filter
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const weekStr = startOfWeek.toISOString().split('T')[0];

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    return posInvoices.filter(inv => {
      const d = inv['Inv Date'] ?? '';
      if (period === 'today') return d === today;
      if (period === 'week')  return d >= weekStr;
      if (period === 'month') return d >= startOfMonth;
      return true;
    });
  }, [posInvoices, period]);

  // Summary stats
  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (Number(inv['Amount']) || 0), 0);
  const totalItems   = filteredInvoices.reduce((sum, inv) => {
    try {
      const items = typeof inv['ItemsJSON'] === 'string' ? JSON.parse(inv['ItemsJSON']) : (inv['ItemsJSON'] ?? []);
      return sum + (Array.isArray(items) ? items.reduce((s: number, i: any) => s + (Number(i.qty) || 0), 0) : 0);
    } catch { return sum; }
  }, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-brand-500" size={20} />
            <h2 className="text-lg font-bold">POS Sales</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
            <X size={18} />
          </button>
        </div>

        {/* Period tabs */}
        <div className="flex-shrink-0 flex gap-1 px-5 pt-3 pb-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                period === p
                  ? 'bg-brand-600 text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="flex-shrink-0 grid grid-cols-3 gap-3 px-5 py-3">
          <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Receipt size={16} className="text-brand-500" />
            </div>
            <div>
              <div className="text-xl font-black">{filteredInvoices.length}</div>
              <div className="text-xs text-muted-foreground">Transactions</div>
            </div>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign size={16} className="text-emerald-500" />
            </div>
            <div>
              <div className="text-xl font-black">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-muted-foreground">Revenue</div>
            </div>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <TrendingUp size={16} className="text-amber-500" />
            </div>
            <div>
              <div className="text-xl font-black">{totalItems}</div>
              <div className="text-xs text-muted-foreground">Units Sold</div>
            </div>
          </div>
        </div>

        {/* Sales table */}
        <div className="flex-1 overflow-auto px-5 pb-5">
          {filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <ShoppingBag size={32} className="opacity-20" />
              <p className="text-sm">No POS sales for {PERIOD_LABELS[period].toLowerCase()}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Inv No</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Date</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground/80">Customer</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Items</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Amount</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Payment</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground/80 whitespace-nowrap">Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredInvoices.map(inv => {
                    let items: any[] = [];
                    try {
                      items = typeof inv['ItemsJSON'] === 'string'
                        ? JSON.parse(inv['ItemsJSON'])
                        : (Array.isArray(inv['ItemsJSON']) ? inv['ItemsJSON'] : []);
                    } catch { }

                    const totalQty = items.reduce((s: number, i: any) => s + (Number(i.qty) || 0), 0);
                    const payment  = paymentByInvNo.get(inv['Inv No']) ?? '—';
                    const isExpanded = expandedInvNo === inv['Inv No'];

                    return (
                      <React.Fragment key={inv['Inv No']}>
                        <tr
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedInvNo(isExpanded ? null : inv['Inv No'])}
                        >
                          <td className="px-3 py-2.5 font-semibold text-brand-500 whitespace-nowrap">{inv['Inv No']}</td>
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDisplayDate(inv['Inv Date'])}</td>
                          <td className="px-3 py-2.5 max-w-[160px] truncate">
                            {inv['Company Name'] || 'Walk-In Customer'}
                            {inv['Phone Number'] && <span className="text-xs text-muted-foreground ml-1">· {inv['Phone Number']}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground">{totalQty}</td>
                          <td className="px-3 py-2.5 text-right font-semibold">${Number(inv['Amount']).toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-center">
                            {payment !== '—' ? (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PAYMENT_COLORS[payment] ?? 'bg-muted text-muted-foreground'}`}>
                                {payment}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              inv['Tax Type'] === 'VAT'
                                ? 'bg-blue-500/10 text-blue-600'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {inv['Tax Type'] ?? 'NON-VAT'}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded line items */}
                        {isExpanded && items.length > 0 && (
                          <tr className="bg-muted/20">
                            <td colSpan={7} className="px-4 py-2">
                              <div className="rounded-lg border border-border overflow-hidden text-xs">
                                <table className="w-full">
                                  <thead className="bg-muted/60">
                                    <tr>
                                      <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">#</th>
                                      <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Model</th>
                                      <th className="text-center px-3 py-1.5 font-semibold text-muted-foreground">Qty</th>
                                      <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground">Unit Price</th>
                                      <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {items.map((item: any, idx: number) => (
                                      <tr key={idx}>
                                        <td className="px-3 py-1.5 text-muted-foreground">{idx + 1}</td>
                                        <td className="px-3 py-1.5">
                                          <div className="font-semibold">{item.modelName || item.itemCode || '—'}</div>
                                          {item.itemCode && item.modelName && <div className="text-muted-foreground font-mono">{item.itemCode}</div>}
                                        </td>
                                        <td className="px-3 py-1.5 text-center">{item.qty}</td>
                                        <td className="px-3 py-1.5 text-right">${Number(item.unitPrice).toFixed(2)}</td>
                                        <td className="px-3 py-1.5 text-right font-semibold">${Number(item.amount).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PosSalesModal;
