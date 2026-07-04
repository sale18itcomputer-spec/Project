'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChartOfAccount } from '../../../types';
import { fetchAccountLedger, setLineReconciled, LedgerLine } from '../../../services/accountingExtrasApi';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { Landmark, RefreshCw } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BankReconciliationTab: React.FC<{ accounts: ChartOfAccount[] }> = ({ accounts }) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();

    const bankAccounts = useMemo(
        () => accounts.filter(a => a.account_type === 'Bank').sort((a, b) => a.account_number.localeCompare(b.account_number)),
        [accounts],
    );

    const [acct, setAcct] = useState('');
    const [lines, setLines] = useState<LedgerLine[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<Record<string, boolean>>({});
    const [stmtBalanceStr, setStmtBalanceStr] = useState('');

    useEffect(() => { if (!acct && bankAccounts.length) setAcct(bankAccounts[0].account_number); }, [bankAccounts, acct]);

    const load = useCallback(async () => {
        if (!acct) return;
        try {
            setLoading(true);
            setLines(await fetchAccountLedger(acct));
        } catch (e: any) {
            addToast(`Failed to load ledger: ${e.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [acct, addToast]);

    useEffect(() => { load(); }, [load]);

    const toggle = async (l: LedgerLine) => {
        setBusy(b => ({ ...b, [l.line_id]: true }));
        const next = !l.reconciled;
        setLines(prev => prev.map(x => x.line_id === l.line_id ? { ...x, reconciled: next } : x)); // optimistic
        try {
            await setLineReconciled(l.line_id, next, currentUser?.Name);
        } catch (e: any) {
            setLines(prev => prev.map(x => x.line_id === l.line_id ? { ...x, reconciled: !next } : x)); // revert
            addToast(`Failed to update: ${e.message}`, 'error');
        } finally {
            setBusy(b => ({ ...b, [l.line_id]: false }));
        }
    };

    const bookBalance    = useMemo(() => lines.reduce((s, l) => s + l.debit - l.credit, 0), [lines]);
    const clearedBalance = useMemo(() => lines.filter(l => l.reconciled).reduce((s, l) => s + l.debit - l.credit, 0), [lines]);
    const unclearedCount = lines.filter(l => !l.reconciled).length;
    const stmtBalance    = parseFloat(stmtBalanceStr);
    const difference     = isFinite(stmtBalance) ? Math.round((stmtBalance - clearedBalance) * 100) / 100 : null;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-brand-600" />
                    <h3 className="font-bold text-foreground">Bank Reconciliation</h3>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <label className="text-xs text-muted-foreground">Account</label>
                    <select value={acct} onChange={e => setAcct(e.target.value)}
                        className="h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 min-w-[240px]">
                        {bankAccounts.length === 0 && <option value="">No bank accounts</option>}
                        {bankAccounts.map(a => <option key={a.account_number} value={a.account_number}>{a.account_number} · {a.account_name}</option>)}
                    </select>
                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-1.5 h-9 px-3 text-sm rounded-lg border border-border bg-background hover:bg-muted/40 disabled:opacity-50">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Book Balance</div>
                    <div className="text-lg font-black tabular-nums text-foreground">${fmt(bookBalance)}</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Cleared Balance</div>
                    <div className="text-lg font-black tabular-nums text-foreground">${fmt(clearedBalance)}</div>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Statement Balance</label>
                    <input type="number" step="0.01" value={stmtBalanceStr} onChange={e => setStmtBalanceStr(e.target.value)} placeholder="0.00"
                        className="w-full bg-transparent text-lg font-black tabular-nums text-foreground focus:outline-none" />
                </div>
                <div className={`border rounded-xl p-3 ${difference === null ? 'bg-card border-border' : difference === 0 ? 'bg-green-50 dark:bg-green-900/15 border-green-300 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/15 border-red-300 dark:border-red-700'}`}>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Difference</div>
                    <div className={`text-lg font-black tabular-nums ${difference === null ? 'text-muted-foreground' : difference === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {difference === null ? '—' : `$${fmt(difference)}`}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{difference === 0 ? 'Reconciled ✓' : `${unclearedCount} line(s) uncleared`}</div>
                </div>
            </div>

            {/* Ledger */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/60 border-b border-border">
                        <tr className="text-muted-foreground">
                            <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase w-16">Cleared</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase w-28">Date</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase w-24">JE #</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase">Description</th>
                            <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase w-32">Deposit</th>
                            <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase w-32">Withdrawal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                        ) : lines.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">No posted transactions for this account.</td></tr>
                        ) : lines.map(l => (
                            <tr key={l.line_id} className={`border-b border-border/20 hover:bg-muted/20 ${l.reconciled ? 'bg-green-50/40 dark:bg-green-900/10' : ''}`}>
                                <td className="px-3 py-2 text-center">
                                    <input type="checkbox" checked={l.reconciled} disabled={busy[l.line_id]} onChange={() => toggle(l)}
                                        className="w-4 h-4 accent-brand-600 cursor-pointer disabled:opacity-40" />
                                </td>
                                <td className="px-3 py-2 text-muted-foreground tabular-nums whitespace-nowrap">{l.entry_date}</td>
                                <td className="px-3 py-2 font-mono text-xs font-semibold text-foreground whitespace-nowrap">{l.entry_number}</td>
                                <td className="px-3 py-2 text-muted-foreground truncate max-w-xs">{l.description}{l.reference ? ` · ${l.reference}` : ''}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-green-600 dark:text-green-400">{l.debit ? fmt(l.debit) : '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-red-500 dark:text-red-400">{l.credit ? fmt(l.credit) : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-muted-foreground">
                Tick each line that appears on your bank statement. When the <span className="font-semibold">Difference</span> reaches $0.00, the account is reconciled to the statement.
            </p>
        </div>
    );
};

export default BankReconciliationTab;
