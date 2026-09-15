import React from 'react';
import { useData } from '@/contexts/DataContext';
import { LineItem, BuildComponent } from './types';
import { PricelistCombobox } from './PricelistCombobox';
import { SerialNumberPicker } from '../../../common/SerialNumberPicker';
import { Trash2, Plus } from 'lucide-react';
import NumericInput from '../../../common/NumericInput';

// Wraps each BuildComponent as a LineItem so it can reuse PricelistCombobox's
// search/select UI without duplicating it — only itemCode/modelName/brand are read back.
const toLineItemShape = (c: BuildComponent, idx: number): LineItem => ({
    id: `bc-${idx}`, no: 0, itemCode: c.itemCode, modelName: c.modelName,
    description: '', qty: c.qty, unitPrice: 0, amount: 0, brand: c.brand,
});

interface PCBuildComponentPickerProps {
    components: BuildComponent[];
    onChange: (components: BuildComponent[]) => void;
    /** Document tax type — forwarded to each component's serial picker so a VAT
     *  invoice only lists VAT-purchased component serials (and vice-versa). */
    taxType?: string;
}

export const PCBuildComponentPicker: React.FC<PCBuildComponentPickerProps> = ({ components, onChange, taxType }) => {
    const { inventoryItems } = useData();
    // Real per-part warranty comes from the received stock (inventory.warranty_months,
    // sourced from the PO), keyed by item code — the pricelist carries no warranty.
    const warrantyByCode = React.useMemo(() => {
        const m = new Map<string, number>();
        for (const r of inventoryItems ?? []) {
            const c = String((r as any).code ?? '').toLowerCase();
            const w = (r as any).warranty_months;
            if (c && w != null && !m.has(c)) m.set(c, Number(w));
        }
        return m;
    }, [inventoryItems]);

    const addComponent = () => {
        onChange([...components, { itemCode: '', modelName: '', qty: 1, unitCost: 0, warrantyMonths: 12 }]);
    };
    const updateComponent = (idx: number, patch: Partial<BuildComponent>) => {
        onChange(components.map((c, i) => i === idx ? { ...c, ...patch } : c));
    };
    const removeComponent = (idx: number) => {
        onChange(components.filter((_, i) => i !== idx));
    };

    return (
        <div className="space-y-2 border border-dashed border-border rounded-lg p-3 bg-background/40">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Build Components</span>
                <span className="text-[9px] text-muted-foreground">{components.length} part(s)</span>
            </div>

            {components.map((c, idx) => (
                <div key={idx} className="p-2 rounded-lg border border-border bg-card space-y-1.5">
                    <div className="flex gap-2 items-start">
                        <div className="flex-1 min-w-0">
                            <PricelistCombobox
                                item={toLineItemShape(c, idx)}
                                onItemChange={(_id, field, value) => {
                                    if (field === 'itemCode') updateComponent(idx, { itemCode: String(value) });
                                }}
                                onPricelistItemSelect={(_item, p) => {
                                    const code = p['Code'] || p['Item Code'] || '';
                                    updateComponent(idx, {
                                        itemCode: code,
                                        modelName: p.Model || '',
                                        description: (p as any).Description || (p as any).description || '',
                                        brand: p.Brand || '',
                                        // Pull the real warranty from received stock; keep 12 as a fallback.
                                        warrantyMonths: warrantyByCode.get(String(code).toLowerCase()) ?? 12,
                                    });
                                }}
                            />
                        </div>
                        <div className="w-16">
                            <NumericInput
                                value={c.qty} blankZero={false}
                                onValueChange={v => updateComponent(idx, { qty: v })}
                                className="w-full h-9 px-2 text-center text-xs bg-input border border-border rounded-md text-foreground"
                                placeholder="Qty" aria-label="Component quantity"
                            />
                        </div>
                        <div className="w-20">
                            <NumericInput
                                value={c.warrantyMonths ?? 12} blankZero={false}
                                onValueChange={v => updateComponent(idx, { warrantyMonths: v })}
                                className="w-full h-9 px-2 text-center text-xs bg-input border border-border rounded-md text-foreground"
                                placeholder="Mo." title="Warranty (months)" aria-label="Warranty months"
                            />
                        </div>
                        <button
                            type="button" onClick={() => removeComponent(idx)}
                            className="h-9 flex items-center justify-center p-1.5 text-muted-foreground hover:text-rose-500"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {c.modelName && (
                        <div className="text-[10px] text-muted-foreground/70 truncate">{c.modelName} {c.brand ? `· ${c.brand}` : ''}</div>
                    )}
                    <SerialNumberPicker
                        itemCode={c.itemCode}
                        modelName={c.modelName}
                        qty={c.qty}
                        value={c.serialNumber || ''}
                        onChange={v => updateComponent(idx, { serialNumber: v })}
                        taxType={taxType}
                    />
                </div>
            ))}

            <button
                type="button" onClick={addComponent}
                className="w-full py-1.5 rounded-md border border-dashed border-brand-300 text-brand-600 text-xs font-bold flex items-center justify-center gap-1"
            >
                <Plus className="w-3 h-3" /> Add Component
            </button>
        </div>
    );
};

export default PCBuildComponentPicker;
