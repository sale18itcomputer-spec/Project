'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../../contexts/DataContext';
import { exportWeeklyReport } from '../../../utils/exportWeeklyReport';
import { buildFuzzyQuoteMap } from '../../../utils/matchQuoteToSO';
import { useToast } from '../../../contexts/ToastContext';
import { PermissionGate } from '../../common/PermissionGate';
import { supabase } from '../../../lib/supabase';
import { formatCurrencySmartly } from '../../../utils/formatters';
import {
    Download, ChevronDown, ChevronUp, FileText, ChevronLeft, ChevronRight,
    CheckCircle2, Pencil, Check, X, Phone, ClipboardList, MapPin, Pin,
} from 'lucide-react';

const BLUE = '#004AAD';
const WIN_PCT_OPTIONS = ['>75%', '50%', '25%', '0%'];

const SO_STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
    Completed:      { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Won' },
    Pending:        { bg: 'bg-amber-500/10',   text: 'text-amber-600',   label: 'Follow Up' },
    Cancel:         { bg: 'bg-rose-500/10',    text: 'text-rose-600',    label: 'Lost' },
    'Close (Win)':  { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Won' },
    'Close (Lose)': { bg: 'bg-rose-500/10',    text: 'text-rose-600',    label: 'Lost' },
    Open:           { bg: 'bg-blue-500/10',    text: 'text-blue-600',    label: 'Pending' },
};

// ─── Date helpers ──────────────────────────────────────────────────────────────
function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}
function getWeekEnd(ws: Date): Date {
    const d = new Date(ws);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
}
function getMonthStart(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); }
function getMonthEnd(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function fmtDate(d: Date): string { return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); }
function fmtShort(d: Date): string { return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtShortFromRaw(raw: string | undefined): string {
    if (!raw) return '';
    const d = new Date(raw);
    return isNaN(d.getTime()) ? '' : fmtShort(d);
}
function toInputDate(raw: string | undefined): string {
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}
function fmtMonthYear(d: Date): string { return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
function inRange(raw: string | undefined, s: Date, e: Date): boolean {
    if (!raw) return false;
    const d = new Date(raw);
    return !isNaN(d.getTime()) && d >= s && d <= e;
}
/** Use the immutable Supabase created_at for period classification.
 *  Falls back to Quote Date if created_at isn't present (legacy rows).
 *  This means updating Quote Date in the Quotations Creator never moves
 *  a quotation to a different week's report. */
function classifyDate(r: any): string | undefined {
    return r['created_at'] || r['Quote Date'];
}
function toISOWeek(d: Date): string {
    const y = d.getFullYear();
    const wk = Math.ceil(((d.getTime() - new Date(y, 0, 1).getTime()) / 86400000 + new Date(y, 0, 1).getDay() + 1) / 7);
    return `${y}-W${String(wk).padStart(2, '0')}`;
}
function parseISOWeek(key: string): Date {
    const [ys, ws] = key.split('-W');
    const y = parseInt(ys), w = parseInt(ws);
    const jan1 = new Date(y, 0, 1);
    const fm = new Date(y, 0, 1 + (8 - (jan1.getDay() || 7)) % 7);
    fm.setDate(fm.getDate() + (w - 1) * 7);
    return fm;
}
function parseItems(raw: any): string {
    try {
        const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(items))
            return items.map((i: any) => `${i.modelName || i.Model || i.Description || i.description || i.Code || i.itemCode || ''} (${i.qty || i.Qty || 1}units)`).join(', ');
    } catch { /**/ }
    return '';
}

// ─── Small reusable UI ────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string; cfg?: Record<string, { bg: string; text: string; label: string }> }> = ({ status, cfg = SO_STATUS_CFG }) => {
    const c = cfg[status] ?? { bg: 'bg-muted', text: 'text-muted-foreground', label: status };
    return <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded ${c.bg} ${c.text} whitespace-nowrap`}>{c.label}</span>;
};

const EditText: React.FC<{ value: string; onSave: (v: string) => void; placeholder?: string; multi?: boolean }> = ({ value, onSave, placeholder = '—', multi }) => {
    const [ed, setEd] = useState(false);
    const [draft, setDraft] = useState(value);
    const commit = () => { onSave(draft); setEd(false); };
    const cancel = () => { setDraft(value); setEd(false); };
    if (ed) return (
        <div className="flex items-start gap-1">
            {multi
                ? <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} rows={2}
                    className="flex-1 text-xs border border-blue-400 rounded px-1.5 py-1 bg-background text-foreground resize-none min-w-[100px]"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } if (e.key === 'Escape') cancel(); }} />
                : <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                    className="flex-1 text-xs border border-blue-400 rounded px-1.5 py-1 bg-background text-foreground min-w-[80px]"
                    onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }} />}
            <button onClick={commit} className="text-emerald-500 mt-0.5"><Check size={12} /></button>
            <button onClick={cancel} className="text-rose-400 mt-0.5"><X size={12} /></button>
        </div>
    );
    return (
        <div className="group flex items-start gap-1 cursor-pointer min-h-[18px]" onClick={() => { setDraft(value); setEd(true); }}>
            <span className="flex-1 text-foreground/80 group-hover:text-foreground leading-snug">
                {value || <span className="text-muted-foreground/40 italic text-[10px]">{placeholder}</span>}
            </span>
            <Pencil size={9} className="opacity-0 group-hover:opacity-40 text-muted-foreground mt-0.5 flex-shrink-0" />
        </div>
    );
};

const EditDate: React.FC<{ value: string; onSave: (v: string) => void; placeholder?: string }> = ({ value, onSave, placeholder = 'Add date' }) => {
    const [ed, setEd] = useState(false);
    const [draft, setDraft] = useState(toInputDate(value));
    const commit = () => { onSave(draft); setEd(false); };
    const cancel = () => { setDraft(toInputDate(value)); setEd(false); };
    if (ed) return (
        <div className="flex items-center gap-1">
            <input type="date" autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                className="text-xs border border-blue-400 rounded px-1.5 py-0.5 bg-background text-foreground"
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }} />
            <button onClick={commit} className="text-emerald-500"><Check size={12} /></button>
            <button onClick={cancel} className="text-rose-400"><X size={12} /></button>
        </div>
    );
    const display = fmtShortFromRaw(value);
    return (
        <div className="group flex items-center gap-1 cursor-pointer min-h-[18px]" onClick={() => { setDraft(toInputDate(value)); setEd(true); }}>
            <span className="flex-1 text-foreground/80 group-hover:text-foreground">
                {display || <span className="text-muted-foreground/40 italic text-[10px]">{placeholder}</span>}
            </span>
            <Pencil size={9} className="opacity-0 group-hover:opacity-40 text-muted-foreground flex-shrink-0" />
        </div>
    );
};

const EditSelect: React.FC<{ value: string; options: { value: string; label: string }[]; onSave: (v: string) => void; cfg?: Record<string, any> }> = ({ value, options, onSave, cfg }) => {
    const [ed, setEd] = useState(false);
    if (ed) return (
        <select autoFocus value={value} onChange={e => { onSave(e.target.value); setEd(false); }} onBlur={() => setEd(false)}
            className="text-xs border border-blue-400 rounded px-1 py-0.5 bg-background text-foreground">
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
    return (
        <div className="group flex items-center gap-1 cursor-pointer" onClick={() => setEd(true)}>
            <StatusBadge status={value} cfg={cfg} />
            <Pencil size={9} className="opacity-0 group-hover:opacity-40 text-muted-foreground" />
        </div>
    );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; count: number; accent: string; children: React.ReactNode }> = ({ title, count, accent, children }) => {
    const [collapsed, setCollapsed] = useState(false);
    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none" style={{ background: accent }} onClick={() => setCollapsed(c => !c)}>
                <span className="font-bold text-sm tracking-wide text-white">{title}</span>
                <div className="flex items-center gap-3">
                    <span className="text-white/70 text-xs font-semibold">{count} record{count !== 1 ? 's' : ''}</span>
                    {collapsed ? <ChevronDown size={15} className="text-white/80" /> : <ChevronUp size={15} className="text-white/80" />}
                </div>
            </div>
            {!collapsed && <div className="overflow-x-auto">{children}</div>}
        </div>
    );
};

const Th: React.FC<{ children: React.ReactNode; align?: string; w?: string }> = ({ children, align = 'text-center', w }) =>
    <th className={`px-2 py-2 ${align} text-[10px] uppercase tracking-wide font-semibold ${w ?? ''}`}>{children}</th>;

const Td: React.FC<{ children: React.ReactNode; align?: string; cls?: string }> = ({ children, align = 'text-left', cls = '' }) =>
    <td className={`px-2 py-2 ${align} ${cls}`}>{children ?? '—'}</td>;

const emptyRow = (cols: number) => (
    <tr><td colSpan={cols} className="text-center py-6 text-muted-foreground italic text-xs">No records</td></tr>
);

// ─── Sale Orders section ──────────────────────────────────────────────────────
interface SOOverride {
    status?: string;
    winPct?: string;
    remark?: string;
    followUpDate?: string;
    itemDesc?: string;
    /** Auto-stamped when the row is first edited while in the Previous Deal section. */
    isPreviousDeal?: boolean;
    /** Snapshot of Quote Date taken the FIRST time this row is detected as Previous Deal.
     *  Frozen in Supabase — immune to future Quote Date changes in Quotations Creator. */
    originalQuoteDate?: string;
}

const SaleOrdersSection: React.FC<{
    rows: any[];
    overrides: Record<string, SOOverride>;
    onOverride: (id: string, field: keyof SOOverride, v: string, pinAsPrev?: boolean) => void;
    /** Explicit pin handler — stamps isPreviousDeal=true and moves row out of New Deal */
    onPin: (id: string) => void;
    rangeStart: Date;
    rangeEnd: Date;
    /** IDs that appeared in ANY past weekly report — permanently Previous Deal */
    historicalPrevIds: Set<string>;
}> = ({ rows, overrides, onOverride, onPin, rangeStart, rangeEnd, historicalPrevIds }) => {
    const OPEN_STATUSES = new Set(['Open', 'Pending']);

    const getEffectiveStatus = (row: any) => {
        const so = row._linkedSO;
        const id = so?.['SO No'] || row['Quote No'] || row['SO No'];
        const ov = overrides[id]?.status;
        if (ov) return ov;
        if (so) return so.Status;
        return row.Status;
    };

    // ── Helper: get a stable row ID
    const getRowId = (r: any) => r._linkedSO?.['SO No'] || r['Quote No'] || r['SO No'];
    // Pinned via current-period override
    const isPinned   = (r: any) => overrides[getRowId(r)]?.isPreviousDeal === true;
    // Appeared in ANY past weekly report → always Previous Deal regardless of date
    const isHistoric = (r: any) => historicalPrevIds.has(getRowId(r));
    // originalQuoteDate (explicitly snapshotted into the override) is the most reliable
    // anchor for old rows — it was captured before created_at existed.
    // created_at is a fallback for new quotations (correctly set on INSERT after migration).
    const getClassifyDate = (r: any) => {
        const id = getRowId(r);
        return overrides[id]?.originalQuoteDate || classifyDate(r);
    };

    // ── PREVIOUS DEAL (three-layer check):
    //   1. Pinned in current-period override  (set by auto-stamp or manual pin)
    //   2. Known historic — appeared in any past weekly report override
    //   3. Open/Pending raw status AND getClassifyDate is before this range
    const prevDeals = rows.filter(r => {
        if (isPinned(r) || isHistoric(r)) return true;
        const rawStatus = r._linkedSO?.Status ?? r.Status;
        return OPEN_STATUSES.has(rawStatus) && !inRange(getClassifyDate(r), rangeStart, rangeEnd);
    });

    // ── NEW DEAL = classifyDate in this range AND not pinned/historic
    const newDeals = rows.filter(r =>
        !isPinned(r) && !isHistoric(r) && inRange(getClassifyDate(r), rangeStart, rangeEnd)
    );
    const statusOpts = [
        { value: 'Pending',        label: 'Follow Up' },
        { value: 'Completed',      label: 'Won (SO Completed)' },
        { value: 'Cancel',         label: 'Lost (SO Cancel)' },
        { value: 'Open',           label: 'Pending' },
        { value: 'Close (Win)',    label: 'Quote (Win)' },
        { value: 'Close (Lose)',   label: 'Quote (Lose)' },
    ];

    // renderRows: isPrevSection=true → edits auto-stamp isPreviousDeal=true.
    // showPin=true → show a pin button to manually move a New Deal row to Previous Deal.
    const renderRows = (arr: any[], isPrevSection: boolean, showPin = false) =>
        arr.length === 0 ? emptyRow(showPin ? 13 : 12) : arr.map((row, i) => {
            const so = row._linkedSO;
            const id = so?.['SO No'] || row['Quote No'] || row['SO No'];
            const ov = overrides[id] ?? {};
            const effectiveStatus = getEffectiveStatus(row);
            const wp = ov.winPct ?? (effectiveStatus === 'Completed' || effectiveStatus === 'Close (Win)' ? '>75%' : effectiveStatus === 'Cancel' || effectiveStatus === 'Close (Lose)' ? '0%' : '50%');
            const quoteNo = row['Quote No'] || '';
            const soNo = so?.['SO No'] || row['SO No'] || '';
            const company = row['Company Name'] || '';
            const items = ov.itemDesc ?? parseItems(so?.['ItemsJSON'] || row['ItemsJSON']);
            const remark = ov.remark ?? (so?.['Remark'] || row['Remark'] || '');
            // Amount — prefer linked SO total, then quotation amount
            const rawAmount = so?.['Total Amount'] || row['Amount'] || row['Total Amount'] || '';
            const currency = so?.['Currency'] || row['Currency'] || 'USD';
            const amountDisplay = rawAmount ? formatCurrencySmartly(parseFloat(String(rawAmount).replace(/,/g, '')) || 0, currency) : '—';
            // Orig. Date priority: originalQuoteDate override (snapshotted before any date
            // changes, most reliable) → created_at (correct for new rows after migration)
            // → live Quote Date (grey fallback — changes when sales team edits)
            const origRaw  = overrides[id]?.originalQuoteDate || row['created_at'];
            const origDate = origRaw ? fmtShort(new Date(origRaw)) : null;
            const edit = (field: keyof SOOverride, v: string) => onOverride(id, field, v, isPrevSection);
            return (
                <tr key={id || i} className={`border-b border-border/40 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-accent/20 transition-colors`}>
                    <Td align="text-center" cls="font-bold text-muted-foreground w-8">{i + 1}</Td>
                    <Td cls="font-semibold max-w-[130px]"><span className="line-clamp-2">{company || '—'}</span></Td>
                    <Td align="text-center" cls="font-mono text-[10px] text-muted-foreground">{quoteNo || '—'}</Td>
                    <Td align="text-center" cls="font-mono text-[10px] text-muted-foreground">{soNo || '—'}</Td>
                    {/* Orig. Date: green when created_at is available (used for classification), grey fallback to Quote Date */}
                    <Td align="text-center" cls="text-[11px]">
                        {origDate
                            ? <span className="text-emerald-600 font-medium" title="Original creation date (used for Previous Deal classification)">{origDate}</span>
                            : <span className="text-muted-foreground" title="created_at not yet available — showing Quote Date">{row['Quote Date'] ? fmtShort(new Date(row['Quote Date'])) : '—'}</span>
                        }
                    </Td>
                    <Td align="text-center" cls="text-muted-foreground text-[11px]">{row['Quote Date'] || row['SO Date'] ? fmtShort(new Date(row['Quote Date'] || row['SO Date'])) : '—'}</Td>
                    <Td align="text-center" cls="text-muted-foreground text-[11px]">
                        <EditDate value={ov.followUpDate ?? (so?.['Delivery Date'] || row['Validity Date'] || '')} onSave={v => edit('followUpDate', v)} />
                    </Td>
                    <Td cls="max-w-[180px] text-[11px]">
                        <EditText value={items} onSave={v => edit('itemDesc', v)} placeholder="Add items" multi />
                    </Td>
                    <Td align="text-right" cls="text-[11px] font-mono font-medium whitespace-nowrap text-foreground">{amountDisplay}</Td>
                    <Td align="text-center">
                        <EditSelect value={effectiveStatus} options={statusOpts} onSave={v => edit('status', v)} cfg={SO_STATUS_CFG} />
                    </Td>
                    <Td align="text-center">
                        <EditSelect value={wp} options={WIN_PCT_OPTIONS.map(o => ({ value: o, label: o }))} onSave={v => edit('winPct', v)} />
                    </Td>
                    <Td cls="max-w-[120px] text-[11px]">
                        <EditText value={remark} onSave={v => edit('remark', v)} placeholder="Add remark" multi />
                    </Td>
                    {showPin && (
                        <Td align="text-center" cls="w-10">
                            <button
                                onClick={() => onPin(id)}
                                title="Move to Previous Deal"
                                className="p-1 rounded hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition"
                            >
                                <Pin size={12} />
                            </button>
                        </Td>
                    )}
                </tr>
            );
        });

    const hdr = (showPin = false) => (
        <tr className="bg-muted/50 text-muted-foreground border-b border-border">
            <Th w="w-8">No.</Th><Th align="text-left" w="w-32">Company</Th><Th w="w-24">Quote No.</Th>
            <Th w="w-24">SO No.</Th>
            <Th w="w-24"><span className="text-emerald-600">Orig. Date</span></Th>
            <Th w="w-24">Sub. Date</Th><Th w="w-24">Follow Up</Th><Th align="text-left">Item Description</Th>
            <Th w="w-24" align="text-right">Amount</Th>
            <Th w="w-24">Status</Th><Th w="w-16">Win%</Th><Th align="text-left" w="w-28">Remark</Th>
            {showPin && <Th w="w-10">{''}</Th>}
        </tr>
    );

    return (
        <>
            <Section title="PREVIOUS DEAL — Follow Up" count={prevDeals.length} accent={BLUE}>
                <table className="w-full text-xs" style={{ minWidth: 900 }}><thead>{hdr(false)}</thead><tbody>{renderRows(prevDeals, true, false)}</tbody></table>
            </Section>
            <Section title="NEW DEAL — This Week" count={newDeals.length} accent="#1a5cbf">
                <table className="w-full text-xs" style={{ minWidth: 960 }}><thead>{hdr(true)}</thead><tbody>{renderRows(newDeals, false, true)}</tbody></table>
            </Section>
        </>
    );
};

interface LogOverride { soNo?: string; remark?: string; }

// ─── Customer List section ───────────────────────────────────────────────────
const CustomerListSection: React.FC<{
    rows: any[];
    overrides: Record<string, LogOverride>;
    onOverride: (id: string, field: keyof LogOverride, v: string) => void;
}> = ({ rows, overrides, onOverride }) => (
    <Section title="CUSTOMER LIST" count={rows.length} accent="#1E88E5">
        <table className="w-full text-xs" style={{ minWidth: 860 }}>
            <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b border-border">
                    <Th w="w-8">No.</Th><Th align="text-left" w="w-36">Company Name</Th><Th align="text-left" w="w-28">Contact Name</Th>
                    <Th w="w-24">Phone</Th><Th w="w-24">Position</Th><Th align="text-left">Opportunity Name</Th>
                    <Th w="w-24">Happen</Th><Th w="w-28">SO No.</Th><Th align="text-left" w="w-32">Remark</Th>
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? emptyRow(9) : rows.map((cl, i) => {
                    const id = cl['Log ID'] || String(i);
                    const ov = overrides[id] ?? {};
                    return (
                        <tr key={id} className={`border-b border-border/40 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-accent/20`}>
                            <Td align="text-center" cls="font-bold text-muted-foreground">{i + 1}</Td>
                            <Td cls="font-semibold max-w-[140px]"><span className="line-clamp-2">{cl['Company Name'] || '—'}</span></Td>
                            <Td cls="text-muted-foreground text-[11px]">{cl['Contact Name'] || '—'}</Td>
                            <Td align="text-center" cls="text-muted-foreground text-[11px]">{cl['Phone Number'] || '—'}</Td>
                            <Td cls="text-muted-foreground text-[11px]">{cl['Position'] || '—'}</Td>
                            <Td cls="text-muted-foreground text-[11px] max-w-[200px]">{cl['Remarks'] || '—'}</Td>
                            <Td align="text-center" cls="text-muted-foreground text-[11px]">{cl['Contact Date'] ? fmtShort(new Date(cl['Contact Date'])) : '—'}</Td>
                            <Td cls="text-[11px]"><EditText value={ov.soNo ?? (cl['SO No'] || '')} onSave={v => onOverride(id, 'soNo', v)} placeholder="Add SO No." /></Td>
                            <Td cls="text-[11px]"><EditText value={ov.remark ?? (cl['Remark'] || cl['Remarks'] || '')} onSave={v => onOverride(id, 'remark', v)} placeholder="Add remark" multi /></Td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </Section>
);

// ─── Location (Site Survey) section ──────────────────────────────────────────
const LocationSurveySection: React.FC<{
    rows: any[];
    overrides: Record<string, LogOverride>;
    onOverride: (id: string, field: keyof LogOverride, v: string) => void;
}> = ({ rows, overrides, onOverride }) => (
    <Section title="LOCATION (SITE SURVEY)" count={rows.length} accent="#43A047">
        <table className="w-full text-xs" style={{ minWidth: 860 }}>
            <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b border-border">
                    <Th w="w-8">No.</Th><Th align="text-left" w="w-36">Location</Th><Th align="text-left" w="w-28">Contact Name</Th>
                    <Th w="w-24">Phone</Th><Th w="w-24">Position</Th><Th align="text-left">Opportunity Name</Th>
                    <Th w="w-24">Happen</Th><Th align="text-left" w="w-32">Remark</Th>
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? emptyRow(8) : rows.map((s, i) => {
                    const id = s['Site ID'] || String(i);
                    const ov = overrides[id] ?? {};
                    return (
                        <tr key={id} className={`border-b border-border/40 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-accent/20`}>
                            <Td align="text-center" cls="font-bold text-muted-foreground">{i + 1}</Td>
                            <Td cls="font-semibold max-w-[140px]"><span className="line-clamp-2">{s['Location'] || '—'}</span></Td>
                            <Td cls="text-muted-foreground text-[11px]">{s['Responsible By'] || '—'}</Td>
                            <Td align="text-center" cls="text-muted-foreground text-[11px]">{s['Phone'] || s['Phone Number'] || '—'}</Td>
                            <Td cls="text-muted-foreground text-[11px]">{s['Position'] || '—'}</Td>
                            <Td cls="text-muted-foreground text-[11px] max-w-[200px]">{s['Opportunity'] || s['Remarks'] || '—'}</Td>
                            <Td align="text-center" cls="text-muted-foreground text-[11px]">{s['Date'] ? fmtShort(new Date(s['Date'])) : '—'}</Td>
                            <Td cls="text-[11px]"><EditText value={ov.remark ?? (s['Remark'] || '')} onSave={v => onOverride(id, 'remark', v)} placeholder="Add remark" multi /></Td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </Section>
);

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string; sub?: string; icon: React.ReactNode; accent: string }> = ({ label, value, sub, icon, accent }) => (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
        <div className={`p-2.5 rounded-lg ${accent} flex-shrink-0`}>{icon}</div>
        <div className="min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
    </div>
);

// ─── Week/Month Picker ────────────────────────────────────────────────────────
const RangePicker: React.FC<{
    weekStart: Date; onChange: (d: Date) => void;
    mode: 'week' | 'month'; onModeChange: (m: 'week' | 'month') => void;
}> = ({ weekStart, onChange, mode, onModeChange }) => {
    const prev = () => { const d = new Date(weekStart); mode === 'week' ? d.setDate(d.getDate() - 7) : d.setMonth(d.getMonth() - 1); onChange(d); };
    const next = () => { const d = new Date(weekStart); mode === 'week' ? d.setDate(d.getDate() + 7) : d.setMonth(d.getMonth() + 1); onChange(d); };
    const weekEnd = getWeekEnd(weekStart);
    const label = mode === 'week' ? `${fmtShort(weekStart)} – ${fmtShort(weekEnd)}` : fmtMonthYear(weekStart);
    const isoWeek = toISOWeek(weekStart);
    const isoMonth = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}`;

    return (
        <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden text-[11px] font-semibold">
                {(['week', 'month'] as const).map(m => (
                    <button key={m} onClick={() => onModeChange(m)}
                        className={`px-2.5 py-1 transition ${mode === m ? 'text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                        style={mode === m ? { background: BLUE } : {}}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                ))}
            </div>
            <button onClick={prev} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"><ChevronLeft size={16} /></button>
            <div className="relative">
                {mode === 'week'
                    ? <><input type="week" value={isoWeek} onChange={e => e.target.value && onChange(parseISOWeek(e.target.value))} className="opacity-0 absolute inset-0 cursor-pointer w-full h-full" /><span className="text-sm font-semibold text-foreground pointer-events-none">{label}</span></>
                    : <><input type="month" value={isoMonth} onChange={e => { if (!e.target.value) return; const [y, mo] = e.target.value.split('-').map(Number); onChange(new Date(y, mo - 1, 1)); }} className="opacity-0 absolute inset-0 cursor-pointer w-full h-full" /><span className="text-sm font-semibold text-foreground pointer-events-none">{label}</span></>
                }
            </div>
            <button onClick={next} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"><ChevronRight size={16} /></button>
            <button onClick={() => onChange(getWeekStart(new Date()))} className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted transition">This week</button>
        </div>
    );
};

// ─── Main Dashboard ────────────────────────────────────────────────────────────
const WeeklyReportDashboard: React.FC = () => {
    const { saleOrders, quotations, contactLogs, siteSurveys, invoices, loading, fetchModule } = useData();
    const { addToast } = useToast();

    const [mode, setMode] = useState<'week' | 'month'>('week');
    const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
    const [preparedBy, setPreparedBy] = useState('Mon Sreyneang');
    const [soOverrides, setSoOverrides] = useState<Record<string, SOOverride>>({});
    const [logOverrides, setLogOverrides] = useState<Record<string, LogOverride>>({});
    const [surveyOverrides, setSurveyOverrides] = useState<Record<string, LogOverride>>({})
    /** IDs from ANY past weekly report — these are definitively Previous Deals */
    const [historicalPrevIds, setHistoricalPrevIds] = useState<Set<string>>(new Set());
    /** True once the current-period overrides Supabase query has returned */
    const [overridesLoaded, setOverridesLoaded] = useState(false);
    /** Tracks which periodKey we've already done the auto-stamp for (prevents loops) */
    const autoStampDone = React.useRef('');

    const periodKey = useMemo(() => mode === 'month'
        ? `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}`
        : toISOWeek(weekStart), [weekStart, mode]);

    useEffect(() => {
        setSoOverrides({});
        setLogOverrides({});
        setSurveyOverrides({});

        // Load current-period overrides
        supabase
            .from('weekly_report_overrides')
            .select('section, record_id, overrides')
            .eq('period_key', periodKey)
            .then(({ data }) => {
                if (!data) return;
                const so: Record<string, SOOverride> = {};
                const log: Record<string, LogOverride> = {};
                const survey: Record<string, LogOverride> = {};
                for (const row of data) {
                    if (row.section === 'so') so[row.record_id] = row.overrides;
                    else if (row.section === 'log') log[row.record_id] = row.overrides;
                    else if (row.section === 'survey') survey[row.record_id] = row.overrides;
                }
                setSoOverrides(so);
                setLogOverrides(log);
                setSurveyOverrides(survey);
                setOverridesLoaded(true); // signal that overrides are ready for auto-stamp
            });

        // Load ALL record IDs from past periods — these are definitively Previous Deals.
        // A quote that appeared in week 13's report is Previous Deal in week 18,
        // regardless of what its Quote Date was changed to in the Quotations Creator.
        supabase
            .from('weekly_report_overrides')
            .select('record_id')
            .eq('section', 'so')
            .neq('period_key', periodKey)
            .then(({ data }) => {
                setHistoricalPrevIds(data ? new Set(data.map((r: any) => r.record_id)) : new Set());
            });
        // Reset flags for new period
        setOverridesLoaded(false);
        autoStampDone.current = '';
    }, [periodKey]);


    useEffect(() => { fetchModule('Sale Orders', 'Quotations', 'Contact_Logs', 'Site_Survey_Logs', 'Invoices'); }, [fetchModule]);

    const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);
    const rangeStart = useMemo(() => mode === 'month' ? getMonthStart(weekStart) : weekStart, [mode, weekStart]);
    const rangeEnd = useMemo(() => mode === 'month' ? getMonthEnd(weekStart) : weekEnd, [mode, weekStart, weekEnd]);

    const periodLabel = mode === 'month' ? fmtMonthYear(weekStart) : `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`;

    const soInRange  = useMemo(() => [...(saleOrders ?? [])].filter(r => inRange(r['SO Date'], rangeStart, rangeEnd)).sort((a, b) => new Date(a['SO Date'] || 0).getTime() - new Date(b['SO Date'] || 0).getTime()), [saleOrders, rangeStart, rangeEnd]);
    const quotInRange = useMemo(() => {
        const allQuotes = quotations ?? [];
        // Classification uses created_at (immutable insertion timestamp) so that
        // updating Quote Date / Validity Date in the Quotations Creator never
        // moves a deal to a different week's report.
        const inWeek = allQuotes.filter(r => inRange(classifyDate(r), rangeStart, rangeEnd));
        // Also carry forward open/pending quotes that were created before this period
        const pendingPrior = allQuotes.filter(r => {
            if (inRange(classifyDate(r), rangeStart, rangeEnd)) return false;
            if (r.Status !== 'Open') return false;
            const d = new Date(classifyDate(r) ?? '');
            return !isNaN(d.getTime()) && d < rangeStart;
        });
        return [...inWeek, ...pendingPrior].sort((a, b) => new Date(classifyDate(a) ?? 0).getTime() - new Date(classifyDate(b) ?? 0).getTime());
    }, [quotations, rangeStart, rangeEnd]);

    // ALL sale orders (not range-filtered) for linking to quotations
    const allSaleOrders = useMemo(() => saleOrders ?? [], [saleOrders]);

    // Build quotation-first unified rows for display
    const soByQuoteNo = useMemo(() => {
        const m = new Map<string, any>();
        for (const so of allSaleOrders) if (so['Quote No']) m.set(so['Quote No'], so);
        return m;
    }, [allSaleOrders]);

    const soBySONo = useMemo(() => {
        const m = new Map<string, any>();
        for (const so of allSaleOrders) if (so['SO No']) m.set(so['SO No'], so);
        return m;
    }, [allSaleOrders]);

    const fuzzyQuoteMap = useMemo(() => buildFuzzyQuoteMap(allSaleOrders, quotInRange), [allSaleOrders, quotInRange]);

    const fuzzySOByQuoteNo = useMemo(() => {
        const m = new Map<string, any>();
        for (const [soNo, q] of fuzzyQuoteMap.entries()) {
            const so = soBySONo.get(soNo);
            if (so) m.set(q['Quote No'], so);
        }
        return m;
    }, [fuzzyQuoteMap, soBySONo]);

    // Quotation-first unified rows — quotations are primary, SO attaches if found from ALL time
    const unifiedRows = useMemo(() => {
        const rows: any[] = quotInRange.map(q => {
            const linkedSO = soByQuoteNo.get(q['Quote No']) ?? fuzzySOByQuoteNo.get(q['Quote No']);
            return { ...q, _linkedSO: linkedSO ?? null, _type: 'quote' };
        });
        return rows;
    }, [quotInRange, soByQuoteNo, fuzzySOByQuoteNo]);

    // ── Auto-stamp originalQuoteDate for all Previous Deal rows on first load.
    // This freezes Orig. Date in Supabase so future Quote Date changes never affect it.
    // Runs once per period AFTER overrides have loaded (overridesLoaded=true).
    useEffect(() => {
        if (!overridesLoaded || !unifiedRows.length) return;
        if (autoStampDone.current === periodKey) return; // already done

        const OPEN = new Set(['Open', 'Pending']);
        const toStamp: Array<{ id: string; merged: Record<string, any> }> = [];

        for (const r of unifiedRows) {
            const id = r._linkedSO?.['SO No'] || r['Quote No'] || r['SO No'];
            if (!id) continue;
            const ov = soOverrides[id] ?? {};
            if (ov.originalQuoteDate) continue; // already snapshotted — do not overwrite

            const pinned   = ov.isPreviousDeal === true;
            const historic = historicalPrevIds.has(id);
            const rawStatus = r._linkedSO?.Status ?? r.Status;
            const datePrev  = OPEN.has(rawStatus) && !inRange(classifyDate(r), rangeStart, rangeEnd);

            if (pinned || historic || datePrev) {
                const date = r['created_at'] || r['Quote Date'] || '';
                if (date) toStamp.push({
                    id,
                    // Set both originalQuoteDate (for stable Orig. Date display) AND
                    // isPreviousDeal (belt-and-suspenders: keeps it in Previous Deal
                    // even before overrides load on next page visit)
                    merged: { ...ov, originalQuoteDate: date, isPreviousDeal: true },
                });
            }
        }

        autoStampDone.current = periodKey;
        if (!toStamp.length) return;

        setSoOverrides(prev => {
            const next = { ...prev };
            for (const { id, merged } of toStamp) next[id] = merged;
            return next;
        });
        for (const { id, merged } of toStamp) {
            supabase.from('weekly_report_overrides').upsert(
                { period_key: periodKey, section: 'so', record_id: id, overrides: merged, updated_at: new Date().toISOString() },
                { onConflict: 'period_key,section,record_id' }
            );
        }
    }, [overridesLoaded, unifiedRows, soOverrides, historicalPrevIds, rangeStart, rangeEnd, periodKey]);

    // For export: convert unified rows to shape PrintableWeeklyReport expects
    const soInRangeEnriched = useMemo(() => unifiedRows.map(row => {
        const so = row._linkedSO;
        const id = so?.['SO No'] || row['Quote No'];
        const ov = soOverrides[id] ?? {};
        const baseStatus = so ? so.Status : (row.Status === 'Close (Win)' ? 'Completed' : row.Status === 'Close (Lose)' ? 'Cancel' : 'Pending');
        const status = ov.status ?? baseStatus;
        const wp = ov.winPct ?? (status === 'Completed' ? '>75%' : status === 'Cancel' ? '0%' : '50%');
        return {
            'SO No': so?.['SO No'] || '',
            'SO Date': so?.['SO Date'] || row['Quote Date'] || '',
            'Quote No': row['Quote No'] || '',
            'Company Name': row['Company Name'] || '',
            'Total Amount': so?.['Total Amount'] || row['Amount'] || '0',
            'Currency': so?.['Currency'] || row['Currency'] || 'USD',
            'ItemsJSON': ov.itemDesc !== undefined ? ov.itemDesc : (so?.['ItemsJSON'] || row['ItemsJSON'] || ''),
            'Remark': ov.remark ?? (so?.['Remark'] || row['Remark'] || ''),
            'Delivery Date': ov.followUpDate ?? (so?.['Delivery Date'] || row['Validity Date'] || ''),
            'Status': status,
            '_winPct': wp,
        };
    }), [unifiedRows, soOverrides]);

    const logInRange  = useMemo(() => [...(contactLogs ?? [])].filter(r => inRange(r['Contact Date'], rangeStart, rangeEnd)).sort((a, b) => new Date(a['Contact Date'] || 0).getTime() - new Date(b['Contact Date'] || 0).getTime()), [contactLogs, rangeStart, rangeEnd]);
    const surveyInRange = useMemo(() => [...(siteSurveys ?? [])].filter(r => inRange(r['Date'], rangeStart, rangeEnd)).sort((a, b) => new Date(a['Date'] || 0).getTime() - new Date(b['Date'] || 0).getTime()), [siteSurveys, rangeStart, rangeEnd]);

    const totalRevenue = useMemo(() => soInRange.filter(s => (soOverrides[s['SO No']]?.status ?? s.Status) === 'Completed').reduce((sum, s) => sum + (parseFloat(String(s['Total Amount'])) || 0), 0), [soInRange, soOverrides]);
    const isEmpty = quotInRange.length + logInRange.length + surveyInRange.length === 0;

    const upsertOverride = (section: 'so' | 'log' | 'survey', id: string, merged: Record<string, any>) => {
        supabase.from('weekly_report_overrides').upsert(
            { period_key: periodKey, section, record_id: id, overrides: merged, updated_at: new Date().toISOString() },
            { onConflict: 'period_key,section,record_id' }
        );
    };

    const handleSOOverride = (id: string, field: keyof SOOverride, v: string, pinAsPrev?: boolean) =>
        setSoOverrides(prev => {
            const merged = { ...(prev[id] ?? {}), [field]: v };
            if (pinAsPrev) merged.isPreviousDeal = true;
            upsertOverride('so', id, merged);
            return { ...prev, [id]: merged };
        });

    /** Explicit pin: move a mis-classified New Deal row permanently to Previous Deal.
     *  Writes isPreviousDeal=true to Supabase so it survives week changes and reloads. */
    const handlePinAsPrevious = (id: string) => {
        setSoOverrides(prev => {
            const merged = { ...(prev[id] ?? {}), isPreviousDeal: true };
            upsertOverride('so', id, merged);
            return { ...prev, [id]: merged };
        });
        addToast('Pinned as Previous Deal', 'success');
    };
    const handleLogOverride = (id: string, field: keyof LogOverride, v: string) =>
        setLogOverrides(prev => {
            const merged = { ...(prev[id] ?? {}), [field]: v };
            upsertOverride('log', id, merged);
            return { ...prev, [id]: merged };
        });
    const handleSurveyOverride = (id: string, field: keyof LogOverride, v: string) =>
        setSurveyOverrides(prev => {
            const merged = { ...(prev[id] ?? {}), [field]: v };
            upsertOverride('survey', id, merged);
            return { ...prev, [id]: merged };
        });

    const handleExport = () => {
        if (!soInRange.length && !quotInRange.length && !logInRange.length) { addToast('No data in this period.', 'error'); return; }
        try {
            const merged = soInRangeEnriched.map(so => {
                const ov = soOverrides[so['SO No']] ?? {};
                const status = (ov.status as any) ?? so.Status;
                const wp = ov.winPct ?? (status === 'Completed' ? '>75%' : status === 'Cancel' ? '0%' : '50%');
                return { ...so, 'Status': status, 'Remark': ov.remark ?? so['Remark'] ?? '', 'Delivery Date': ov.followUpDate ?? so['Delivery Date'] ?? '', '_winPct': wp, 'ItemsJSON': ov.itemDesc !== undefined ? ov.itemDesc : so['ItemsJSON'] };
            });

            // Tag each quotation row with _isPreviousDeal using the same logic as the screen
            // (inlined here because isPinned/isHistoric/getClassifyDate live in SaleOrdersSection scope).
            const taggedQuotations = unifiedRows.map(r => {
                const id = r._linkedSO?.['SO No'] || r['Quote No'] || r['SO No'];
                const ov = soOverrides[id] ?? {};
                const pinned   = ov.isPreviousDeal === true;
                const historic = historicalPrevIds.has(id);
                const classDate = ov.originalQuoteDate || r['created_at'] || r['Quote Date'];
                const d = classDate ? new Date(classDate) : null;
                const inRng = d && !isNaN(d.getTime()) ? d >= rangeStart && d <= rangeEnd : false;
                const status = r._linkedSO?.Status ?? r.Status;
                const isOpen = status === 'Open' || status === 'Pending';
                const prev = pinned || historic || (isOpen && !inRng);
                return { ...r, _isPreviousDeal: prev };
            });

            exportWeeklyReport(merged as any, { preparedBy, reportMonth: periodLabel, weekStart, quotations: taggedQuotations as any, invoices: invoices ?? [], contactLogs: logInRange, siteSurveys: surveyInRange });
            addToast('Opening print dialog…', 'success');
        } catch (err: any) { addToast(`Export failed: ${err.message}`, 'error'); }
    };

    const dataLoading = loading && !saleOrders && !quotations;

    return (
        <div className="h-full flex flex-col overflow-hidden">

            {/* Header */}
            <header className="flex-shrink-0 bg-card border-b border-border px-4 lg:px-6 py-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BLUE }}>
                                <FileText size={16} className="text-white" />
                            </div>
                            <h1 className="text-base font-bold text-foreground">Weekly Sales Report</h1>
                        </div>
                        <RangePicker weekStart={weekStart} onChange={setWeekStart} mode={mode} onModeChange={setMode} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-muted rounded-md px-2.5 py-1.5 border border-border">
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Prepared by</span>
                            <input type="text" value={preparedBy} onChange={e => setPreparedBy(e.target.value)} className="bg-transparent text-sm font-semibold text-foreground focus:outline-none w-36" />
                        </div>
                        <PermissionGate module="weekly_report" action="export">
                          <button onClick={handleExport} className="flex items-center gap-2 text-white font-bold py-2 px-4 rounded-md transition shadow text-sm" style={{ background: BLUE }}>
                              <Download size={14} />Export PDF
                          </button>
                        </PermissionGate>
                    </div>
                </div>
            </header>

            {/* Stats */}
            <div className="flex-shrink-0 px-4 lg:px-6 py-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard label="Sale Orders" value={String(soInRange.length)} sub="this period" icon={<ClipboardList size={16} className="text-blue-500" />} accent="bg-blue-500/10" />
                <StatCard label="SO Revenue" value={`${totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} sub="completed" icon={<CheckCircle2 size={16} className="text-emerald-500" />} accent="bg-emerald-500/10" />
                <StatCard label="Quotations" value={String(quotInRange.length)} sub="this week + pending" icon={<FileText size={16} className="text-indigo-500" />} accent="bg-indigo-500/10" />
                <StatCard label="Customer List" value={String(logInRange.length)} sub="interactions" icon={<Phone size={16} className="text-rose-500" />} accent="bg-rose-500/10" />
                <StatCard label="Site Surveys" value={String(surveyInRange.length)} sub="conducted" icon={<MapPin size={16} className="text-green-500" />} accent="bg-green-500/10" />
            </div>

            {/* Edit hint */}
            <div className="flex-shrink-0 px-4 lg:px-6 pb-2">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Pencil size={10} />
                    Click any cell in Status, Win %, Item Description, or Remark to edit. Changes apply to the export only.
                </p>
            </div>

            {/* Tables */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-6 pb-6 space-y-3">
                {dataLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: BLUE }} />
                    </div>
                ) : isEmpty ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                        <FileText size={36} className="opacity-15" />
                        <div className="text-center">
                            <p className="font-semibold text-sm">No activity recorded this {mode}</p>
                            <p className="text-xs mt-0.5">Try navigating to a different {mode}</p>
                        </div>
                    </div>
                ) : !overridesLoaded ? (
                    // Wait for overrides before rendering deal sections.
                    // Without this gate, rows flash between New/Previous Deal while
                    // Supabase resolves the override that contains originalQuoteDate.
                    <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: BLUE }} />
                    </div>
                ) : (
                    <>
                        <SaleOrdersSection
                            rows={unifiedRows}
                            overrides={soOverrides}
                            onOverride={handleSOOverride}
                            onPin={handlePinAsPrevious}
                            rangeStart={rangeStart}
                            rangeEnd={rangeEnd}
                            historicalPrevIds={historicalPrevIds}
                        />
                        <CustomerListSection rows={logInRange} overrides={logOverrides} onOverride={handleLogOverride} />
                        <LocationSurveySection rows={surveyInRange} overrides={surveyOverrides} onOverride={handleSurveyOverride} />
                    </>
                )}
            </div>
        </div>
    );
};

export default WeeklyReportDashboard;
