'use client';

/**
 * GlobalSearch.tsx
 *
 * Cross-module search bar for the miniapp home screen.
 * Calls /api/miniapp/search and groups results by module.
 * Navigates to the relevant module page on tap.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, FileText, ShoppingCart, Receipt, Truck, ClipboardList, Package, Loader2 } from 'lucide-react';
import { haptic, type SearchResult } from '@/lib/miniapp/telegramShare';
import { useData } from '@/contexts/MiniAppDataContext';

const MODULE_ICONS: Record<string, React.ElementType> = {
    'Quotations':      FileText,
    'Sale Orders':     ShoppingCart,
    'Invoices':        Receipt,
    'Delivery Orders': Truck,
    'Receipts':        ClipboardList,
    'Purchase Orders': Package,
};

const MODULE_COLORS: Record<string, string> = {
    'Quotations':      '#38bdf8',
    'Sale Orders':     '#34d399',
    'Invoices':        '#a78bfa',
    'Delivery Orders': '#fb923c',
    'Receipts':        '#f472b6',
    'Purchase Orders': '#fbbf24',
};

export default function GlobalSearch() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const data = useData();

    const runSearch = useCallback((q: string) => {
        if (q.trim().length < 2) { setResults([]); setLoading(false); return; }
        setLoading(true);
        const lowerQ = q.toLowerCase();
        const res: SearchResult[] = [];

        // Search Quotations
        if (data.quotations) {
            for (const item of data.quotations) {
                if (String(item['Quote No'])?.toLowerCase().includes(lowerQ) || item['Company Name']?.toLowerCase().includes(lowerQ)) {
                    res.push({ module: 'Quotations', label: String(item['Quote No']), sublabel: String(item['Company Name']), meta: String(item['Amount']), href: `/miniapp/sales/quotations/${item['Quote No']}` });
                }
            }
        }
        // Search Sale Orders
        if (data.saleOrders) {
            for (const item of data.saleOrders) {
                if (String(item['SO No'])?.toLowerCase().includes(lowerQ) || item['Company Name']?.toLowerCase().includes(lowerQ)) {
                    res.push({ module: 'Sale Orders', label: String(item['SO No']), sublabel: String(item['Company Name']), meta: String(item['Total Amount'] ?? item['Amount'] ?? ''), href: `/miniapp/sales/sale-orders/${item['SO No']}` });
                }
            }
        }
        // Search Invoices
        if (data.invoices) {
            for (const item of data.invoices) {
                if (item['Invoice No']?.toLowerCase().includes(lowerQ) || item['Company Name']?.toLowerCase().includes(lowerQ)) {
                    res.push({ module: 'Invoices', label: String(item['Invoice No']), sublabel: String(item['Company Name']), meta: String(item['Grand Total']), href: `/miniapp/sales/invoices/${item['Invoice No']}` });
                }
            }
        }
        // Delivery Orders
        if (data.deliveryOrders) {
            for (const item of data.deliveryOrders) {
                if (item['DO No']?.toLowerCase().includes(lowerQ) || item['Company Name']?.toLowerCase().includes(lowerQ)) {
                    res.push({ module: 'Delivery Orders', label: String(item['DO No']), sublabel: String(item['Company Name']), href: `/miniapp/sales/delivery-orders/${item['DO No']}` });
                }
            }
        }
        // Receipts
        if (data.receipts) {
            for (const item of data.receipts) {
                if (item['Receipt No']?.toLowerCase().includes(lowerQ) || item['Company Name']?.toLowerCase().includes(lowerQ)) {
                    res.push({ module: 'Receipts', label: String(item['Receipt No']), sublabel: String(item['Company Name']), meta: String(item['Amount']), href: `/miniapp/sales/receipts/${item['Receipt No']}` });
                }
            }
        }

        setResults(res.slice(0, 50));
        setLoading(false);
    }, [data.quotations, data.saleOrders, data.invoices, data.deliveryOrders, data.receipts]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.trim().length < 2) { setResults([]); return; }
        debounceRef.current = setTimeout(() => runSearch(query), 350);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query, runSearch]);

    const clear = () => {
        setQuery('');
        setResults([]);
        setOpen(false);
        inputRef.current?.blur();
    };

    const handleSelect = (result: SearchResult) => {
        haptic('light');
        clear();
        router.push(result.href);
    };

    // Group results by module
    const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
        (acc[r.module] ??= []).push(r);
        return acc;
    }, {});

    return (
        <div className="relative px-3 pb-1">
            {/* Search input */}
            <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-2xl transition-all duration-150"
                style={{
                    background: 'hsl(var(--muted)/0.6)',
                    border: `1px solid ${open ? 'hsl(var(--border))' : 'transparent'}`,
                }}
            >
                {loading
                    ? <Loader2 size={16} className="flex-shrink-0 animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
                    : <Search size={16} className="flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
                }
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    placeholder="Search quotes, invoices, companies…"
                    onFocus={() => setOpen(true)}
                    onBlur={() => { if (!query) setOpen(false); }}
                    onChange={e => setQuery(e.target.value)}
                    className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
                    style={{ color: 'hsl(var(--foreground))' }}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
                {query && (
                    <button
                        onPointerDown={e => { e.preventDefault(); clear(); }}
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-opacity active:opacity-60"
                        style={{ background: 'hsl(var(--muted-foreground)/0.25)' }}
                        aria-label="Clear search"
                    >
                        <X size={11} style={{ color: 'hsl(var(--foreground))' }} />
                    </button>
                )}
            </div>

            {/* Results dropdown */}
            {open && (query.length >= 2) && (
                <div
                    className="absolute left-3 right-3 top-full mt-1 rounded-2xl overflow-hidden z-50"
                    style={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border)/0.8)',
                        boxShadow: '0 8px 32px hsl(var(--foreground)/0.12)',
                    }}
                >
                    {loading && results.length === 0 && (
                        <div className="flex items-center justify-center gap-2 py-6">
                            <Loader2 size={16} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
                            <span className="text-[13px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Searching…</span>
                        </div>
                    )}

                    {!loading && results.length === 0 && query.length >= 2 && (
                        <div className="py-6 text-center">
                            <p className="text-[13px]" style={{ color: 'hsl(var(--muted-foreground))' }}>No results for "{query}"</p>
                        </div>
                    )}

                    {Object.entries(grouped).map(([module, items], gi) => {
                        const Icon = MODULE_ICONS[module] ?? FileText;
                        const color = MODULE_COLORS[module] ?? '#888';
                        return (
                            <div key={module}>
                                {gi > 0 && (
                                    <div style={{ height: '1px', background: 'hsl(var(--border)/0.5)', margin: '0 12px' }} />
                                )}
                                {/* Module label */}
                                <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                                    <Icon size={12} style={{ color }} />
                                    <span
                                        className="text-[10px] font-semibold uppercase tracking-wider"
                                        style={{ color: 'hsl(var(--muted-foreground))' }}
                                    >
                                        {module}
                                    </span>
                                </div>
                                {/* Result rows */}
                                {items.map((result, i) => (
                                    <button
                                        key={`${result.label}-${i}`}
                                        onPointerDown={e => { e.preventDefault(); handleSelect(result); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors active:opacity-70"
                                        style={{ background: 'transparent' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted)/0.5)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <div
                                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                                        >
                                            <Icon size={15} style={{ color }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p
                                                className="text-[13px] font-semibold leading-tight truncate"
                                                style={{ color: 'hsl(var(--foreground))' }}
                                            >
                                                {result.label}
                                            </p>
                                            <p
                                                className="text-[11px] truncate mt-0.5"
                                                style={{ color: 'hsl(var(--muted-foreground))' }}
                                            >
                                                {result.sublabel}
                                                {result.meta && <span style={{ color: 'hsl(var(--muted-foreground)/0.6)' }}> · {result.meta}</span>}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        );
                    })}

                    {results.length > 0 && (
                        <div
                            className="px-3 py-2 text-center"
                            style={{ borderTop: '1px solid hsl(var(--border)/0.4)' }}
                        >
                            <p className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground)/0.5)' }}>
                                {results.length} result{results.length !== 1 ? 's' : ''} across all modules
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
