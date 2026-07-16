'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChartOfAccount } from '../../../types';
import { fetchUndepositedCheques, depositCheques, UndepositedCheque } from '../../../services/accountingExtrasApi';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { Banknote, RefreshCw } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const getTodayISO = () => new Date().toISOString().split('T')[0];
const UNDEPOSITED_CHEQUE_ACCOUNT = '11800';

const DepositChequeTab: React.FC<{ accounts: ChartOfAccount[] }> = ({ accounts }) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();

    const bankAccounts = useMemo(
        () => accounts
            .filter(a => a.account_type === 'Bank' && a.account_number !== UNDEPOSITED_CHEQUE_ACCOUNT)
            .sort((a, b) => a.account_number.localeCompare(b.account_number)),
        [accounts],
    );

    const [cheques, setCheques] = useState<UndepositedCheque[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [targetAccount, setTargetAccount] = useState('');
    const [depositDate, setDepositDate] = useState(getTodayISO());
    const [depositing, setDepositing] = useState(false);

    useEffect(() => { if (!targetAccount && bankAccounts.length) setTargetAccount(bankAccounts[0].account_number); }, [bankAccounts, targetAccount]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchUndepositedCheques();
            setCheques(data);
            setSelected({});
        } catch (e: any) {
            addToast(`Failed to load undeposited cheques: ${e.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { load(); }, [load]);

    const toggle = (lineId: string) => setSelected(s => ({ ...s, [lineId]: !s[lineId] }));
    const toggleAll = () => {
        const allSelected = cheques.length > 0 && cheques.every(c => selected[c.line_id]);
        setSelected(allSelected ? {} : Object.fromEntries(cheques.map(c => [c.line_id, true])));
    };

    const selectedLines = cheques.filter(c => selected[c.line_id]);
    const selectedTotal = selectedLines.reduce((s, c) => s + c.amount, 0);

    const handleDeposit = async () => {
        if (selectedLines.length === 0) { addToast('Select at least one cheque to deposit.', 'error'); return; }
        if (!targetAccount) { addToast('Choose a bank account to deposit into.', 'error'); return; }
        setDepositing(true);
        try {
            const entryNumber = await depositCheques({
                lineIds: selectedLines.map(l => l.line_id),
                targetAccount,
                entryDate: depositDate,
                createdBy: currentUser?.Name || 'system',
            });
            addToast(`Deposited ${selectedLines.length} cheque(s) — $${fmt(selectedTotal)} — posted as ${entryNumber}.`, 'success');
            await load();
        } catch (e: any) {
            addToast(`Deposit failed: ${e.message}`, 'error');
        } finally {
            setDepositing(false);
        }
    };

    const allChecked = cheques.length > 0 && cheques.every(c => selected[c.line_id]);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-brand-600" />
                    <h3 className="font-bold text-foreground">Deposit Cheque</h3>
                </div>
                <button onClick={load} disabled={loading}
                    className="flex items-center gap-1.5 h-9 px-3 text-sm rounded-lg border border-border bg-background hover:bg-muted/40 disabled:opacity-50 ml-auto">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            <p className="text-xs text-muted-foreground">
                Cheque receipts post to <span className="font-semibold">11800 Undeposit Cheque</span> until the cheque actually clears at the bank.
                Select the cheques you've physically deposited, pick the bank account, and post the transfer — one JE, DR bank / CR 11800.
            </p>

            {/* Deposit controls */}
            <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 flex-wrap">
                <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Deposit To</label>
                    <select value={targetAccount} onChange={e => setTargetAccount(e.target.value)}
                        className="h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 min-w-[240px] mt-1">
                        {bankAccounts.length === 0 && <option value="">No bank accounts</option>}
                        {bankAccounts.map(a => <option key={a.account_number} value={a.account_number}>{a.account_number} · {a.account_name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Deposit Date</label>
                    <input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)}
                        className="h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 mt-1" />
                </div>
                <div className="ml-auto text-right">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Selected Total</div>
                    <div className="text-lg font-black tabular-nums text-foreground">${fmt(selectedTotal)}</div>
                </div>
                <button
                    onClick={handleDeposit}
                    disabled={depositing || selectedLines.length === 0 || !targetAccount}
                    className="h-9 px-4 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {depositing ? 'Depositing…' : `Deposit ${selectedLines.length || ''} Cheque${selectedLines.length === 1 ? '' : 's'}`}
                </button>
            </div>

            {/* Undeposited cheque list */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/60 border-b border-border">
                        <tr className="text-muted-foreground">
                            <th className="text-center px-3 py-2.5 w-10">
                                <input type="checkbox" checked={allChecked} onChange={toggleAll} disabled={cheques.length === 0}
                                    className="w-4 h-4 accent-brand-600 cursor-pointer disabled:opacity-40" />
                            </th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase w-28">Date</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase w-24">JE #</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase">Description</th>
                            <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase w-32">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                        ) : cheques.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">No undeposited cheques — everything has been swept to the bank.</td></tr>
                        ) : cheques.map(c => (
                            <tr key={c.line_id} className={`border-b border-border/20 hover:bg-muted/20 ${selected[c.line_id] ? 'bg-brand-500/5' : ''}`}>
                                <td className="px-3 py-2 text-center">
                                    <input type="checkbox" checked={!!selected[c.line_id]} onChange={() => toggle(c.line_id)}
                                        className="w-4 h-4 accent-brand-600 cursor-pointer" />
                                </td>
                                <td className="px-3 py-2 text-muted-foreground tabular-nums whitespace-nowrap">{c.entry_date}</td>
                                <td className="px-3 py-2 font-mono text-xs font-semibold text-foreground whitespace-nowrap">{c.entry_number}</td>
                                <td className="px-3 py-2 text-muted-foreground truncate max-w-xs">{c.description}{c.reference ? ` · ${c.reference}` : ''}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-foreground">{fmt(c.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DepositChequeTab;
