'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Search, ChevronDown, ChevronRight, RefreshCw, ShieldAlert } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchAuditLogs, fetchAuditTables, AuditLog, AuditFilter } from '@/services/auditApi';

const PAGE_SIZE = 100;
const OPS = ['INSERT', 'UPDATE', 'DELETE', 'ACTION'] as const;

const opStyle: Record<string, string> = {
    INSERT: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    UPDATE: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    DELETE: 'bg-red-500/10 text-red-600 border-red-500/30',
    ACTION: 'bg-brand-500/10 text-brand-600 border-brand-500/30',
};

const fmtTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const fmtVal = (v: any) => {
    if (v === null || v === undefined) return '∅';
    if (typeof v === 'object') return JSON.stringify(v);
    const s = String(v);
    return s.length > 200 ? s.slice(0, 200) + '…' : s;
};

const AuditLogDashboard: React.FC = () => {
    const { canView } = usePermissions();
    const allowed = canView('audit_log');

    const [filter, setFilter] = useState<AuditFilter>({});
    const [applied, setApplied] = useState<AuditFilter>({});
    const [page, setPage] = useState(0);
    const [rows, setRows] = useState<AuditLog[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tables, setTables] = useState<string[]>([]);
    const [expanded, setExpanded] = useState<number | null>(null);

    useEffect(() => { fetchAuditTables().then(setTables).catch(() => {}); }, []);

    const load = useCallback(async (f: AuditFilter, p: number) => {
        setLoading(true); setError(null);
        try {
            const res = await fetchAuditLogs({ ...f, limit: PAGE_SIZE, offset: p * PAGE_SIZE });
            setRows(res.rows); setCount(res.count);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load audit log');
            setRows([]); setCount(0);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { if (allowed) load(applied, page); }, [allowed, applied, page, load]);

    const apply = () => { setPage(0); setApplied(filter); };
    const reset = () => { setFilter({}); setPage(0); setApplied({}); };

    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    const set = (patch: Partial<AuditFilter>) => setFilter(prev => ({ ...prev, ...patch }));

    const summary = useMemo(() => (r: AuditLog) => {
        if (r.action_label) return r.action_label;
        if (r.operation === 'UPDATE' && r.changed_fields) {
            const keys = Object.keys(r.changed_fields);
            return `Changed ${keys.length} field${keys.length === 1 ? '' : 's'}: ${keys.slice(0, 4).join(', ')}${keys.length > 4 ? '…' : ''}`;
        }
        if (r.operation === 'INSERT') return 'Created record';
        if (r.operation === 'DELETE') return 'Deleted record';
        return '';
    }, []);

    if (!allowed) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-8">
                <ShieldAlert className="w-8 h-8" />
                <p className="text-sm font-medium">You don’t have permission to view the audit log.</p>
            </div>
        );
    }

    const inputCls = 'text-xs px-2 py-1.5 rounded-md border border-border bg-input text-foreground focus:ring-1 focus:ring-brand-500 outline-none';

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center"><History className="w-5 h-5 text-brand-600" /></div>
                <div>
                    <h1 className="text-lg font-bold text-foreground">Audit Log</h1>
                    <p className="text-xs text-muted-foreground">Every create, edit, and delete across the system — who, what, and when.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1"><span className="text-[10px] uppercase font-bold text-muted-foreground">From</span>
                    <input type="date" className={inputCls} value={filter.dateFrom ?? ''} onChange={e => set({ dateFrom: e.target.value || undefined })} /></label>
                <label className="flex flex-col gap-1"><span className="text-[10px] uppercase font-bold text-muted-foreground">To</span>
                    <input type="date" className={inputCls} value={filter.dateTo ?? ''} onChange={e => set({ dateTo: e.target.value || undefined })} /></label>
                <label className="flex flex-col gap-1"><span className="text-[10px] uppercase font-bold text-muted-foreground">Table</span>
                    <select className={inputCls} value={filter.table ?? ''} onChange={e => set({ table: e.target.value || undefined })}>
                        <option value="">All tables</option>
                        {tables.map(t => <option key={t} value={t}>{t}</option>)}
                    </select></label>
                <label className="flex flex-col gap-1"><span className="text-[10px] uppercase font-bold text-muted-foreground">Operation</span>
                    <select className={inputCls} value={filter.operation ?? ''} onChange={e => set({ operation: (e.target.value || undefined) as any })}>
                        <option value="">All</option>
                        {OPS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select></label>
                <label className="flex flex-col gap-1"><span className="text-[10px] uppercase font-bold text-muted-foreground">Source</span>
                    <select className={inputCls} value={filter.source ?? ''} onChange={e => set({ source: (e.target.value || undefined) as any })}>
                        <option value="">All</option>
                        <option value="trigger">trigger</option>
                        <option value="app">app</option>
                    </select></label>
                <label className="flex flex-col gap-1"><span className="text-[10px] uppercase font-bold text-muted-foreground">Actor</span>
                    <input className={inputCls} placeholder="email / name" value={filter.actor ?? ''} onChange={e => set({ actor: e.target.value || undefined })} /></label>
                <label className="flex flex-col gap-1 flex-1 min-w-[160px]"><span className="text-[10px] uppercase font-bold text-muted-foreground">Search (record / action)</span>
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input className={`${inputCls} w-full pl-7`} placeholder="INV2026-00004…" value={filter.search ?? ''} onChange={e => set({ search: e.target.value || undefined })}
                            onKeyDown={e => { if (e.key === 'Enter') apply(); }} />
                    </div></label>
                <button onClick={apply} className="text-xs font-bold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:brightness-110">Apply</button>
                <button onClick={reset} className="text-xs font-medium px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted">Reset</button>
                <button onClick={() => load(applied, page)} title="Refresh" className="text-xs px-2 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>

            {/* Results */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs text-muted-foreground">
                    <span>{loading ? 'Loading…' : `${count.toLocaleString()} entr${count === 1 ? 'y' : 'ies'}`}</span>
                    <span>Page {page + 1} / {totalPages}</span>
                </div>
                {error && <div className="p-4 text-sm text-red-600">{error}</div>}
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/50 text-muted-foreground">
                            <tr className="text-left">
                                <th className="w-6"></th>
                                <th className="px-3 py-2 font-semibold whitespace-nowrap">Time</th>
                                <th className="px-3 py-2 font-semibold">Actor</th>
                                <th className="px-3 py-2 font-semibold">Op</th>
                                <th className="px-3 py-2 font-semibold">Table</th>
                                <th className="px-3 py-2 font-semibold">Record</th>
                                <th className="px-3 py-2 font-semibold">Summary</th>
                                <th className="px-3 py-2 font-semibold">Src</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => {
                                const open = expanded === r.id;
                                return (
                                    <React.Fragment key={r.id}>
                                        <tr className="border-t border-border hover:bg-muted/40 cursor-pointer" onClick={() => setExpanded(open ? null : r.id)}>
                                            <td className="pl-2 text-muted-foreground">{open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                                            <td className="px-3 py-2 whitespace-nowrap font-mono text-muted-foreground">{fmtTime(r.occurred_at)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{r.actor_name || <span className="text-muted-foreground italic">system</span>}{r.actor_role ? <span className="text-muted-foreground"> · {r.actor_role}</span> : ''}</td>
                                            <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${opStyle[r.operation] || ''}`}>{r.operation}</span></td>
                                            <td className="px-3 py-2 whitespace-nowrap font-mono">{r.table_name}</td>
                                            <td className="px-3 py-2 whitespace-nowrap font-mono">{r.record_pk || '—'}</td>
                                            <td className="px-3 py-2 text-foreground/80">{summary(r)}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{r.source}</td>
                                        </tr>
                                        {open && (
                                            <tr className="bg-muted/30 border-t border-border">
                                                <td></td>
                                                <td colSpan={7} className="px-3 py-3">
                                                    {r.changed_fields ? (
                                                        <table className="text-[11px] w-full max-w-3xl">
                                                            <thead className="text-muted-foreground"><tr className="text-left"><th className="py-1 pr-4">Field</th><th className="py-1 pr-4">Old</th><th className="py-1">New</th></tr></thead>
                                                            <tbody className="font-mono">
                                                                {Object.entries(r.changed_fields).map(([k, v]) => (
                                                                    <tr key={k} className="border-t border-border/50">
                                                                        <td className="py-1 pr-4 font-semibold">{k}</td>
                                                                        <td className="py-1 pr-4 text-red-600/80">{fmtVal(v.old)}</td>
                                                                        <td className="py-1 text-emerald-600/90">{fmtVal(v.new)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    ) : (r.new_row || r.old_row) ? (
                                                        <pre className="text-[11px] font-mono whitespace-pre-wrap break-all max-w-3xl text-foreground/80">{JSON.stringify(r.new_row || r.old_row, null, 2).slice(0, 4000)}</pre>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">{r.action_label || 'No detail recorded.'}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {!loading && rows.length === 0 && !error && (
                                <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No audit entries match these filters.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border">
                    <button disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))} className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-40 hover:bg-muted">Prev</button>
                    <button disabled={page + 1 >= totalPages || loading} onClick={() => setPage(p => p + 1)} className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-40 hover:bg-muted">Next</button>
                </div>
            </div>
        </div>
    );
};

export default AuditLogDashboard;
