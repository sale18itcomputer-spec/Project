'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { formatDisplayDate } from '../../utils/time';
import { X, ShoppingBag, TrendingUp, DollarSign, Receipt, Search, ChevronDown, ChevronRight } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  week:  'This Week',
  month: 'This Month',
  all:   'All Time',
};

const PAYMENT_COLORS: Record<string, string> = {
  Cash:            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  ABA:             'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  KHQR:            'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Card:            'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  'Bank Transfer': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

interface PosSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PosSalesModal: React.FC<PosSalesModalProps> = ({ isOpen, onClose }) => {
  const { invoices, receipts } = useData();
  const [period, setPeriod] = useState<Period>('today');
  const [expandedInvNo, setExpandedInvNo] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const year = new Date().getFullYear();
  const POS_PREFIX = `POS-${year}-`;

  const paymentByInvNo = useMemo(() => {
    const map = new Map<string, string>();
    (receipts ?? []).forEach(r => {
      if (r['Inv No'] && r['Payment Method']) map.set(r['Inv No'], r['Payment Method']);
    });
    return map;
  }, [receipts]);

  const posInvoices = useMemo(() => {
    return (invoices ?? [])
      .filter(inv => inv['Inv No']?.startsWith(POS_PREFIX))
      .sort((a, b) => (b['Inv Date'] ?? '').localeCompare(a['Inv Date'] ?? ''));
  }, [invoices, POS_PREFIX]);

  const periodFiltered = useMemo(() => {
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

  const filteredInvoices = useMemo(() => {
    if (!search.trim()) return periodFiltered;
    const q = search.toLowerCase();
    return periodFiltered.filter(inv =>
      (inv['Inv No'] ?? '').toLowerCase().includes(q) ||
      (inv['Company Name'] ?? '').toLowerCase().includes(q) ||
      (inv['Contact Name'] ?? '').toLowerCase().includes(q) ||
      (inv['Phone Number'] ?? '').toLowerCase().includes(q)
    );
  }, [periodFiltered, search]);

  const totalRevenue = periodFiltered.reduce((s, inv) => s + (Number(inv['Amount']) || 0), 0);
  const totalItems   = periodFiltered.reduce((s, inv) => {
    try {
      const items = typeof inv['ItemsJSON'] === 'string' ? JSON.parse(inv['ItemsJSON']) : (inv['ItemsJSON'] ?? []);
      return s + (Array.isArray(items) ? items.reduce((a: number, i: any) => a + (Number(i.qty) || 0), 0) : 0);
    } catch { return s; }
  }, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col border border-border">

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

        {/* Period tabs + summary bar */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-b border-border/50">
          {/* Tabs */}
          <div className="flex gap-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setExpandedInvNo(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  period === p
                    ? 'bg-brand-600 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Compact stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Receipt size={13} className="text-brand-500" />
              <span className="font-black">{periodFiltered.length}</span>
              <span className="text-muted-foreground text-xs">txn</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <DollarSign size={13} className="text-emerald-500" />
              <span className="font-black">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-muted-foreground text-xs">revenue</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-amber-500" />
              <span className="font-black">{totalItems}</span>
              <span className="text-muted-foreground text-xs">units</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex-shrink-0 px-5 py-2.5 border-b border-border/50">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by invoice, customer, phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-5 pb-5 pt-3">
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 sticky top-0 z-10">
                <tr>
                  <th className="w-6 px-3 py-2.5" />
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Invoice</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Qty</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Amount</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Payment</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <ShoppingBag size={28} className="opacity-20" />
                        <p className="text-sm">
                          {search ? `No results for "${search}"` : `No POS sales for ${PERIOD_LABELS[period].toLowerCase()}`}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => {
                    let items: any[] = [];
                    try {
                      items = typeof inv['ItemsJSON'] === 'string'
                        ? JSON.parse(inv['ItemsJSON'])
                        : (Array.isArray(inv['ItemsJSON']) ? inv['ItemsJSON'] : []);
                    } catch { }

                    const totalQty  = items.reduce((s: number, i: any) => s + (Number(i.qty) || 0), 0);
                    const payment   = paymentByInvNo.get(inv['Inv No']) ?? '—';
                    const isExpanded = expandedInvNo === inv['Inv No'];
                    const customer  = inv['Company Name'] || inv['Contact Name'] || 'Walk-In Customer';
                    const isWalkIn  = customer === 'Walk-In Customer';

                    return (
                      <React.Fragment key={inv['Inv No']}>
                        <tr
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedInvNo(isExpanded ? null : inv['Inv No'])}
                        >
                          <td className="px-3 py-2.5 text-muted-foreground/50">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-brand-500 whitespace-nowrap">{inv['Inv No']}</td>
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDisplayDate(inv['Inv Date'])}</td>
                          <td className="px-3 py-2.5 max-w-[180px]">
                            <span className={isWalkIn ? 'text-muted-foreground italic text-xs' : 'truncate block font-medium'}>
                              {customer}
                            </span>
                            {inv['Phone Number'] && (
                              <span className="text-xs text-muted-foreground block">{inv['Phone Number']}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground tabular-nums">{totalQty}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">${Number(inv['Amount']).toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-center">
                            {payment !== '—' ? (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${PAYMENT_COLORS[payment] ?? 'bg-muted text-muted-foreground'}`}>
                                {payment}
                              </span>
                            ) : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                              inv['Tax Type'] === 'VAT'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {inv['Tax Type'] ?? 'NON-VAT'}
                            </span>
                          </td>
                        </tr>

                        {isExpanded && items.length > 0 && (
                          <tr className="bg-muted/10">
                            <td colSpan={8} className="px-4 py-2.5">
                              <div className="rounded-lg border border-border overflow-hidden text-xs">
                                <table className="w-full">
                                  <thead className="bg-muted/60">
                                    <tr>
                                      <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                                      <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground uppercase tracking-wide">Model</th>
                                      <th className="text-center px-3 py-1.5 font-semibold text-muted-foreground uppercase tracking-wide">Qty</th>
                                      <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground uppercase tracking-wide">Unit Price</th>
                                      <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {items.map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-muted/20">
                                        <td className="px-3 py-1.5 text-muted-foreground">{idx + 1}</td>
                                        <td className="px-3 py-1.5">
                                          <div className="font-semibold">{item.modelName || item.itemCode || '—'}</div>
                                          {item.itemCode && item.modelName && (
                                            <div className="text-muted-foreground font-mono text-[10px]">{item.itemCode}</div>
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5 text-center tabular-nums">{item.qty}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">${Number(item.unitPrice).toFixed(2)}</td>
                                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">${Number(item.amount).toFixed(2)}</td>
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
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredInvoices.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground text-right">
              {filteredInvoices.length} record{filteredInvoices.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PosSalesModal;
