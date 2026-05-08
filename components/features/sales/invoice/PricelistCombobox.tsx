import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from "../../../../contexts/DataContext";
import { LineItem } from "./types";

const lineItemInputClasses = "w-full text-sm p-2 bg-muted/50 border border-border rounded-md focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-foreground placeholder-muted-foreground transition";

const PricelistCombobox: React.FC<{
    item: LineItem;
    onItemChange: (id: string, field: keyof Omit<LineItem, 'id' | 'amount' | 'no'>, value: string | number) => void;
    onPricelistItemSelect: (item: LineItem, pricelistItem: any) => void;
    disabled?: boolean;
}> = ({ item, onItemChange, onPricelistItemSelect, disabled = false }) => {
    const { pricelist } = useData();
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

    const filteredPricelist = useMemo(() => {
        if (!pricelist || !isOpen) return [];
        const query = item.itemCode?.toLowerCase() || '';
        if (query === '') return pricelist.slice(0, 50);
        return pricelist.filter(p =>
            p['Item Code']?.toLowerCase().includes(query) ||
            p.Model?.toLowerCase().includes(query) ||
            p.Brand?.toLowerCase().includes(query)
        ).slice(0, 50);
    }, [pricelist, item.itemCode, isOpen]);

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
                placeholder="Search..."
                className={lineItemInputClasses}
                disabled={disabled}
            />
            {isOpen && filteredPricelist.length > 0 && (
                <div className="absolute z-[9999] w-[400px] mt-1 bg-card border border-border rounded-md shadow-xl max-h-[300px] overflow-y-auto overflow-x-hidden">
                    {filteredPricelist.map((p, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b border-border last:border-0 group"
                            onClick={() => {
                                onPricelistItemSelect(item, p);
                                setIsOpen(false);
                            }}
                        >
                            <div className="font-bold text-foreground group-hover:text-brand-500 truncate">{p['Item Code']}</div>
                            <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2 mt-1">
                                <span className="truncate">Model: {p.Model}</span>
                                <span className="text-right font-semibold text-brand-500">${Number(p['Selling Price (Include VAT)']).toLocaleString()}</span>
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
