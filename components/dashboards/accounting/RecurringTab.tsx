'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChartOfAccount } from '../../../types';
import {
    fetchRecurring, createRecurring, deleteRecurring, updateRecurring, generateRecurringJE,
    RecurringTemplate, RecurringLine,
} from '../../../services/accountingExtrasApi';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { RefreshCw, PlusCircle, Trash2, Play, X } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().split('T')[0];
const blankLine = (): RecurringLine & { id: string } => ({ id: `l-${Date.now()}-${Math.random()}`, account_number: '', description: '', debit: 0, credit: 0 });

const RecurringTab: React.FC<{ accounts: ChartOfAccount[] }> = ({ accounts }) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<Record<string, boolean>>({});
    const [showForm, setShowForm] = useState(false);

    // ── New-template form state ──
    const [name, setName] = useState('');
    const [frequency, setFrequency] = useState<RecurringTemplate['frequency']>('monthly');
    const [formLines, setFormLines] = useState<(RecurringLine & { id: string })[]>([blankLine(), blankLine()]);
    const [saving, setSaving] = useState(false);

    const postAccounts = accounts.filter(a => a.account_type !== 'Non-Posting').sort((a, b) => a.account_number.localeCompare(b.account_number));

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setTemplates(await fetchRecurring());
        } catch (e: any) {
            addToast(`Failed to load recurring templates: ${e.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { load(); }, [load]);

    const totalDr = formLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCr = formLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    const balanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;

    const resetForm = () => { setName(''); setFrequency('monthly'); setFormLines([blankLine(), blankLine()]); setShowForm(false); };

    const save = async () => {
        if (!name.trim()) { addToast('Give the template a name.', 'error'); return; }
        const lines = formLines.filter(l => l.account_number && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0));
        if (lines.length < 2) { addToast('Add at least two account lines.', 'error'); return; }
        if (!balanced) { addToast('Debits must equal credits (and be greater than zero).', 'error'); return; }
        try {
            setSaving(true);
            await createRecurring({
                name: name.trim(), frequency, is_active: true,
                lines: lines.map(({ account_number, description, debit, credit }) => ({ account_number, description, debit: Number(debit) || 0, credit: Number(credit) || 0 })),
                created_by: currentUser?.Name ?? null,
            });
            addToast('Recurring template saved.', 'success');
            resetForm();
            load();
        } catch (e: any) {
            addToast(`Failed to save: ${e.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const generate = async (t: RecurringTemplate) => {
        setBusy(b => ({ ...b, [t.id!]: true }));
        try {
            const je = await generateRecurringJE(t, todayISO(), currentUser?.Name || 'system');
            addToast(`Posted ${je} from "${t.name}".`, 'success');
            load();
        } catch (e: any) {
            addToast(`Failed to generate: ${e.message}`, 'error');
        } finally {
            setBusy(b => ({ ...b, [t.id!]: false }));
        }
    };

    const remove = async (t: RecurringTemplate) => {
        if (!confirm(`Delete recurring template "${t.name}"? Journal entries already posted from it are kept.`)) return;
        try { await deleteRecurring(t.id!); load(); } catch (e: any) { addToast(`Failed to delete: ${e.message}`, 'error'); }
    };

    const toggleActive = async (t: RecurringTemplate) => {
        try { await updateRecurring(t.id!, { is_active: !t.is_active }); setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x)); }
        catch (e: any) { addToast(`Failed to update: ${e.message}`, 'error'); }
    };

    const setLine = (id: string, field: keyof RecurringLine, value: string) =>
        setFormLines(prev => prev.map(l => l.id === id ? { ...l, [field]: field === 'debit' || field === 'credit' ? (parseFloat(value) || 0) : value } : l));

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-brand-600" />
                    <h3 className="font-bold text-foreground">Recurring Entries</h3>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-1.5 h-9 px-3 text-sm rounded-lg border border-border bg-background hover:bg-muted/40 disabled:opacity-50">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button onClick={() => setShowForm(v => !v)}
                        className="flex items-center gap-1.5 h-9 px-3 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 font-medium">
                        <PlusCircle size={15} /> New Template
                    </button>
                </div>
            </div>

            {/* New template form */}
            {showForm && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground">New Recurring Template</h4>
                        <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <label className="text-xs text-muted-foreground block mb-1">Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Monthly Office Rent"
                                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Frequency</label>
                            <select value={frequency} onChange={e => setFrequency(e.target.value as any)}
                                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600">
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {formLines.map(l => (
                            <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
                                <select value={l.account_number} onChange={e => setLine(l.id, 'account_number', e.target.value)}
                                    className="col-span-5 h-8 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600">
                                    <option value="">Select account…</option>
                                    {postAccounts.map(a => <option key={a.account_number} value={a.account_number}>{a.account_number} · {a.account_name}</option>)}
                                </select>
                                <input value={l.description} onChange={e => setLine(l.id, 'description', e.target.value)} placeholder="Description"
                                    className="col-span-3 h-8 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                                <input type="number" step="0.01" value={l.debit || ''} onChange={e => setLine(l.id, 'debit', e.target.value)} placeholder="Debit"
                                    className="col-span-2 h-8 px-2 text-xs text-right rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                                <input type="number" step="0.01" value={l.credit || ''} onChange={e => setLine(l.id, 'credit', e.target.value)} placeholder="Credit"
                                    className="col-span-2 h-8 px-2 text-xs text-right rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                            </div>
                        ))}
                        <button onClick={() => setFormLines(prev => [...prev, blankLine()])} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                            <PlusCircle size={13} /> Add Line
                        </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className={`text-xs font-semibold ${balanced ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                            Debits ${fmt(totalDr)} · Credits ${fmt(totalCr)} {balanced ? '✓ balanced' : totalDr > 0 ? '· not balanced' : ''}
                        </span>
                        <button onClick={save} disabled={saving || !balanced}
                            className="h-9 px-4 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 font-medium disabled:opacity-40">
                            {saving ? 'Saving…' : 'Save Template'}
                        </button>
                    </div>
                </div>
            )}

            {/* Templates list */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/60 border-b border-border">
                        <tr className="text-muted-foreground">
                            <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Name</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold uppercase w-28">Frequency</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase w-32">Amount</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold uppercase w-36">Last Posted</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase w-24">Active</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase w-40">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                        ) : templates.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">No recurring templates yet. Create one for repeating entries like rent, salaries or depreciation.</td></tr>
                        ) : templates.map(t => {
                            const amt = (t.lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
                            return (
                                <tr key={t.id} className="border-b border-border/20 hover:bg-muted/20">
                                    <td className="px-4 py-2.5 font-medium text-foreground">{t.name}</td>
                                    <td className="px-4 py-2.5 text-muted-foreground capitalize">{t.frequency}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">${fmt(amt)}</td>
                                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{t.last_generated_date || '—'}</td>
                                    <td className="px-4 py-2.5 text-center">
                                        <button onClick={() => toggleActive(t)}
                                            className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${t.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                                            {t.is_active ? 'Active' : 'Paused'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button onClick={() => generate(t)} disabled={busy[t.id!]}
                                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40" title="Post a journal entry from this template dated today">
                                                <Play size={12} /> Post Now
                                            </button>
                                            <button onClick={() => remove(t)} className="text-muted-foreground hover:text-red-500 p-1" title="Delete template"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-muted-foreground">
                Templates don't post automatically — click <span className="font-semibold">Post Now</span> to create a balanced journal entry (dated today) whenever the recurring charge is due.
            </p>
        </div>
    );
};

export default RecurringTab;
