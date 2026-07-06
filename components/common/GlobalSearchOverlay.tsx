'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Building2, User, FileText, ShoppingCart, Receipt as ReceiptIcon, Wrench, Hash } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useWindowManager } from '../../contexts/WindowManagerContext';
import CompanyWindowContent from '../windows/content/CompanyWindowContent';
import ContactWindowContent from '../windows/content/ContactWindowContent';
import QuotationWindowContent from '../windows/content/QuotationWindowContent';
import SaleOrderWindowContent from '../windows/content/SaleOrderWindowContent';
import InvoiceWindowContent from '../windows/content/InvoiceWindowContent';
import ServiceTicketWindowContent from '../windows/content/ServiceTicketWindowContent';
import SerialNumberWindowContent from '../windows/content/SerialNumberWindowContent';
import { isServiceInvoice } from '../../utils/serviceInvoice';

interface SearchResult {
    key: string;
    group: string;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    badge?: string;
    open: () => void;
}

const MAX_PER_GROUP = 5;

const GlobalSearchOverlay: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    const {
        companies, contacts, quotations, saleOrders, invoices,
        serviceTickets, serialNumbers, fetchModule,
    } = useData();
    const { can } = usePermissions();
    const { openWindow } = useWindowManager();

    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Load the searchable modules the first time the palette opens.
    useEffect(() => {
        if (open) {
            fetchModule('Quotations', 'Sale Orders', 'Invoices', 'Service Tickets', 'Serial Numbers');
            setQuery('');
            setActiveIndex(0);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open, fetchModule]);

    const results = useMemo<SearchResult[]>(() => {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];
        const match = (...fields: (string | undefined | null)[]) =>
            fields.some(f => f?.toLowerCase().includes(q));
        const out: SearchResult[] = [];

        const openAndClose = (cfg: Parameters<typeof openWindow>[0]) => {
            openWindow(cfg);
            onClose();
        };

        if (can('companies', 'view') && companies) {
            let n = 0;
            for (const c of companies) {
                if (n >= MAX_PER_GROUP) break;
                if (!match(c['Company Name'], c['Company Name (Khmer)'], c['Company ID'])) continue;
                n++;
                const id = `company-${c['Company ID']}`;
                out.push({
                    key: id, group: 'Companies',
                    icon: <Building2 size={15} />,
                    title: c['Company Name'] || c['Company ID'],
                    subtitle: c['Company ID'],
                    open: () => openAndClose({
                        id, title: 'Company',
                        content: <CompanyWindowContent windowId={id} companyId={c['Company ID']} />,
                        initialWidth: 700, initialHeight: 750, minWidth: 500, minHeight: 400,
                        detachUrl: `/standalone/company/${encodeURIComponent(c['Company ID'])}`,
                    }),
                });
            }
        }

        if (can('contacts', 'view') && contacts) {
            let n = 0;
            for (const c of contacts) {
                if (n >= MAX_PER_GROUP) break;
                if (!match(c['Name'], c['Company Name'], c['Tel (1)'], c['Email'], c['Customer ID'])) continue;
                n++;
                const id = `contact-${c['Customer ID']}`;
                out.push({
                    key: id, group: 'Contacts',
                    icon: <User size={15} />,
                    title: c['Name'] || c['Customer ID'],
                    subtitle: c['Company Name'] || c['Tel (1)'] || '',
                    open: () => openAndClose({
                        id, title: 'Contact',
                        content: <ContactWindowContent windowId={id} contactId={c['Customer ID']} />,
                        initialWidth: 640, initialHeight: 700, minWidth: 500, minHeight: 400,
                        detachUrl: `/standalone/contact/${encodeURIComponent(c['Customer ID'])}`,
                    }),
                });
            }
        }

        if (can('quotations', 'view') && quotations) {
            let n = 0;
            for (const doc of quotations) {
                if (n >= MAX_PER_GROUP) break;
                if (!match(doc['Quote No'], doc['Company Name'], doc['Contact Name'])) continue;
                n++;
                const id = `quotation-${doc['Quote No']}`;
                out.push({
                    key: id, group: 'Quotations',
                    icon: <FileText size={15} />,
                    title: doc['Quote No'],
                    subtitle: doc['Company Name'] || '',
                    open: () => openAndClose({
                        id, title: `Quotation: ${doc['Quote No']}`,
                        content: <QuotationWindowContent windowId={id} quoteNo={doc['Quote No']} />,
                        noPadding: true, initialWidth: 1200, initialHeight: 820, minWidth: 900, minHeight: 600,
                        detachUrl: `/standalone/quotation/${encodeURIComponent(doc['Quote No'])}`,
                    }),
                });
            }
        }

        if (can('sale_orders', 'view') && saleOrders) {
            let n = 0;
            for (const doc of saleOrders) {
                if (n >= MAX_PER_GROUP) break;
                if (!match(doc['SO No'], doc['Company Name'], doc['Contact Name'])) continue;
                n++;
                const id = `sale-order-${doc['SO No']}`;
                out.push({
                    key: id, group: 'Sale Orders',
                    icon: <ShoppingCart size={15} />,
                    title: doc['SO No'],
                    subtitle: doc['Company Name'] || '',
                    open: () => openAndClose({
                        id, title: `Sale Order: ${doc['SO No']}`,
                        content: <SaleOrderWindowContent windowId={id} soNo={doc['SO No']} />,
                        noPadding: true, initialWidth: 1200, initialHeight: 820, minWidth: 900, minHeight: 600,
                        detachUrl: `/standalone/sale-order/${encodeURIComponent(doc['SO No'])}`,
                    }),
                });
            }
        }

        if (invoices) {
            let n = 0;
            for (const inv of invoices) {
                if (n >= MAX_PER_GROUP) break;
                const service = isServiceInvoice(inv);
                if (!can(service ? 'service_invoices' : 'invoices', 'view')) continue;
                if (!match(inv['Inv No'], inv['Company Name'], inv['Contact Name'])) continue;
                n++;
                const id = `invoice-${inv['Inv No']}`;
                out.push({
                    key: id, group: 'Invoices',
                    icon: <ReceiptIcon size={15} />,
                    title: inv['Inv No'],
                    subtitle: inv['Company Name'] || '',
                    badge: service ? 'Service' : undefined,
                    open: () => openAndClose({
                        id, title: `Invoice: ${inv['Inv No']}`,
                        content: <InvoiceWindowContent windowId={id} invNo={inv['Inv No']} />,
                        noPadding: true, initialWidth: 1200, initialHeight: 820, minWidth: 900, minHeight: 600,
                        detachUrl: `/standalone/invoice/${encodeURIComponent(inv['Inv No'])}`,
                    }),
                });
            }
        }

        if (can('service_tickets', 'view') && serviceTickets) {
            let n = 0;
            for (const t of serviceTickets) {
                if (n >= MAX_PER_GROUP) break;
                if (!t.id) continue;
                if (!match(t.ticket_no, t.company_name, t.contact_name, t.serial_number, t.model_name)) continue;
                n++;
                const id = `service-ticket-${t.id}`;
                out.push({
                    key: id, group: 'Service Tickets',
                    icon: <Wrench size={15} />,
                    title: t.ticket_no,
                    subtitle: [t.company_name, t.model_name].filter(Boolean).join(' — '),
                    badge: t.status,
                    open: () => openAndClose({
                        id, title: 'Service Ticket',
                        content: <ServiceTicketWindowContent windowId={id} ticketId={t.id!} initialReadOnly={true} />,
                        draggable: true, initialWidth: 900, initialHeight: 760, minWidth: 880, minHeight: 480,
                    }),
                });
            }
        }

        if (can('serial_numbers', 'view') && serialNumbers) {
            let n = 0;
            for (const s of serialNumbers) {
                if (n >= MAX_PER_GROUP) break;
                if (!s.id) continue;
                if (!match(s.serial_number, s.model_name, s.brand, s.company_name)) continue;
                n++;
                const id = `serial-number-${s.id}`;
                out.push({
                    key: id, group: 'Serial Numbers',
                    icon: <Hash size={15} />,
                    title: s.serial_number,
                    subtitle: [s.brand, s.model_name].filter(Boolean).join(' ') || s.company_name || '',
                    badge: s.stock_status,
                    open: () => openAndClose({
                        id, title: 'Serial Number',
                        content: <SerialNumberWindowContent windowId={id} snId={s.id!} />,
                        draggable: true,
                    }),
                });
            }
        }

        return out;
    }, [query, companies, contacts, quotations, saleOrders, invoices, serviceTickets, serialNumbers, can, openWindow, onClose]);

    useEffect(() => { setActiveIndex(0); }, [query]);

    // Keep the active row visible while navigating with the keyboard.
    useEffect(() => {
        listRef.current
            ?.querySelector(`[data-index="${activeIndex}"]`)
            ?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter' && results[activeIndex]) { e.preventDefault(); results[activeIndex].open(); }
    };

    if (!open) return null;

    // Render group headers as the flat list changes group.
    let lastGroup = '';

    return (
        <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[12vh] px-4" onKeyDown={handleKeyDown}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
            <div className="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-up">
                <div className="flex items-center gap-3 px-4 border-b border-border">
                    <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search companies, contacts, invoices, tickets, serials..."
                        className="w-full py-3.5 bg-transparent text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none"
                    />
                    <kbd className="hidden sm:inline-block text-[10px] font-semibold text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">ESC</kbd>
                </div>

                <div ref={listRef} className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {query.trim().length < 2 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            Type at least 2 characters to search
                        </div>
                    ) : results.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            No results for &ldquo;{query}&rdquo;
                        </div>
                    ) : (
                        results.map((r, i) => {
                            const showHeader = r.group !== lastGroup;
                            lastGroup = r.group;
                            return (
                                <React.Fragment key={r.key}>
                                    {showHeader && (
                                        <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                            {r.group}
                                        </div>
                                    )}
                                    <button
                                        data-index={i}
                                        onClick={r.open}
                                        onMouseEnter={() => setActiveIndex(i)}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                            i === activeIndex ? 'bg-brand-500/10' : 'hover:bg-muted/60'
                                        }`}
                                    >
                                        <span className={`flex-shrink-0 ${i === activeIndex ? 'text-brand-500' : 'text-muted-foreground'}`}>
                                            {r.icon}
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm font-semibold text-foreground truncate">{r.title}</span>
                                            {r.subtitle && <span className="block text-xs text-muted-foreground truncate">{r.subtitle}</span>}
                                        </span>
                                        {r.badge && (
                                            <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                {r.badge}
                                            </span>
                                        )}
                                    </button>
                                </React.Fragment>
                            );
                        })
                    )}
                </div>

                <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/30 text-[10px] text-muted-foreground">
                    <span><kbd className="font-semibold">↑↓</kbd> navigate</span>
                    <span><kbd className="font-semibold">↵</kbd> open</span>
                    <span><kbd className="font-semibold">esc</kbd> close</span>
                </div>
            </div>
        </div>
    );
};

export default GlobalSearchOverlay;
