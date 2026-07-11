import React from 'react';
import { LineItem, BuildComponent } from './types';
import { PricelistCombobox } from './PricelistCombobox';
import { SerialNumberPicker } from '../../../common/SerialNumberPicker';
import { Trash2, Plus } from 'lucide-react';

// Wraps each BuildComponent as a LineItem so it can reuse PricelistCombobox's
// search/select UI without duplicating it — only itemCode/modelName/brand are read back.
const toLineItemShape = (c: BuildComponent, idx: number): LineItem => ({
    id: `bc-${idx}`, no: 0, itemCode: c.itemCode, modelName: c.modelName,
    description: '', qty: c.qty, unitPrice: 0, amount: 0, brand: c.brand,
});

interface PCBuildComponentPickerProps {
    components: BuildComponent[];
    onChange: (components: BuildComponent[]) => void;
}

export const PCBuildComponentPicker: React.FC<PCBuildComponentPickerProps> = ({ components, onChange }) => {
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
                                onPricelistItemSelect={(_item, p) => updateComponent(idx, {
                                    itemCode: p['Code'] || p['Item Code'] || '',
                                    modelName: p.Model || '',
                                    brand: p.Brand || '',
                                })}
                            />
                        </div>
                        <div className="w-16">
                            <input
                                type="number" min={1} value={c.qty}
                                onChange={e => updateComponent(idx, { qty: Number(e.target.value) || 1 })}
                                className="w-full h-9 px-2 text-center text-xs bg-input border border-border rounded-md text-foreground"
                                placeholder="Qty"
                            />
                        </div>
                        <div className="w-20">
                            <input
                                type="number" min={0} value={c.warrantyMonths ?? 12}
                                onChange={e => updateComponent(idx, { warrantyMonths: Number(e.target.value) || 0 })}
                                className="w-full h-9 px-2 text-center text-xs bg-input border border-border rounded-md text-foreground"
                                placeholder="Mo." title="Warranty (months)"
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
