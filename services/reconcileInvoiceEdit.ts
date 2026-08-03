import { supabase } from '../lib/supabase';
import {
    createJournalEntry,
    getNextEntryNumber,
    normalizeBrand,
    BRAND_ACCOUNT_MAP,
} from './accountingApi';

/**
 * Delta reconciliation for edits to an ALREADY-ISSUED invoice.
 *
 * The issue-path (InvoiceCreator handleSave, `wasDraft && isNowIssued`) relieves
 * inventory + serials + posts the invoice JE exactly once, on the Draft→Issued
 * transition. Re-saving an already-issued invoice deliberately skips that block
 * so the originals aren't deducted twice. The side effect was that anything ADDED
 * or REMOVED by editing an issued invoice (extra line, a bundled accessory, more
 * captured serials, a qty change) was never reflected in stock, the serial
 * register, or the GL.
 *
 * This function closes that gap by reconciling ONLY the delta between the last
 * saved items and the new items — mirroring the issue-path's mechanics:
 *   • inventory.qty  — deduct net additions (FIFO oldest lot), restore net removals
 *   • serial_numbers — mark newly-added serials Sold, revert removed ones to In Stock
 *   • journal_entry  — post a separate, additive adjustment JE for any value change
 *
 * It never mutates or deletes the original invoice JE, so the audit trail is
 * preserved and repeated edits each post their own incremental adjustment.
 */

const addMonths = (dateStr: string, months: number): string => {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + (Number(months) || 0));
    return d.toISOString().slice(0, 10);
};

interface LeafAgg { code?: string; model?: string; qty: number; brand?: string; }
interface SerialInfo { code?: string; model?: string; brand?: string; modelName?: string; description?: string; warrantyMonths: number; }

interface Collected {
    qtyByKey: Map<string, LeafAgg>;
    serials: Map<string, SerialInfo>;
    amountByBrand: Map<string, number>;
}

const keyOf = (code?: string, model?: string) => (code || model || '').trim().toLowerCase();

/** Flatten an ItemsJSON array to leaf sellable units (normal lines + PC-build
 *  components), aggregating qty per code and collecting captured serials, plus
 *  revenue amount per resolved brand (PC-build revenue books under 'PC Build'). */
function collect(list: any[], brandByCode: Map<string, string>): Collected {
    const qtyByKey = new Map<string, LeafAgg>();
    const serials = new Map<string, SerialInfo>();
    const amountByBrand = new Map<string, number>();

    const addQty = (code: string | undefined, model: string | undefined, qty: number, brand?: string) => {
        if (!(qty > 0)) return;
        const key = keyOf(code, model);
        if (!key) return;
        const cur = qtyByKey.get(key) || { code, model, qty: 0, brand };
        cur.qty += qty;
        qtyByKey.set(key, cur);
    };
    const addRevenue = (brand: string, amount: number) => {
        if (!(Math.abs(amount) > 0)) return;
        amountByBrand.set(brand, (amountByBrand.get(brand) || 0) + amount);
    };
    const splitSerials = (raw?: string) => (raw || '').split('\n').map(s => s.trim()).filter(Boolean);

    for (const it of list || []) {
        if (it.isPromotion) continue; // promos are contra-revenue; out of scope for edit delta
        const amount = Number(it.amount) || 0;

        if (it.isPCBuild) {
            addRevenue('PC Build', amount);
            for (const c of it.buildComponents || []) {
                const cq = Number(c.qty) || 0;
                addQty(c.itemCode?.trim(), c.modelName?.trim(), cq, c.brand);
                for (const sn of splitSerials(c.serialNumber)) {
                    serials.set(sn, {
                        code: c.itemCode?.trim(), model: c.modelName?.trim(),
                        brand: (c.itemCode && brandByCode.get(c.itemCode)) || c.brand,
                        modelName: c.modelName, description: it.description,
                        warrantyMonths: c.warrantyMonths ?? 12,
                    });
                }
            }
            continue;
        }

        const code = it.itemCode?.trim(), model = it.modelName?.trim();
        const q = Number(it.qty) || 0;
        addQty(code, model, q, it.brand);
        const brand = normalizeBrand((code && brandByCode.get(code)) || it.brand || 'Other Accessories');
        addRevenue(brand, amount);
        for (const sn of splitSerials(it.serialNumber)) {
            serials.set(sn, {
                code, model,
                brand: (code && brandByCode.get(code)) || it.brand,
                modelName: it.modelName, description: it.description,
                warrantyMonths: 12,
            });
        }
    }
    return { qtyByKey, serials, amountByBrand };
}

export interface EditDelta {
    /** Net qty change per leaf code (>0 deduct, <0 restore). */
    qtyDeltas: { code?: string; model?: string; brand: string; delta: number }[];
    /** Serials present in new but not old — to mark Sold. */
    addedSerials: { serial: string; info: SerialInfo }[];
    /** Serials present in old but not new — to revert to In Stock. */
    removedSerials: string[];
    /** Net revenue change per brand. */
    revDeltaByBrand: Record<string, number>;
}

/** Pure delta between two ItemsJSON snapshots. No I/O — unit-testable. */
export function computeInvoiceEditDelta(oldItems: any[], newItems: any[], brandByCode: Map<string, string>): EditDelta {
    const oldC = collect(oldItems, brandByCode);
    const newC = collect(newItems, brandByCode);

    const qtyDeltas: EditDelta['qtyDeltas'] = [];
    const allKeys = new Set<string>([...oldC.qtyByKey.keys(), ...newC.qtyByKey.keys()]);
    for (const key of allKeys) {
        const o = oldC.qtyByKey.get(key);
        const n = newC.qtyByKey.get(key);
        const info = n || o!;
        const delta = (n?.qty || 0) - (o?.qty || 0);
        if (delta === 0) continue;
        const brand = normalizeBrand((info.code && brandByCode.get(info.code)) || info.brand || 'Other Accessories');
        qtyDeltas.push({ code: info.code, model: info.model, brand, delta });
    }

    const addedSerials: EditDelta['addedSerials'] = [];
    for (const [serial, info] of newC.serials) if (!oldC.serials.has(serial)) addedSerials.push({ serial, info });
    const removedSerials: string[] = [];
    for (const [serial] of oldC.serials) if (!newC.serials.has(serial)) removedSerials.push(serial);

    const revDeltaByBrand: Record<string, number> = {};
    const revBrands = new Set<string>([...oldC.amountByBrand.keys(), ...newC.amountByBrand.keys()]);
    for (const b of revBrands) {
        const d = (newC.amountByBrand.get(b) || 0) - (oldC.amountByBrand.get(b) || 0);
        if (Math.abs(d) > 0.005) revDeltaByBrand[b] = d;
    }

    return { qtyDeltas, addedSerials, removedSerials, revDeltaByBrand };
}

export interface ReconcileResult {
    inventoryChanged: boolean;
    serialsChanged: boolean;
    glAdjusted: boolean;
    summary: string;
}

export async function reconcileIssuedInvoiceEdit(params: {
    invNo: string;
    invoiceDate: string;        // warranty start / JE date (YYYY-MM-DD or ISO)
    isVAT: boolean;
    soNo?: string;
    companyName?: string;
    contactName?: string;
    createdBy: string;
    oldItems: any[];
    newItems: any[];
    brandByCode: Map<string, string>;
}): Promise<ReconcileResult> {
    const startDate = (params.invoiceDate || new Date().toISOString()).slice(0, 10);
    const delta = computeInvoiceEditDelta(params.oldItems, params.newItems, params.brandByCode);

    let inventoryChanged = false;
    let serialsChanged = false;

    // COGS delta accumulates per (cogsBrand, inventoryBrand) as units move.
    const cogsDeltaByBrand = new Map<string, number>(); // brand → signed cost delta

    // ── 1. Inventory qty delta (per code) ──────────────────────────────────
    const deductFIFO = async (code: string | undefined, model: string | undefined, qty: number): Promise<number> => {
        // Returns the unit_price of the lot deducted (for COGS), 0 if none matched.
        let rows: any[] | null = null;
        if (code) {
            const { data } = await supabase.from('inventory')
                .select('id, qty, unit_price').eq('status', 'In Stock').gt('qty', 0)
                .eq('code', code).order('created_at', { ascending: true }).limit(1);
            rows = data;
        }
        if ((!rows || !rows.length) && model) {
            const { data } = await supabase.from('inventory')
                .select('id, qty, unit_price').eq('status', 'In Stock').gt('qty', 0)
                .ilike('model_name', `%${model}%`).order('created_at', { ascending: true }).limit(1);
            rows = data;
        }
        if (!rows || !rows.length) return 0;
        const lot = rows[0];
        const newQty = Math.max(0, Number(lot.qty) - qty);
        await supabase.from('inventory').update({
            qty: newQty, status: newQty <= 0 ? 'Out of Stock' : 'In Stock',
        }).eq('id', lot.id);
        inventoryChanged = true;
        return Number(lot.unit_price) || 0;
    };

    const restock = async (code: string | undefined, model: string | undefined, qty: number): Promise<number> => {
        // Adds qty back to the oldest matching lot (any status); returns its unit_price.
        let rows: any[] | null = null;
        if (code) {
            const { data } = await supabase.from('inventory')
                .select('id, qty, unit_price').eq('code', code)
                .order('created_at', { ascending: true }).limit(1);
            rows = data;
        }
        if ((!rows || !rows.length) && model) {
            const { data } = await supabase.from('inventory')
                .select('id, qty, unit_price').ilike('model_name', `%${model}%`)
                .order('created_at', { ascending: true }).limit(1);
            rows = data;
        }
        if (!rows || !rows.length) return 0;
        const lot = rows[0];
        const newQty = Number(lot.qty) + qty;
        await supabase.from('inventory').update({
            qty: newQty, status: newQty > 0 ? 'In Stock' : 'Out of Stock',
        }).eq('id', lot.id);
        inventoryChanged = true;
        return Number(lot.unit_price) || 0;
    };

    for (const { code, model, brand, delta: d } of delta.qtyDeltas) {
        if (d > 0) {
            const unitCost = await deductFIFO(code, model, d);
            if (unitCost > 0) cogsDeltaByBrand.set(brand, (cogsDeltaByBrand.get(brand) || 0) + unitCost * d);
        } else {
            const unitCost = await restock(code, model, -d);
            if (unitCost > 0) cogsDeltaByBrand.set(brand, (cogsDeltaByBrand.get(brand) || 0) + unitCost * d); // d<0 → negative
        }
    }

    // ── 2. Serial status delta (no qty change here — handled above) ─────────
    const markSold = async (sn: string, info: SerialInfo) => {
        const { data: existing } = await supabase.from('serial_numbers')
            .select('id, inventory_id, warranty_period_months').eq('serial_number', sn).limit(1);
        const brand = info.brand || '';
        if (existing && existing.length) {
            const row = existing[0];
            const months = row.warranty_period_months ?? info.warrantyMonths ?? 12;
            await supabase.from('serial_numbers').update({
                brand, model_name: info.modelName || '', description: info.description || '',
                so_no: params.soNo || '', company_name: params.companyName || '', contact_name: params.contactName || '',
                warranty_start_date: startDate, warranty_period_months: months,
                warranty_end_date: addMonths(startDate, months),
                status: 'Active', stock_status: 'Sold',
            }).eq('id', row.id);
        } else {
            const months = info.warrantyMonths ?? 12;
            await supabase.from('serial_numbers').insert({
                serial_number: sn, brand, model_name: info.modelName || '', description: info.description || '',
                so_no: params.soNo || '', company_name: params.companyName || '', contact_name: params.contactName || '',
                warranty_start_date: startDate, warranty_period_months: months,
                warranty_end_date: addMonths(startDate, months),
                status: 'Active', stock_status: 'Sold', created_by: params.createdBy,
            });
        }
        serialsChanged = true;
    };

    const revertToStock = async (sn: string) => {
        const { data: existing } = await supabase.from('serial_numbers')
            .select('id, stock_status, so_no').eq('serial_number', sn).limit(1);
        if (!existing || !existing.length) return;
        const row = existing[0];
        // Only revert a unit that is Sold AND belongs to THIS sale — never touch a
        // serial that has since been reassigned to a different SO.
        if (row.stock_status === 'Sold' && params.soNo && row.so_no && row.so_no !== params.soNo) return;
        await supabase.from('serial_numbers').update({
            so_no: '', company_name: '', contact_name: '',
            warranty_start_date: null, warranty_end_date: null,
            stock_status: 'In Stock',
        }).eq('id', row.id);
        serialsChanged = true;
    };

    for (const { serial, info } of delta.addedSerials) await markSold(serial, info);
    for (const serial of delta.removedSerials) await revertToStock(serial);

    // ── 3. GL adjustment JE for any value change (additive, never mutates original) ──
    const revDeltaByBrand = new Map<string, number>(Object.entries(delta.revDeltaByBrand));
    let revDeltaTotal = 0;
    for (const d of revDeltaByBrand.values()) revDeltaTotal += d;
    const vatDelta = params.isVAT ? revDeltaTotal * 0.1 : 0;
    const arDelta = revDeltaTotal + vatDelta;

    const hasCogs = [...cogsDeltaByBrand.values()].some(v => Math.abs(v) > 0.005);
    const hasRev = Math.abs(revDeltaTotal) > 0.005;
    let glAdjusted = false;

    if (hasRev || hasCogs) {
        const lines: { account_number: string; description: string; debit: number; credit: number }[] = [];
        // Positive `amount` goes on `side`; negative flips to the opposite side.
        const push = (account: string, desc: string, amount: number, side: 'debit' | 'credit') => {
            if (Math.abs(amount) <= 0.005) return;
            const onDebit = side === 'debit' ? amount > 0 : amount < 0;
            const v = Math.abs(amount);
            lines.push({ account_number: account, description: desc, debit: onDebit ? v : 0, credit: onDebit ? 0 : v });
        };

        // Revenue side: DR AR (rev+vat), CR revenue per brand, CR VAT output.
        push('11900', `AR adj — ${params.invNo}`, arDelta, 'debit');
        for (const [rawBrand, d] of revDeltaByBrand) {
            const brand = normalizeBrand(rawBrand);
            const acct = BRAND_ACCOUNT_MAP[brand]?.revenue ?? '40600';
            push(acct, `Revenue ${brand} adj — ${params.invNo}`, d, 'credit');
        }
        if (params.isVAT) push('23000', `VAT Output adj — ${params.invNo}`, vatDelta, 'credit');

        // COGS side: DR COGS per brand, CR inventory/payable per brand.
        for (const [rawBrand, d] of cogsDeltaByBrand) {
            if (Math.abs(d) <= 0.005) continue;
            const brand = normalizeBrand(rawBrand);
            const entry = BRAND_ACCOUNT_MAP[brand];
            const cogsAcct = entry?.cogs ?? '50600';
            const creditAcct = entry?.payable ?? entry?.inventory ?? '12600';
            const creditDesc = entry?.payable ? 'Payable' : 'Inventory out';
            push(cogsAcct, `COGS ${brand} adj — ${params.invNo}`, d, 'debit');
            push(creditAcct, `${creditDesc} ${brand} adj — ${params.invNo}`, d, 'credit');
        }

        if (lines.length > 0) {
            const entryNumber = await getNextEntryNumber();
            await createJournalEntry(
                {
                    entry_number: entryNumber,
                    entry_date: startDate,
                    description: `Auto: Invoice ${params.invNo} edit adjustment`,
                    reference: params.invNo,
                    created_by: params.createdBy,
                    is_posted: true,
                    source: 'invoice-edit-adjustment',
                } as any,
                lines,
            );
            glAdjusted = true;
        }
    }

    const parts: string[] = [];
    if (inventoryChanged) parts.push('inventory');
    if (serialsChanged) parts.push('serials');
    if (glAdjusted) parts.push('journal');
    const summary = parts.length ? parts.join(' + ') + ' updated' : 'no changes needed';
    return { inventoryChanged, serialsChanged, glAdjusted, summary };
}
