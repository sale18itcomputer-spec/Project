import { supabase } from '../lib/supabase';
import {
    createJournalEntry,
    getNextEntryNumber,
    normalizeBrand,
    BRAND_ACCOUNT_MAP,
} from './accountingApi';
import { wantTaxType, taxTypeOrFilter } from './inventoryApi';

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

// ── Batched serial writers ──────────────────────────────────────────────────
// A per-serial SELECT+UPDATE round-trip froze saves once "Select all" could add
// hundreds of serials at once. These do ONE classify read, then grouped .in()
// writes (chunked to keep each request small). Shared by the issue path, the
// issued-edit reconcile, and the deposit-finalize path so all three scale.
const chunkArr = <X,>(arr: X[], n: number): X[][] => {
    const out: X[][] = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
};
const SERIAL_CHUNK = 150;

/** Mark serials Sold, batched. Existing rows are updated (keeping a real warranty
 *  term already recorded at PO intake); serials with no prior row are inserted.
 *  A unit already Sold to a DIFFERENT SO is never stolen — it's returned in
 *  `conflicts` for the caller to surface. */
export async function markSerialsSold(
    added: { serial: string; info: SerialInfo }[],
    ctx: { startDate: string; soNo?: string; companyName?: string; contactName?: string; createdBy: string },
): Promise<{ conflicts: { serial: string; soNo: string }[] }> {
    if (!added.length) return { conflicts: [] };
    const infoBySn = new Map(added.map(a => [a.serial, a.info]));
    const allSns = [...infoBySn.keys()];

    const existRows: { serial_number: string; warranty_period_months: number | null; stock_status: string; so_no: string | null }[] = [];
    for (const b of chunkArr(allSns, SERIAL_CHUNK)) {
        const { data } = await supabase.from('serial_numbers')
            .select('serial_number, warranty_period_months, stock_status, so_no').in('serial_number', b);
        if (data) existRows.push(...(data as any));
    }
    const existBySn = new Map(existRows.map(r => [r.serial_number, r]));

    // Group existing-serial updates by identical payload so hundreds of rows
    // collapse into a few .in() writes; brand-new serials go in one batch insert.
    const groups = new Map<string, { patch: Record<string, any>; sns: string[] }>();
    const inserts: any[] = [];
    const conflicts: { serial: string; soNo: string }[] = [];
    for (const sn of allSns) {
        const info = infoBySn.get(sn)!;
        const brand = info.brand || '';
        const ex = existBySn.get(sn);
        // Never reassign a unit already Sold to a different SO.
        if (ex && ex.stock_status === 'Sold' && ex.so_no && ctx.soNo && ex.so_no !== ctx.soNo) {
            conflicts.push({ serial: sn, soNo: ex.so_no });
            continue;
        }
        if (ex) {
            const months = ex.warranty_period_months ?? info.warrantyMonths ?? 12;
            const key = `${brand}|${info.modelName || ''}|${info.description || ''}|${months}`;
            if (!groups.has(key)) groups.set(key, {
                patch: {
                    brand, model_name: info.modelName || '', description: info.description || '',
                    so_no: ctx.soNo || '', company_name: ctx.companyName || '', contact_name: ctx.contactName || '',
                    warranty_start_date: ctx.startDate, warranty_period_months: months,
                    warranty_end_date: addMonths(ctx.startDate, months),
                    status: 'Active', stock_status: 'Sold',
                },
                sns: [],
            });
            groups.get(key)!.sns.push(sn);
        } else {
            const months = info.warrantyMonths ?? 12;
            inserts.push({
                serial_number: sn, brand, model_name: info.modelName || '', description: info.description || '',
                so_no: ctx.soNo || '', company_name: ctx.companyName || '', contact_name: ctx.contactName || '',
                warranty_start_date: ctx.startDate, warranty_period_months: months,
                warranty_end_date: addMonths(ctx.startDate, months),
                status: 'Active', stock_status: 'Sold', created_by: ctx.createdBy,
            });
        }
    }
    for (const { patch, sns } of groups.values())
        for (const b of chunkArr(sns, SERIAL_CHUNK))
            await supabase.from('serial_numbers').update(patch).in('serial_number', b);
    for (const b of chunkArr(inserts, SERIAL_CHUNK))
        await supabase.from('serial_numbers').insert(b);
}

/** Revert serials back to In Stock (unlink this sale), batched. Skips any unit
 *  since reassigned to a different SO. Returns how many were reverted. */
export async function revertSerialsToStock(serials: string[], soNo?: string): Promise<number> {
    if (!serials.length) return 0;
    const rows: { id: string; stock_status: string; so_no: string | null }[] = [];
    for (const b of chunkArr(serials, SERIAL_CHUNK)) {
        const { data } = await supabase.from('serial_numbers')
            .select('id, stock_status, so_no').in('serial_number', b);
        if (data) rows.push(...(data as any));
    }
    const ids = rows.filter(r =>
        !(r.stock_status === 'Sold' && soNo && r.so_no && r.so_no !== soNo)
    ).map(r => r.id);
    for (const b of chunkArr(ids, SERIAL_CHUNK))
        await supabase.from('serial_numbers').update({
            so_no: '', company_name: '', contact_name: '',
            warranty_start_date: null, warranty_end_date: null, stock_status: 'In Stock',
        }).in('id', b);
    return ids.length;
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
    const wantTax = wantTaxType(params.isVAT); // only draw stock of this tax type (or unclassified)
    const deductFIFO = async (code: string | undefined, model: string | undefined, qty: number): Promise<number> => {
        // Returns the unit_price of the lot deducted (for COGS), 0 if none matched.
        let rows: any[] | null = null;
        if (code) {
            const { data } = await supabase.from('inventory')
                .select('id, qty, unit_price').eq('status', 'In Stock').gt('qty', 0)
                .eq('code', code).or(taxTypeOrFilter(wantTax)).order('created_at', { ascending: true }).limit(1);
            rows = data;
        }
        if ((!rows || !rows.length) && model) {
            const { data } = await supabase.from('inventory')
                .select('id, qty, unit_price').eq('status', 'In Stock').gt('qty', 0)
                .ilike('model_name', `%${model}%`).or(taxTypeOrFilter(wantTax)).order('created_at', { ascending: true }).limit(1);
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
    // Batched via the shared markSerialsSold/revertSerialsToStock helpers. A
    // per-serial SELECT+UPDATE round-trip here froze the save when "Select all"
    // adds hundreds of serials at once.
    if (delta.addedSerials.length) {
        await markSerialsSold(delta.addedSerials, {
            startDate, soNo: params.soNo, companyName: params.companyName,
            contactName: params.contactName, createdBy: params.createdBy,
        });
        serialsChanged = true;
    }
    if (delta.removedSerials.length) {
        const n = await revertSerialsToStock(delta.removedSerials, params.soNo);
        if (n > 0) serialsChanged = true;
    }

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
        const deltaLines: { account_number: string; description: string; debit: number; credit: number }[] = [];
        // Positive `amount` goes on `side`; negative flips to the opposite side.
        const push = (account: string, desc: string, amount: number, side: 'debit' | 'credit') => {
            if (Math.abs(amount) <= 0.005) return;
            const onDebit = side === 'debit' ? amount > 0 : amount < 0;
            const v = Math.abs(amount);
            deltaLines.push({ account_number: account, description: desc, debit: onDebit ? v : 0, credit: onDebit ? 0 : v });
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

        if (deltaLines.length > 0) {
            // Ops model: adjusting an invoice sets its FINAL price, so the invoice's
            // own JE must always equal the invoice total — the edit is FOLDED into it
            // (reprice_invoice_je, atomic). The 'invoice-edit-adjustment' JE is then a
            // NON-POSTING reference ("adjusted from X to Y"), never a second posting —
            // posting both double-counts the delta (see INV2026-00014 / JE-2195).
            const { data: mainJe } = await supabase.from('journal_entries')
                .select('id').eq('reference', params.invNo).eq('source', 'invoice').maybeSingle();
            let arWas = 0;
            if (mainJe) {
                const { data: arRows } = await supabase.from('journal_entry_lines')
                    .select('debit, credit').eq('journal_entry_id', mainJe.id).eq('account_number', '11900');
                arWas = (arRows ?? []).reduce((s, l) => s + (Number(l.debit) || 0) - (Number(l.credit) || 0), 0);
            }

            let repriced: string | null = null;
            if (mainJe) {
                try {
                    const { data, error } = await supabase.rpc('reprice_invoice_je', { p_inv_no: params.invNo, p_delta_lines: deltaLines });
                    if (error) throw new Error(error.message);
                    repriced = (data as string | null) ?? null;
                } catch { repriced = null; }
            }

            if (repriced) {
                glAdjusted = true;
                // Non-posting reference of what changed (does NOT hit the ledger).
                const arNow = arWas + arDelta;
                const refNum = await getNextEntryNumber();
                await createJournalEntry(
                    {
                        entry_number: refNum, entry_date: startDate,
                        description: `Reference: ${params.invNo} adjusted (AR $${arWas.toFixed(2)} → $${arNow.toFixed(2)})`,
                        reference: params.invNo, created_by: params.createdBy,
                        is_posted: false, source: 'invoice-edit-adjustment',
                    } as any,
                    deltaLines,
                );
            } else {
                // No main JE (or reprice unavailable) — post a real adjustment so the
                // ledger still reflects the change (never silently lose it).
                const entryNumber = await getNextEntryNumber();
                await createJournalEntry(
                    {
                        entry_number: entryNumber, entry_date: startDate,
                        description: `Auto: Invoice ${params.invNo} edit adjustment`,
                        reference: params.invNo, created_by: params.createdBy,
                        is_posted: true, source: 'invoice-edit-adjustment',
                    } as any,
                    deltaLines,
                );
                glAdjusted = true;
            }
        }
    }

    const parts: string[] = [];
    if (inventoryChanged) parts.push('inventory');
    if (serialsChanged) parts.push('serials');
    if (glAdjusted) parts.push('journal');
    const summary = parts.length ? parts.join(' + ') + ' updated' : 'no changes needed';
    return { inventoryChanged, serialsChanged, glAdjusted, summary };
}

/**
 * Void an issued invoice: the accounting-correct alternative to hard-deleting it.
 * Deleting an invoice row (deleteRecord) left its journal entry orphaned in the
 * GL, its inventory relieved, and its serials Sold — plus a permanent gap in the
 * monotonic number sequence (see INV2026-00005 / INV2026-00006). Voiding instead:
 *   1. restores inventory qty for every line and reverts its serials to In Stock
 *      (via the tested computeInvoiceEditDelta, diffing current items → empty),
 *   2. posts an EXACT contra of the original invoice JE (every line's debit/credit
 *      swapped) so the GL nets to zero regardless of any lot-cost drift — the
 *      original entry is preserved, the reversal sits beside it, fully auditable,
 *   3. leaves the caller to set the invoice row's status to 'Cancel' and KEEP it,
 *      so the number stays in sequence (gapless) and shows as a voided record.
 */
export interface VoidResult { restocked: boolean; serialsReverted: boolean; jeReversed: string | null; }

export async function voidInvoice(params: {
    invNo: string;
    entryDate: string;
    createdBy: string;
    currentItems: any[];
    brandByCode: Map<string, string>;
}): Promise<VoidResult> {
    const entryDate = (params.entryDate || new Date().toISOString()).slice(0, 10);
    const delta = computeInvoiceEditDelta(params.currentItems, [], params.brandByCode);

    let restocked = false;
    // 1a. Restore inventory qty for every line (all deltas are removals → d < 0).
    for (const { code, model, delta: d } of delta.qtyDeltas) {
        if (d >= 0) continue;
        const qty = -d;
        let rows: any[] | null = null;
        if (code) {
            const { data } = await supabase.from('inventory')
                .select('id, qty').eq('code', code)
                .order('created_at', { ascending: true }).limit(1);
            rows = data;
        }
        if ((!rows || !rows.length) && model) {
            const { data } = await supabase.from('inventory')
                .select('id, qty').ilike('model_name', `%${model}%`)
                .order('created_at', { ascending: true }).limit(1);
            rows = data;
        }
        if (!rows || !rows.length) continue;
        const lot = rows[0];
        const newQty = Number(lot.qty) + qty;
        await supabase.from('inventory').update({ qty: newQty, status: newQty > 0 ? 'In Stock' : 'Out of Stock' }).eq('id', lot.id);
        restocked = true;
    }

    // 1b. Revert every serial to In Stock — but only units still linked to THIS
    //     invoice's number/SO, never one already reassigned elsewhere.
    let serialsReverted = false;
    for (const sn of delta.removedSerials) {
        const { data: existing } = await supabase.from('serial_numbers')
            .select('id, stock_status, so_no').eq('serial_number', sn).limit(1);
        if (!existing || !existing.length) continue;
        const row = existing[0];
        if (row.stock_status === 'Sold' && row.so_no && params.invNo && row.so_no !== params.invNo && !String(row.so_no).startsWith('SO-')) continue;
        await supabase.from('serial_numbers').update({
            so_no: '', company_name: '', contact_name: '',
            warranty_start_date: null, warranty_end_date: null, stock_status: 'In Stock',
        }).eq('id', row.id);
        serialsReverted = true;
    }

    // 2. Exact contra of the original invoice JE (net GL impact → zero).
    let jeReversed: string | null = null;
    const { data: je } = await supabase.from('journal_entries')
        .select('id, entry_number').eq('reference', params.invNo).eq('source', 'invoice').maybeSingle();
    if (je?.id) {
        const { data: lines } = await supabase.from('journal_entry_lines')
            .select('account_number, description, debit, credit').eq('journal_entry_id', je.id);
        const revLines = (lines ?? []).map((l: any) => ({
            account_number: l.account_number,
            description: `Void ${params.invNo} — reverse ${je.entry_number}`,
            debit: Number(l.credit) || 0,
            credit: Number(l.debit) || 0,
        }));
        if (revLines.length) {
            const entryNumber = await getNextEntryNumber();
            await createJournalEntry(
                {
                    entry_number: entryNumber,
                    entry_date: entryDate,
                    description: `Void: Invoice ${params.invNo} (reverse ${je.entry_number})`,
                    reference: params.invNo,
                    created_by: params.createdBy,
                    is_posted: true,
                    source: 'invoice-void',
                } as any,
                revLines,
            );
            jeReversed = je.entry_number;
        }
    }

    return { restocked, serialsReverted, jeReversed };
}

/**
 * Reserve/free serial numbers for a DRAFT (not-yet-issued) invoice, so a serial
 * placed on one document can't be picked on another before its invoice is issued.
 *
 * Serials are only marked 'Sold' at issue time (InvoiceCreator issue-path). Until
 * then they'd stay 'In Stock' and the SerialNumberPicker (which offers In-Stock
 * serials) would show them on other documents — the double-appearance the picker
 * bug showed. This reserves them at save:
 *   - serials ADDED to the doc and currently 'In Stock' → 'Reserved' (+ linkage)
 *   - serials REMOVED from the doc that are 'Reserved' → back to 'In Stock'
 * The picker already hides anything that isn't 'In Stock', so Reserved auto-hides.
 * At issue the Sold-sync upgrades Reserved → Sold; void/delete frees them.
 * Never touches a 'Sold' serial. Pass newItems: [] to free ALL of a doc's serials
 * (used when a draft is deleted).
 */
export async function reserveInvoiceSerials(params: {
    soNo?: string;
    companyName?: string;
    contactName?: string;
    oldItems: any[];
    newItems: any[];
    brandByCode: Map<string, string>;
}): Promise<{ changed: boolean }> {
    const delta = computeInvoiceEditDelta(params.oldItems, params.newItems, params.brandByCode);
    let changed = false;

    // Reserve newly-added serials still In Stock (batched — a per-serial round-trip
    // froze the draft save once "Select all" could add hundreds at once).
    if (delta.addedSerials.length) {
        const sns = delta.addedSerials.map(a => a.serial);
        const rows: { id: string; stock_status: string }[] = [];
        for (const b of chunkArr(sns, SERIAL_CHUNK)) {
            const { data } = await supabase.from('serial_numbers')
                .select('id, stock_status').in('serial_number', b);
            if (data) rows.push(...(data as any));
        }
        const ids = rows.filter(r => r.stock_status === 'In Stock').map(r => r.id);
        for (const b of chunkArr(ids, SERIAL_CHUNK))
            await supabase.from('serial_numbers').update({
                stock_status: 'Reserved',
                so_no: params.soNo || '', company_name: params.companyName || '', contact_name: params.contactName || '',
            }).in('id', b);
        if (ids.length) changed = true;
    }

    // Free serials we had reserved but were removed from the draft. Only touch units
    // WE reserved — never disturb a 'Sold' unit or one another document reserved.
    if (delta.removedSerials.length) {
        const rows: { id: string; stock_status: string }[] = [];
        for (const b of chunkArr(delta.removedSerials, SERIAL_CHUNK)) {
            const { data } = await supabase.from('serial_numbers')
                .select('id, stock_status').in('serial_number', b);
            if (data) rows.push(...(data as any));
        }
        const ids = rows.filter(r => r.stock_status === 'Reserved').map(r => r.id);
        for (const b of chunkArr(ids, SERIAL_CHUNK))
            await supabase.from('serial_numbers').update({
                stock_status: 'In Stock', so_no: '', company_name: '', contact_name: '',
            }).in('id', b);
        if (ids.length) changed = true;
    }

    return { changed };
}
