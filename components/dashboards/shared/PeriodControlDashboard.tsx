'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Unlock, ShieldAlert, RefreshCw, CalendarClock } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { PeriodLock, fetchPeriodLocks, lockPeriod, unlockPeriod } from '@/services/periodApi';

const MONTHS_BACK = 23; // current + previous 23 = 2 years

const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

const fmtTs = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const PeriodControlDashboard: React.FC = () => {
    const { canView, can } = usePermissions();
    const { currentUser } = useAuth();
    const allowed = canView('period_control');
    const mayLock = can('period_control', 'lock');
    const mayUnlock = can('period_control', 'unlock');

    const [locks, setLocks] = useState<PeriodLock[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [modal, setModal] = useState<{ key: string; action: 'lock' | 'unlock' } | null>(null);
    const [note, setNote] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try { setLocks(await fetchPeriodLocks()); }
        catch (e: any) { setError(e?.message ?? 'Failed to load period locks'); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { if (allowed) load(); }, [allowed, load]);

    const lockByKey = useMemo(() => {
        const m = new Map<string, PeriodLock>();
        for (const l of locks) m.set(String(l.period).slice(0, 10), l);
        return m;
    }, [locks]);

    const months = useMemo(() => {
        const out: string[] = [];
        const now = new Date();
        for (let i = 0; i <= MONTHS_BACK; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
        }
        return out;
    }, []);

    const actor = { id: currentUser?.UserID, name: currentUser?.Name, role: currentUser?.Role };

    const confirm = async () => {
        if (!modal) return;
        setBusy(modal.key); setError(null);
        try {
            if (modal.action === 'lock') await lockPeriod(modal.key, actor, note.trim() || undefined);
            else await unlockPeriod(modal.key, actor, note.trim() || undefined);
            setModal(null); setNote('');
            await load();
        } catch (e: any) {
            setError(e?.message ?? 'Action failed');
        } finally { setBusy(null); }
    };

    if (!allowed) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-8">
                <ShieldAlert className="w-8 h-8" />
                <p className="text-sm font-medium">You don’t have permission to manage period locks.</p>
            </div>
        );
    }

    const lockedCount = locks.filter(l => l.status === 'locked').length;

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center"><CalendarClock className="w-5 h-5 text-brand-600" /></div>
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-foreground">Period Control</h1>
                    <p className="text-xs text-muted-foreground">Lock a month to freeze its ledger and financial documents. {lockedCount} locked.</p>
                </div>
                <button onClick={load} title="Refresh" className="text-xs px-2 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                Locking a month blocks all create / edit / delete on invoices, receipts, bills and journal entries dated in that month — for everyone. Corrections require unlocking first (recorded in the audit log).
            </div>

            {error && <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">{error}</div>}

            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground text-xs">
                        <tr className="text-left">
                            <th className="px-4 py-2 font-semibold">Month</th>
                            <th className="px-4 py-2 font-semibold">Status</th>
                            <th className="px-4 py-2 font-semibold">Detail</th>
                            <th className="px-4 py-2 font-semibold text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {months.map(key => {
                            const lock = lockByKey.get(key);
                            const isLocked = lock?.status === 'locked';
                            return (
                                <tr key={key} className="border-t border-border">
                                    <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{monthLabel(key)}</td>
                                    <td className="px-4 py-2.5">
                                        {isLocked
                                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-600 border border-red-500/30"><Lock className="w-3 h-3" /> Locked</span>
                                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"><Unlock className="w-3 h-3" /> Open</span>}
                                    </td>
                                    <td className="px-4 py-2.5 text-[11px] text-muted-foreground">
                                        {isLocked
                                            ? <>Locked by {lock?.locked_by || '—'} · {fmtTs(lock?.locked_at || null)}{lock?.note ? <> · <span className="italic">{lock.note}</span></> : ''}</>
                                            : lock?.unlocked_at
                                                ? <>Re-opened by {lock?.unlocked_by || '—'} · {fmtTs(lock?.unlocked_at)}</>
                                                : <span className="text-muted-foreground/60">—</span>}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        {isLocked
                                            ? (mayUnlock ? (
                                                <button disabled={busy === key} onClick={() => { setNote(''); setModal({ key, action: 'unlock' }); }}
                                                    className="text-xs font-bold px-3 py-1 rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40">Unlock</button>
                                            ) : <span className="text-[11px] text-muted-foreground">—</span>)
                                            : (mayLock ? (
                                                <button disabled={busy === key} onClick={() => { setNote(''); setModal({ key, action: 'lock' }); }}
                                                    className="text-xs font-bold px-3 py-1 rounded-md bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40">Lock</button>
                                            ) : <span className="text-[11px] text-muted-foreground">—</span>)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Confirm modal */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setModal(null)}>
                    <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                            {modal.action === 'lock' ? <Lock className="w-5 h-5 text-red-600" /> : <Unlock className="w-5 h-5 text-emerald-600" />}
                            <h3 className="text-base font-bold text-foreground">{modal.action === 'lock' ? 'Lock' : 'Unlock'} {monthLabel(modal.key)}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {modal.action === 'lock'
                                ? 'No invoices, receipts, bills or journal entries dated in this month can be created, edited, or deleted until it is unlocked.'
                                : 'This re-opens the month so its financial records can be corrected. This is recorded in the audit log.'}
                        </p>
                        <label className="block">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Reason / note {modal.action === 'unlock' ? '(recommended)' : '(optional)'}</span>
                            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                                className="mt-1 w-full text-sm p-2 rounded-md border border-border bg-input text-foreground resize-y"
                                placeholder={modal.action === 'lock' ? 'e.g. June close signed off' : 'e.g. correcting a mis-dated receipt'} />
                        </label>
                        <div className="flex justify-end gap-2 pt-1">
                            <button disabled={!!busy} onClick={() => setModal(null)} className="text-xs font-medium px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted">Cancel</button>
                            <button disabled={!!busy} onClick={confirm}
                                className={`text-xs font-bold px-4 py-1.5 rounded-md text-white disabled:opacity-50 ${modal.action === 'lock' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                {busy ? 'Working…' : (modal.action === 'lock' ? 'Lock month' : 'Unlock month')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PeriodControlDashboard;
