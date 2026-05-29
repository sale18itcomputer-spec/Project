'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChartOfAccount, JournalEntry, JournalEntryLine, BalanceSheetLine } from '../../../types';
import {
    fetchChartOfAccounts, createAccount, updateAccount,
    fetchJournalEntries, createJournalEntry, deleteJournalEntry,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const getTodayISO = () => new Date().toISOString().split('T')[0];

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
    const [entryHeader, setEntryHeader]       = useState<Partial<JournalEntry>>({
        entry_date: getTodayISO(), description: '', reference: '', is_posted: false,
    });
    const [entryLines, setEntryLines]         = useState<Partial<JournalEntryLine>[]>([
        { account_number: '', description: '', debit: 0, credit: 0 },
        { account_number: '', description: '', debit: 0, credit: 0 },
    ]);
    const [savingEntry, setSavingEntry]       = useState(false);
    const [deletingId, setDeletingId]         = useState<string | null>(null);

    // ── Balance Sheet state ───────────────────────────────────────────────────
    const [bsAsOfDate, setBsAsOfDate]   = useState(getTodayISO());
    const [bsData, setBsData]           = useState<Awaited<ReturnType<typeof computeBalanceSheet>> | null>(null);
    const [loadingBS, setLoadingBS]     = useState(false);

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
        setEntryHeader({ entry_date: getTodayISO(), description: '', reference: '', is_posted: false });
        setEntryLines([
            { account_number: '', description: '', debit: 0, credit: 0 },
            { account_number: '', description: '', debit: 0, credit: 0 },
        ]);
        setShowEntryForm(true);
        setEntryHeader(prev => ({ ...prev, entry_number: nextNum }));
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
        setSavingEntry(true);
        try {
            const created = await createJournalEntry(
                {
                    entry_number: entryHeader.entry_number || 'JE-0001',
                    entry_date:   entryHeader.entry_date || getTodayISO(),
                    description:  entryHeader.description || '',
                    reference:    entryHeader.reference || '',
                    created_by:   currentUser?.Name || '',
                    is_posted:    false,
                },
                validLines.map(l => ({
                    account_number: l.account_number!,
                    description:    l.description || '',
                    debit:          Number(l.debit)  || 0,
                    credit:         Number(l.credit) || 0,
                })),
            );
            setEntries(prev => [created, ...prev]);
            setShowEntryForm(false);
            addToast(`Journal entry ${created.entry_number} saved.`, 'success');
        } catch (e: any) {
            addToast(`Failed to save entry: ${e.message}`, 'error');
        } finally {
            setSavingEntry(false);
        }
    };

    const handleDeleteEntry = async (id: string) => {
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
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide ${TYPE_COLORS[account.account_type] || 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
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
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <p className="text-sm text-muted-foreground">{entries.length} entries</p>
                        {canCreate && (
                            <Button size="sm" onClick={resetEntryForm} className="bg-brand-600 hover:bg-brand-700 gap-1.5">
                                <PlusCircle size={14} /> New Journal Entry
                            </Button>
                        )}
                    </div>

                    {/* Entry Form */}
                    {showEntryForm && (
                        <div className="bg-card border border-brand-600/30 rounded-xl p-5 space-y-4">
                            <h3 className="font-semibold text-foreground">New Journal Entry</h3>
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
                                <Button size="sm" variant="outline" onClick={() => setShowEntryForm(false)}>Cancel</Button>
                                <Button
                                    size="sm"
                                    onClick={handleSaveEntry}
                                    disabled={savingEntry || !entryBalance.balanced}
                                    className="bg-brand-600 hover:bg-brand-700"
                                >
                                    {savingEntry ? 'Saving…' : 'Save Entry'}
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
                    ) : (
                        <div className="space-y-3">
                            {entries.map(entry => (
                                <div key={entry.id} className="bg-card border border-border rounded-xl overflow-hidden">
                                    {/* Entry header */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-sm font-semibold text-foreground">{entry.entry_number}</span>
                                            <span className="text-sm text-muted-foreground">{entry.entry_date}</span>
                                            {entry.description && <span className="text-sm text-foreground">{entry.description}</span>}
                                            {entry.reference && <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border">{entry.reference}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                entry.is_posted
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            }`}>
                                                {entry.is_posted ? 'Posted' : 'Draft'}
                                            </span>
                                            <span className="text-xs text-muted-foreground">Dr ${fmt(entry.total_debit ?? 0)} / Cr ${fmt(entry.total_credit ?? 0)}</span>
                                            {canCreate && (
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
                                                    disabled={deletingId === entry.id}
                                                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
                    <div className="flex items-center gap-3 flex-wrap">
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
                    </div>

                    {loadingBS ? (
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
                                    {/* Net Income from P&L */}
                                    <div className="flex justify-between py-1 text-sm border-b border-border/30 font-medium text-foreground">
                                        <span>Net Income (Current Period)</span>
                                        <span className={bsData.netIncome < 0 ? 'text-red-500' : 'text-green-600'}>${fmt(bsData.netIncome)}</span>
                                    </div>
                                    <div className="flex justify-between pt-3 border-t-2 border-foreground font-bold text-base">
                                        <span>TOTAL EQUITY</span>
                                        <span className="text-purple-600">${fmt(bsData.totalEquity)}</span>
                                    </div>
                                </div>

                                {/* Equation check */}
                                <div className={`rounded-xl p-4 flex items-center justify-between text-sm font-semibold ${
                                    bsData.isBalanced
                                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                                }`}>
                                    <span>Liabilities + Equity</span>
                                    <span>${fmt(bsData.totalLiabilities + bsData.totalEquity)}</span>
                                </div>

                                {/* P&L Summary */}
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
                    )}
                </div>
            )}
        </div>
    );
}
