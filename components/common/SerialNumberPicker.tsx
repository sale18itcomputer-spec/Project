'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { wantTaxType, taxTypeOrFilter } from '../../services/inventoryApi';

interface AvailableSerial {
    id: string;
    serial_number: string;
}

interface SerialNumberPickerProps {
    itemCode?: string;
    modelName?: string;
    qty?: number;
    value: string;
    onChange: (value: string) => void;
    /** Document tax type ('VAT' | 'NON-VAT' | 'Commercial Invoice'). When set, only
     *  serials from stock of the matching tax type (or unclassified) are offered —
     *  so VAT stock can only be picked on a VAT invoice, and vice-versa. */
    taxType?: string;
}

const splitLines = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean);

// Picks serial numbers from real unsold inventory (stock_status = 'In Stock')
// instead of free-typing. Falls back to a manual textarea for units never
// logged at PO intake. Always emits the same newline-joined string shape that
// LineItem.serialNumber already expects, so callers don't need to change.
export const SerialNumberPicker: React.FC<SerialNumberPickerProps> = ({ itemCode, modelName, qty = 0, value, onChange, taxType }) => {
    const [available, setAvailable] = useState<AvailableSerial[]>([]);
    const [loading, setLoading] = useState(false);

    const currentLines = useMemo(() => splitLines(value), [value]);

    useEffect(() => {
        let active = true;
        const code = itemCode?.trim();
        const model = modelName?.trim();

        if (!code && !model) {
            setAvailable([]);
            return;
        }

        setLoading(true);
        (async () => {
            // Same code-first, model-fallback precedence used for FIFO inventory
            // matching in InvoiceCreator/DeliveryOrderCreator. When a document tax
            // type is given, restrict to matching (or unclassified) stock so a VAT
            // invoice never lists non-VAT serials and vice-versa.
            const taxFilter = taxType ? taxTypeOrFilter(wantTaxType(taxType === 'VAT')) : null;
            let invIds: string[] = [];
            if (code) {
                let q = supabase.from('inventory').select('id').eq('code', code);
                if (taxFilter) q = q.or(taxFilter);
                const { data } = await q;
                invIds = (data ?? []).map((r: any) => r.id);
            }
            if (invIds.length === 0 && model) {
                let q = supabase.from('inventory').select('id').ilike('model_name', `%${model}%`);
                if (taxFilter) q = q.or(taxFilter);
                const { data } = await q;
                invIds = (data ?? []).map((r: any) => r.id);
            }

            if (invIds.length === 0) {
                if (active) { setAvailable([]); setLoading(false); }
                return;
            }

            const { data: serials } = await supabase
                .from('serial_numbers')
                .select('id, serial_number')
                .in('inventory_id', invIds)
                .eq('stock_status', 'In Stock')
                .order('created_at', { ascending: true });

            if (active) {
                setAvailable(serials ?? []);
                setLoading(false);
            }
        })();

        return () => { active = false; };
    }, [itemCode, modelName, taxType]);

    const availableSet = useMemo(() => new Set(available.map(a => a.serial_number)), [available]);
    const selectedKnown = currentLines.filter(l => availableSet.has(l));
    const manualLines = currentLines.filter(l => !availableSet.has(l));
    const manualText = manualLines.join('\n');

    const toggleSerial = (sn: string) => {
        const isSelected = currentLines.includes(sn);
        const next = isSelected ? currentLines.filter(l => l !== sn) : [...currentLines, sn];
        onChange(next.join('\n'));
    };

    const allSelected = available.length > 0 && selectedKnown.length === available.length;
    const toggleAll = () => {
        if (allSelected) {
            // Deselect every in-stock serial, but keep any manually-typed lines.
            onChange(manualLines.join('\n'));
        } else {
            // Select every in-stock serial (union with whatever's already there),
            // preserving order: known serials first, manual entries after.
            const union = [...available.map(a => a.serial_number), ...manualLines];
            onChange(Array.from(new Set(union)).join('\n'));
        }
    };

    const handleManualChange = (text: string) => {
        onChange([...selectedKnown, ...splitLines(text)].join('\n'));
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-1 gap-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">
                    Serial Numbers <span className="normal-case font-normal text-muted-foreground/40">(one per line)</span>
                </label>
                <div className="flex items-center gap-2 whitespace-nowrap">
                    {available.length > 0 && (
                        <button
                            type="button"
                            onClick={toggleAll}
                            className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-brand-500/30 text-brand-600 bg-brand-500/10 hover:bg-brand-500/20 transition-colors"
                        >
                            {allSelected ? 'Clear all' : `Select all ${available.length}`}
                        </button>
                    )}
                    <span className="text-[9px] text-muted-foreground">
                        {selectedKnown.length}{qty > 0 ? `/${qty}` : ''} selected &middot; {available.length} in stock
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="text-xs text-muted-foreground py-1">Loading available serials…</div>
            ) : available.length > 0 ? (
                <div className="max-h-28 overflow-y-auto vertical-scroll flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-input mb-1.5">
                    {available.map(s => {
                        const checked = currentLines.includes(s.serial_number);
                        return (
                            <label
                                key={s.id}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono cursor-pointer border transition-colors ${checked
                                    ? 'bg-brand-500/10 text-brand-600 border-brand-500/30'
                                    : 'bg-background text-foreground border-border hover:bg-muted'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSerial(s.serial_number)}
                                    className="h-3.5 w-3.5 rounded border-border bg-background text-brand-600 focus:ring-brand-500"
                                />
                                {s.serial_number}
                            </label>
                        );
                    })}
                </div>
            ) : (
                <div className="text-[10px] text-muted-foreground italic mb-1">
                    No in-stock serials found for this item — enter manually below if needed.
                </div>
            )}

            <textarea
                value={manualText}
                onChange={e => handleManualChange(e.target.value)}
                className="w-full text-xs p-2 font-mono rounded-lg border border-border bg-input text-foreground resize-y min-h-[40px]"
                rows={2}
                placeholder={available.length > 0 ? 'Other serial not listed above (one per line)' : `SN001\nSN002\nSN003...`}
            />
            {manualLines.length > 0 && (
                <div className="text-[9px] text-amber-600 mt-0.5">
                    {manualLines.length} manually entered — not verified against in-stock inventory
                </div>
            )}
        </div>
    );
};

export default SerialNumberPicker;
