'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChartOfAccount, JournalEntry, JournalEntryLine, BalanceSheetLine } from '../../../types';
import {
    fetchChartOfAccounts, createAccount, updateAccount,
    fetchJournalEntries, createJournalEntry, updateJournalEntry, deleteJournalEntry,
    togglePostJournalEntry, getNextEntryNumber, computeBalanceSheet, computeCashFlow,
    computeProfitLoss,
} from '../../../services/accountingApi';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { Button } from '../../ui/button';
import {
    BookOpen, PlusCircle, Trash2, Check, X, ChevronRight, ChevronDown,
    AlertTriangle, TrendingUp, TrendingDown, Scale, Edit2, Eye, EyeOff,
    FileText, Landmark, Activity, BarChart2,
} from 'lucide-react';

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
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getTodayISO = () => new Date().toISOString().split('T')[0];

const getMonthEnd = (ym: string): string => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0).toISOString().split('T')[0];
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
}> = ({ title, lines, totalLabel, total, negate }) => {
    const relevant = lines.filter(l => l.balance !== 0);
    if (relevant.length === 0 && total === 0) return null;
    const t = fmtAmt(total, negate);
    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-3.5 border-b border-border bg-muted/30">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</h4>
            </div>
            <div className="px-6 py-2">
                {relevant.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-3">No activity for this period</p>
                ) : relevant.map(l => {
                    const a = fmtAmt(l.balance, negate);
                    return (
                        <div key={l.account_number} className={`flex justify-between items-baseline py-2.5 border-b border-border/30 last:border-0 ${l.is_parent ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                            <span className={`text-sm ${l.is_parent ? '' : 'pl-4'}`}>{l.account_number} · {l.account_name}</span>
                            <span className={`text-sm tabular-nums ml-8 shrink-0 ${a.negative ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>{a.display}</span>
                        </div>
                    );
                })}
                <div className="flex justify-between items-baseline py-3 mt-1 border-t-2 border-border/60 font-bold">
                    <span className="text-sm text-foreground">{totalLabel}</span>
                    <span className={`text-sm tabular-nums ml-8 shrink-0 ${t.negative ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{t.display}</span>
                </div>
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

// ── BSCompareTab ──────────────────────────────────────────────────────────────

const BSCompareTab: React.FC<{ data: BSMultiItem[] }> = ({ data: cols }) => {
    type D = BSMultiItem['data'];
    const n = cols.length;

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

    const getBal = (d: D, num: string) =>
        [...d.assets, ...d.liabilities, ...d.equity].find(l => l.account_number === num)?.balance ?? 0;

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
        return accounts.map(acct => (
            <tr key={`${rowKey}-${acct.account_number}`} className="border-b border-border/10 hover:bg-muted/20">
                <td className={`sticky left-0 z-10 bg-background px-4 py-1.5 text-sm leading-snug ${acct.is_parent ? 'font-semibold text-foreground' : 'text-muted-foreground pl-10'}`}>
                    {acct.account_number} · {acct.account_name}
                </td>
                {cols.map(({ month, data }, ci) => {
                    const val = getBal(data, acct.account_number);
                    const prev = ci > 0 ? getBal(cols[ci - 1].data, acct.account_number) : undefined;
                    return (
                        <td key={month} className={`px-4 py-1.5 text-right text-sm tabular-nums leading-snug ${val < 0 ? 'text-red-500 dark:text-red-400' : val === 0 ? 'text-muted-foreground/30' : 'text-foreground'}`}>
                            <div>{fmtCell(val)}</div>
                            <DeltaChip curr={val} prev={prev} />
                        </td>
                    );
                })}
            </tr>
        ));
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

type Tab = 'coa' | 'journal' | 'balance' | 'cashflow' | 'pl';
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
    const [postingAll, setPostingAll]         = useState(false);

    // ── Balance Sheet state ───────────────────────────────────────────────────
    const [bsMode, setBsMode]           = useState<'single' | 'compare'>('single');
    const [bsAsOfDate, setBsAsOfDate]   = useState(getTodayISO());
    const [bsData, setBsData]           = useState<Awaited<ReturnType<typeof computeBalanceSheet>> | null>(null);
    const [loadingBS, setLoadingBS]     = useState(false);
    const [bsMonthFrom, setBsMonthFrom] = useState(() => `${new Date().getFullYear()}-01`);
    const [bsMonthTo, setBsMonthTo]     = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [bsMultiData, setBsMultiData] = useState<BSMultiItem[]>([]);
    const [loadingBSMulti, setLoadingBSMulti] = useState(false);

    // ── Cash Flow state ───────────────────────────────────────────────────────
    const [cfDateFrom, setCfDateFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
    const [cfDateTo, setCfDateTo]     = useState(getTodayISO);
    const [cfData, setCfData]         = useState<CashFlowData | null>(null);
    const [loadingCF, setLoadingCF]   = useState(false);

    // ── P&L state ────────────────────────────────────────────────────────────
    const [plDateFrom, setPlDateFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
    const [plDateTo, setPlDateTo]     = useState(getTodayISO);
    const [plData, setPlData]         = useState<PLData | null>(null);
    const [loadingPL, setLoadingPL]   = useState(false);

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
        return result;
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
                    account_name: editingAccount.account_name,
                    description:  editingAccount.description,
                    is_hidden:    editingAccount.is_hidden,
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
                setAccounts(prev => [...prev, created].sort((a, b) => a.sort_order - b.sort_order));
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

    const handleTogglePost = async (entry: JournalEntry) => {
        // Require confirmation before removing a posted entry from the ledger
        if (entry.is_posted && !window.confirm(`Unpost ${entry.entry_number}? This will remove it from all financial reports until reposted.`)) {
            return;
        }
        try {
            const updated = await togglePostJournalEntry(entry.id!, !entry.is_posted);
            setEntries(prev => prev.map(e => e.id === updated.id ? { ...e, is_posted: updated.is_posted } : e));
            addToast(updated.is_posted ? 'Entry posted.' : 'Entry unposted.', 'success');
            // Refresh balance sheet if open
            if (activeTab === 'balance') setBsData(null);
        } catch (e: any) {
            addToast(`Failed to update entry: ${e.message}`, 'error');
        }
    };

    // Inline account name lookup for journal lines display
    const accountMap = useMemo(() =>
        Object.fromEntries(accounts.map(a => [a.account_number, a.account_name])),
        [accounts]
    );

    // ── Journal filter + counts ───────────────────────────────────────────────
    const filteredEntries = useMemo(() => {
        switch (journalFilter) {
            case 'draft':  return entries.filter(e => !e.is_posted);
            case 'auto':   return entries.filter(e => e.source && e.source !== 'manual');
            case 'manual': return entries.filter(e => !e.source || e.source === 'manual');
            default:       return entries;
        }
    }, [entries, journalFilter]);

    const draftCount = useMemo(() => entries.filter(e => !e.is_posted).length, [entries]);
    const autoCount  = useMemo(() => entries.filter(e => e.source && e.source !== 'manual').length, [entries]);

    const handlePostAllDrafts = async () => {
        const drafts = filteredEntries.filter(e => !e.is_posted);
        if (drafts.length === 0) { addToast('No draft entries to post.', 'info'); return; }
        if (!window.confirm(`Post all ${drafts.length} draft ${drafts.length === 1 ? 'entry' : 'entries'} in the current view? This will add them to all financial reports.`)) return;
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
        if (activeTab === 'balance') setBsData(null);
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

    const BSSection = ({
        title, lines, totalLabel, total,
    }: { title: string; lines: BalanceSheetLine[]; totalLabel: string; total: number; indent?: boolean }) => {
        const relevant = lines.filter(l => l.balance !== 0 || l.is_parent);
        return (
            <div className="mb-3">
                <div className="py-2 border-b border-border/50 mb-0.5">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</h4>
                </div>
                {relevant.length === 0
                    ? <p className="text-xs text-muted-foreground italic px-1 py-1.5">No balances</p>
                    : relevant.map(l => (
                        <div
                            key={l.account_number}
                            className={`flex justify-between items-baseline py-2 border-b border-border/20 last:border-0 ${
                                l.is_parent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                            }`}
                        >
                            <span className={`text-sm ${l.is_parent ? '' : 'pl-4'}`}>{l.account_number} · {l.account_name}</span>
                            <span className={`text-sm tabular-nums ml-4 shrink-0 ${l.balance < 0 ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>
                                {l.balance < 0 ? `(${fmt(Math.abs(l.balance))})` : fmt(l.balance)}
                            </span>
                        </div>
                    ))
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

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-brand-600/10">
                        <BookOpen className="w-7 h-7 text-brand-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Chart of Accounts · Journal Entries · Balance Sheet · Cash Flow · Profit &amp; Loss</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 flex-wrap border-b border-border pb-0">
                <TabBtn id="coa"      label="Chart of Accounts" icon={<Landmark size={15} />} />
                <TabBtn id="journal"  label="Journal Entries"   icon={<FileText size={15} />} />
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
                                <select
                                    value={newAccountForm.parent_account_number || ''}
                                    onChange={e => setNewAccountForm(p => ({ ...p, parent_account_number: e.target.value || null }))}
                                    className="w-full mt-1 h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                >
                                    <option value="">— None —</option>
                                    {parentOptions.map(a => (
                                        <option key={a.account_number} value={a.account_number}>
                                            {a.account_number} · {a.account_name}
                                        </option>
                                    ))}
                                </select>
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
                                        {canEdit && <th className="px-5 py-3 w-20" />}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {filteredAccounts.map(account => {
                                        const isParent = !account.parent_account_number;
                                        const hasChildren = accounts.some(a => a.parent_account_number === account.account_number);
                                        const isCollapsed = collapsed.has(account.account_number);
                                        const isEditing = editingAccount?.id === account.id;

                                        // Hide children of collapsed parents
                                        if (
                                            account.parent_account_number &&
                                            collapsed.has(account.parent_account_number)
                                        ) return null;

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
                                                        {isEditing ? (
                                                            <input
                                                                autoFocus
                                                                value={editingAccount.account_name}
                                                                onChange={e => setEditingAccount(p => p ? { ...p, account_name: e.target.value } : null)}
                                                                className="h-8 px-2 text-sm rounded border border-brand-600 bg-background focus:outline-none w-56"
                                                            />
                                                        ) : (
                                                            <span className={`text-sm ${isParent ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                                                                {account.account_name}
                                                                {account.is_hidden && <span className="ml-1.5 text-xs text-muted-foreground/60">(hidden)</span>}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 hidden md:table-cell">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${TYPE_COLORS[account.account_type] || 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                                                        {account.account_type}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-sm text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                                                    {isEditing ? (
                                                        <input
                                                            value={editingAccount.description}
                                                            onChange={e => setEditingAccount(p => p ? { ...p, description: e.target.value } : null)}
                                                            className="h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none w-full"
                                                        />
                                                    ) : account.description}
                                                </td>
                                                {canEdit && (
                                                    <td className="px-5 py-3.5">
                                                        {isEditing ? (
                                                            <div className="flex gap-1">
                                                                <button onClick={handleSaveAccount} disabled={savingAccount} className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20">
                                                                    <Check size={14} />
                                                                </button>
                                                                <button onClick={() => setEditingAccount(null)} className="p-1.5 rounded text-muted-foreground hover:bg-muted">
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setEditingAccount(account)} className="p-1.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors">
                                                                <Edit2 size={14} />
                                                            </button>
                                                        )}
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
                                                    title={entry.is_posted ? 'Unpost' : 'Post'}
                                                    className={`p-1.5 rounded transition-colors ${
                                                        entry.is_posted
                                                            ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                                            : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                                    }`}
                                                >
                                                    {entry.is_posted ? <X size={14} /> : <Check size={14} />}
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
                    </div>

                    {loadingCF ? (
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
                    {/* Date range picker */}
                    <div className="flex items-center gap-3 flex-wrap">
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
                    </div>

                    {loadingPL ? (
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
                                    <span className="text-xs text-muted-foreground">{bsMultiData.length} month{bsMultiData.length > 1 ? 's' : ''} · end-of-month balances</span>
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
                                    />
                                    <BSSection
                                        title="Accounts Receivable"
                                        lines={bsData.assets.filter(l => l.account_type === 'Accounts Receivable')}
                                        totalLabel="Total Receivables"
                                        total={bsData.assets.filter(l => l.account_type === 'Accounts Receivable').reduce((s, l) => s + l.balance, 0)}
                                    />
                                    <BSSection
                                        title="Other Current Assets"
                                        lines={bsData.assets.filter(l => l.account_type === 'Other Current Asset')}
                                        totalLabel="Total Current Assets"
                                        total={bsData.assets.filter(l => l.account_type === 'Other Current Asset').reduce((s, l) => s + l.balance, 0)}
                                    />
                                    <BSSection
                                        title="Fixed Assets"
                                        lines={bsData.assets.filter(l => l.account_type === 'Fixed Asset')}
                                        totalLabel="Total Fixed Assets"
                                        total={bsData.assets.filter(l => l.account_type === 'Fixed Asset').reduce((s, l) => s + l.balance, 0)}
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
                                        />
                                        <BSSection
                                            title="Other Current Liabilities"
                                            lines={bsData.liabilities.filter(l => l.account_type === 'Other Current Liability')}
                                            totalLabel="Total Liabilities"
                                            total={bsData.totalLiabilities}
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
    );
}
