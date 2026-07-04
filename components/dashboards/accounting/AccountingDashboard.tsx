'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChartOfAccount, JournalEntry, JournalEntryLine, BalanceSheetLine } from '../../../types';
import {
    fetchChartOfAccounts, createAccount, updateAccount,
    fetchJournalEntries, createJournalEntry, updateJournalEntry, deleteJournalEntry,
    togglePostJournalEntry, getNextEntryNumber, computeBalanceSheet, computeCashFlow,
    computeProfitLoss, backfillAllMissingCOGS,
    fetchAccountPLDetail, PLDetailLine,
} from '../../../services/accountingApi';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { Button } from '../../ui/button';
import ConfirmationModal from '../../modals/ConfirmationModal';
import {
    BookOpen, PlusCircle, Trash2, Check, X, ChevronRight, ChevronDown,
    AlertTriangle, TrendingUp, TrendingDown, Scale, Edit2, Eye, EyeOff,
    FileText, Landmark, Activity, BarChart2, RefreshCw, Receipt, Building2, Download, Printer, Power,
    ListChecks, Repeat, Banknote,
} from 'lucide-react';
import BillsTab from './BillsTab';
import AccountingVendorsTab from './AccountingVendorsTab';
import TrialBalanceTab from './TrialBalanceTab';
import RecurringTab from './RecurringTab';
import BankReconciliationTab from './BankReconciliationTab';
import {
    exportCoA, exportJournalEntries, exportGeneralLedger,
    exportBalanceSheet, exportBSCompare,
    exportCashFlow, exportCFCompare,
    exportProfitLoss, exportPLCompare,
} from '../../../utils/exportAccountingXlsx';
import {
    printBSPdf, printBSComparePdf,
    printCFPdf, printCFComparePdf,
    printPLPdf, printPLComparePdf,
} from '../../../utils/exportAccountingPdf';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
    'Bank',
    'Accounts Receivable',
    'Other Current Asset',
    'Fixed Asset',
    'Accounts Payable',
    'Other Current Liability',
    'Equity',
    'Income',
    'Cost of Goods Sold',
    'Expense',
    'Other Income',
    'Other Expense',
    'Non-Posting',
];

const TYPE_COLORS: Record<string, string> = {
    'Bank':                    'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700',
    'Accounts Receivable':     'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-700',
    'Other Current Asset':     'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-200 dark:border-cyan-700',
    'Fixed Asset':             'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-700',
    'Accounts Payable':        'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700',
    'Other Current Liability': 'bg-pink-50 text-pink-700 border border-pink-200 dark:bg-pink-900/40 dark:text-pink-200 dark:border-pink-700',
    'Equity':                  'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-700',
    'Income':                  'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700',
    'Cost of Goods Sold':      'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-700',
    'Expense':                 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700',
    'Other Income':            'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-200 dark:border-teal-700',
    'Other Expense':           'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700',
    'Non-Posting':             'bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
};

const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
    invoice:        { label: 'Auto · Invoice',  cls: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
    receipt:        { label: 'Auto · Receipt',  cls: 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700' },
    delivery_order: { label: 'Auto · DO',       cls: 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700' },
    purchase_order: { label: 'Auto · PO',       cls: 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700' },
    bill:           { label: 'Auto · Bill',     cls: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getTodayISO = () => new Date().toISOString().split('T')[0];

const getMonthEnd = (ym: string): string => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m, 0); // last day of month in local time
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const monthsBetween = (from: string, to: string): string[] => {
    const months: string[] = [];
    let [y, m] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    while (y < ty || (y === ty && m <= tm)) {
        months.push(`${y}-${String(m).padStart(2, '0')}`);
        if (++m > 12) { m = 1; y++; }
    }
    return months;
};

type BSMultiItem = { month: string; label: string; data: Awaited<ReturnType<typeof computeBalanceSheet>> };
type CFMultiItem = { month: string; label: string; data: Awaited<ReturnType<typeof computeCashFlow>> };
type PLMultiItem = { month: string; label: string; data: Awaited<ReturnType<typeof computeProfitLoss>> };

const DEBIT_NORMAL_GL = new Set([
    'Bank', 'Accounts Receivable', 'Other Current Asset', 'Fixed Asset',
    'Cost of Goods Sold', 'Expense', 'Other Expense',
]);

// ── P&L helper components ─────────────────────────────────────────────────────

// ── Shared financial-statement amount renderer ────────────────────────────────

const fmtAmt = (n: number, negate?: boolean): { display: string; negative: boolean } => {
    const v = negate ? -n : n;
    return { display: v < 0 ? `(${fmt(Math.abs(v))})` : fmt(v), negative: v < 0 };
};

const PLSection: React.FC<{
    title: string;
    lines: BalanceSheetLine[];
    totalLabel: string;
    total: number;
    totalColor: string;
    negate?: boolean;
    fmt: (n: number) => string;
    dateFrom: string;
    dateTo: string;
}> = ({ title, lines, totalLabel, total, negate, dateFrom, dateTo }) => {
    const [expandedAcct, setExpandedAcct] = React.useState<string | null>(null);
    const [detailCache, setDetailCache] = React.useState<Record<string, PLDetailLine[]>>({});
    const [loadingAcct, setLoadingAcct] = React.useState<string | null>(null);

    React.useEffect(() => {
        setExpandedAcct(null);
        setDetailCache({});
    }, [dateFrom, dateTo]);

    const relevant = lines.filter(l => l.balance !== 0);
    if (relevant.length === 0 && total === 0) return null;

    const toggle = async (acctNum: string) => {
        if (expandedAcct === acctNum) { setExpandedAcct(null); return; }
        setExpandedAcct(acctNum);
        if (detailCache[acctNum]) return;
        setLoadingAcct(acctNum);
        try {
            const rows = await fetchAccountPLDetail(acctNum, dateFrom, dateTo);
            setDetailCache(c => ({ ...c, [acctNum]: rows }));
        } catch {
            setDetailCache(c => ({ ...c, [acctNum]: [] }));
        } finally {
            setLoadingAcct(null);
        }
    };

    const t = fmtAmt(total, negate);
    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-3.5 border-b border-border bg-muted/30">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</h4>
            </div>
            <div>
                {relevant.length === 0 ? (
                    <p className="px-6 text-sm text-muted-foreground italic py-3">No activity for this period</p>
                ) : relevant.map(l => {
                    const a = fmtAmt(l.balance, negate);
                    const isExpanded = expandedAcct === l.account_number;
                    const detail = detailCache[l.account_number];
                    const isLoading = loadingAcct === l.account_number;
                    const isDebitNormal = DEBIT_NORMAL_GL.has(l.account_type);
                    return (
                        <React.Fragment key={l.account_number}>
                            <button
                                onClick={() => toggle(l.account_number)}
                                className={`w-full flex justify-between items-center px-6 py-2.5 border-b border-border/30 hover:bg-muted/20 transition-colors text-left ${l.is_parent ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                            >
                                <span className={`text-sm flex items-center gap-1.5 ${l.is_parent ? '' : 'pl-3'}`}>
                                    {isExpanded
                                        ? <ChevronDown size={12} className="shrink-0 text-brand-600" />
                                        : <ChevronRight size={12} className="shrink-0 opacity-40" />
                                    }
                                    {l.account_number} · {l.account_name}
                                </span>
                                <span className={`text-sm tabular-nums ml-8 shrink-0 ${a.negative ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>
                                    {a.display}
                                </span>
                            </button>

                            {isExpanded && (
                                <div className="bg-muted/10 border-b border-border/30">
                                    {isLoading ? (
                                        <p className="px-14 py-3 text-xs text-muted-foreground">Loading transactions…</p>
                                    ) : !detail || detail.length === 0 ? (
                                        <p className="px-14 py-3 text-xs text-muted-foreground italic">No transactions found for this account in this period.</p>
                                    ) : (
                                        <table className="w-full text-xs">
                                            <thead className="border-b border-border/30 bg-muted/20">
                                                <tr className="text-muted-foreground">
                                                    <th className="text-left px-14 py-1.5 font-medium whitespace-nowrap">Date</th>
                                                    <th className="text-left px-3 py-1.5 font-medium whitespace-nowrap">JE #</th>
                                                    <th className="text-left px-3 py-1.5 font-medium">Description</th>
                                                    <th className="text-right px-6 py-1.5 font-medium whitespace-nowrap">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.map((d, i) => {
                                                    const contribution = isDebitNormal
                                                        ? d.debit - d.credit
                                                        : d.credit - d.debit;
                                                    const desc = d.line_description || d.je_description;
                                                    const isNeg = contribution < 0;
                                                    return (
                                                        <tr key={i} className="border-b border-border/10 hover:bg-muted/20">
                                                            <td className="px-14 py-1.5 text-muted-foreground tabular-nums whitespace-nowrap">{d.entry_date}</td>
                                                            <td className="px-3 py-1.5 font-mono font-semibold text-foreground whitespace-nowrap">{d.entry_number}</td>
                                                            <td className="px-3 py-1.5 text-muted-foreground truncate max-w-xs">{desc}</td>
                                                            <td className={`px-6 py-1.5 text-right tabular-nums font-medium whitespace-nowrap ${isNeg ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>
                                                                {isNeg ? `(${fmt(Math.abs(contribution))})` : fmt(contribution)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="border-t border-border/30 bg-muted/20">
                                                <tr>
                                                    <td colSpan={3} className="px-14 py-1.5 text-muted-foreground/60 text-xs">
                                                        {detail.length} transaction{detail.length !== 1 ? 's' : ''}
                                                    </td>
                                                    <td className={`px-6 py-1.5 text-right font-bold tabular-nums text-xs ${a.negative ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>
                                                        {a.display}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    )}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
                <div className="flex justify-between items-baseline px-6 py-3 border-t-2 border-border/60 font-bold">
                    <span className="text-sm text-foreground">{totalLabel}</span>
                    <span className={`text-sm tabular-nums ml-8 shrink-0 ${t.negative ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{t.display}</span>
                </div>
            </div>
        </div>
    );
};

// ── SearchableSelect ─────────────────────────────────────────────────────────

interface SearchableSelectOption { value: string; label: string; }

const SearchableSelect: React.FC<{
    value: string;
    onChange: (value: string) => void;
    options: SearchableSelectOption[];
    placeholder?: string;
    className?: string;
}> = ({ value, onChange, options, placeholder = '— None —', className = '' }) => {
    const [open, setOpen]   = React.useState(false);
    const [query, setQuery] = React.useState('');
    const ref               = React.useRef<HTMLDivElement>(null);
    const inputRef          = React.useRef<HTMLInputElement>(null);

    const selected = options.find(o => o.value === value);
    const filtered = query.trim()
        ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
        : options;

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleOpen = () => {
        setOpen(true);
        setQuery('');
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleSelect = (val: string) => {
        onChange(val);
        setOpen(false);
        setQuery('');
    };

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                type="button"
                onClick={handleOpen}
                className="w-full mt-1 h-8 px-2 text-sm rounded border border-border bg-background text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-brand-600 hover:border-brand-500 transition-colors"
            >
                <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown size={12} className="text-muted-foreground shrink-0 ml-1" />
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-border/50">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Type account # or name…"
                            className="w-full h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 placeholder:text-muted-foreground/50"
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                        {!query.trim() && (
                            <button
                                type="button"
                                onClick={() => handleSelect('')}
                                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors ${!value ? 'bg-brand-500/10 text-brand-600 font-medium' : 'text-muted-foreground'}`}
                            >
                                {placeholder}
                            </button>
                        )}
                        {filtered.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-muted-foreground italic">No matches</p>
                        ) : filtered.map(o => (
                            <button
                                key={o.value}
                                type="button"
                                onClick={() => handleSelect(o.value)}
                                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors ${o.value === value ? 'bg-brand-500/10 text-brand-600 font-medium' : 'text-foreground'}`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── BSSection ────────────────────────────────────────────────────────────────

const BSSection: React.FC<{
    title: string;
    lines: BalanceSheetLine[];
    totalLabel: string;
    total: number;
    asOfDate: string;
}> = ({ title, lines, totalLabel, total, asOfDate }) => {
    const [expandedAcct, setExpandedAcct] = React.useState<string | null>(null);
    const [detailCache, setDetailCache]   = React.useState<Record<string, PLDetailLine[]>>({});
    const [loadingAcct, setLoadingAcct]   = React.useState<string | null>(null);

    React.useEffect(() => {
        setExpandedAcct(null);
        setDetailCache({});
    }, [asOfDate]);

    const toggle = async (acctNum: string) => {
        if (expandedAcct === acctNum) { setExpandedAcct(null); return; }
        setExpandedAcct(acctNum);
        if (detailCache[acctNum]) return;
        setLoadingAcct(acctNum);
        try {
            const rows = await fetchAccountPLDetail(acctNum, '2000-01-01', asOfDate);
            setDetailCache(c => ({ ...c, [acctNum]: rows }));
        } catch {
            setDetailCache(c => ({ ...c, [acctNum]: [] }));
        } finally {
            setLoadingAcct(null);
        }
    };

    // Roll up children balances into parent display totals
    const childrenSum: Record<string, number> = {};
    lines.forEach(l => {
        if (l.parent_account_number) {
            childrenSum[l.parent_account_number] = (childrenSum[l.parent_account_number] ?? 0) + l.balance;
        }
    });
    // Round to 2dp so float residuals (e.g. -0.0004) don't render as "(0.00)"
    const getDisplayBalance = (l: BalanceSheetLine): number =>
        Math.round((l.is_parent ? l.balance + (childrenSum[l.account_number] ?? 0) : l.balance) * 100) / 100;

    const relevant = lines;
    if (relevant.length === 0) return null;

    return (
        <div className="mb-3">
            <div className="py-2 border-b border-border/50 mb-0.5">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</h4>
            </div>
            {relevant.length === 0
                ? <p className="text-xs text-muted-foreground italic px-1 py-1.5">No balances</p>
                : relevant.map(l => {
                    const displayBal = getDisplayBalance(l);
                    const isExpanded = expandedAcct === l.account_number;
                    const detail     = detailCache[l.account_number];
                    const isLoading  = loadingAcct === l.account_number;
                    const isDebitNormal = DEBIT_NORMAL_GL.has(l.account_type);
                    return (
                        <React.Fragment key={l.account_number}>
                            <button
                                onClick={() => toggle(l.account_number)}
                                className={`w-full flex justify-between items-center py-2 border-b border-border/20 hover:bg-muted/20 transition-colors text-left ${
                                    l.is_parent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                                }`}
                            >
                                <span className={`text-sm flex items-center gap-1.5 ${l.is_parent ? '' : 'pl-2'}`}>
                                    {isExpanded
                                        ? <ChevronDown size={12} className="shrink-0 text-brand-600" />
                                        : <ChevronRight size={12} className="shrink-0 opacity-40" />
                                    }
                                    {l.account_number} · {l.account_name}
                                </span>
                                <span className={`text-sm tabular-nums ml-4 shrink-0 ${displayBal < 0 ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>
                                    {displayBal < 0 ? `(${fmt(Math.abs(displayBal))})` : fmt(displayBal)}
                                </span>
                            </button>
                            {isExpanded && (
                                <div className="bg-muted/10 border-b border-border/20">
                                    {isLoading ? (
                                        <p className="px-8 py-2 text-xs text-muted-foreground italic">Loading transactions…</p>
                                    ) : !detail?.length ? (
                                        <p className="px-8 py-2 text-xs text-muted-foreground italic">No posted transactions found.</p>
                                    ) : (
                                        <table className="w-full text-xs">
                                            <thead className="border-b border-border/30 bg-muted/20">
                                                <tr className="text-muted-foreground">
                                                    <th className="text-left px-6 py-1.5 font-medium whitespace-nowrap w-24">Date</th>
                                                    <th className="text-left px-3 py-1.5 font-medium whitespace-nowrap w-24">JE #</th>
                                                    <th className="text-left px-3 py-1.5 font-medium">Description</th>
                                                    <th className="text-right px-4 py-1.5 font-medium whitespace-nowrap w-28">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.map((d, i) => {
                                                    const contribution = isDebitNormal
                                                        ? d.debit - d.credit
                                                        : d.credit - d.debit;
                                                    const isNeg = contribution < 0;
                                                    return (
                                                        <tr key={i} className="border-b border-border/10 hover:bg-muted/20">
                                                            <td className="px-6 py-1.5 text-muted-foreground tabular-nums whitespace-nowrap">{d.entry_date}</td>
                                                            <td className="px-3 py-1.5 font-mono font-semibold text-foreground whitespace-nowrap">{d.entry_number}</td>
                                                            <td className="px-3 py-1.5 text-muted-foreground break-words">{d.line_description || d.je_description}</td>
                                                            <td className={`px-4 py-1.5 text-right tabular-nums font-medium whitespace-nowrap ${isNeg ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>
                                                                {isNeg ? `(${fmt(Math.abs(contribution))})` : fmt(contribution)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="border-t border-border/30 bg-muted/20 font-bold">
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-1.5 text-muted-foreground/60">{detail.length} transaction{detail.length !== 1 ? 's' : ''}</td>
                                                    <td className={`px-4 py-1.5 text-right tabular-nums ${l.balance < 0 ? 'text-red-500 dark:text-red-400' : 'text-brand-600'}`}>
                                                        {l.balance < 0 ? `(${fmt(Math.abs(l.balance))})` : fmt(l.balance)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    )}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })
            }
            <div className="flex justify-between items-baseline py-2.5 mt-0.5 border-t-2 border-border/60 font-bold">
                <span className="text-sm text-foreground">{totalLabel}</span>
                <span className={`text-sm tabular-nums ml-4 shrink-0 ${total < 0 ? 'text-red-500 dark:text-red-400' : 'text-brand-600 dark:text-brand-400'}`}>
                    {total < 0 ? `($${fmt(Math.abs(total))})` : `$${fmt(total)}`}
                </span>
            </div>
        </div>
    );
};

const PLSubtotal: React.FC<{
    label: string;
    value: number;
    fmt: (n: number) => string;
    size: 'md' | 'lg';
}> = ({ label, value, size }) => (
    <div className={`flex justify-between items-center px-6 py-4 rounded-xl border-2 ${
        value >= 0
            ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/15'
            : 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/15'
    }`}>
        <span className={`font-bold ${size === 'lg' ? 'text-base' : 'text-sm'} ${value >= 0 ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
            {label}
        </span>
        <span className={`font-bold tabular-nums ${size === 'lg' ? 'text-2xl' : 'text-lg'} ${value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {value < 0 ? `($${fmt(Math.abs(value))})` : `$${fmt(value)}`}
        </span>
    </div>
);

// ── CFCompareTab ──────────────────────────────────────────────────────────────

const CFCompareTab: React.FC<{ data: CFMultiItem[] }> = ({ data: cols }) => {
    type D = CFMultiItem['data'];
    const n = cols.length;

    const allOperAccts = [...new Map(
        cols.flatMap(c => c.data.operatingAdjustments.map(i => [i.account_number, i]))
    ).values()];
    const allInvAccts = [...new Map(
        cols.flatMap(c => c.data.investingItems.map(i => [i.account_number, i]))
    ).values()];
    const allFinAccts = [...new Map(
        cols.flatMap(c => c.data.financingItems.map(i => [i.account_number, i]))
    ).values()];

    const getOper = (d: D, num: string) => d.operatingAdjustments.find(i => i.account_number === num)?.amount ?? 0;
    const getInv  = (d: D, num: string) => d.investingItems.find(i => i.account_number === num)?.amount ?? 0;
    const getFin  = (d: D, num: string) => d.financingItems.find(i => i.account_number === num)?.amount ?? 0;

    const fmtAmt2 = (v: number) => v === 0 ? '—' : v < 0 ? `($${fmt(Math.abs(v))})` : `$${fmt(v)}`;

    const DeltaChip2 = ({ curr, prev }: { curr: number; prev?: number }) => {
        if (prev === undefined) return null;
        const d = curr - prev;
        if (Math.abs(d) < 0.01) return null;
        return <div className={`text-[9px] font-semibold leading-tight mt-0.5 ${d > 0 ? 'text-green-500' : 'text-red-400'}`}>{d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}</div>;
    };

    const head = (k: string, label: string, cls: string, textCls: string) => (
        <tr key={k} className={cls}><td colSpan={n + 1} className={`sticky left-0 ${cls} px-4 py-2`}><span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${textCls}`}>{label}</span></td></tr>
    );

    const sub = (k: string, label: string) => (
        <tr key={k}><td className="sticky left-0 z-10 bg-background px-4 pl-6 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">{label}</td>{cols.map(({ month }) => <td key={month} />)}</tr>
    );

    const acctRow = (k: string, label: string, getVal: (d: D) => number, cls?: string) => (
        <tr key={k} className="border-b border-border/10 hover:bg-muted/20">
            <td className={`sticky left-0 z-10 bg-background px-4 pl-10 py-1.5 text-sm text-muted-foreground ${cls ?? ''}`}>{label}</td>
            {cols.map(({ month, data }, ci) => {
                const v = getVal(data);
                const prev = ci > 0 ? getVal(cols[ci - 1].data) : undefined;
                return (
                    <td key={month} className={`px-4 py-1.5 text-right text-sm tabular-nums ${v < 0 ? 'text-red-500 dark:text-red-400' : v === 0 ? 'text-muted-foreground/30' : 'text-foreground'}`}>
                        <div>{fmtAmt2(v)}</div><DeltaChip2 curr={v} prev={prev} />
                    </td>
                );
            })}
        </tr>
    );

    const subtotal = (k: string, label: string, getVal: (d: D) => number, color: string) => (
        <tr key={k} className="border-t border-border/40 bg-muted/10">
            <td className="sticky left-0 z-10 bg-muted/10 px-4 py-2 text-sm font-semibold text-foreground">{label}</td>
            {cols.map(({ month, data }, ci) => {
                const v = getVal(data);
                const prev = ci > 0 ? getVal(cols[ci - 1].data) : undefined;
                return (
                    <td key={month} className={`px-4 py-2 text-right text-sm font-semibold tabular-nums ${color}`}>
                        <div>{fmtAmt2(v)}</div><DeltaChip2 curr={v} prev={prev} />
                    </td>
                );
            })}
        </tr>
    );

    const grand = (k: string, label: string, getVal: (d: D) => number, color: string) => (
        <tr key={k} className="border-t-2 border-border bg-muted/20">
            <td className="sticky left-0 z-10 bg-muted/20 px-4 py-3 text-sm font-bold uppercase tracking-wide text-foreground">{label}</td>
            {cols.map(({ month, data }, ci) => {
                const v = getVal(data);
                const prev = ci > 0 ? getVal(cols[ci - 1].data) : undefined;
                return (
                    <td key={month} className={`px-4 py-3 text-right font-bold tabular-nums text-base ${color}`}>
                        <div>{fmtAmt2(v)}</div><DeltaChip2 curr={v} prev={prev} />
                    </td>
                );
            })}
        </tr>
    );

    const spacer = (k: string) => <tr key={k}><td colSpan={n + 1} className="py-1.5 bg-muted/5" /></tr>;

    return (
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
            <table className="w-full text-sm border-collapse" style={{ minWidth: `${Math.max(600, n * 165 + 280)}px` }}>
                <thead>
                    <tr className="bg-muted/60 border-b-2 border-border">
                        <th className="sticky left-0 z-20 bg-muted/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[280px] border-r border-border/40">Item</th>
                        {cols.map(({ month, label }) => (
                            <th key={month} className="px-4 py-3 text-right text-xs font-bold text-foreground min-w-[160px]">{label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {head('h-oper', 'Operating Activities', 'bg-green-50/50 dark:bg-green-950/20', 'text-green-700 dark:text-green-400')}
                    {acctRow('ar-netincome', 'Net Income', d => d.netIncome, 'font-medium text-foreground')}
                    {allOperAccts.length > 0 && sub('sub-wc', 'Working Capital Adjustments')}
                    {allOperAccts.map(i => acctRow(`oper-${i.account_number}`, `${i.account_number} · ${i.account_name}`, d => getOper(d, i.account_number)))}
                    {subtotal('st-oper', 'Net Cash from Operating Activities', d => d.netOperating, 'text-green-600 dark:text-green-400')}
                    {spacer('sp-1')}

                    {head('h-inv', 'Investing Activities', 'bg-indigo-50/50 dark:bg-indigo-950/20', 'text-indigo-700 dark:text-indigo-400')}
                    {allInvAccts.length === 0
                        ? <tr key="inv-empty"><td colSpan={n + 1} className="px-4 pl-10 py-2 text-xs text-muted-foreground/40 italic">No investing activity</td></tr>
                        : allInvAccts.map(i => acctRow(`inv-${i.account_number}`, `${i.account_number} · ${i.account_name}`, d => getInv(d, i.account_number)))
                    }
                    {subtotal('st-inv', 'Net Cash from Investing Activities', d => d.netInvesting, 'text-indigo-600 dark:text-indigo-400')}
                    {spacer('sp-2')}

                    {head('h-fin', 'Financing Activities', 'bg-purple-50/50 dark:bg-purple-950/20', 'text-purple-700 dark:text-purple-400')}
                    {allFinAccts.length === 0
                        ? <tr key="fin-empty"><td colSpan={n + 1} className="px-4 pl-10 py-2 text-xs text-muted-foreground/40 italic">No financing activity</td></tr>
                        : allFinAccts.map(i => acctRow(`fin-${i.account_number}`, `${i.account_number} · ${i.account_name}`, d => getFin(d, i.account_number)))
                    }
                    {subtotal('st-fin', 'Net Cash from Financing Activities', d => d.netFinancing, 'text-purple-600 dark:text-purple-400')}
                    {spacer('sp-3')}

                    {grand('gt-netchange', 'Net Increase (Decrease) in Cash', d => d.netCashChange, 'text-brand-600 dark:text-brand-400')}
                    <tr key="beg-cash" className="border-b border-border/20">
                        <td className="sticky left-0 z-10 bg-background px-4 py-2 text-sm text-muted-foreground">Cash at Beginning of Period</td>
                        {cols.map(({ month, data }, ci) => {
                            const v = data.beginningCash;
                            const prev = ci > 0 ? cols[ci - 1].data.beginningCash : undefined;
                            return <td key={month} className="px-4 py-2 text-right text-sm tabular-nums text-foreground"><div>${fmt(v)}</div><DeltaChip2 curr={v} prev={prev} /></td>;
                        })}
                    </tr>
                    {grand('gt-endcash', 'Cash at End of Period', d => d.endingCash, 'text-green-600 dark:text-green-400')}
                </tbody>
            </table>
        </div>
    );
};

// ── PLCompareTab ───────────────────────────────────────────────────────────────

const PLCompareTab: React.FC<{ data: PLMultiItem[] }> = ({ data: cols }) => {
    type D = PLMultiItem['data'];
    const n = cols.length;

    const allAccts = (getLines: (d: D) => BalanceSheetLine[]) =>
        [...new Map(cols.flatMap(c => getLines(c.data).map(l => [l.account_number, l]))).values()];

    const getAcctBal = (d: D, num: string) =>
        [...d.income, ...d.cogs, ...d.expenses, ...d.otherIncome, ...d.otherExpenses].find(l => l.account_number === num)?.balance ?? 0;

    const fmtAmt3 = (v: number, negate?: boolean) => {
        const val = negate ? -v : v;
        return val === 0 ? '—' : val < 0 ? `($${fmt(Math.abs(val))})` : `$${fmt(val)}`;
    };

    const DeltaChip3 = ({ curr, prev, negate }: { curr: number; prev?: number; negate?: boolean }) => {
        if (prev === undefined) return null;
        const d = curr - prev;
        if (Math.abs(d) < 0.01) return null;
        const up = negate ? d < 0 : d > 0;
        return <div className={`text-[9px] font-semibold leading-tight mt-0.5 ${up ? 'text-green-500' : 'text-red-400'}`}>{up ? '▲' : '▼'} ${fmt(Math.abs(d))}</div>;
    };

    const head = (k: string, label: string, cls: string, textCls: string) => (
        <tr key={k} className={cls}><td colSpan={n + 2} className={`sticky left-0 ${cls} px-4 py-2`}><span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${textCls}`}>{label}</span></td></tr>
    );

    const acctRow = (k: string, label: string, num: string, negate?: boolean) => {
        const total = cols.reduce((s, c) => s + getAcctBal(c.data, num), 0);
        const displayedTotal = negate ? -total : total;
        return (
        <tr key={k} className="border-b border-border/10 hover:bg-muted/20">
            <td className="sticky left-0 z-10 bg-background px-4 pl-10 py-1.5 text-sm text-muted-foreground">{label}</td>
            {cols.map(({ month, data }, ci) => {
                const v = getAcctBal(data, num);
                const prev = ci > 0 ? getAcctBal(cols[ci - 1].data, num) : undefined;
                const displayed = negate ? -v : v;
                return (
                    <td key={month} className={`px-4 py-1.5 text-right text-sm tabular-nums ${displayed < 0 ? 'text-red-500 dark:text-red-400' : displayed === 0 ? 'text-muted-foreground/30' : 'text-foreground'}`}>
                        <div>{fmtAmt3(v, negate)}</div><DeltaChip3 curr={v} prev={prev} negate={negate} />
                    </td>
                );
            })}
            <td className={`px-4 py-1.5 text-right text-sm tabular-nums font-semibold border-l-2 border-border/60 bg-muted/20 ${displayedTotal < 0 ? 'text-red-500 dark:text-red-400' : displayedTotal === 0 ? 'text-muted-foreground/30' : 'text-foreground'}`}>
                {fmtAmt3(total, negate)}
            </td>
        </tr>
        );
    };

    const subtotal = (k: string, label: string, getVal: (d: D) => number, color: string, negate?: boolean) => {
        const total = cols.reduce((s, c) => s + getVal(c.data), 0);
        return (
        <tr key={k} className="border-t border-border/40 bg-muted/10">
            <td className="sticky left-0 z-10 bg-muted/10 px-4 py-2 text-sm font-semibold text-foreground">{label}</td>
            {cols.map(({ month, data }, ci) => {
                const v = getVal(data);
                const prev = ci > 0 ? getVal(cols[ci - 1].data) : undefined;
                return (
                    <td key={month} className={`px-4 py-2 text-right text-sm font-semibold tabular-nums ${color}`}>
                        <div>{fmtAmt3(v, negate)}</div><DeltaChip3 curr={v} prev={prev} negate={negate} />
                    </td>
                );
            })}
            <td className={`px-4 py-2 text-right text-sm font-bold tabular-nums border-l-2 border-border/60 bg-muted/25 ${color}`}>
                {fmtAmt3(total, negate)}
            </td>
        </tr>
        );
    };

    const grand = (k: string, label: string, getVal: (d: D) => number, posColor: string, negColor: string) => {
        const total = cols.reduce((s, c) => s + getVal(c.data), 0);
        return (
        <tr key={k} className="border-t-2 border-border bg-muted/20">
            <td className="sticky left-0 z-10 bg-muted/20 px-4 py-3 text-sm font-bold uppercase tracking-wide text-foreground">{label}</td>
            {cols.map(({ month, data }, ci) => {
                const v = getVal(data);
                const prev = ci > 0 ? getVal(cols[ci - 1].data) : undefined;
                return (
                    <td key={month} className={`px-4 py-3 text-right font-bold tabular-nums text-base ${v >= 0 ? posColor : negColor}`}>
                        <div>{v < 0 ? `($${fmt(Math.abs(v))})` : `$${fmt(v)}`}</div><DeltaChip3 curr={v} prev={prev} />
                    </td>
                );
            })}
            <td className={`px-4 py-3 text-right font-bold tabular-nums text-base border-l-2 border-border/60 bg-muted/30 ${total >= 0 ? posColor : negColor}`}>
                {total < 0 ? `($${fmt(Math.abs(total))})` : `$${fmt(total)}`}
            </td>
        </tr>
        );
    };

    const spacer = (k: string) => <tr key={k}><td colSpan={n + 2} className="py-1 bg-muted/5" /></tr>;

    const incomeAccts  = allAccts(d => d.income);
    const cogsAccts    = allAccts(d => d.cogs);
    const expAccts     = allAccts(d => d.expenses);
    const oiAccts      = allAccts(d => d.otherIncome);
    const oeAccts      = allAccts(d => d.otherExpenses);

    return (
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
            <table className="w-full text-sm border-collapse" style={{ minWidth: `${Math.max(600, (n + 1) * 165 + 280)}px` }}>
                <thead>
                    <tr className="bg-muted/60 border-b-2 border-border">
                        <th className="sticky left-0 z-20 bg-muted/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[280px] border-r border-border/40">Account</th>
                        {cols.map(({ month, label }) => (
                            <th key={month} className="px-4 py-3 text-right text-xs font-bold text-foreground min-w-[160px]">{label}</th>
                        ))}
                        <th className="px-4 py-3 text-right text-xs font-bold text-foreground min-w-[160px] border-l-2 border-border/60 bg-muted/80">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {head('h-rev', 'Revenue', 'bg-green-50/50 dark:bg-green-950/20', 'text-green-700 dark:text-green-400')}
                    {incomeAccts.map(l => acctRow(`inc-${l.account_number}`, `${l.account_number} · ${l.account_name}`, l.account_number))}
                    {subtotal('st-rev', 'Total Revenue', d => d.totalRevenue, 'text-green-600 dark:text-green-400')}
                    {spacer('sp-1')}

                    {head('h-cogs', 'Cost of Goods Sold', 'bg-orange-50/50 dark:bg-orange-950/20', 'text-orange-700 dark:text-orange-400')}
                    {cogsAccts.length === 0
                        ? <tr key="cogs-empty"><td colSpan={n + 2} className="px-4 pl-10 py-2 text-xs text-muted-foreground/40 italic">No COGS for these months</td></tr>
                        : cogsAccts.map(l => acctRow(`cogs-${l.account_number}`, `${l.account_number} · ${l.account_name}`, l.account_number, true))
                    }
                    {subtotal('st-cogs', 'Total COGS', d => d.totalCogs, 'text-orange-600 dark:text-orange-400', true)}
                    {grand('gt-gp', 'Gross Profit', d => d.grossProfit, 'text-green-600 dark:text-green-400', 'text-red-600 dark:text-red-400')}
                    {spacer('sp-2')}

                    {head('h-exp', 'Operating Expenses', 'bg-rose-50/50 dark:bg-rose-950/20', 'text-rose-700 dark:text-rose-400')}
                    {expAccts.length === 0
                        ? <tr key="exp-empty"><td colSpan={n + 2} className="px-4 pl-10 py-2 text-xs text-muted-foreground/40 italic">No expenses for these months</td></tr>
                        : expAccts.map(l => acctRow(`exp-${l.account_number}`, `${l.account_number} · ${l.account_name}`, l.account_number, true))
                    }
                    {subtotal('st-exp', 'Total Expenses', d => d.totalExpenses, 'text-rose-600 dark:text-rose-400', true)}
                    {grand('gt-oi', 'Operating Income', d => d.operatingIncome, 'text-green-600 dark:text-green-400', 'text-red-600 dark:text-red-400')}
                    {spacer('sp-3')}

                    {(oiAccts.length > 0 || oeAccts.length > 0) && (<>
                        {oiAccts.length > 0 && head('h-oi', 'Other Income', 'bg-teal-50/50 dark:bg-teal-950/20', 'text-teal-700 dark:text-teal-400')}
                        {oiAccts.map(l => acctRow(`oi-${l.account_number}`, `${l.account_number} · ${l.account_name}`, l.account_number))}
                        {oiAccts.length > 0 && subtotal('st-oi', 'Total Other Income', d => d.totalOtherIncome, 'text-teal-600 dark:text-teal-400')}
                        {oeAccts.length > 0 && head('h-oe', 'Other Expenses', 'bg-red-50/50 dark:bg-red-950/20', 'text-red-700 dark:text-red-400')}
                        {oeAccts.map(l => acctRow(`oe-${l.account_number}`, `${l.account_number} · ${l.account_name}`, l.account_number, true))}
                        {oeAccts.length > 0 && subtotal('st-oe', 'Total Other Expenses', d => d.totalOtherExpenses, 'text-red-600 dark:text-red-400', true)}
                        {spacer('sp-4')}
                    </>)}

                    {grand('gt-ni', 'Net Income', d => d.netIncome, 'text-green-600 dark:text-green-400', 'text-red-600 dark:text-red-400')}
                </tbody>
            </table>
        </div>
    );
};

// ── BSCompareTab ──────────────────────────────────────────────────────────────

const BSCompareTab: React.FC<{ data: BSMultiItem[] }> = ({ data: cols }) => {
    type D = BSMultiItem['data'];
    const n = cols.length;

    // Drill-down state: key = `${acctNum}:${month}`
    const [expandedKey, setExpandedKey]     = React.useState<string | null>(null);
    const [detailCache, setDetailCache]     = React.useState<Record<string, PLDetailLine[]>>({});
    const [loadingKey, setLoadingKey]       = React.useState<string | null>(null);

    React.useEffect(() => {
        setExpandedKey(null);
        setDetailCache({});
    }, [cols]);

    const toggleCell = async (acctNum: string, month: string, acctType: string) => {
        const key = `${acctNum}:${month}`;
        if (expandedKey === key) { setExpandedKey(null); return; }
        setExpandedKey(key);
        if (detailCache[key]) return;
        setLoadingKey(key);
        try {
            const rows = await fetchAccountPLDetail(acctNum, '2000-01-01', getMonthEnd(month));
            setDetailCache(c => ({ ...c, [key]: rows }));
        } catch {
            setDetailCache(c => ({ ...c, [key]: [] }));
        } finally {
            setLoadingKey(null);
        }
    };

    const mergeAccounts = (types: string[]): BalanceSheetLine[] => {
        const seen = new Map<string, BalanceSheetLine>();
        for (const { data } of cols) {
            for (const l of [...data.assets, ...data.liabilities, ...data.equity]) {
                if (types.includes(l.account_type) && !seen.has(l.account_number))
                    seen.set(l.account_number, l);
            }
        }
        return [...seen.values()].sort((a, b) => a.account_number.localeCompare(b.account_number));
    };

    const getBal = (d: D, num: string): number => {
        const all = [...d.assets, ...d.liabilities, ...d.equity];
        const found = all.find(l => l.account_number === num);
        if (!found) return 0;
        const raw = found.is_parent
            ? all.filter(l => l.parent_account_number === num).reduce((s, l) => s + l.balance, found.balance)
            : found.balance;
        return Math.round(raw * 100) / 100;
    };

    const fmtCell = (v: number) => v === 0 ? '—' : v < 0 ? `($${fmt(Math.abs(v))})` : `$${fmt(v)}`;

    const delta = (curr: number, prevVal?: number) => {
        if (prevVal === undefined) return null;
        const d = curr - prevVal;
        return Math.abs(d) < 0.01 ? null : { d, up: d > 0 };
    };

    const DeltaChip = ({ curr, prev }: { curr: number; prev?: number }) => {
        const info = delta(curr, prev);
        if (!info) return null;
        return (
            <div className={`text-[9px] font-semibold leading-tight mt-0.5 ${info.up ? 'text-green-500' : 'text-red-400'}`}>
                {info.up ? '▲' : '▼'} ${fmt(Math.abs(info.d))}
            </div>
        );
    };

    // ── Row builders (plain functions, not React components) ──────────────────

    const sectionHeader = (label: string, cls: string, textCls: string, key: string) => (
        <tr key={key} className={cls}>
            <td colSpan={n + 1} className={`sticky left-0 ${cls} px-4 py-2`}>
                <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${textCls}`}>{label}</span>
            </td>
        </tr>
    );

    const subHeader = (label: string, key: string) => (
        <tr key={key}>
            <td className="sticky left-0 z-10 bg-background px-4 pl-6 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                {label}
            </td>
            {cols.map(({ month }) => <td key={month} />)}
        </tr>
    );

    const accountRows = (types: string[], rowKey: string) => {
        const accounts = mergeAccounts(types);
        if (accounts.length === 0) return (
            <tr key={rowKey}>
                <td className="sticky left-0 z-10 bg-background px-4 pl-10 py-1.5 text-xs text-muted-foreground/40 italic">No balances</td>
                {cols.map(({ month }) => <td key={month} className="px-4 py-1.5 text-right text-xs text-muted-foreground/30">—</td>)}
            </tr>
        );
        return accounts.flatMap(acct => {
            const isDebitNormal = DEBIT_NORMAL_GL.has(acct.account_type);
            // Find which month (if any) is currently expanded for this account
            const activeMonth = cols.find(({ month }) => expandedKey === `${acct.account_number}:${month}`)?.month ?? null;
            const detail    = activeMonth ? detailCache[`${acct.account_number}:${activeMonth}`] : undefined;
            const isLoading = activeMonth ? loadingKey === `${acct.account_number}:${activeMonth}` : false;
            const activeLabel = activeMonth ? cols.find(c => c.month === activeMonth)?.label ?? '' : '';

            const rows: React.ReactNode[] = [
                <tr key={`${rowKey}-${acct.account_number}`} className="border-b border-border/10 hover:bg-muted/10">
                    <td className={`sticky left-0 z-10 bg-background px-4 py-1.5 text-sm leading-snug ${acct.is_parent ? 'font-semibold text-foreground' : 'text-muted-foreground pl-10'}`}>
                        {acct.account_number} · {acct.account_name}
                    </td>
                    {cols.map(({ month, data }, ci) => {
                        const val = getBal(data, acct.account_number);
                        const prev = ci > 0 ? getBal(cols[ci - 1].data, acct.account_number) : undefined;
                        const key = `${acct.account_number}:${month}`;
                        const isExpanded = expandedKey === key;
                        return (
                            <td key={month} className="px-2 py-1.5 text-right">
                                <button
                                    onClick={() => toggleCell(acct.account_number, month, acct.account_type)}
                                    className={`inline-flex flex-col items-end w-full px-2 py-0.5 rounded transition-colors text-sm tabular-nums leading-snug
                                        ${isExpanded ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 ring-1 ring-brand-500/30' :
                                          val < 0 ? 'text-red-500 dark:text-red-400 hover:bg-muted/30' :
                                          val === 0 ? 'text-muted-foreground/30 hover:bg-muted/20' :
                                          'text-foreground hover:bg-muted/30'
                                        }`}
                                    title={`View transactions for ${acct.account_name} — as of ${getMonthEnd(month)}`}
                                >
                                    <span>{fmtCell(val)}</span>
                                    <DeltaChip curr={val} prev={prev} />
                                </button>
                            </td>
                        );
                    })}
                </tr>
            ];

            // Detail row appears directly below when a month is expanded
            if (activeMonth) {
                rows.push(
                    <tr key={`${rowKey}-${acct.account_number}-detail`}>
                        <td colSpan={n + 1} className="p-0 border-b border-border/30">
                            <div className="bg-muted/10">
                                {/* Header strip */}
                                <div className="flex items-center gap-2 px-6 py-1.5 bg-brand-500/5 border-b border-brand-500/10">
                                    <ChevronDown size={11} className="text-brand-500 shrink-0" />
                                    <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wide">
                                        {acct.account_number} · {acct.account_name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground ml-1">— as of {activeLabel} ({getMonthEnd(activeMonth)})</span>
                                    <button
                                        onClick={() => setExpandedKey(null)}
                                        className="ml-auto text-muted-foreground/50 hover:text-rose-500 transition text-xs px-1"
                                        title="Close"
                                    >✕</button>
                                </div>
                                {isLoading ? (
                                    <p className="px-8 py-2 text-xs text-muted-foreground italic">Loading transactions…</p>
                                ) : !detail?.length ? (
                                    <p className="px-8 py-2 text-xs text-muted-foreground italic">No posted transactions found.</p>
                                ) : (
                                    <table className="w-full text-xs">
                                        <thead className="border-b border-border/30 bg-muted/20">
                                            <tr className="text-muted-foreground">
                                                <th className="text-left px-6 py-1.5 font-medium whitespace-nowrap w-24">Date</th>
                                                <th className="text-left px-3 py-1.5 font-medium whitespace-nowrap w-24">JE #</th>
                                                <th className="text-left px-3 py-1.5 font-medium">Description</th>
                                                <th className="text-right px-4 py-1.5 font-medium whitespace-nowrap w-28">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detail.map((d, i) => {
                                                const contribution = isDebitNormal
                                                    ? d.debit - d.credit
                                                    : d.credit - d.debit;
                                                const isNeg = contribution < 0;
                                                return (
                                                    <tr key={i} className="border-b border-border/10 hover:bg-muted/20">
                                                        <td className="px-6 py-1.5 text-muted-foreground tabular-nums whitespace-nowrap">{d.entry_date}</td>
                                                        <td className="px-3 py-1.5 font-mono font-semibold text-foreground whitespace-nowrap">{d.entry_number}</td>
                                                        <td className="px-3 py-1.5 text-muted-foreground break-words">{d.line_description || d.je_description}</td>
                                                        <td className={`px-4 py-1.5 text-right tabular-nums font-medium whitespace-nowrap ${isNeg ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>
                                                            {isNeg ? `(${fmt(Math.abs(contribution))})` : fmt(contribution)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="border-t border-border/30 bg-muted/20 font-bold">
                                            <tr>
                                                <td colSpan={3} className="px-6 py-1.5 text-muted-foreground/60">
                                                    {detail.length} transaction{detail.length !== 1 ? 's' : ''}
                                                </td>
                                                <td className={`px-4 py-1.5 text-right tabular-nums ${getBal(cols.find(c => c.month === activeMonth)!.data, acct.account_number) < 0 ? 'text-red-500 dark:text-red-400' : 'text-brand-600'}`}>
                                                    {fmtCell(getBal(cols.find(c => c.month === activeMonth)!.data, acct.account_number))}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                )}
                            </div>
                        </td>
                    </tr>
                );
            }

            return rows;
        });
    };

    const subtotalRow = (label: string, extractor: (d: D) => number, color: string, key: string) => (
        <tr key={key} className="border-t border-border/40 bg-muted/10">
            <td className="sticky left-0 z-10 bg-muted/10 px-4 py-2 text-sm font-semibold text-foreground">{label}</td>
            {cols.map(({ month, data }, ci) => {
                const val = extractor(data);
                const prev = ci > 0 ? extractor(cols[ci - 1].data) : undefined;
                return (
                    <td key={month} className={`px-4 py-2 text-right text-sm font-semibold tabular-nums ${color}`}>
                        <div>${ fmt(val)}</div>
                        <DeltaChip curr={val} prev={prev} />
                    </td>
                );
            })}
        </tr>
    );

    const grandTotalRow = (label: string, extractor: (d: D) => number, color: string, key: string) => (
        <tr key={key} className="border-t-2 border-border bg-muted/20">
            <td className="sticky left-0 z-10 bg-muted/20 px-4 py-3 text-sm font-bold uppercase tracking-wide text-foreground">{label}</td>
            {cols.map(({ month, data }, ci) => {
                const val = extractor(data);
                const prev = ci > 0 ? extractor(cols[ci - 1].data) : undefined;
                return (
                    <td key={month} className={`px-4 py-3 text-right font-bold tabular-nums text-base ${color}`}>
                        <div>${fmt(val)}</div>
                        <DeltaChip curr={val} prev={prev} />
                    </td>
                );
            })}
        </tr>
    );

    const spacerRow = (key: string) => (
        <tr key={key}><td colSpan={n + 1} className="py-1.5 bg-muted/5" /></tr>
    );

    return (
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
            <table className="w-full text-sm border-collapse" style={{ minWidth: `${Math.max(600, n * 165 + 280)}px` }}>
                <thead>
                    <tr className="bg-muted/60 border-b-2 border-border">
                        <th className="sticky left-0 z-20 bg-muted/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[280px] border-r border-border/40">
                            Account
                        </th>
                        {cols.map(({ month, label, data }) => (
                            <th key={month} className="px-4 py-3 text-right text-xs min-w-[160px]">
                                <div className="font-bold text-foreground">{label}</div>
                                <div className={`text-[9px] font-normal mt-0.5 ${data.isBalanced ? 'text-green-500' : 'text-red-500'}`}>
                                    {data.isBalanced ? '✓ Balanced' : '⚠ Unbalanced'}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sectionHeader('Assets', 'bg-blue-50/50 dark:bg-blue-950/20', 'text-blue-700 dark:text-blue-400', 'sh-assets')}
                    {subHeader('Cash & Bank', 'sub-bank')}
                    {accountRows(['Bank'], 'ar-bank')}
                    {subtotalRow('Total Cash & Bank', d => d.assets.filter(l => l.account_type === 'Bank').reduce((s, l) => s + l.balance, 0), 'text-blue-600 dark:text-blue-400', 'st-bank')}

                    {subHeader('Accounts Receivable', 'sub-ar')}
                    {accountRows(['Accounts Receivable'], 'ar-ar')}
                    {subtotalRow('Total Receivables', d => d.assets.filter(l => l.account_type === 'Accounts Receivable').reduce((s, l) => s + l.balance, 0), 'text-blue-600 dark:text-blue-400', 'st-ar')}

                    {subHeader('Other Current Assets', 'sub-oca')}
                    {accountRows(['Other Current Asset'], 'ar-oca')}
                    {subtotalRow('Total Other Current Assets', d => d.assets.filter(l => l.account_type === 'Other Current Asset').reduce((s, l) => s + l.balance, 0), 'text-blue-600 dark:text-blue-400', 'st-oca')}

                    {subHeader('Fixed Assets', 'sub-fa')}
                    {accountRows(['Fixed Asset'], 'ar-fa')}
                    {subtotalRow('Total Fixed Assets', d => d.assets.filter(l => l.account_type === 'Fixed Asset').reduce((s, l) => s + l.balance, 0), 'text-blue-600 dark:text-blue-400', 'st-fa')}

                    {grandTotalRow('Total Assets', d => d.totalAssets, 'text-blue-600 dark:text-blue-400', 'gt-assets')}
                    {spacerRow('sp-1')}

                    {sectionHeader('Liabilities', 'bg-rose-50/50 dark:bg-rose-950/20', 'text-rose-700 dark:text-rose-400', 'sh-liab')}
                    {subHeader('Accounts Payable', 'sub-ap')}
                    {accountRows(['Accounts Payable'], 'ar-ap')}
                    {subtotalRow('Total Payables', d => d.liabilities.filter(l => l.account_type === 'Accounts Payable').reduce((s, l) => s + l.balance, 0), 'text-rose-600 dark:text-rose-400', 'st-ap')}

                    {subHeader('Other Current Liabilities', 'sub-ocl')}
                    {accountRows(['Other Current Liability'], 'ar-ocl')}
                    {subtotalRow('Total Other Liabilities', d => d.liabilities.filter(l => l.account_type === 'Other Current Liability').reduce((s, l) => s + l.balance, 0), 'text-rose-600 dark:text-rose-400', 'st-ocl')}

                    {grandTotalRow('Total Liabilities', d => d.totalLiabilities, 'text-rose-600 dark:text-rose-400', 'gt-liab')}
                    {spacerRow('sp-2')}

                    {sectionHeader('Equity', 'bg-purple-50/50 dark:bg-purple-950/20', 'text-purple-700 dark:text-purple-400', 'sh-eq')}
                    {accountRows(['Equity'], 'ar-eq')}
                    {/* Net Income row */}
                    {cols.length > 0 && (() => {
                        return (
                            <tr key="ar-netincome" className="border-b border-border/10 hover:bg-muted/20">
                                <td className="sticky left-0 z-10 bg-background px-4 pl-10 py-1.5 text-sm text-muted-foreground">Net Income (Current Period)</td>
                                {cols.map(({ month, data }, ci) => {
                                    const val = data.netIncome;
                                    const prev = ci > 0 ? cols[ci - 1].data.netIncome : undefined;
                                    return (
                                        <td key={month} className={`px-4 py-1.5 text-right text-sm tabular-nums ${val < 0 ? 'text-red-500 dark:text-red-400' : val === 0 ? 'text-muted-foreground/30' : 'text-green-600 dark:text-green-400'}`}>
                                            <div>{val < 0 ? `($${fmt(Math.abs(val))})` : val === 0 ? '—' : `$${fmt(val)}`}</div>
                                            <DeltaChip curr={val} prev={prev} />
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })()}
                    {grandTotalRow('Total Equity', d => d.totalEquity, 'text-purple-600 dark:text-purple-400', 'gt-eq')}
                    {spacerRow('sp-3')}

                    {/* Balance check */}
                    <tr key="le-check" className="border-t-2 border-border/60 bg-muted/30">
                        <td className="sticky left-0 z-10 bg-muted/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Liabilities + Equity</td>
                        {cols.map(({ month, data }) => {
                            const le = data.totalLiabilities + data.totalEquity;
                            return (
                                <td key={month} className={`px-4 py-2.5 text-right text-sm font-bold tabular-nums ${data.isBalanced ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                    ${fmt(le)} {data.isBalanced ? '✓' : '✗'}
                                </td>
                            );
                        })}
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

// ── AccountingDashboard ───────────────────────────────────────────────────────

type Tab = 'coa' | 'ledger' | 'journal' | 'bills' | 'vendors' | 'trial' | 'recurring' | 'bankrec' | 'balance' | 'cashflow' | 'pl';
type CashFlowData = Awaited<ReturnType<typeof computeCashFlow>>;
type PLData = Awaited<ReturnType<typeof computeProfitLoss>>;

export default function AccountingDashboard() {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { can } = usePermissions();

    const canCreate = can('accounting', 'create');
    const canEdit   = can('accounting', 'edit');
    const canDelete = can('accounting', 'delete');

    const [activeTab, setActiveTab] = useState<Tab>('coa');

    // ── Data ──────────────────────────────────────────────────────────────────
    const [accounts, setAccounts]       = useState<ChartOfAccount[]>([]);
    const [entries, setEntries]         = useState<JournalEntry[]>([]);
    const [loading, setLoading]         = useState(true);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [entriesLoaded, setEntriesLoaded]   = useState(false);

    const loadAccounts = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchChartOfAccounts();
            setAccounts(data);
        } catch (e: any) {
            addToast(`Failed to load Chart of Accounts: ${e.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    const loadEntries = useCallback(async () => {
        try {
            setLoadingEntries(true);
            const data = await fetchJournalEntries();
            setEntries(data);
            setEntriesLoaded(true);
        } catch (e: any) {
            addToast(`Failed to load journal entries: ${e.message}`, 'error');
        } finally {
            setLoadingEntries(false);
        }
    }, [addToast]);

    useEffect(() => { loadAccounts(); }, [loadAccounts]);

    useEffect(() => {
        if (activeTab === 'ledger'  && !entriesLoaded) loadEntries();
        if (activeTab === 'journal' && !entriesLoaded) loadEntries();
        if (activeTab === 'balance' && !entriesLoaded) loadEntries();
    }, [activeTab, entriesLoaded, loadEntries]);

    // ── COA state ────────────────────────────────────────────────────────────
    const [coaSearch, setCoaSearch]         = useState('');
    const [showHidden, setShowHidden]       = useState(false);
    const [collapsed, setCollapsed]         = useState<Set<string>>(new Set());
    const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
    const [showNewAccountForm, setShowNewAccountForm] = useState(false);
    const [newAccountForm, setNewAccountForm] = useState<Partial<ChartOfAccount>>({
        account_number: '', account_name: '', parent_account_number: null,
        account_type: 'Expense', description: '', is_hidden: false,
    });
    const [savingAccount, setSavingAccount] = useState(false);

    // ── General Ledger state ─────────────────────────────────────────────────
    const [glDateFrom, setGlDateFrom]     = useState(() => `${new Date().getFullYear()}-01-01`);
    const [glDateTo, setGlDateTo]         = useState(getTodayISO);
    const [glAccountFilter, setGlAccountFilter] = useState('');
    const [glPostedOnly, setGlPostedOnly] = useState(true);
    const [glCollapsed, setGlCollapsed]   = useState<Set<string>>(new Set());

    // ── Journal Entry state ───────────────────────────────────────────────────
    const [showEntryForm, setShowEntryForm]   = useState(false);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [entryHeader, setEntryHeader]       = useState<Partial<JournalEntry>>({
        entry_date: getTodayISO(), description: '', reference: '', is_posted: false,
    });
    const [entryLines, setEntryLines]         = useState<Partial<JournalEntryLine>[]>([
        { account_number: '', description: '', debit: 0, credit: 0 },
        { account_number: '', description: '', debit: 0, credit: 0 },
    ]);
    const [savingEntry, setSavingEntry]       = useState(false);
    const [deletingId, setDeletingId]         = useState<string | null>(null);
    const [journalFilter, setJournalFilter]   = useState<'all' | 'draft' | 'auto' | 'manual'>('all');
    const [journalSearch, setJournalSearch]   = useState('');
    const [jeDateFrom, setJeDateFrom]         = useState('');
    const [jeDateTo, setJeDateTo]             = useState('');
    const [postingAll, setPostingAll]         = useState(false);
    const [backfillingCOGS, setBackfillingCOGS] = useState(false);
    const [confirmDialog, setConfirmDialog]   = useState<{
        title: string; message: string; confirmText: string;
        variant: 'danger' | 'warning'; onConfirm: () => void;
    } | null>(null);

    // ── Balance Sheet state ───────────────────────────────────────────────────
    const [pdfHideZeros, setPdfHideZeros] = useState(true);
    const [bsMode, setBsMode]           = useState<'single' | 'compare'>('single');
    const [bsAsOfDate, setBsAsOfDate]   = useState(getTodayISO());
    const [bsData, setBsData]           = useState<Awaited<ReturnType<typeof computeBalanceSheet>> | null>(null);
    const [loadingBS, setLoadingBS]     = useState(false);
    const [bsMonthFrom, setBsMonthFrom] = useState(() => `${new Date().getFullYear()}-01`);
    const [bsMonthTo, setBsMonthTo]     = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [bsMultiData, setBsMultiData] = useState<BSMultiItem[]>([]);
    const [loadingBSMulti, setLoadingBSMulti] = useState(false);

    // ── Cash Flow state ───────────────────────────────────────────────────────
    const [cfMode, setCfMode]         = useState<'single' | 'compare'>('single');
    const [cfDateFrom, setCfDateFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
    const [cfDateTo, setCfDateTo]     = useState(getTodayISO);
    const [cfData, setCfData]         = useState<CashFlowData | null>(null);
    const [loadingCF, setLoadingCF]   = useState(false);
    const [cfMonthFrom, setCfMonthFrom] = useState(() => `${new Date().getFullYear()}-01`);
    const [cfMonthTo, setCfMonthTo]     = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [cfMultiData, setCfMultiData] = useState<CFMultiItem[]>([]);
    const [loadingCFMulti, setLoadingCFMulti] = useState(false);

    // ── P&L state ────────────────────────────────────────────────────────────
    const [plMode, setPlMode]         = useState<'single' | 'compare'>('single');
    const [plDateFrom, setPlDateFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
    const [plDateTo, setPlDateTo]     = useState(getTodayISO);
    const [plData, setPlData]         = useState<PLData | null>(null);
    const [loadingPL, setLoadingPL]   = useState(false);
    const [plMonthFrom, setPlMonthFrom] = useState(() => `${new Date().getFullYear()}-01`);
    const [plMonthTo, setPlMonthTo]     = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [plMultiData, setPlMultiData] = useState<PLMultiItem[]>([]);
    const [loadingPLMulti, setLoadingPLMulti] = useState(false);

    const loadBalanceSheet = useCallback(async () => {
        if (!accounts.length) return;
        try {
            setLoadingBS(true);
            const data = await computeBalanceSheet(accounts, bsAsOfDate);
            setBsData(data);
        } catch (e: any) {
            addToast(`Failed to compute balance sheet: ${e.message}`, 'error');
        } finally {
            setLoadingBS(false);
        }
    }, [accounts, bsAsOfDate, addToast]);

    const loadBalanceSheetMulti = useCallback(async () => {
        if (!accounts.length) return;
        const months = monthsBetween(bsMonthFrom, bsMonthTo);
        if (months.length === 0) { addToast('From month must not be after To month.', 'error'); return; }
        if (months.length > 12) { addToast('Maximum 12 months per comparison.', 'error'); return; }
        try {
            setLoadingBSMulti(true);
            const results = await Promise.all(
                months.map(async (ym) => {
                    const data = await computeBalanceSheet(accounts, getMonthEnd(ym));
                    const [y, m2] = ym.split('-').map(Number);
                    const label = new Date(y, m2 - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
                    return { month: ym, label, data };
                })
            );
            setBsMultiData(results);
        } catch (e: any) {
            addToast(`Failed to compute comparison: ${e.message}`, 'error');
        } finally {
            setLoadingBSMulti(false);
        }
    }, [accounts, bsMonthFrom, bsMonthTo, addToast]);

    const loadCashFlow = useCallback(async () => {
        if (!accounts.length) return;
        try {
            setLoadingCF(true);
            const data = await computeCashFlow(accounts, cfDateFrom, cfDateTo);
            setCfData(data);
        } catch (e: any) {
            addToast(`Failed to compute cash flow: ${e.message}`, 'error');
        } finally {
            setLoadingCF(false);
        }
    }, [accounts, cfDateFrom, cfDateTo, addToast]);

    const loadProfitLoss = useCallback(async () => {
        if (!accounts.length) return;
        try {
            setLoadingPL(true);
            const data = await computeProfitLoss(accounts, plDateFrom, plDateTo);
            setPlData(data);
        } catch (e: any) {
            addToast(`Failed to compute P&L: ${e.message}`, 'error');
        } finally {
            setLoadingPL(false);
        }
    }, [accounts, plDateFrom, plDateTo, addToast]);

    const loadCFMulti = useCallback(async () => {
        if (!accounts.length) return;
        const months = monthsBetween(cfMonthFrom, cfMonthTo);
        if (months.length === 0) { addToast('From month must not be after To month.', 'error'); return; }
        if (months.length > 12) { addToast('Maximum 12 months per comparison.', 'error'); return; }
        try {
            setLoadingCFMulti(true);
            const results = await Promise.all(
                months.map(async (ym) => {
                    const [y, m2] = ym.split('-').map(Number);
                    const data = await computeCashFlow(accounts, `${ym}-01`, getMonthEnd(ym));
                    const label = new Date(y, m2 - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
                    return { month: ym, label, data };
                })
            );
            setCfMultiData(results);
        } catch (e: any) {
            addToast(`Failed to compute cash flow comparison: ${e.message}`, 'error');
        } finally {
            setLoadingCFMulti(false);
        }
    }, [accounts, cfMonthFrom, cfMonthTo, addToast]);

    const loadPLMulti = useCallback(async () => {
        if (!accounts.length) return;
        const months = monthsBetween(plMonthFrom, plMonthTo);
        if (months.length === 0) { addToast('From month must not be after To month.', 'error'); return; }
        if (months.length > 12) { addToast('Maximum 12 months per comparison.', 'error'); return; }
        try {
            setLoadingPLMulti(true);
            const results = await Promise.all(
                months.map(async (ym) => {
                    const [y, m2] = ym.split('-').map(Number);
                    const data = await computeProfitLoss(accounts, `${ym}-01`, getMonthEnd(ym));
                    const label = new Date(y, m2 - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
                    return { month: ym, label, data };
                })
            );
            setPlMultiData(results);
        } catch (e: any) {
            addToast(`Failed to compute P&L comparison: ${e.message}`, 'error');
        } finally {
            setLoadingPLMulti(false);
        }
    }, [accounts, plMonthFrom, plMonthTo, addToast]);

    // ── General Ledger computed data ──────────────────────────────────────────
    const glData = useMemo(() => {
        if (!entries.length || !accounts.length) return [];
        const accountMap = new Map(accounts.map(a => [a.account_number, a]));
        type GLLine = {
            account_number: string; entry_date: string; entry_number: string;
            source: string; je_description: string; line_description: string;
            split: string; debit: number; credit: number; is_posted: boolean; running: number;
        };
        const grouped = new Map<string, GLLine[]>();

        for (const entry of entries) {
            if (glPostedOnly && !entry.is_posted) continue;
            if (entry.entry_date < glDateFrom || entry.entry_date > glDateTo) continue;
            const lines = entry.lines ?? [];
            for (const line of lines) {
                const otherNums = lines.filter(l => l.account_number !== line.account_number).map(l => l.account_number);
                const split = lines.length > 2 ? '-SPLIT-' : otherNums[0] ?? '';
                const row: GLLine = {
                    account_number: line.account_number,
                    entry_date: entry.entry_date,
                    entry_number: entry.entry_number,
                    source: entry.source ?? 'manual',
                    je_description: entry.description,
                    line_description: line.description ?? '',
                    split,
                    debit: Number(line.debit),
                    credit: Number(line.credit),
                    is_posted: entry.is_posted,
                    running: 0,
                };
                if (!grouped.has(line.account_number)) grouped.set(line.account_number, []);
                grouped.get(line.account_number)!.push(row);
            }
        }

        const result: {
            account_number: string; account_name: string; account_type: string;
            lines: (GLLine & { running: number })[]; totalDebit: number; totalCredit: number; endingBalance: number;
        }[] = [];

        for (const acc of accounts) {
            const lines = grouped.get(acc.account_number);
            if (!lines || lines.length === 0) continue;
            if (glAccountFilter && !`${acc.account_number} ${acc.account_name}`.toLowerCase().includes(glAccountFilter.toLowerCase())) continue;
            lines.sort((a, b) => a.entry_date !== b.entry_date ? a.entry_date.localeCompare(b.entry_date) : a.entry_number.localeCompare(b.entry_number));
            const isDebitNormal = DEBIT_NORMAL_GL.has(acc.account_type);
            let running = 0;
            for (const line of lines) {
                running += isDebitNormal ? (line.debit - line.credit) : (line.credit - line.debit);
                line.running = running;
            }
            result.push({
                account_number: acc.account_number,
                account_name: acc.account_name,
                account_type: acc.account_type,
                lines,
                totalDebit: lines.reduce((s, l) => s + l.debit, 0),
                totalCredit: lines.reduce((s, l) => s + l.credit, 0),
                endingBalance: running,
            });
        }
        return result;
    }, [entries, accounts, glDateFrom, glDateTo, glPostedOnly, glAccountFilter]);

    useEffect(() => {
        if (activeTab === 'balance' && accounts.length) loadBalanceSheet();
    }, [activeTab, accounts, loadBalanceSheet]);

    useEffect(() => {
        if (activeTab === 'cashflow' && accounts.length) loadCashFlow();
    }, [activeTab, accounts, loadCashFlow]);

    useEffect(() => {
        if (activeTab === 'pl' && accounts.length) loadProfitLoss();
    }, [activeTab, accounts, loadProfitLoss]);

    // ── COA helpers ───────────────────────────────────────────────────────────

    const filteredAccounts = useMemo(() => {
        let result = accounts;
        if (!showHidden) result = result.filter(a => !a.is_hidden);
        if (coaSearch.trim()) {
            const q = coaSearch.toLowerCase();
            result = result.filter(a =>
                a.account_number.includes(q) ||
                a.account_name.toLowerCase().includes(q) ||
                a.account_type.toLowerCase().includes(q)
            );
        }
        return [...result].sort((a, b) =>
            a.account_number.localeCompare(b.account_number, undefined, { numeric: true })
        );
    }, [accounts, showHidden, coaSearch]);

    const parentOptions = useMemo(() =>
        accounts.filter(a => !a.parent_account_number && a.account_type !== 'Non-Posting'),
        [accounts]
    );

    const toggleCollapse = (accountNumber: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(accountNumber) ? next.delete(accountNumber) : next.add(accountNumber);
            return next;
        });
    };

    const handleSaveAccount = async () => {
        const form = editingAccount ? { ...editingAccount } : newAccountForm;
        if (!form.account_number?.trim() || !form.account_name?.trim() || !form.account_type) {
            addToast('Account number, name, and type are required.', 'error');
            return;
        }
        setSavingAccount(true);
        try {
            if (editingAccount) {
                const updated = await updateAccount(editingAccount.id, {
                    account_name:          editingAccount.account_name,
                    account_type:          editingAccount.account_type,
                    parent_account_number: editingAccount.parent_account_number,
                    description:           editingAccount.description,
                    is_hidden:             editingAccount.is_hidden,
                });
                setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
                addToast('Account updated.', 'success');
                setEditingAccount(null);
            } else {
                const created = await createAccount({
                    account_number:        form.account_number!.trim(),
                    account_name:          form.account_name!.trim(),
                    parent_account_number: form.parent_account_number || null,
                    account_type:          form.account_type!,
                    description:           form.description || '',
                    is_hidden:             false,
                    sort_order:            accounts.length * 10 + 10,
                });
                setAccounts(prev => [...prev, created].sort((a, b) => a.account_number.localeCompare(b.account_number, undefined, { numeric: true })));
                addToast('Account created.', 'success');
                setShowNewAccountForm(false);
                setNewAccountForm({ account_number: '', account_name: '', parent_account_number: null, account_type: 'Expense', description: '', is_hidden: false });
            }
        } catch (e: any) {
            addToast(`Failed to save account: ${e.message}`, 'error');
        } finally {
            setSavingAccount(false);
        }
    };

    const handleToggleHidden = async (account: ChartOfAccount) => {
        try {
            const updated = await updateAccount(account.id, { is_hidden: !account.is_hidden });
            setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
            addToast(`Account ${updated.is_hidden ? 'deactivated' : 'activated'}.`, 'success');
        } catch (e: any) {
            addToast(`Failed to update account: ${e.message}`, 'error');
        }
    };

    // ── Journal Entry helpers ─────────────────────────────────────────────────

    const entryBalance = useMemo(() => {
        const totalDebit  = entryLines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
        const totalCredit = entryLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
        return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.001 };
    }, [entryLines]);

    const addLine = () =>
        setEntryLines(prev => [...prev, { account_number: '', description: '', debit: 0, credit: 0 }]);

    const removeLine = (i: number) =>
        setEntryLines(prev => prev.filter((_, idx) => idx !== i));

    const updateLine = (i: number, field: keyof JournalEntryLine, value: any) =>
        setEntryLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

    const resetEntryForm = async () => {
        const nextNum = await getNextEntryNumber();
        setEditingEntryId(null);
        setEntryHeader({ entry_number: nextNum, entry_date: getTodayISO(), description: '', reference: '', is_posted: false });
        setEntryLines([
            { account_number: '', description: '', debit: 0, credit: 0 },
            { account_number: '', description: '', debit: 0, credit: 0 },
        ]);
        setShowEntryForm(true);
    };

    const openEditForm = (entry: JournalEntry) => {
        setEditingEntryId(entry.id!);
        setEntryHeader({
            entry_number: entry.entry_number,
            entry_date:   entry.entry_date,
            description:  entry.description,
            reference:    entry.reference,
            is_posted:    entry.is_posted,
        });
        setEntryLines(
            entry.lines && entry.lines.length > 0
                ? entry.lines.map(l => ({
                    account_number: l.account_number,
                    description:    l.description,
                    debit:          l.debit,
                    credit:         l.credit,
                }))
                : [
                    { account_number: '', description: '', debit: 0, credit: 0 },
                    { account_number: '', description: '', debit: 0, credit: 0 },
                ],
        );
        setShowEntryForm(true);
    };

    const handleSaveEntry = async () => {
        if (!entryBalance.balanced) {
            addToast('Entry is not balanced — debits must equal credits.', 'error');
            return;
        }
        const validLines = entryLines.filter(l => l.account_number && (Number(l.debit) > 0 || Number(l.credit) > 0));
        if (validLines.length < 2) {
            addToast('At least 2 valid lines (with an account and amount) are required.', 'error');
            return;
        }
        const mappedLines = validLines.map(l => ({
            account_number: l.account_number!,
            description:    l.description || '',
            debit:          Number(l.debit)  || 0,
            credit:         Number(l.credit) || 0,
        }));

        setSavingEntry(true);
        try {
            if (editingEntryId) {
                // ── Edit mode ──────────────────────────────────────────────────
                const updated = await updateJournalEntry(
                    editingEntryId,
                    {
                        entry_date:  entryHeader.entry_date || getTodayISO(),
                        description: entryHeader.description || '',
                        reference:   entryHeader.reference || '',
                    },
                    mappedLines,
                );
                setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
                setShowEntryForm(false);
                setEditingEntryId(null);
                addToast(`Journal entry ${updated.entry_number} updated.`, 'success');
            } else {
                // ── Create mode ────────────────────────────────────────────────
                const created = await createJournalEntry(
                    {
                        entry_number: entryHeader.entry_number || 'JE-0001',
                        entry_date:   entryHeader.entry_date || getTodayISO(),
                        description:  entryHeader.description || '',
                        reference:    entryHeader.reference || '',
                        created_by:   currentUser?.Name || '',
                        is_posted:    false,
                    },
                    mappedLines,
                );
                setEntries(prev => [created, ...prev]);
                setShowEntryForm(false);
                addToast(`Journal entry ${created.entry_number} saved.`, 'success');
            }
        } catch (e: any) {
            addToast(`Failed to save entry: ${e.message}`, 'error');
        } finally {
            setSavingEntry(false);
        }
    };

    const handleDeleteEntry = async (id: string) => {
        const entry = entries.find(e => e.id === id);
        if (entry?.is_posted) {
            addToast(`Cannot delete posted entry ${entry.entry_number}. Unpost it first.`, 'error');
            return;
        }
        setDeletingId(id);
        try {
            await deleteJournalEntry(id);
            setEntries(prev => prev.filter(e => e.id !== id));
            addToast('Journal entry deleted.', 'success');
        } catch (e: any) {
            addToast(`Failed to delete entry: ${e.message}`, 'error');
        } finally {
            setDeletingId(null);
        }
    };

    // Wipe every cached report so the next tab visit re-queries with the correct is_posted state.
    const invalidateReports = useCallback(() => {
        setBsData(null);
        setBsMultiData([]);
        setPlData(null);
        setPlMultiData([]);
        setCfData(null);
        setCfMultiData([]);
    }, []);

    const handleTogglePost = (entry: JournalEntry) => {
        const doToggle = async () => {
            try {
                const updated = await togglePostJournalEntry(entry.id!, !entry.is_posted);
                // Bubble the toggled entry to top so it's immediately visible in "All" view
                setEntries(prev => {
                    const toggled = { ...prev.find(e => e.id === updated.id)!, is_posted: updated.is_posted };
                    return [toggled, ...prev.filter(e => e.id !== updated.id)];
                });
                addToast(updated.is_posted ? 'Entry posted.' : 'Entry unposted.', 'success');
                invalidateReports();
            } catch (e: any) {
                addToast(`Failed to update entry: ${e.message}`, 'error');
            }
        };
        if (entry.is_posted) {
            setConfirmDialog({
                title: `Unpost ${entry.entry_number}?`,
                message: 'This will remove it from all financial reports until it is reposted.',
                confirmText: 'Unpost',
                variant: 'warning',
                onConfirm: () => { setConfirmDialog(null); doToggle(); },
            });
        } else {
            doToggle();
        }
    };

    // Inline account name lookup for journal lines display
    const accountMap = useMemo(() =>
        Object.fromEntries(accounts.map(a => [a.account_number, a.account_name])),
        [accounts]
    );

    // ── Journal filter + counts ───────────────────────────────────────────────
    const filteredEntries = useMemo(() => {
        let base: JournalEntry[];
        switch (journalFilter) {
            case 'draft':  base = entries.filter(e => !e.is_posted); break;
            case 'auto':   base = entries.filter(e => e.source && e.source !== 'manual'); break;
            case 'manual': base = entries.filter(e => !e.source || e.source === 'manual'); break;
            default:       base = entries;
        }
        if (jeDateFrom) base = base.filter(e => e.entry_date >= jeDateFrom);
        if (jeDateTo)   base = base.filter(e => e.entry_date <= jeDateTo);
        if (!journalSearch.trim()) return base;
        const q = journalSearch.toLowerCase();
        return base.filter(e =>
            e.entry_number?.toLowerCase().includes(q) ||
            e.description?.toLowerCase().includes(q) ||
            e.reference?.toLowerCase().includes(q) ||
            e.created_by?.toLowerCase().includes(q) ||
            e.lines?.some(l => l.description?.toLowerCase().includes(q) || l.account_number?.includes(q))
        );
    }, [entries, journalFilter, journalSearch, jeDateFrom, jeDateTo]);

    const draftCount = useMemo(() => entries.filter(e => !e.is_posted).length, [entries]);
    const autoCount  = useMemo(() => entries.filter(e => e.source && e.source !== 'manual').length, [entries]);

    const handlePostAllDrafts = () => {
        const drafts = filteredEntries.filter(e => !e.is_posted);
        if (drafts.length === 0) { addToast('No draft entries to post.', 'info'); return; }
        setConfirmDialog({
            title: `Post ${drafts.length} draft ${drafts.length === 1 ? 'entry' : 'entries'}?`,
            message: 'This will add all drafts in the current view to all financial reports.',
            confirmText: 'Post All',
            variant: 'warning',
            onConfirm: () => { setConfirmDialog(null); doPostAllDrafts(drafts); },
        });
    };

    const doPostAllDrafts = async (drafts: JournalEntry[]) => {
        setPostingAll(true);
        let posted = 0;
        let failed = 0;
        for (const entry of drafts) {
            try {
                const updated = await togglePostJournalEntry(entry.id!, true);
                setEntries(prev => prev.map(e => e.id === updated.id ? { ...e, is_posted: true } : e));
                posted++;
            } catch {
                failed++;
            }
        }
        setPostingAll(false);
        if (failed === 0) addToast(`${posted} ${posted === 1 ? 'entry' : 'entries'} posted successfully.`, 'success');
        else addToast(`${posted} posted, ${failed} failed (unbalanced?). Check failed entries.`, 'error');
        invalidateReports();
    };

    const handleBackfillCOGS = () => {
        setConfirmDialog({
            title: 'Back-fill COGS?',
            message: 'Creates draft COGS journal entries for all invoices currently missing cost lines. Review and post them when ready.',
            confirmText: 'Back-fill',
            variant: 'warning',
            onConfirm: () => { setConfirmDialog(null); doBackfillCOGS(); },
        });
    };

    const doBackfillCOGS = async () => {
        setBackfillingCOGS(true);
        try {
            const result = await backfillAllMissingCOGS(currentUser?.Name || 'admin');
            if (result.backfilled === 0) {
                addToast(`All ${result.total} invoice journals already have COGS lines. Nothing to back-fill.`, 'info');
            } else {
                addToast(`Back-fill complete: ${result.backfilled} COGS draft${result.backfilled !== 1 ? 's' : ''} created, ${result.skipped} skipped. Post them when ready.`, 'success');
                await loadEntries();
            }
        } catch (e: any) {
            addToast(`Back-fill failed: ${e.message}`, 'error');
        } finally {
            setBackfillingCOGS(false);
        }
    };

    // ── Render helpers ────────────────────────────────────────────────────────

    const TabBtn = ({ id, label, icon }: { id: Tab; label: string; icon: React.ReactNode }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === id
                    ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
        >
            {icon}
            {label}
        </button>
    );


    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
        <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-brand-600/10">
                        <BookOpen className="w-7 h-7 text-brand-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Chart of Accounts · General Ledger · Journal Entries · Trial Balance · Recurring · Bank Reconciliation · Balance Sheet · Cash Flow · Profit &amp; Loss</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 flex-wrap border-b border-border pb-0">
                <TabBtn id="coa"      label="Chart of Accounts" icon={<Landmark size={15} />} />
                <TabBtn id="ledger"   label="General Ledger"    icon={<BookOpen size={15} />} />
                <TabBtn id="journal"  label="Journal Entries"   icon={<FileText size={15} />} />
                <TabBtn id="bills"    label="Bills"             icon={<Receipt size={15} />} />
                <TabBtn id="vendors"  label="Vendors"           icon={<Building2 size={15} />} />
                <TabBtn id="trial"    label="Trial Balance"     icon={<ListChecks size={15} />} />
                <TabBtn id="recurring" label="Recurring"        icon={<Repeat size={15} />} />
                <TabBtn id="bankrec"  label="Bank Reconciliation" icon={<Banknote size={15} />} />
                <TabBtn id="balance"  label="Balance Sheet"     icon={<Scale size={15} />} />
                <TabBtn id="cashflow" label="Cash Flow"         icon={<Activity size={15} />} />
                <TabBtn id="pl"       label="Profit & Loss"     icon={<BarChart2 size={15} />} />
            </div>

            {/* ── TAB: Chart of Accounts ─────────────────────────────────────── */}
            {activeTab === 'coa' && (
                <div className="space-y-4">
                    {/* Toolbar */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <input
                            type="text"
                            placeholder="Search accounts…"
                            value={coaSearch}
                            onChange={e => setCoaSearch(e.target.value)}
                            className="flex-1 min-w-[200px] h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-600/40"
                        />
                        <button
                            onClick={() => setShowHidden(v => !v)}
                            className={`flex items-center gap-1.5 px-3 h-9 text-sm rounded-lg border transition-colors ${
                                showHidden
                                    ? 'border-brand-600 bg-brand-600/10 text-brand-600'
                                    : 'border-border text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                            {showHidden ? 'Hiding hidden' : 'Show hidden'}
                        </button>
                        {canCreate && (
                            <Button
                                size="sm"
                                onClick={() => setShowNewAccountForm(v => !v)}
                                className="bg-brand-600 hover:bg-brand-700 gap-1.5"
                            >
                                <PlusCircle size={14} /> New Account
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportCoA(accounts, new Date().toISOString().slice(0, 10))}
                            className="gap-1.5 ml-auto"
                        >
                            <Download size={13} /> Export
                        </Button>
                    </div>

                    {/* New Account Form */}
                    {showNewAccountForm && (
                        <div className="bg-card border border-brand-600/30 rounded-xl p-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Account #</label>
                                <input
                                    type="text"
                                    value={newAccountForm.account_number || ''}
                                    onChange={e => setNewAccountForm(p => ({ ...p, account_number: e.target.value }))}
                                    className="w-full mt-1 h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                    placeholder="e.g. 68600"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Account Name</label>
                                <input
                                    type="text"
                                    value={newAccountForm.account_name || ''}
                                    onChange={e => setNewAccountForm(p => ({ ...p, account_name: e.target.value }))}
                                    className="w-full mt-1 h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Type</label>
                                <select
                                    value={newAccountForm.account_type || 'Expense'}
                                    onChange={e => setNewAccountForm(p => ({ ...p, account_type: e.target.value }))}
                                    className="w-full mt-1 h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                >
                                    {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Parent Account</label>
                                <SearchableSelect
                                    value={newAccountForm.parent_account_number || ''}
                                    onChange={v => setNewAccountForm(p => ({ ...p, parent_account_number: v || null }))}
                                    options={parentOptions.map(a => ({ value: a.account_number, label: `${a.account_number} · ${a.account_name}` }))}
                                />
                            </div>
                            <div className="col-span-2 md:col-span-2">
                                <label className="text-xs font-medium text-muted-foreground">Description</label>
                                <input
                                    type="text"
                                    value={newAccountForm.description || ''}
                                    onChange={e => setNewAccountForm(p => ({ ...p, description: e.target.value }))}
                                    className="w-full mt-1 h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                />
                            </div>
                            <div className="col-span-2 md:col-span-3 flex gap-2 justify-end">
                                <Button size="sm" variant="outline" onClick={() => setShowNewAccountForm(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleSaveAccount} disabled={savingAccount} className="bg-brand-600 hover:bg-brand-700">
                                    {savingAccount ? 'Saving…' : 'Save Account'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* COA Table */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading accounts…</div>
                    ) : (
                        <div className="bg-card border border-border rounded-xl overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground w-32">Account #</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account Name</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground w-52 hidden md:table-cell">Type</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Description</th>
                                        {canEdit && <th className="px-5 py-3 w-24 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground pr-5">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {filteredAccounts.map(account => {
                                        const isParent = !account.parent_account_number;
                                        const hasChildren = accounts.some(a => a.parent_account_number === account.account_number);
                                        const isCollapsed = collapsed.has(account.account_number);

                                        if (account.parent_account_number && collapsed.has(account.parent_account_number)) return null;

                                        return (
                                            <tr
                                                key={account.id}
                                                className={`hover:bg-muted/30 transition-colors ${account.is_hidden ? 'opacity-40' : ''}`}
                                            >
                                                <td className="px-5 py-3.5 font-mono text-sm text-muted-foreground">
                                                    {account.account_number}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2" style={{ paddingLeft: account.parent_account_number ? '1.5rem' : 0 }}>
                                                        {hasChildren && (
                                                            <button onClick={() => toggleCollapse(account.account_number)} className="text-muted-foreground hover:text-foreground">
                                                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                                            </button>
                                                        )}
                                                        <span className={`text-sm ${isParent ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                                                            {account.account_name}
                                                            {account.is_hidden && <span className="ml-1.5 text-xs text-muted-foreground/60">(inactive)</span>}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 hidden md:table-cell">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${TYPE_COLORS[account.account_type] || 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                                                        {account.account_type}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-sm text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                                                    {account.description}
                                                </td>
                                                {canEdit && (
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-0.5">
                                                            <button
                                                                onClick={() => setEditingAccount({ ...account })}
                                                                title="Edit account"
                                                                className="p-1.5 rounded text-muted-foreground/50 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleToggleHidden(account)}
                                                                title={account.is_hidden ? 'Activate account' : 'Deactivate account'}
                                                                className={`p-1.5 rounded transition-colors ${
                                                                    account.is_hidden
                                                                        ? 'text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                                                        : 'text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                                }`}
                                                            >
                                                                <Power size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filteredAccounts.length === 0 && (
                                <div className="py-12 text-center text-sm text-muted-foreground">No accounts found.</div>
                            )}
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground">{accounts.filter(a => !a.is_hidden).length} active accounts · {accounts.length} total</p>

                    {/* ── Edit Account Modal ───────────────────────────────────── */}
                    {editingAccount && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">Edit Account</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">#{editingAccount.account_number}</p>
                                    </div>
                                    <button onClick={() => setEditingAccount(null)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="px-6 py-5 grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-xs font-medium text-muted-foreground">Account Name <span className="text-red-500">*</span></label>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editingAccount.account_name}
                                            onChange={e => setEditingAccount(p => p ? { ...p, account_name: e.target.value } : null)}
                                            className="w-full mt-1 h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-600/40"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">Account Type <span className="text-red-500">*</span></label>
                                        <select
                                            value={editingAccount.account_type}
                                            onChange={e => setEditingAccount(p => p ? { ...p, account_type: e.target.value } : null)}
                                            className="w-full mt-1 h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-600/40"
                                        >
                                            {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">Parent Account</label>
                                        <div className="mt-1">
                                            <SearchableSelect
                                                value={editingAccount.parent_account_number || ''}
                                                onChange={v => setEditingAccount(p => p ? { ...p, parent_account_number: v || null } : null)}
                                                options={[
                                                    { value: '', label: '— None (top-level) —' },
                                                    ...parentOptions
                                                        .filter(a => a.account_number !== editingAccount.account_number)
                                                        .map(a => ({ value: a.account_number, label: `${a.account_number} · ${a.account_name}` })),
                                                ]}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-medium text-muted-foreground">Description</label>
                                        <input
                                            type="text"
                                            value={editingAccount.description || ''}
                                            onChange={e => setEditingAccount(p => p ? { ...p, description: e.target.value } : null)}
                                            className="w-full mt-1 h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-600/40"
                                            placeholder="Optional description…"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!editingAccount.is_hidden}
                                                onChange={e => setEditingAccount(p => p ? { ...p, is_hidden: !e.target.checked } : null)}
                                                className="rounded"
                                            />
                                            <span className="text-sm text-foreground">Active <span className="text-xs text-muted-foreground">(uncheck to deactivate)</span></span>
                                        </label>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 rounded-b-2xl">
                                    <Button size="sm" variant="outline" onClick={() => setEditingAccount(null)}>Cancel</Button>
                                    <Button size="sm" onClick={handleSaveAccount} disabled={savingAccount} className="bg-brand-600 hover:bg-brand-700 min-w-[80px]">
                                        {savingAccount ? 'Saving…' : 'Save Changes'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB: General Ledger ────────────────────────────────────────── */}
            {activeTab === 'ledger' && (
                <div className="space-y-4">
                    {/* Toolbar */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-muted-foreground">From</label>
                            <input type="date" value={glDateFrom} onChange={e => setGlDateFrom(e.target.value)}
                                className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-muted-foreground">To</label>
                            <input type="date" value={glDateTo} onChange={e => setGlDateTo(e.target.value)}
                                className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                        </div>
                        <input
                            type="text"
                            placeholder="Filter by account…"
                            value={glAccountFilter}
                            onChange={e => setGlAccountFilter(e.target.value)}
                            className="h-8 px-3 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 min-w-[200px]"
                        />
                        <button
                            onClick={() => setGlPostedOnly(p => !p)}
                            className={`h-8 px-3 text-xs font-semibold rounded border transition-colors ${glPostedOnly ? 'bg-brand-600 text-white border-brand-600' : 'bg-background text-muted-foreground border-border hover:text-foreground'}`}
                        >
                            {glPostedOnly ? 'Posted only' : 'All entries'}
                        </button>
                        <span className="text-xs text-muted-foreground ml-auto">
                            {glData.length} account{glData.length !== 1 ? 's' : ''} · {glData.reduce((s, a) => s + a.lines.length, 0)} lines
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportGeneralLedger(entries, new Date().toISOString().slice(0, 10), glAccountFilter || undefined)}
                            className="gap-1.5"
                        >
                            <Download size={13} /> Export
                        </Button>
                    </div>

                    {loadingEntries ? (
                        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading entries…</div>
                    ) : glData.length === 0 ? (
                        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">No activity for the selected filters.</div>
                    ) : (
                        <div className="space-y-3">
                            {glData.map(acctGroup => {
                                const isCollapsed = glCollapsed.has(acctGroup.account_number);
                                const toggle = () => setGlCollapsed(prev => {
                                    const next = new Set(prev);
                                    next.has(acctGroup.account_number) ? next.delete(acctGroup.account_number) : next.add(acctGroup.account_number);
                                    return next;
                                });
                                return (
                                    <div key={acctGroup.account_number} className="bg-card border border-border rounded-xl overflow-hidden">
                                        {/* Account header */}
                                        <button
                                            onClick={toggle}
                                            className="w-full flex items-center justify-between px-5 py-3 bg-muted/30 hover:bg-muted/50 transition-colors border-b border-border"
                                        >
                                            <div className="flex items-center gap-3">
                                                {isCollapsed ? <ChevronRight size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                                                <span className={`text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded ${TYPE_COLORS[acctGroup.account_type] ?? 'bg-gray-100 text-gray-600'}`}>
                                                    {acctGroup.account_type}
                                                </span>
                                                <span className="text-sm font-semibold text-foreground">{acctGroup.account_number} · {acctGroup.account_name}</span>
                                            </div>
                                            <div className="flex items-center gap-6 text-xs text-muted-foreground shrink-0">
                                                <span>Dr <span className="text-foreground font-medium tabular-nums">${fmt(acctGroup.totalDebit)}</span></span>
                                                <span>Cr <span className="text-foreground font-medium tabular-nums">${fmt(acctGroup.totalCredit)}</span></span>
                                                <span className={`font-semibold tabular-nums ${acctGroup.endingBalance < 0 ? 'text-red-500' : 'text-brand-600 dark:text-brand-400'}`}>
                                                    Balance {acctGroup.endingBalance < 0 ? `($${fmt(Math.abs(acctGroup.endingBalance))})` : `$${fmt(acctGroup.endingBalance)}`}
                                                </span>
                                            </div>
                                        </button>

                                        {!isCollapsed && (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-border/40 bg-muted/10">
                                                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-[100px]">Date</th>
                                                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-[90px]">JE #</th>
                                                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Description</th>
                                                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Memo</th>
                                                            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Split</th>
                                                            <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-[100px]">Debit</th>
                                                            <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-[100px]">Credit</th>
                                                            <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-[110px]">Balance</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {acctGroup.lines.map((line, idx) => (
                                                            <tr key={`${line.entry_number}-${idx}`} className="border-b border-border/10 hover:bg-muted/20">
                                                                <td className="px-4 py-1.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{line.entry_date}</td>
                                                                <td className="px-4 py-1.5">
                                                                    <span className="text-xs font-mono text-brand-600 dark:text-brand-400">{line.entry_number}</span>
                                                                    {!line.is_posted && <span className="ml-1 text-[9px] text-amber-600 font-bold">DRAFT</span>}
                                                                </td>
                                                                <td className="px-4 py-1.5 text-xs text-foreground max-w-[200px] truncate" title={line.je_description}>{line.je_description}</td>
                                                                <td className="px-4 py-1.5 text-xs text-muted-foreground max-w-[180px] truncate" title={line.line_description}>{line.line_description || '—'}</td>
                                                                <td className="px-4 py-1.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{line.split || '—'}</td>
                                                                <td className="px-4 py-1.5 text-right text-xs tabular-nums text-foreground">{line.debit > 0 ? `$${fmt(line.debit)}` : '—'}</td>
                                                                <td className="px-4 py-1.5 text-right text-xs tabular-nums text-foreground">{line.credit > 0 ? `$${fmt(line.credit)}` : '—'}</td>
                                                                <td className={`px-4 py-1.5 text-right text-xs tabular-nums font-medium ${line.running < 0 ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>
                                                                    {line.running < 0 ? `($${fmt(Math.abs(line.running))})` : `$${fmt(line.running)}`}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {/* Totals row */}
                                                        <tr className="border-t-2 border-border/40 bg-muted/20 font-semibold">
                                                            <td colSpan={5} className="px-4 py-2 text-xs text-muted-foreground font-bold uppercase tracking-wide">Total</td>
                                                            <td className="px-4 py-2 text-right text-xs tabular-nums text-foreground">${fmt(acctGroup.totalDebit)}</td>
                                                            <td className="px-4 py-2 text-right text-xs tabular-nums text-foreground">${fmt(acctGroup.totalCredit)}</td>
                                                            <td className={`px-4 py-2 text-right text-xs tabular-nums font-bold ${acctGroup.endingBalance < 0 ? 'text-red-500 dark:text-red-400' : 'text-brand-600 dark:text-brand-400'}`}>
                                                                {acctGroup.endingBalance < 0 ? `($${fmt(Math.abs(acctGroup.endingBalance))})` : `$${fmt(acctGroup.endingBalance)}`}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB: Journal Entries ───────────────────────────────────────── */}
            {activeTab === 'journal' && (
                <div className="space-y-4">
                    {/* Toolbar: counts, filter chips, actions */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        {/* Filter chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {(['all', 'draft', 'auto', 'manual'] as const).map(f => {
                                const labels: Record<string, string> = {
                                    all:    `All (${entries.length})`,
                                    draft:  `Drafts (${draftCount})`,
                                    auto:   `Auto-generated (${autoCount})`,
                                    manual: `Manual`,
                                };
                                return (
                                    <button
                                        key={f}
                                        onClick={() => setJournalFilter(f)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                                            journalFilter === f
                                                ? 'bg-brand-600 text-white'
                                                : 'bg-muted text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {labels[f]}
                                    </button>
                                );
                            })}
                        </div>
                        {/* Date range + Search row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Date range */}
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="date"
                                    value={jeDateFrom}
                                    onChange={e => setJeDateFrom(e.target.value)}
                                    className="h-8 px-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 text-foreground w-34"
                                    title="From date"
                                />
                                <span className="text-xs text-muted-foreground">–</span>
                                <input
                                    type="date"
                                    value={jeDateTo}
                                    onChange={e => setJeDateTo(e.target.value)}
                                    className="h-8 px-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 text-foreground w-34"
                                    title="To date"
                                />
                                {(jeDateFrom || jeDateTo) && (
                                    <button
                                        onClick={() => { setJeDateFrom(''); setJeDateTo(''); }}
                                        className="h-8 px-2 text-xs text-muted-foreground hover:text-rose-500 border border-border rounded-lg transition-colors"
                                        title="Clear date filter"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                            {/* Search */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={journalSearch}
                                    onChange={e => setJournalSearch(e.target.value)}
                                    placeholder="Search entries…"
                                    className="h-8 pl-8 pr-8 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 w-48"
                                />
                                <svg className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                                {journalSearch && (
                                    <button onClick={() => setJournalSearch('')} className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            {canEdit && draftCount > 0 && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handlePostAllDrafts}
                                    disabled={postingAll}
                                    className="gap-1.5 border-green-500/40 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                                >
                                    <Check size={13} />
                                    {postingAll ? 'Posting…' : `Post all drafts (${draftCount})`}
                                </Button>
                            )}
                            {canCreate && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleBackfillCOGS}
                                    disabled={backfillingCOGS}
                                    className="gap-1.5 border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                                >
                                    <RefreshCw size={13} className={backfillingCOGS ? 'animate-spin' : ''} />
                                    {backfillingCOGS ? 'Back-filling…' : 'Back-fill COGS'}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => exportJournalEntries(filteredEntries, new Date().toISOString().slice(0, 10))}
                                className="gap-1.5"
                            >
                                <Download size={13} /> Export
                            </Button>
                            {canCreate && (
                                <Button size="sm" onClick={resetEntryForm} className="bg-brand-600 hover:bg-brand-700 gap-1.5">
                                    <PlusCircle size={14} /> New Journal Entry
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Entry Form */}
                    {showEntryForm && (
                        <div className="bg-card border border-brand-600/30 rounded-xl p-5 space-y-4">
                            <h3 className="font-semibold text-foreground">
                                {editingEntryId ? 'Edit Journal Entry' : 'New Journal Entry'}
                            </h3>
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Entry #</label>
                                    <input
                                        readOnly
                                        value={entryHeader.entry_number || ''}
                                        className="w-full mt-1 h-8 px-2 text-sm rounded border border-border bg-muted font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Date</label>
                                    <input
                                        type="date"
                                        value={entryHeader.entry_date || ''}
                                        onChange={e => setEntryHeader(p => ({ ...p, entry_date: e.target.value }))}
                                        className="w-full mt-1 h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                                    <input
                                        type="text"
                                        value={entryHeader.description || ''}
                                        onChange={e => setEntryHeader(p => ({ ...p, description: e.target.value }))}
                                        className="w-full mt-1 h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                        placeholder="e.g. Invoice payment received"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-muted-foreground">Reference</label>
                                    <input
                                        type="text"
                                        value={entryHeader.reference || ''}
                                        onChange={e => setEntryHeader(p => ({ ...p, reference: e.target.value }))}
                                        className="w-full mt-1 h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                        placeholder="e.g. INV-0042"
                                    />
                                </div>
                            </div>

                            {/* Lines */}
                            <div>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="pb-2 text-left text-xs font-medium text-muted-foreground w-64">Account</th>
                                            <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                                            <th className="pb-2 text-right text-xs font-medium text-muted-foreground w-28">Debit (Dr)</th>
                                            <th className="pb-2 text-right text-xs font-medium text-muted-foreground w-28">Credit (Cr)</th>
                                            <th className="pb-2 w-8" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {entryLines.map((line, i) => (
                                            <tr key={i}>
                                                <td className="py-1.5 pr-2">
                                                    <select
                                                        value={line.account_number || ''}
                                                        onChange={e => updateLine(i, 'account_number', e.target.value)}
                                                        className="w-full h-8 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                                    >
                                                        <option value="">— Select account —</option>
                                                        {accounts.filter(a => !a.is_hidden && a.account_type !== 'Non-Posting').map(a => (
                                                            <option key={a.account_number} value={a.account_number}>
                                                                {a.account_number} · {a.account_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="py-1.5 pr-2">
                                                    <input
                                                        type="text"
                                                        value={line.description || ''}
                                                        onChange={e => updateLine(i, 'description', e.target.value)}
                                                        className="w-full h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                                    />
                                                </td>
                                                <td className="py-1.5 pr-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={line.debit || ''}
                                                        onChange={e => updateLine(i, 'debit', parseFloat(e.target.value) || 0)}
                                                        className="w-full h-8 px-2 text-sm text-right rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                                    />
                                                </td>
                                                <td className="py-1.5 pr-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={line.credit || ''}
                                                        onChange={e => updateLine(i, 'credit', parseFloat(e.target.value) || 0)}
                                                        className="w-full h-8 px-2 text-sm text-right rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                                    />
                                                </td>
                                                <td className="py-1.5">
                                                    {entryLines.length > 2 && (
                                                        <button onClick={() => removeLine(i)} className="p-1 text-muted-foreground hover:text-destructive">
                                                            <X size={13} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t border-border font-semibold">
                                            <td className="pt-2 text-xs text-muted-foreground" colSpan={2}>Totals</td>
                                            <td className="pt-2 text-right text-sm">${fmt(entryBalance.totalDebit)}</td>
                                            <td className="pt-2 text-right text-sm">${fmt(entryBalance.totalCredit)}</td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>

                                <button onClick={addLine} className="mt-2 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                                    <PlusCircle size={12} /> Add line
                                </button>

                                {/* Balance indicator */}
                                <div className={`mt-3 flex items-center gap-2 text-sm font-medium ${entryBalance.balanced ? 'text-green-600' : 'text-amber-600'}`}>
                                    {entryBalance.balanced
                                        ? <><Check size={14} /> Balanced</>
                                        : <><AlertTriangle size={14} /> Difference: ${fmt(Math.abs(entryBalance.totalDebit - entryBalance.totalCredit))}</>
                                    }
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-border">
                                <Button size="sm" variant="outline" onClick={() => { setShowEntryForm(false); setEditingEntryId(null); }}>Cancel</Button>
                                <Button
                                    size="sm"
                                    onClick={handleSaveEntry}
                                    disabled={savingEntry || !entryBalance.balanced}
                                    className="bg-brand-600 hover:bg-brand-700"
                                >
                                    {savingEntry ? 'Saving…' : editingEntryId ? 'Update Entry' : 'Save Entry'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Entries List */}
                    {loadingEntries ? (
                        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading entries…</div>
                    ) : entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                            <FileText size={36} className="opacity-30" />
                            <p className="text-sm">No journal entries yet. Create your first entry to begin posting.</p>
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                            <FileText size={30} className="opacity-20" />
                            <p className="text-sm">No entries match this filter.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredEntries.map(entry => (
                                <div key={entry.id} className="bg-card border border-border rounded-xl overflow-hidden">
                                    {/* Entry header */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
                                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                                            <span className="font-mono text-sm font-semibold text-foreground shrink-0">{entry.entry_number}</span>
                                            <span className="text-sm text-muted-foreground shrink-0">{entry.entry_date}</span>
                                            {entry.description && <span className="text-sm text-foreground truncate">{entry.description}</span>}
                                            {entry.reference && <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border shrink-0">{entry.reference}</span>}
                                            {entry.source && SOURCE_BADGE[entry.source] && (
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${SOURCE_BADGE[entry.source].cls}`}>
                                                    {SOURCE_BADGE[entry.source].label}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                entry.is_posted
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            }`}>
                                                {entry.is_posted ? 'Posted' : 'Draft'}
                                            </span>
                                            <span className="text-xs text-muted-foreground hidden md:inline">Dr ${fmt(entry.total_debit ?? 0)} / Cr ${fmt(entry.total_credit ?? 0)}</span>
                                            {canEdit && !entry.is_posted && (
                                                <button
                                                    onClick={() => openEditForm(entry)}
                                                    title="Edit entry"
                                                    className="p-1.5 rounded text-muted-foreground hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            )}
                                            {canEdit && (
                                                <button
                                                    onClick={() => handleTogglePost(entry)}
                                                    title={entry.is_posted ? 'Unpost this entry' : 'Post this entry'}
                                                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                                        entry.is_posted
                                                            ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700'
                                                            : 'text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700'
                                                    }`}
                                                >
                                                    {entry.is_posted ? 'Unpost' : 'Post'}
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDeleteEntry(entry.id!)}
                                                    disabled={deletingId === entry.id || entry.is_posted}
                                                    title={entry.is_posted ? 'Cannot delete posted entry' : 'Delete entry'}
                                                    className={`p-1.5 rounded transition-colors ${
                                                        entry.is_posted
                                                            ? 'text-muted-foreground/25 cursor-not-allowed'
                                                            : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                                    }`}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {/* Lines */}
                                    {entry.lines && entry.lines.length > 0 && (
                                        <table className="w-full text-xs">
                                            <tbody className="divide-y divide-border/30">
                                                {entry.lines.map(line => (
                                                    <tr key={line.id} className="hover:bg-muted/20">
                                                        <td className="px-4 py-1.5 font-mono text-muted-foreground w-24">{line.account_number}</td>
                                                        <td className="px-2 py-1.5 text-foreground">
                                                            {accountMap[line.account_number] || line.account_number}
                                                            {line.description && <span className="ml-2 text-muted-foreground">— {line.description}</span>}
                                                        </td>
                                                        <td className="px-4 py-1.5 text-right text-foreground w-28">
                                                            {line.debit > 0 ? <span className="font-medium">${fmt(line.debit)}</span> : <span className="text-muted-foreground">—</span>}
                                                        </td>
                                                        <td className="px-4 py-1.5 text-right text-foreground w-28">
                                                            {line.credit > 0 ? <span className="font-medium">${fmt(line.credit)}</span> : <span className="text-muted-foreground">—</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB: Cash Flow ────────────────────────────────────────────── */}
            {activeTab === 'cashflow' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Mode toggle */}
                        <div className="flex items-center bg-muted rounded-lg p-0.5 shrink-0">
                            <button onClick={() => setCfMode('single')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${cfMode === 'single' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Single Period</button>
                            <button onClick={() => setCfMode('compare')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${cfMode === 'compare' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Compare Months</button>
                        </div>

                        {cfMode === 'single' ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">From</label>
                                    <input
                                        type="date"
                                        value={cfDateFrom}
                                        onChange={e => setCfDateFrom(e.target.value)}
                                className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-muted-foreground">To</label>
                            <input
                                type="date"
                                value={cfDateTo}
                                onChange={e => setCfDateTo(e.target.value)}
                                className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                            />
                        </div>
                        <Button size="sm" onClick={loadCashFlow} disabled={loadingCF} className="bg-brand-600 hover:bg-brand-700">
                            {loadingCF ? 'Computing…' : 'Refresh'}
                        </Button>
                                {cfData && (
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={() => exportCashFlow(cfData, cfDateFrom, cfDateTo)} className="gap-1.5">
                                            <Download size={13} /> Export
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => printCFPdf(cfData as any, cfDateFrom, cfDateTo, pdfHideZeros)} className="gap-1.5 border-brand-600/40 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20">
                                            <Printer size={13} /> Print PDF
                                        </Button>
                                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                                            <input type="checkbox" checked={pdfHideZeros} onChange={e => setPdfHideZeros(e.target.checked)} className="rounded" />
                                            Hide $0
                                        </label>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">From</label>
                                    <input type="month" value={cfMonthFrom} onChange={e => setCfMonthFrom(e.target.value)} className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">To</label>
                                    <input type="month" value={cfMonthTo} onChange={e => setCfMonthTo(e.target.value)} className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                                </div>
                                <Button size="sm" onClick={loadCFMulti} disabled={loadingCFMulti} className="bg-brand-600 hover:bg-brand-700">
                                    {loadingCFMulti ? 'Computing…' : 'Compare'}
                                </Button>
                                {cfMultiData.length > 0 && (
                                    <>
                                        <span className="text-xs text-muted-foreground">{cfMultiData.length} month{cfMultiData.length > 1 ? 's' : ''}</span>
                                        <Button size="sm" variant="outline" onClick={() => exportCFCompare(cfMultiData as any, cfMonthFrom, cfMonthTo)} className="gap-1.5">
                                            <Download size={13} /> Export
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => printCFComparePdf(cfMultiData as any, cfMonthFrom, cfMonthTo, pdfHideZeros)} className="gap-1.5 border-brand-600/40 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20">
                                            <Printer size={13} /> Print PDF
                                        </Button>
                                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                                            <input type="checkbox" checked={pdfHideZeros} onChange={e => setPdfHideZeros(e.target.checked)} className="rounded" />
                                            Hide $0
                                        </label>
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── Single Period view ──────────────────────────────────── */}
                    {cfMode === 'compare' ? (
                        loadingCFMulti ? (
                            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Computing comparison…</div>
                        ) : cfMultiData.length === 0 ? (
                            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Select a month range and click Compare.</div>
                        ) : (
                            <CFCompareTab data={cfMultiData} />
                        )
                    ) : loadingCF ? (
                        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Computing cash flow…</div>
                    ) : !cfData ? (
                        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Click Refresh to load the statement.</div>
                    ) : (
                        <div className="space-y-3">
                            {/* Operating Activities */}
                            <div className="bg-card border border-border rounded-xl overflow-hidden">
                                <div className="px-6 py-3.5 border-b border-border bg-muted/30 flex items-center gap-2.5">
                                    <TrendingUp className="w-4 h-4 text-green-500 shrink-0" />
                                    <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Operating Activities</h4>
                                </div>
                                <div className="px-6 py-2">
                                    <div className="flex justify-between items-baseline py-2.5 border-b border-border/30">
                                        <span className="text-sm text-muted-foreground">Net Income</span>
                                        <span className={`text-sm tabular-nums ml-8 shrink-0 font-medium ${cfData.netIncome < 0 ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>
                                            {cfData.netIncome < 0 ? `($${fmt(Math.abs(cfData.netIncome))})` : `$${fmt(cfData.netIncome)}`}
                                        </span>
                                    </div>
                                    {cfData.operatingAdjustments.length > 0 && (
                                        <>
                                            <div className="pt-3 pb-1">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">Working Capital Adjustments</p>
                                            </div>
                                            {cfData.operatingAdjustments.map(item => {
                                                const a = fmtAmt(item.amount);
                                                return (
                                                    <div key={item.account_number} className="flex justify-between items-baseline py-2 border-b border-border/20 last:border-0 pl-4">
                                                        <span className="text-sm text-muted-foreground">{item.account_number} · {item.account_name}</span>
                                                        <span className={`text-sm tabular-nums ml-8 shrink-0 ${a.negative ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>{a.display}</span>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                    <div className="flex justify-between items-baseline py-3 mt-1 border-t-2 border-border/60 font-bold">
                                        <span className="text-sm text-foreground">Net Cash from Operating Activities</span>
                                        <span className={`text-sm tabular-nums ml-8 shrink-0 ${cfData.netOperating < 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                            {cfData.netOperating < 0 ? `($${fmt(Math.abs(cfData.netOperating))})` : `$${fmt(cfData.netOperating)}`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Investing Activities */}
                            <div className="bg-card border border-border rounded-xl overflow-hidden">
                                <div className="px-6 py-3.5 border-b border-border bg-muted/30 flex items-center gap-2.5">
                                    <Scale className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Investing Activities</h4>
                                </div>
                                <div className="px-6 py-2">
                                    {cfData.investingItems.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic py-3">No investing activity for this period</p>
                                    ) : cfData.investingItems.map(item => {
                                        const a = fmtAmt(item.amount);
                                        return (
                                            <div key={item.account_number} className="flex justify-between items-baseline py-2.5 border-b border-border/30 last:border-0">
                                                <span className="text-sm text-muted-foreground">{item.account_number} · {item.account_name}</span>
                                                <span className={`text-sm tabular-nums ml-8 shrink-0 ${a.negative ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>{a.display}</span>
                                            </div>
                                        );
                                    })}
                                    <div className="flex justify-between items-baseline py-3 mt-1 border-t-2 border-border/60 font-bold">
                                        <span className="text-sm text-foreground">Net Cash from Investing Activities</span>
                                        <span className={`text-sm tabular-nums ml-8 shrink-0 ${cfData.netInvesting < 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                            {cfData.netInvesting < 0 ? `($${fmt(Math.abs(cfData.netInvesting))})` : `$${fmt(cfData.netInvesting)}`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Financing Activities */}
                            <div className="bg-card border border-border rounded-xl overflow-hidden">
                                <div className="px-6 py-3.5 border-b border-border bg-muted/30 flex items-center gap-2.5">
                                    <TrendingDown className="w-4 h-4 text-purple-500 shrink-0" />
                                    <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Financing Activities</h4>
                                </div>
                                <div className="px-6 py-2">
                                    {cfData.financingItems.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic py-3">No financing activity for this period</p>
                                    ) : cfData.financingItems.map(item => {
                                        const a = fmtAmt(item.amount);
                                        return (
                                            <div key={item.account_number} className="flex justify-between items-baseline py-2.5 border-b border-border/30 last:border-0">
                                                <span className="text-sm text-muted-foreground">{item.account_number} · {item.account_name}</span>
                                                <span className={`text-sm tabular-nums ml-8 shrink-0 ${a.negative ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>{a.display}</span>
                                            </div>
                                        );
                                    })}
                                    <div className="flex justify-between items-baseline py-3 mt-1 border-t-2 border-border/60 font-bold">
                                        <span className="text-sm text-foreground">Net Cash from Financing Activities</span>
                                        <span className={`text-sm tabular-nums ml-8 shrink-0 ${cfData.netFinancing < 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                            {cfData.netFinancing < 0 ? `($${fmt(Math.abs(cfData.netFinancing))})` : `$${fmt(cfData.netFinancing)}`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Net Change + Ending Cash */}
                            <div className={`flex justify-between items-center px-6 py-4 rounded-xl border-2 ${
                                cfData.netCashChange >= 0
                                    ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/15'
                                    : 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/15'
                            }`}>
                                <span className={`font-bold text-base ${cfData.netCashChange >= 0 ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                                    Net Increase (Decrease) in Cash
                                </span>
                                <span className={`font-bold tabular-nums text-2xl ${cfData.netCashChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {cfData.netCashChange < 0 ? `($${fmt(Math.abs(cfData.netCashChange))})` : `$${fmt(cfData.netCashChange)}`}
                                </span>
                            </div>

                            <div className="bg-card border border-border rounded-xl px-6 py-4 space-y-2.5">
                                <div className="flex justify-between items-baseline text-sm">
                                    <span className="text-muted-foreground">Cash at Beginning of Period</span>
                                    <span className="tabular-nums font-medium text-foreground ml-8 shrink-0">${fmt(cfData.beginningCash)}</span>
                                </div>
                                <div className="flex justify-between items-baseline font-bold text-base border-t border-border pt-2.5">
                                    <span className="text-foreground">Cash at End of Period</span>
                                    <span className="tabular-nums text-brand-600 dark:text-brand-400 ml-8 shrink-0">${fmt(cfData.endingCash)}</span>
                                </div>
                                {Math.abs(cfData.beginningCash + cfData.netCashChange - cfData.endingCash) > 0.02 && (
                                    <div className="flex items-center gap-1.5 text-amber-600 text-xs pt-1">
                                        <AlertTriangle size={12} /> Reconciliation difference detected — check posted entries
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB: Profit & Loss ────────────────────────────────────────── */}
            {activeTab === 'pl' && (
                <div className="space-y-4">
                    {/* Date range picker + mode toggle */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Mode toggle */}
                        <div className="flex items-center bg-muted rounded-lg p-0.5 shrink-0">
                            <button onClick={() => setPlMode('single')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${plMode === 'single' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Single Period</button>
                            <button onClick={() => setPlMode('compare')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${plMode === 'compare' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Compare Months</button>
                        </div>

                        {plMode === 'single' ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">From</label>
                                    <input
                                        type="date"
                                        value={plDateFrom}
                                        onChange={e => setPlDateFrom(e.target.value)}
                                        className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">To</label>
                                    <input
                                        type="date"
                                        value={plDateTo}
                                        onChange={e => setPlDateTo(e.target.value)}
                                        className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                    />
                                </div>
                                <Button size="sm" onClick={loadProfitLoss} disabled={loadingPL} className="bg-brand-600 hover:bg-brand-700">
                                    {loadingPL ? 'Computing…' : 'Refresh'}
                                </Button>
                                {plData && (
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={() => exportProfitLoss(plData, plDateFrom, plDateTo)} className="gap-1.5">
                                            <Download size={13} /> Export
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => printPLPdf(plData as any, plDateFrom, plDateTo, pdfHideZeros)} className="gap-1.5 border-brand-600/40 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20">
                                            <Printer size={13} /> Print PDF
                                        </Button>
                                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                                            <input type="checkbox" checked={pdfHideZeros} onChange={e => setPdfHideZeros(e.target.checked)} className="rounded" />
                                            Hide $0
                                        </label>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">From</label>
                                    <input type="month" value={plMonthFrom} onChange={e => setPlMonthFrom(e.target.value)} className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">To</label>
                                    <input type="month" value={plMonthTo} onChange={e => setPlMonthTo(e.target.value)} className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                                </div>
                                <Button size="sm" onClick={loadPLMulti} disabled={loadingPLMulti} className="bg-brand-600 hover:bg-brand-700">
                                    {loadingPLMulti ? 'Computing…' : 'Compare'}
                                </Button>
                                {plMultiData.length > 0 && (
                                    <>
                                        <span className="text-xs text-muted-foreground">{plMultiData.length} month{plMultiData.length > 1 ? 's' : ''}</span>
                                        <Button size="sm" variant="outline" onClick={() => exportPLCompare(plMultiData as any, plMonthFrom, plMonthTo)} className="gap-1.5">
                                            <Download size={13} /> Export
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => printPLComparePdf(plMultiData as any, plMonthFrom, plMonthTo, pdfHideZeros)} className="gap-1.5 border-brand-600/40 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20">
                                            <Printer size={13} /> Print PDF
                                        </Button>
                                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                                            <input type="checkbox" checked={pdfHideZeros} onChange={e => setPdfHideZeros(e.target.checked)} className="rounded" />
                                            Hide $0
                                        </label>
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── Compare view ──────────────────────────────────────── */}
                    {plMode === 'compare' ? (
                        loadingPLMulti ? (
                            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Computing comparison…</div>
                        ) : plMultiData.length === 0 ? (
                            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Select a month range and click Compare.</div>
                        ) : (
                            <PLCompareTab data={plMultiData} />
                        )
                    ) : loadingPL ? (
                        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Computing profit & loss…</div>
                    ) : !plData ? (
                        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Click Refresh to load the statement.</div>
                    ) : (
                        <div className="space-y-3">

                            {/* Revenue */}
                            <PLSection
                                title="Revenue"
                                lines={plData.income}
                                totalLabel="Total Revenue"
                                total={plData.totalRevenue}
                                totalColor="text-green-600 dark:text-green-400"
                                fmt={fmt}
                                dateFrom={plDateFrom}
                                dateTo={plDateTo}
                            />

                            {/* Cost of Goods Sold */}
                            <PLSection
                                title="Cost of Goods Sold"
                                lines={plData.cogs}
                                totalLabel="Total COGS"
                                total={plData.totalCogs}
                                totalColor="text-rose-600 dark:text-rose-400"
                                negate
                                fmt={fmt}
                                dateFrom={plDateFrom}
                                dateTo={plDateTo}
                            />

                            {/* Gross Profit */}
                            <PLSubtotal
                                label="Gross Profit"
                                value={plData.grossProfit}
                                fmt={fmt}
                                size="md"
                            />

                            {/* Operating Expenses */}
                            <PLSection
                                title="Operating Expenses"
                                lines={plData.expenses}
                                totalLabel="Total Expenses"
                                total={plData.totalExpenses}
                                totalColor="text-rose-600 dark:text-rose-400"
                                negate
                                fmt={fmt}
                                dateFrom={plDateFrom}
                                dateTo={plDateTo}
                            />

                            {/* Operating Income */}
                            <PLSubtotal
                                label="Operating Income"
                                value={plData.operatingIncome}
                                fmt={fmt}
                                size="md"
                            />

                            {/* Other Income & Expenses */}
                            {(plData.otherIncome.some(l => l.balance !== 0) || plData.otherExpenses.some(l => l.balance !== 0)) && (
                                <>
                                    <PLSection
                                        title="Other Income"
                                        lines={plData.otherIncome}
                                        totalLabel="Total Other Income"
                                        total={plData.totalOtherIncome}
                                        totalColor="text-teal-600 dark:text-teal-400"
                                        fmt={fmt}
                                        dateFrom={plDateFrom}
                                        dateTo={plDateTo}
                                    />
                                    {plData.otherExpenses.some(l => l.balance !== 0) && (
                                        <PLSection
                                            title="Other Expenses"
                                            lines={plData.otherExpenses}
                                            totalLabel="Total Other Expenses"
                                            total={plData.totalOtherExpenses}
                                            totalColor="text-rose-600 dark:text-rose-400"
                                            negate
                                            fmt={fmt}
                                            dateFrom={plDateFrom}
                                            dateTo={plDateTo}
                                        />
                                    )}
                                </>
                            )}

                            {/* Net Income */}
                            <PLSubtotal
                                label="Net Income"
                                value={plData.netIncome}
                                fmt={fmt}
                                size="lg"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB: Bills ────────────────────────────────────────────────── */}
            {activeTab === 'bills' && (
                <BillsTab accounts={accounts} />
            )}

            {/* ── TAB: Vendors ───────────────────────────────────────────── */}
            {activeTab === 'vendors' && (
                <AccountingVendorsTab />
            )}

            {/* ── TAB: Trial Balance ─────────────────────────────────────── */}
            {activeTab === 'trial' && (
                <TrialBalanceTab accounts={accounts} />
            )}

            {/* ── TAB: Recurring ─────────────────────────────────────────── */}
            {activeTab === 'recurring' && (
                <RecurringTab accounts={accounts} />
            )}

            {/* ── TAB: Bank Reconciliation ───────────────────────────────── */}
            {activeTab === 'bankrec' && (
                <BankReconciliationTab accounts={accounts} />
            )}

            {/* ── TAB: Balance Sheet ─────────────────────────────────────────── */}
            {activeTab === 'balance' && (
                <div className="space-y-4">

                    {/* ── Mode toggle + controls ──────────────────────────────── */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Mode toggle */}
                        <div className="flex items-center bg-muted rounded-lg p-0.5 shrink-0">
                            <button
                                onClick={() => setBsMode('single')}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${bsMode === 'single' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Single Date
                            </button>
                            <button
                                onClick={() => setBsMode('compare')}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${bsMode === 'compare' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Compare Months
                            </button>
                        </div>

                        {bsMode === 'single' ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">As of</label>
                                    <input
                                        type="date"
                                        value={bsAsOfDate}
                                        onChange={e => setBsAsOfDate(e.target.value)}
                                        className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                    />
                                </div>
                                <Button size="sm" onClick={loadBalanceSheet} disabled={loadingBS} className="bg-brand-600 hover:bg-brand-700">
                                    {loadingBS ? 'Computing…' : 'Refresh'}
                                </Button>
                                {bsData && (
                                    <span className={`flex items-center gap-1.5 text-sm font-medium ${bsData.isBalanced ? 'text-green-600' : 'text-red-500'}`}>
                                        {bsData.isBalanced
                                            ? <><Check size={14} /> Balanced</>
                                            : <><AlertTriangle size={14} /> Out of balance — check entries</>
                                        }
                                    </span>
                                )}
                                {bsData && (
                                    <div className="flex items-center gap-2 ml-auto">
                                        <Button size="sm" variant="outline" onClick={() => exportBalanceSheet(bsData, bsAsOfDate)} className="gap-1.5">
                                            <Download size={13} /> Export
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => printBSPdf(bsData as any, bsAsOfDate, pdfHideZeros)} className="gap-1.5 border-brand-600/40 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20">
                                            <Printer size={13} /> Print PDF
                                        </Button>
                                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                                            <input type="checkbox" checked={pdfHideZeros} onChange={e => setPdfHideZeros(e.target.checked)} className="rounded" />
                                            Hide $0
                                        </label>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">From</label>
                                    <input
                                        type="month"
                                        value={bsMonthFrom}
                                        onChange={e => setBsMonthFrom(e.target.value)}
                                        className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">To</label>
                                    <input
                                        type="month"
                                        value={bsMonthTo}
                                        onChange={e => setBsMonthTo(e.target.value)}
                                        className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                    />
                                </div>
                                <Button size="sm" onClick={loadBalanceSheetMulti} disabled={loadingBSMulti} className="bg-brand-600 hover:bg-brand-700">
                                    {loadingBSMulti ? 'Computing…' : 'Compare'}
                                </Button>
                                {bsMultiData.length > 0 && (
                                    <>
                                        <span className="text-xs text-muted-foreground">{bsMultiData.length} month{bsMultiData.length > 1 ? 's' : ''} · end-of-month balances</span>
                                        <Button size="sm" variant="outline" onClick={() => exportBSCompare(bsMultiData as any, bsMonthFrom, bsMonthTo)} className="gap-1.5">
                                            <Download size={13} /> Export
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => printBSComparePdf(bsMultiData as any, bsMonthFrom, bsMonthTo, pdfHideZeros)} className="gap-1.5 border-brand-600/40 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20">
                                            <Printer size={13} /> Print PDF
                                        </Button>
                                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                                            <input type="checkbox" checked={pdfHideZeros} onChange={e => setPdfHideZeros(e.target.checked)} className="rounded" />
                                            Hide $0
                                        </label>
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── Single Date view ────────────────────────────────────── */}
                    {bsMode === 'single' && (
                        loadingBS ? (
                            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Computing balance sheet…</div>
                        ) : !bsData ? (
                            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Click Refresh to load the balance sheet.</div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Assets */}
                                <div className="bg-card border border-border rounded-xl p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <TrendingUp className="w-4 h-4 text-blue-500" />
                                        <h3 className="font-bold text-foreground">Assets</h3>
                                    </div>
                                    <BSSection
                                        title="Cash & Bank"
                                        lines={bsData.assets.filter(l => l.account_type === 'Bank')}
                                        totalLabel="Total Cash & Bank"
                                        total={bsData.assets.filter(l => l.account_type === 'Bank').reduce((s, l) => s + l.balance, 0)}
                                        asOfDate={bsAsOfDate}
                                    />
                                    <BSSection
                                        title="Accounts Receivable"
                                        lines={bsData.assets.filter(l => l.account_type === 'Accounts Receivable')}
                                        totalLabel="Total Receivables"
                                        total={bsData.assets.filter(l => l.account_type === 'Accounts Receivable').reduce((s, l) => s + l.balance, 0)}
                                        asOfDate={bsAsOfDate}
                                    />
                                    <BSSection
                                        title="Other Current Assets"
                                        lines={bsData.assets.filter(l => l.account_type === 'Other Current Asset')}
                                        totalLabel="Total Current Assets"
                                        total={bsData.assets.filter(l => l.account_type === 'Other Current Asset').reduce((s, l) => s + l.balance, 0)}
                                        asOfDate={bsAsOfDate}
                                    />
                                    <BSSection
                                        title="Fixed Assets"
                                        lines={bsData.assets.filter(l => l.account_type === 'Fixed Asset')}
                                        totalLabel="Total Fixed Assets"
                                        total={bsData.assets.filter(l => l.account_type === 'Fixed Asset').reduce((s, l) => s + l.balance, 0)}
                                        asOfDate={bsAsOfDate}
                                    />
                                    <div className="flex justify-between pt-3 border-t-2 border-foreground font-bold text-base">
                                        <span>TOTAL ASSETS</span>
                                        <span className="text-blue-600">${fmt(bsData.totalAssets)}</span>
                                    </div>
                                </div>

                                {/* Right: Liabilities + Equity */}
                                <div className="space-y-4">
                                    <div className="bg-card border border-border rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <TrendingDown className="w-4 h-4 text-rose-500" />
                                            <h3 className="font-bold text-foreground">Liabilities</h3>
                                        </div>
                                        <BSSection
                                            title="Accounts Payable"
                                            lines={bsData.liabilities.filter(l => l.account_type === 'Accounts Payable')}
                                            totalLabel="Total Payables"
                                            total={bsData.liabilities.filter(l => l.account_type === 'Accounts Payable').reduce((s, l) => s + l.balance, 0)}
                                            asOfDate={bsAsOfDate}
                                        />
                                        <BSSection
                                            title="Other Current Liabilities"
                                            lines={bsData.liabilities.filter(l => l.account_type === 'Other Current Liability')}
                                            totalLabel="Total Liabilities"
                                            total={bsData.totalLiabilities}
                                            asOfDate={bsAsOfDate}
                                        />
                                        <div className="flex justify-between pt-3 border-t-2 border-foreground font-bold text-base">
                                            <span>TOTAL LIABILITIES</span>
                                            <span className="text-rose-600">${fmt(bsData.totalLiabilities)}</span>
                                        </div>
                                    </div>

                                    <div className="bg-card border border-border rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Scale className="w-4 h-4 text-purple-500" />
                                            <h3 className="font-bold text-foreground">Equity</h3>
                                        </div>
                                        <BSSection
                                            title="Share Capital"
                                            lines={bsData.equity}
                                            totalLabel="Total Share Capital"
                                            total={bsData.equity.reduce((s, l) => s + l.balance, 0)}
                                            asOfDate={bsAsOfDate}
                                        />
                                        <div className="flex justify-between py-1 text-sm border-b border-border/30 font-medium text-foreground">
                                            <span>Net Income (Current Period)</span>
                                            <span className={bsData.netIncome < 0 ? 'text-red-500' : 'text-green-600'}>${fmt(bsData.netIncome)}</span>
                                        </div>
                                        <div className="flex justify-between pt-3 border-t-2 border-foreground font-bold text-base">
                                            <span>TOTAL EQUITY</span>
                                            <span className="text-purple-600">${fmt(bsData.totalEquity)}</span>
                                        </div>
                                    </div>

                                    <div className={`rounded-xl p-4 flex items-center justify-between text-sm font-semibold ${
                                        bsData.isBalanced
                                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                                            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                                    }`}>
                                        <span>Liabilities + Equity</span>
                                        <span>${fmt(bsData.totalLiabilities + bsData.totalEquity)}</span>
                                    </div>

                                    <div className="bg-card border border-border rounded-xl p-5">
                                        <h3 className="font-bold text-foreground mb-3">Income Summary</h3>
                                        <div className="space-y-1.5 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Revenue</span>
                                                <span className="text-green-600 font-medium">${fmt(bsData.income.reduce((s,l)=>s+l.balance,0) + bsData.otherIncome.reduce((s,l)=>s+l.balance,0))}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Cost of Goods Sold</span>
                                                <span className="text-rose-600 font-medium">(${fmt(bsData.cogs.reduce((s,l)=>s+l.balance,0))})</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Expenses</span>
                                                <span className="text-rose-600 font-medium">(${fmt(bsData.expenses.reduce((s,l)=>s+l.balance,0) + bsData.otherExpenses.reduce((s,l)=>s+l.balance,0))})</span>
                                            </div>
                                            <div className="flex justify-between font-bold border-t border-border pt-1.5 mt-1.5">
                                                <span>Net Income</span>
                                                <span className={bsData.netIncome < 0 ? 'text-red-600' : 'text-green-600'}>${fmt(bsData.netIncome)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {/* ── Compare Months view ─────────────────────────────────── */}
                    {bsMode === 'compare' && (
                        loadingBSMulti ? (
                            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Computing comparison…</div>
                        ) : bsMultiData.length === 0 ? (
                            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                                Select a month range and click Compare to view the balance sheet side by side.
                            </div>
                        ) : (
                            <BSCompareTab data={bsMultiData} />
                        )
                    )}
                </div>
            )}
        </div>

        {confirmDialog && (
            <ConfirmationModal
                isOpen
                title={confirmDialog.title}
                confirmText={confirmDialog.confirmText}
                variant={confirmDialog.variant}
                onConfirm={confirmDialog.onConfirm}
                onClose={() => setConfirmDialog(null)}
            >
                {confirmDialog.message}
            </ConfirmationModal>
        )}
        </>
    );
}
