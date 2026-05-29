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
    'Bank':                    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'Accounts Receivable':     'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    'Other Current Asset':     'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    'Fixed Asset':             'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    'Accounts Payable':        'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    'Other Current Liability': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    'Equity':                  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'Income':                  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'Cost of Goods Sold':      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'Expense':                 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    'Other Income':            'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    'Other Expense':           'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'Non-Posting':             'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Helpers ───────────────────────────────────────────────────────────────────

const getTodayISO = () => new Date().toISOString().split('T')[0];

// ── P&L helper components ─────────────────────────────────────────────────────

const PLSection: React.FC<{
    title: string;
    lines: BalanceSheetLine[];
    totalLabel: string;
    total: number;
    totalColor: string;
    negate?: boolean;
    fmt: (n: number) => string;
}> = ({ title, lines, totalLabel, total, totalColor, negate, fmt }) => {
    const relevant = lines.filter(l => l.balance !== 0);
    if (relevant.length === 0 && total === 0) return null;
    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50 bg-muted/20">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h4>
            </div>
            <div className="px-5 py-3 space-y-0.5">
                {relevant.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-1">No activity</p>
                ) : relevant.map(l => (
                    <div
                        key={l.account_number}
                        className={`flex justify-between py-1 text-sm border-b border-border/20 last:border-0 ${
                            l.is_parent ? 'font-semibold text-foreground' : 'text-muted-foreground pl-4'
                        }`}
                    >
                        <span>{l.account_number} · {l.account_name}</span>
                        <span>{negate ? `(${fmt(l.balance)})` : fmt(l.balance)}</span>
                    </div>
                ))}
                <div className={`flex justify-between pt-2 border-t-2 border-border/40 font-bold text-sm mt-1`}>
                    <span className="text-foreground">{totalLabel}</span>
                    <span className={totalColor}>
                        {negate ? `(${fmt(total)})` : fmt(total)}
                    </span>
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
}> = ({ label, value, fmt, size }) => (
    <div className={`flex justify-between items-center px-5 py-3 rounded-xl border-2 ${
        value >= 0
            ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
            : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
    }`}>
        <span className={`font-bold ${size === 'lg' ? 'text-base' : 'text-sm'} ${value >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {label}
        </span>
        <span className={`font-bold tabular-nums ${size === 'lg' ? 'text-xl' : 'text-base'} ${value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    const BSSection = ({
        title, lines, totalLabel, total, indent,
    }: { title: string; lines: BalanceSheetLine[]; totalLabel: string; total: number; indent?: boolean }) => {
        const relevant = lines.filter(l => l.balance !== 0 || l.is_parent);
        return (
            <div className="mb-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{title}</h4>
                {relevant.length === 0
                    ? <p className="text-xs text-muted-foreground italic px-2">No balances</p>
                    : relevant.map(l => (
                        <div
                            key={l.account_number}
                            className={`flex justify-between py-1 text-sm border-b border-border/30 ${
                                l.is_parent
                                    ? 'font-semibold text-foreground'
                                    : 'text-muted-foreground pl-4'
                            }`}
                        >
                            <span>{l.account_number} · {l.account_name}</span>
                            <span className={l.balance < 0 ? 'text-red-500' : ''}>{fmt(l.balance)}</span>
                        </div>
                    ))
                }
                <div className="flex justify-between py-2 font-bold text-sm border-t-2 border-foreground/20 mt-1">
                    <span>{totalLabel}</span>
                    <span className={total < 0 ? 'text-red-500' : 'text-brand-600'}>${fmt(total)}</span>
                </div>
            </div>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="p-6 space-y-5 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-brand-600/10">
                        <BookOpen className="w-6 h-6 text-brand-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
                        <p className="text-sm text-muted-foreground">Chart of Accounts · Journal Entries · Balance Sheet · Cash Flow · Profit &amp; Loss</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                <TabBtn id="coa"      label="Chart of Accounts" icon={<Landmark size={15} />} />
                <TabBtn id="journal"  label="Journal Entries"   icon={<FileText size={15} />} />
                <TabBtn id="balance"  label="Balance Sheet"     icon={<Scale size={15} />} />
                <TabBtn id="cashflow" label="Cash Flow"         icon={<Activity size={15} />} />
                <TabBtn id="pl"       label="Profit & Loss"    icon={<BarChart2 size={15} />} />
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
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-28">Account #</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Account Name</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-44 hidden md:table-cell">Type</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Description</th>
                                        {canEdit && <th className="px-4 py-2.5 w-20" />}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
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
                                                className={`hover:bg-muted/30 transition-colors ${account.is_hidden ? 'opacity-50' : ''}`}
                                            >
                                                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                                                    {account.account_number}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-1.5" style={{ paddingLeft: account.parent_account_number ? '1.25rem' : 0 }}>
                                                        {hasChildren && (
                                                            <button onClick={() => toggleCollapse(account.account_number)} className="text-muted-foreground hover:text-foreground">
                                                                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                                            </button>
                                                        )}
                                                        {isEditing ? (
                                                            <input
                                                                autoFocus
                                                                value={editingAccount.account_name}
                                                                onChange={e => setEditingAccount(p => p ? { ...p, account_name: e.target.value } : null)}
                                                                className="h-7 px-2 text-sm rounded border border-brand-600 bg-background focus:outline-none w-48"
                                                            />
                                                        ) : (
                                                            <span className={isParent ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                                                                {account.account_name}
                                                                {account.is_hidden && <span className="ml-1 text-xs text-muted-foreground">(hidden)</span>}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 hidden md:table-cell">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[account.account_type] || 'bg-gray-100 text-gray-600'}`}>
                                                        {account.account_type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                                                    {isEditing ? (
                                                        <input
                                                            value={editingAccount.description}
                                                            onChange={e => setEditingAccount(p => p ? { ...p, description: e.target.value } : null)}
                                                            className="h-7 px-2 text-sm rounded border border-border bg-background focus:outline-none w-full"
                                                        />
                                                    ) : account.description}
                                                </td>
                                                {canEdit && (
                                                    <td className="px-4 py-2.5">
                                                        {isEditing ? (
                                                            <div className="flex gap-1">
                                                                <button onClick={handleSaveAccount} disabled={savingAccount} className="p-1 rounded text-green-600 hover:bg-green-50">
                                                                    <Check size={14} />
                                                                </button>
                                                                <button onClick={() => setEditingAccount(null)} className="p-1 rounded text-muted-foreground hover:bg-muted">
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setEditingAccount(account)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
                                                                <Edit2 size={13} />
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
                        <div className="max-w-2xl space-y-4">
                            {/* Operating Activities */}
                            <div className="bg-card border border-border rounded-xl p-5">
                                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                    Operating Activities
                                </h3>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between py-1">
                                        <span className="text-muted-foreground">Net Income</span>
                                        <span className={`font-medium ${cfData.netIncome < 0 ? 'text-red-500' : 'text-foreground'}`}>
                                            ${fmt(cfData.netIncome)}
                                        </span>
                                    </div>
                                    {cfData.operatingAdjustments.length > 0 && (
                                        <>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pt-2 pb-1">
                                                Adjustments for working capital changes
                                            </p>
                                            {cfData.operatingAdjustments.map(item => (
                                                <div key={item.account_number} className="flex justify-between py-0.5 pl-3">
                                                    <span className="text-muted-foreground">{item.account_number} · {item.account_name}</span>
                                                    <span className={item.amount < 0 ? 'text-red-500' : 'text-foreground'}>
                                                        {item.amount < 0 ? `(${fmt(Math.abs(item.amount))})` : fmt(item.amount)}
                                                    </span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                    <div className="flex justify-between pt-2 border-t border-border font-bold">
                                        <span>Net Cash from Operating Activities</span>
                                        <span className={cfData.netOperating < 0 ? 'text-red-500' : 'text-green-600'}>
                                            ${fmt(cfData.netOperating)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Investing Activities */}
                            <div className="bg-card border border-border rounded-xl p-5">
                                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                                    <Scale className="w-4 h-4 text-indigo-500" />
                                    Investing Activities
                                </h3>
                                <div className="space-y-1 text-sm">
                                    {cfData.investingItems.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">No investing activity</p>
                                    ) : cfData.investingItems.map(item => (
                                        <div key={item.account_number} className="flex justify-between py-0.5">
                                            <span className="text-muted-foreground">{item.account_number} · {item.account_name}</span>
                                            <span className={item.amount < 0 ? 'text-red-500' : 'text-foreground'}>
                                                {item.amount < 0 ? `(${fmt(Math.abs(item.amount))})` : fmt(item.amount)}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between pt-2 border-t border-border font-bold">
                                        <span>Net Cash from Investing Activities</span>
                                        <span className={cfData.netInvesting < 0 ? 'text-red-500' : 'text-green-600'}>
                                            ${fmt(cfData.netInvesting)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Financing Activities */}
                            <div className="bg-card border border-border rounded-xl p-5">
                                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4 text-purple-500" />
                                    Financing Activities
                                </h3>
                                <div className="space-y-1 text-sm">
                                    {cfData.financingItems.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">No financing activity</p>
                                    ) : cfData.financingItems.map(item => (
                                        <div key={item.account_number} className="flex justify-between py-0.5">
                                            <span className="text-muted-foreground">{item.account_number} · {item.account_name}</span>
                                            <span className={item.amount < 0 ? 'text-red-500' : 'text-foreground'}>
                                                {item.amount < 0 ? `(${fmt(Math.abs(item.amount))})` : fmt(item.amount)}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between pt-2 border-t border-border font-bold">
                                        <span>Net Cash from Financing Activities</span>
                                        <span className={cfData.netFinancing < 0 ? 'text-red-500' : 'text-green-600'}>
                                            ${fmt(cfData.netFinancing)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="bg-card border border-border rounded-xl p-5 space-y-2 text-sm">
                                <div className="flex justify-between font-bold text-base border-b border-border pb-2">
                                    <span>Net Increase (Decrease) in Cash</span>
                                    <span className={cfData.netCashChange < 0 ? 'text-red-500' : 'text-green-600'}>
                                        ${fmt(cfData.netCashChange)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Cash at Beginning of Period</span>
                                    <span>${fmt(cfData.beginningCash)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-brand-600 text-base pt-1 border-t border-border">
                                    <span>Cash at End of Period</span>
                                    <span>${fmt(cfData.endingCash)}</span>
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
                        <div className="max-w-2xl space-y-2">

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
