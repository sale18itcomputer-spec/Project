'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChartOfAccount } from '../../../types';
import { computeTrialBalance, TrialBalanceRow } from '../../../services/accountingApi';
import { useToast } from '../../../contexts/ToastContext';
import { Scale, RefreshCw } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().split('T')[0];

const TrialBalanceTab: React.FC<{ accounts: ChartOfAccount[] }> = ({ accounts }) => {
    const { addToast } = useToast();
    const [asOf, setAsOf] = useState(todayISO());
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; isBalanced: boolean } | null>(null);

    const load = useCallback(async () => {
        if (!accounts.length) return;
        try {
            setLoading(true);
            setData(await computeTrialBalance(accounts, asOf));
        } catch (e: any) {
            addToast(`Failed to compute trial balance: ${e.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [accounts, asOf, addToast]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-brand-600" />
                    <h3 className="font-bold text-foreground">Trial Balance</h3>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <label className="text-xs text-muted-foreground">As of</label>
                    <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
                        className="h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-1.5 h-9 px-3 text-sm rounded-lg border border-border bg-background hover:bg-muted/40 disabled:opacity-50">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/60 border-b border-border">
                        <tr className="text-muted-foreground">
                            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Account</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide w-40">Debit</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide w-40">Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Computing…</td></tr>
                        ) : !data || data.rows.length === 0 ? (
                            <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground italic">No posted activity as of this date.</td></tr>
                        ) : data.rows.map(r => (
                            <tr key={r.account_number} className="border-b border-border/20 hover:bg-muted/20">
                                <td className="px-4 py-2 text-foreground">
                                    <span className="font-mono text-xs text-muted-foreground mr-2">{r.account_number}</span>
                                    {r.account_name}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums">{r.debit ? fmt(r.debit) : '—'}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{r.credit ? fmt(r.credit) : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                    {data && data.rows.length > 0 && (
                        <tfoot className="border-t-2 border-border bg-muted/30 font-bold">
                            <tr>
                                <td className="px-4 py-3 text-foreground uppercase text-xs tracking-wide">Total</td>
                                <td className="px-4 py-3 text-right tabular-nums text-brand-600">${fmt(data.totalDebit)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-brand-600">${fmt(data.totalCredit)}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {data && data.rows.length > 0 && (
                <div className={`text-sm font-semibold flex items-center gap-2 ${data.isBalanced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {data.isBalanced
                        ? <>✓ In balance — debits equal credits (${fmt(data.totalDebit)}).</>
                        : <>⚠ Out of balance by ${fmt(Math.abs(data.totalDebit - data.totalCredit))} — investigate before relying on reports.</>}
                </div>
            )}
        </div>
    );
};

export default TrialBalanceTab;
