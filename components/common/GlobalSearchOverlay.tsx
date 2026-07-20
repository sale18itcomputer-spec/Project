'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Building2, User, FileText, ShoppingCart, Receipt as ReceiptIcon, Wrench, Hash, Loader2, Clock } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useWindowManager, type OpenWindowInput } from '../../contexts/WindowManagerContext';
import CompanyWindowContent from '../windows/content/CompanyWindowContent';
import ContactWindowContent from '../windows/content/ContactWindowContent';
import QuotationWindowContent from '../windows/content/QuotationWindowContent';
import SaleOrderWindowContent from '../windows/content/SaleOrderWindowContent';
import InvoiceWindowContent from '../windows/content/InvoiceWindowContent';
import ServiceTicketWindowContent from '../windows/content/ServiceTicketWindowContent';
import SerialNumberWindowContent from '../windows/content/SerialNumberWindowContent';
import { isServiceInvoice } from '../../utils/serviceInvoice';

/**
 * A serializable descriptor for a search hit. It carries everything needed to
 * (a) render the row and (b) re-open the record's window later — including from
 * the persisted "Recent" list, where the original open() closure is long gone.
 */
interface RecentEntry {
    key: string;
    group: string;
    title: string;
    subtitle: string;
    badge?: string;
    payload: Record<string, string>;
    at: number;
}

interface SearchResult {
    key: string;
    group: string;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    badge?: string;
    score: number;
    recent: RecentEntry;
    open: () => void;
}

const MAX_PER_GROUP = 5;

/** Searchable modules shown as hint chips on the idle (empty-query) state. */
const CATEGORIES: { icon: React.ReactNode; label: string; resource: string }[] = [
    { icon: <Building2 size={13} />, label: 'Companies', resource: 'companies' },
    { icon: <User size={13} />, label: 'Contacts', resource: 'contacts' },
    { icon: <FileText size={13} />, label: 'Quotations', resource: 'quotations' },
    { icon: <ShoppingCart size={13} />, label: 'Sale Orders', resource: 'sale_orders' },
    { icon: <ReceiptIcon size={13} />, label: 'Invoices', resource: 'invoices' },
    { icon: <Wrench size={13} />, label: 'Service Tickets', resource: 'service_tickets' },
    { icon: <Hash size={13} />, label: 'Serial Numbers', resource: 'serial_numbers' },
];

/** Group → the icon used for its rows (also reused for persisted recents). */
const GROUP_ICON: Record<string, React.ReactNode> = {
    Companies: <Building2 size={15} />,
    Contacts: <User size={15} />,
    Quotations: <FileText size={15} />,
    'Sale Orders': <ShoppingCart size={15} />,
    Invoices: <ReceiptIcon size={15} />,
    'Service Tickets': <Wrench size={15} />,
    'Serial Numbers': <Hash size={15} />,
};

/**
 * Build the WindowManager config that opens a record's window, from its group
 * and a compact string payload. This is the single source of truth for window
 * geometry/content, shared by live search hits and the persisted recents list.
 */
function buildOpenConfig(group: string, p: Record<string, string>): OpenWindowInput | null {
    switch (group) {
        case 'Companies': {
            const id = `company-${p.companyId}`;
            return {
                id, title: 'Company',
                content: <CompanyWindowContent windowId={id} companyId={p.companyId} />,
                initialWidth: 700, initialHeight: 750, minWidth: 500, minHeight: 400,
                detachUrl: `/standalone/company/${encodeURIComponent(p.companyId)}`,
            };
        }
        case 'Contacts': {
            const id = `contact-${p.contactId}`;
            return {
                id, title: 'Contact',
                content: <ContactWindowContent windowId={id} contactId={p.contactId} />,
                initialWidth: 640, initialHeight: 700, minWidth: 500, minHeight: 400,
                detachUrl: `/standalone/contact/${encodeURIComponent(p.contactId)}`,
            };
        }
        case 'Quotations': {
            const id = `quotation-${p.quoteNo}`;
            return {
                id, title: `Quotation: ${p.quoteNo}`,
                content: <QuotationWindowContent windowId={id} quoteNo={p.quoteNo} />,
                noPadding: true, initialWidth: 1200, initialHeight: 820, minWidth: 900, minHeight: 600,
                detachUrl: `/standalone/quotation/${encodeURIComponent(p.quoteNo)}`,
            };
        }
        case 'Sale Orders': {
            const id = `sale-order-${p.soNo}`;
            return {
                id, title: `Sale Order: ${p.soNo}`,
                content: <SaleOrderWindowContent windowId={id} soNo={p.soNo} />,
                noPadding: true, initialWidth: 1200, initialHeight: 820, minWidth: 900, minHeight: 600,
                detachUrl: `/standalone/sale-order/${encodeURIComponent(p.soNo)}`,
            };
        }
        case 'Invoices': {
            const id = `invoice-${p.invNo}`;
            return {
                id, title: `Invoice: ${p.invNo}`,
                content: <InvoiceWindowContent windowId={id} invNo={p.invNo} />,
                noPadding: true, initialWidth: 1200, initialHeight: 820, minWidth: 900, minHeight: 600,
                detachUrl: `/standalone/invoice/${encodeURIComponent(p.invNo)}`,
            };
        }
        case 'Service Tickets': {
            const id = `service-ticket-${p.ticketId}`;
            return {
                id, title: 'Service Ticket',
                content: <ServiceTicketWindowContent windowId={id} ticketId={p.ticketId} initialReadOnly={true} />,
                draggable: true, initialWidth: 900, initialHeight: 760, minWidth: 880, minHeight: 480,
            };
        }
        case 'Serial Numbers': {
            const id = `serial-number-${p.snId}`;
            return {
                id, title: 'Serial Number',
                content: <SerialNumberWindowContent windowId={id} snId={p.snId} />,
                draggable: true,
            };
        }
        default:
            return null;
    }
}

const RECENTS_KEY = 'globalSearch.recents.v1';
const MAX_RECENTS = 6;

function loadRecents(): RecentEntry[] {
    try {
        const parsed = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

/** A searchable field paired with a weight (title fields weigh more than secondary ones). */
type ScoreField = { v: string; w: number };

/** Build a lowercased, weighted field for scoring. Falsy values become empty strings. */
const field = (value: string | null | undefined, weight: number): ScoreField => ({
    v: (value ?? '').toLowerCase(),
    w: weight,
});

const TITLE_W = 3;
const SUB_W = 1;

/**
 * Score a record against the query tokens (AND semantics — every token must
 * match at least one field, or the record is rejected). Higher is more
 * relevant: exact field match > prefix > word-boundary > loose substring, and
 * matches in a heavier (title) field count for more.
 */
function scoreRecord(tokens: string[], fields: ScoreField[]): number | null {
    let total = 0;
    for (const tok of tokens) {
        let best = 0;
        for (const { v, w } of fields) {
            if (!v) continue;
            const idx = v.indexOf(tok);
            if (idx === -1) continue;
            let s = w;                                          // loose substring
            if (v === tok) s += 6 * w;                          // whole field equals token
            else if (idx === 0) s += 4 * w;                     // field starts with token
            else if (!/[a-z0-9]/.test(v[idx - 1])) s += 2 * w;  // token sits on a word boundary
            if (s > best) best = s;
        }
        if (best === 0) return null;   // this token matched nothing → drop the record
        total += best;
    }
    return total;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wrap the query tokens found in `text` with a highlight <mark>. */
function highlight(text: string, tokens: string[]): React.ReactNode {
    if (!text || tokens.length === 0) return text;
    const re = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'ig');
    const parts = text.split(re);
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
        i % 2 === 1
            ? <mark key={i} className="bg-brand-500/25 text-foreground rounded-[2px] px-px">{part}</mark>
            : part
    );
}

const GlobalSearchOverlay: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    const {
        companies, contacts, quotations, saleOrders, invoices,
        serviceTickets, serialNumbers, fetchModule, loading,
    } = useData();
    const { can } = usePermissions();
    const { openWindow } = useWindowManager();

    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [recents, setRecents] = useState<RecentEntry[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Load the searchable modules + recents each time the palette opens.
    useEffect(() => {
        if (open) {
            fetchModule('Quotations', 'Sale Orders', 'Invoices', 'Service Tickets', 'Serial Numbers');
            setQuery('');
            setActiveIndex(0);
            setRecents(loadRecents());
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open, fetchModule]);

    // Move the just-opened record to the front of the persisted recents list.
    const rememberRecent = useCallback((entry: RecentEntry) => {
        setRecents(prev => {
            const next = [{ ...entry, at: Date.now() }, ...prev.filter(r => r.key !== entry.key)]
                .slice(0, MAX_RECENTS);
            try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    }, []);

    const queryTokens = useMemo(
        () => query.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0),
        [query],
    );

    const results = useMemo<SearchResult[]>(() => {
        const q = query.trim();
        if (q.length < 2 || queryTokens.length === 0) return [];
        const tokens = queryTokens;
        const out: SearchResult[] = [];

        // Push a hit, deriving its recents descriptor and window-opener from the
        // same compact payload so live results and persisted recents never drift.
        const push = (r: {
            key: string; group: string; score: number; icon: React.ReactNode;
            title: string; subtitle: string; badge?: string; payload: Record<string, string>;
        }) => {
            out.push({
                key: r.key, group: r.group, score: r.score, icon: r.icon,
                title: r.title, subtitle: r.subtitle, badge: r.badge,
                recent: {
                    key: r.key, group: r.group, title: r.title,
                    subtitle: r.subtitle, badge: r.badge, payload: r.payload, at: 0,
                },
                open: () => {
                    const cfg = buildOpenConfig(r.group, r.payload);
                    if (cfg) openWindow(cfg);
                    onClose();
                },
            });
        };

        if (can('companies', 'view') && companies) {
            for (const c of companies) {
                const score = scoreRecord(tokens, [
                    field(c['Company Name'], TITLE_W),
                    field(c['Company Name (Khmer)'], TITLE_W),
                    field(c['Company ID'], SUB_W),
                ]);
                if (score === null) continue;
                push({
                    key: `company-${c['Company ID']}`, group: 'Companies', score,
                    icon: <Building2 size={15} />,
                    title: c['Company Name'] || c['Company ID'],
                    subtitle: c['Company ID'],
                    payload: { companyId: c['Company ID'] },
                });
            }
        }

        if (can('contacts', 'view') && contacts) {
            for (const c of contacts) {
                const score = scoreRecord(tokens, [
                    field(c['Name'], TITLE_W),
                    field(c['Company Name'], SUB_W),
                    field(c['Tel (1)'], SUB_W),
                    field(c['Email'], SUB_W),
                    field(c['Customer ID'], SUB_W),
                ]);
                if (score === null) continue;
                push({
                    key: `contact-${c['Customer ID']}`, group: 'Contacts', score,
                    icon: <User size={15} />,
                    title: c['Name'] || c['Customer ID'],
                    subtitle: c['Company Name'] || c['Tel (1)'] || '',
                    payload: { contactId: c['Customer ID'] },
                });
            }
        }

        if (can('quotations', 'view') && quotations) {
            for (const doc of quotations) {
                const score = scoreRecord(tokens, [
                    field(doc['Quote No'], TITLE_W),
                    field(doc['Company Name'], SUB_W),
                    field(doc['Contact Name'], SUB_W),
                ]);
                if (score === null) continue;
                push({
                    key: `quotation-${doc['Quote No']}`, group: 'Quotations', score,
                    icon: <FileText size={15} />,
                    title: doc['Quote No'],
                    subtitle: doc['Company Name'] || '',
                    payload: { quoteNo: doc['Quote No'] },
                });
            }
        }

        if (can('sale_orders', 'view') && saleOrders) {
            for (const doc of saleOrders) {
                const score = scoreRecord(tokens, [
                    field(doc['SO No'], TITLE_W),
                    field(doc['Company Name'], SUB_W),
                    field(doc['Contact Name'], SUB_W),
                ]);
                if (score === null) continue;
                push({
                    key: `sale-order-${doc['SO No']}`, group: 'Sale Orders', score,
                    icon: <ShoppingCart size={15} />,
                    title: doc['SO No'],
                    subtitle: doc['Company Name'] || '',
                    payload: { soNo: doc['SO No'] },
                });
            }
        }

        if (invoices) {
            for (const inv of invoices) {
                const service = isServiceInvoice(inv);
                if (!can(service ? 'service_invoices' : 'invoices', 'view')) continue;
                const score = scoreRecord(tokens, [
                    field(inv['Inv No'], TITLE_W),
                    field(inv['Company Name'], SUB_W),
                    field(inv['Contact Name'], SUB_W),
                ]);
                if (score === null) continue;
                push({
                    key: `invoice-${inv['Inv No']}`, group: 'Invoices', score,
                    icon: <ReceiptIcon size={15} />,
                    title: inv['Inv No'],
                    subtitle: inv['Company Name'] || '',
                    badge: service ? 'Service' : undefined,
                    payload: { invNo: inv['Inv No'] },
                });
            }
        }

        if (can('service_tickets', 'view') && serviceTickets) {
            for (const t of serviceTickets) {
                if (!t.id) continue;
                const score = scoreRecord(tokens, [
                    field(t.ticket_no, TITLE_W),
                    field(t.serial_number, SUB_W),
                    field(t.model_name, SUB_W),
                    field(t.company_name, SUB_W),
                    field(t.contact_name, SUB_W),
                ]);
                if (score === null) continue;
                push({
                    key: `service-ticket-${t.id}`, group: 'Service Tickets', score,
                    icon: <Wrench size={15} />,
                    title: t.ticket_no,
                    subtitle: [t.company_name, t.model_name].filter(Boolean).join(' — '),
                    badge: t.status,
                    payload: { ticketId: t.id },
                });
            }
        }

        if (can('serial_numbers', 'view') && serialNumbers) {
            for (const s of serialNumbers) {
                if (!s.id) continue;
                const score = scoreRecord(tokens, [
                    field(s.serial_number, TITLE_W),
                    field(s.model_name, SUB_W),
                    field(s.brand, SUB_W),
                    field(s.company_name, SUB_W),
                ]);
                if (score === null) continue;
                push({
                    key: `serial-number-${s.id}`, group: 'Serial Numbers', score,
                    icon: <Hash size={15} />,
                    title: s.serial_number,
                    subtitle: [s.brand, s.model_name].filter(Boolean).join(' ') || s.company_name || '',
                    badge: s.stock_status,
                    payload: { snId: s.id },
                });
            }
        }

        // Group results, sort each group by relevance and cap it, then order the
        // groups themselves by their single best match so the most relevant
        // module surfaces first — while keeping each group's rows contiguous for
        // the header rendering below.
        const groups = new Map<string, SearchResult[]>();
        const groupOrder: string[] = [];
        for (const r of out) {
            let bucket = groups.get(r.group);
            if (!bucket) { bucket = []; groups.set(r.group, bucket); groupOrder.push(r.group); }
            bucket.push(r);
        }

        const ordered = groupOrder
            .map(g => {
                const rows = groups.get(g)!.sort((a, b) => b.score - a.score).slice(0, MAX_PER_GROUP);
                return { rows, best: rows[0].score };
            })
            .sort((a, b) => b.best - a.best);

        return ordered.flatMap(g => g.rows);
    }, [query, queryTokens, companies, contacts, quotations, saleOrders, invoices, serviceTickets, serialNumbers, can, openWindow, onClose]);

    // Idle state: recently opened records, shown (and navigable) before a query.
    const recentRows = useMemo<SearchResult[]>(() => recents.map(e => ({
        key: e.key, group: 'Recent', score: 0,
        icon: GROUP_ICON[e.group] ?? <FileText size={15} />,
        title: e.title, subtitle: e.subtitle, badge: e.badge,
        recent: e,
        open: () => {
            const cfg = buildOpenConfig(e.group, e.payload);
            if (cfg) openWindow(cfg);
            onClose();
        },
    })), [recents, openWindow, onClose]);

    // Whether we're showing the empty-query (recents) view or live search hits.
    const showingRecents = query.trim().length < 2;
    const rows = showingRecents ? recentRows : results;

    // Record the pick in recents, then open its window.
    const activate = useCallback((r: SearchResult) => {
        rememberRecent(r.recent);
        r.open();
    }, [rememberRecent]);

    // Per-group counts for the group-header pill (covers recents + results).
    const groupCounts = useMemo(() => {
        const m = new Map<string, number>();
        for (const r of rows) m.set(r.group, (m.get(r.group) ?? 0) + 1);
        return m;
    }, [rows]);

    useEffect(() => { setActiveIndex(0); }, [query, recents]);

    // Keep the active row visible while navigating with the keyboard.
    useEffect(() => {
        listRef.current
            ?.querySelector(`[data-index="${activeIndex}"]`)
            ?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, rows.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter' && rows[activeIndex]) { e.preventDefault(); activate(rows[activeIndex]); }
        else if (e.key === 'Tab') { e.preventDefault(); inputRef.current?.focus(); }  // trap focus in the palette
    };

    if (!open) return null;

    // Render group headers as the flat list changes group.
    let lastGroup = '';

    return (
        <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[12vh] px-4" onKeyDown={handleKeyDown}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Global search"
                className="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-up"
            >
                <div className="flex items-center gap-3 px-4 border-b border-border">
                    <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search companies, contacts, invoices, tickets, serials..."
                        className="w-full py-3.5 bg-transparent text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none"
                        role="combobox"
                        aria-expanded={rows.length > 0}
                        aria-controls="global-search-listbox"
                        aria-activedescendant={rows.length > 0 ? `gs-opt-${activeIndex}` : undefined}
                        aria-autocomplete="list"
                        aria-label="Search companies, contacts, invoices, tickets, serials"
                    />
                    <kbd className="hidden sm:inline-block text-[10px] font-semibold text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">ESC</kbd>
                </div>

                <div ref={listRef} id="global-search-listbox" role="listbox" aria-label="Search results" className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {rows.length > 0 ? (
                        <>
                            {rows.map((r, i) => {
                                const showHeader = r.group !== lastGroup;
                                lastGroup = r.group;
                                return (
                                    <React.Fragment key={r.key}>
                                        {showHeader && (
                                            <div className="flex items-center justify-between px-4 pt-3 pb-1">
                                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                                    {showingRecents && <Clock size={11} />}
                                                    {r.group}
                                                </span>
                                                <span className="text-[10px] font-semibold text-muted-foreground/50 tabular-nums">
                                                    {groupCounts.get(r.group)}
                                                </span>
                                            </div>
                                        )}
                                        <button
                                            id={`gs-opt-${i}`}
                                            role="option"
                                            aria-selected={i === activeIndex}
                                            data-index={i}
                                            onClick={() => activate(r)}
                                            onMouseEnter={() => setActiveIndex(i)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-l-2 transition-colors ${
                                                i === activeIndex
                                                    ? 'bg-brand-500/10 border-brand-500'
                                                    : 'border-transparent hover:bg-muted/60'
                                            }`}
                                        >
                                            <span className={`flex-shrink-0 ${i === activeIndex ? 'text-brand-500' : 'text-muted-foreground'}`}>
                                                {r.icon}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm font-semibold text-foreground truncate">{highlight(r.title, queryTokens)}</span>
                                                {r.subtitle && <span className="block text-xs text-muted-foreground truncate">{highlight(r.subtitle, queryTokens)}</span>}
                                            </span>
                                            {r.badge && (
                                                <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                    {r.badge}
                                                </span>
                                            )}
                                            {i === activeIndex && (
                                                <kbd className="flex-shrink-0 hidden sm:inline-flex items-center text-[10px] font-semibold text-brand-500 bg-brand-500/10 border border-brand-500/30 rounded px-1.5 py-0.5">
                                                    ↵
                                                </kbd>
                                            )}
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                            {showingRecents && (
                                <p className="px-4 py-3 text-center text-[11px] text-muted-foreground/60">
                                    Start typing to search across all modules
                                </p>
                            )}
                        </>
                    ) : showingRecents ? (
                        <div className="py-8 px-4">
                            <p className="text-center text-xs text-muted-foreground/70 mb-4">
                                Type at least 2 characters to search across
                            </p>
                            <div className="flex flex-wrap justify-center gap-1.5">
                                {CATEGORIES.filter(c => can(c.resource, 'view')).map(c => (
                                    <span
                                        key={c.label}
                                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border rounded-full px-2.5 py-1"
                                    >
                                        <span className="text-muted-foreground/70">{c.icon}</span>
                                        {c.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : loading ? (
                        <div className="py-10 flex flex-col items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 size={18} className="animate-spin" />
                            Searching…
                        </div>
                    ) : (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            No results for &ldquo;{query}&rdquo;
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/30 text-[10px] text-muted-foreground">
                    <span><kbd className="font-semibold">↑↓</kbd> navigate</span>
                    <span><kbd className="font-semibold">↵</kbd> open</span>
                    <span><kbd className="font-semibold">esc</kbd> close</span>
                    {results.length > 0 && (
                        <span className="ml-auto tabular-nums">
                            {results.length} result{results.length === 1 ? '' : 's'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GlobalSearchOverlay;
