import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from "../../../../contexts/DataContext";
import { LineItem } from "./types";

const lineItemInputClasses = "w-full text-sm p-2 bg-muted/50 border border-border rounded-md focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-foreground placeholder-muted-foreground transition";

/** Normalized pick passed to onPricelistItemSelect — works for both a pricelist
 *  catalog row and an in-stock inventory row. */
interface Pick {
    source: 'inventory' | 'pricelist';
    key: string;
    Code: string;
    Model: string;
    Description: string;
    Brand: string;
    unitPrice: number;
    statusLabel: string;
}

const PricelistCombobox: React.FC<{
    item: LineItem;
    onItemChange: (id: string, field: keyof Omit<LineItem, 'id' | 'amount' | 'no'>, value: string | number) => void;
    onPricelistItemSelect: (item: LineItem, pick: Pick) => void;
    disabled?: boolean;
}> = ({ item, onItemChange, onPricelistItemSelect, disabled = false }) => {
    // catalogPricelist is the shared b2c catalog (always populated, mode-independent);
    // fall back to the mode-resolved pricelist. inventoryItems is the shared stock.
    const { catalogPricelist, pricelist, inventoryItems } = useData();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const results = useMemo((): Pick[] => {
        if (!isOpen) return [];
        const query = (item.itemCode ?? '').toLowerCase().trim();
        const catalog = (catalogPricelist && catalogPricelist.length > 0) ? catalogPricelist : (pricelist ?? []);
        // Map code → SELLING price (End User Price) from the catalog. Inventory's
        // unit_price is the purchase COST and must NEVER become the customer price,
        // so an inventory pick's price is resolved from the catalog, or left 0 for
        // the user to enter — never the cost.
        const sellPriceByCode = new Map<string, number>(
            (catalog as any[]).map(p => [(p['Code'] ?? '').toLowerCase(), Number(p['End User Price']) || 0]),
        );

        // In-stock inventory first (what's actually on hand), then the catalog.
        const invPicks: Pick[] = (inventoryItems ?? [])
            .filter((inv: any) => (Number(inv.qty) || 0) > 0 && (!query
                || (inv.code ?? '').toLowerCase().includes(query)
                || (inv.model_name ?? '').toLowerCase().includes(query)
                || (inv.brand ?? '').toLowerCase().includes(query)
                || (inv.description ?? '').toLowerCase().includes(query)))
            .slice(0, 30)
            .map((inv: any) => ({
                source: 'inventory' as const,
                key: `inv-${inv.id}`,
                Code: inv.code ?? '',
                Model: inv.model_name ?? '',
                Description: inv.description ?? '',
                Brand: inv.brand ?? '',
                unitPrice: sellPriceByCode.get((inv.code ?? '').toLowerCase()) ?? 0, // SELLING price, never cost
                statusLabel: `In stock: ${inv.qty}`,
            }));

        const seenCodes = new Set(invPicks.map(p => p.Code.toLowerCase()).filter(Boolean));
        const catPicks: Pick[] = (catalog as any[])
            .filter(p => (!query
                || (p['Code'] ?? '').toLowerCase().includes(query)
                || (p['Model'] ?? '').toLowerCase().includes(query)
                || (p['Brand'] ?? '').toLowerCase().includes(query)
                || (p['Description'] ?? '').toLowerCase().includes(query)))
            .filter(p => !seenCodes.has((p['Code'] ?? '').toLowerCase())) // avoid dupes already shown from stock
            .slice(0, 50)
            .map((p, idx) => ({
                source: 'pricelist' as const,
                key: `pl-${p['Code'] ?? idx}`,
                Code: p['Code'] ?? '',
                Model: p['Model'] ?? '',
                Description: p['Description'] ?? '',
                Brand: p['Brand'] ?? '',
                unitPrice: Number(p['End User Price']) || 0,
                statusLabel: 'Catalog',
            }));

        return [...invPicks, ...catPicks].slice(0, 60);
    }, [catalogPricelist, pricelist, inventoryItems, item.itemCode, isOpen]);

    const handleBlur = () => {
        setTimeout(() => {
            if (!document.body.contains(wrapperRef.current)) return;
            setIsOpen(false);
        }, 200);
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <input
                type="text"
                value={item.itemCode || ''}
                autoComplete="off"
                onFocus={() => setIsOpen(true)}
                onBlur={handleBlur}
                onChange={(e) => onItemChange(item.id, 'itemCode', e.target.value)}
                placeholder="Search code, model or brand…"
                className={lineItemInputClasses}
                disabled={disabled}
            />
            {isOpen && results.length > 0 && (
                <div className="absolute z-[9999] w-[400px] mt-1 bg-card border border-border rounded-md shadow-xl max-h-[300px] overflow-y-auto overflow-x-hidden">
                    {results.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b border-border last:border-0 group"
                            onClick={() => {
                                onPricelistItemSelect(item, p);
                                setIsOpen(false);
                            }}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-foreground group-hover:text-brand-500 truncate">{p.Code}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.source === 'inventory' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>{p.statusLabel}</span>
                            </div>
                            <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2 mt-1">
                                <span className="truncate">Model: {p.Model}</span>
                                <span className="text-right font-semibold text-brand-500">{p.unitPrice > 0 ? `$${p.unitPrice.toLocaleString()}` : '—'}</span>
                            </div>
                            {p.Brand && <div className="text-[10px] text-muted-foreground/60 mt-0.5">Brand: {p.Brand}</div>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
export { PricelistCombobox, lineItemInputClasses };
