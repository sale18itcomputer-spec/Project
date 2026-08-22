import { supabase } from '../lib/supabase';
import { PurchaseOrder, PurchaseOrderItem, PricelistItem, VendorPricelistItem } from '../types';
import { stripHtml } from '../utils/formatters';

/** Collapse a multi-line/comma serial field into a single comma-separated string. */
export const normalizeSerials = (raw?: string | null): string =>
    (raw ?? '')
        .split(/[\n,]/)
        .map(s => s.trim())
        .filter(Boolean)
        .join(', ');

export interface ConvertPOToInventoryResult {
    /** True if new inventory rows were inserted by this call. */
    converted: boolean;
    /** True if this PO already had inventory rows linked to it (re-synced, not re-converted). */
    alreadyConverted: boolean;
    /** True if existing inventory rows were updated to match the edited PO (metadata + qty delta). */
    resynced?: boolean;
    /** Number of inventory rows inserted (convert) or updated+inserted (re-sync). */
    count: number;
}

// `po_ordered_qty` / `tax_type` may not exist yet if their migration hasn't been
// applied. Strip them and retry so PO→Inventory conversion never breaks on a
// lagging migration (the field just isn't recorded until the column exists).
const OPTIONAL_INV_COLS = /po_ordered_qty|tax_type/i;
async function inventoryInsert(rows: any[], select = 'id'): Promise<{ data: any[] | null; error: any }> {
    let res: any = await supabase.from('inventory').insert(rows).select(select);
    if (res.error && OPTIONAL_INV_COLS.test(res.error.message)) {
        res = await supabase.from('inventory').insert(rows.map(({ po_ordered_qty, tax_type, ...r }: any) => r)).select(select);
    }
    return res;
}
async function inventoryUpdate(id: string, upd: Record<string, any>) {
    let res = await supabase.from('inventory').update(upd).eq('id', id);
    if (res.error && OPTIONAL_INV_COLS.test(res.error.message)) {
        const { po_ordered_qty, tax_type, ...rest } = upd;
        res = await supabase.from('inventory').update(rest).eq('id', id);
    }
    return res;
}

/** The tax type a sale draws: VAT documents draw VAT stock, everything else non-VAT. */
export const wantTaxType = (isVAT: boolean): 'VAT' | 'NON-VAT' => (isVAT ? 'VAT' : 'NON-VAT');

/** A lot is eligible for a document of `want` tax type when its own tax_type matches,
 *  or it is unclassified (NULL — legacy stock with no PO tax type). Used as a Supabase
 *  `.or()` filter fragment on the inventory query. */
export const taxTypeOrFilter = (want: 'VAT' | 'NON-VAT'): string => `tax_type.eq.${want},tax_type.is.null`;

/**
 * Enforce "VAT stock sells on VAT invoices only" (and non-VAT on non-VAT).
 *
 * Pre-flight run BEFORE any inventory is deducted or a number minted. For every
 * coded line it checks the required qty can be met from stock of the matching tax
 * type (or unclassified). If a line's need can only be covered by WRONG-tax-type
 * stock, it returns a human-readable block message; otherwise null (proceed).
 * Lines with no tracked stock (services, untracked) are ignored.
 */
export async function checkInventoryTaxMatch(
    items: any[],
    isVAT: boolean,
): Promise<string | null> {
    const want = wantTaxType(isVAT);
    const other = want === 'VAT' ? 'NON-VAT' : 'VAT';
    const need = new Map<string, number>();
    const addNeed = (code?: string, qty?: number) => {
        const c = (code || '').trim(); const q = Number(qty) || 0;
        if (c && q > 0) need.set(c, (need.get(c) || 0) + q);
    };
    for (const it of items || []) {
        if (it?.isPromotion) continue;
        if (it?.isPCBuild) { for (const comp of it.buildComponents || []) addNeed(comp.itemCode, comp.qty); continue; }
        addNeed(it?.itemCode, it?.qty);
    }
    for (const [code, qty] of need) {
        const { data } = await supabase.from('inventory')
            .select('qty, tax_type').eq('code', code).eq('status', 'In Stock').gt('qty', 0);
        if (!data || !data.length) continue; // untracked / service — not guarded here
        const eligible = data.filter(r => r.tax_type === want || r.tax_type == null).reduce((s, r) => s + (Number(r.qty) || 0), 0);
        const wrong    = data.filter(r => r.tax_type === other).reduce((s, r) => s + (Number(r.qty) || 0), 0);
        if (eligible < qty && wrong > 0) {
            return `${code}: this is a ${want} document, but ${wrong} of the ${qty} unit(s) in stock are ${other}-purchased. ${want} stock can only be sold on ${want} invoices — issue this as a ${other} invoice, or add ${want} stock. (${want}-eligible on hand: ${eligible}.)`;
        }
    }
    return null;
}

/** Returns true if any inventory rows are already linked to this PO. */
export const hasInventoryForPO = async (poId: string): Promise<boolean> => {
    const { data, error } = await supabase
        .from('inventory')
        .select('id')
        .eq('po_id', poId)
        .limit(1);
    if (error) throw new Error(error.message);
    return !!data && data.length > 0;
};

/** Resolve one PO line item into the inventory-row shape (brand/category/model/
 *  code cascade against the pricelist + vendor pricelist). Shared by the initial
 *  conversion (insert) and the re-sync (update), so both stay identical. */
function buildInventoryRow(
    item: PurchaseOrderItem,
    po: PurchaseOrder,
    poId: string,
    pricelist: PricelistItem[],
    vendorPricelist: VendorPricelistItem[] | null,
    createdBy?: string,
) {
    const code = (item.item_number ?? '').trim();
    const hasPOBrand = !!(item.brand ?? '').trim();
    const hasPOModel = !!(item.model_name ?? '').trim();

    let plMatch = (pricelist ?? []).find(
        p => (p.Code && p.Code.toLowerCase() === code.toLowerCase())
            || (p.Model && p.Model.toLowerCase() === code.toLowerCase())
    );
    const vplMatch = (vendorPricelist ?? []).find(
        v => v.model_name && v.model_name.toLowerCase() === code.toLowerCase()
    );
    if (!plMatch && vplMatch?.model_name) {
        plMatch = (pricelist ?? []).find(
            p => p.Model && p.Model.toLowerCase() === vplMatch.model_name.toLowerCase()
        );
    }

    const resolvedBrand = hasPOBrand ? item.brand!
        : plMatch?.Brand ? plMatch.Brand : vplMatch?.brand ? vplMatch.brand : '';
    const resolvedCategory = (item.category ?? '').trim() ? item.category!
        : plMatch?.Category ? plMatch.Category : 'General';
    const cleanDesc = stripHtml(item.description ?? '');
    const resolvedModel = hasPOModel ? item.model_name!
        : plMatch?.Model ? plMatch.Model : vplMatch?.model_name ? vplMatch.model_name
        : code || cleanDesc.substring(0, 80) || 'N/A';
    const resolvedDesc = cleanDesc || plMatch?.Description || vplMatch?.specification || '';
    // Align to the sales pricelist's Code when matched (join key for DO deduction).
    const resolvedCode = plMatch?.Code ? plMatch.Code : code;

    return {
        po_id:       poId,
        po_number:   po.po_number,
        vendor_id:   po.vendor_id ?? null,
        vendor_name: po.vendor_name ?? '',
        category:    resolvedCategory,
        code:        resolvedCode,
        brand:       resolvedBrand,
        model_name:  resolvedModel,
        description: resolvedDesc,
        serial_number: normalizeSerials(item.serial_number),
        warranty_months: item.warranty_months ?? null,
        qty:         item.qty,
        po_ordered_qty: item.qty, // baseline ordered qty, for edit re-sync deltas
        unit_price:  item.unit_price ?? 0,
        currency:    po.currency ?? 'USD',
        status:      'In Stock',
        tax_type:    (po as any).tax_type ?? null, // VAT | NON-VAT — gates sale-time deduction
        created_by:  createdBy ?? 'System',
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
    };
}

/**
 * Re-sync an ALREADY-converted PO's inventory to the current (edited) PO — used
 * when a PO is saved again after conversion. For each current line it updates the
 * linked inventory row's metadata (cost, vendor, brand, category, model, warranty,
 * currency) and applies the ORDERED-QTY DELTA (new ordered qty − the baseline
 * po_ordered_qty), so a qty change flows through WITHOUT clobbering units already
 * sold (delta is added to whatever's on hand, floored at 0). Lines new to the PO
 * are inserted. This is what closes the "PO edit doesn't reach inventory" gap.
 */
export async function resyncPurchaseOrderToInventory(
    po: PurchaseOrder,
    poId: string,
    items: PurchaseOrderItem[],
    pricelist: PricelistItem[],
    vendorPricelist: VendorPricelistItem[] | null,
    createdBy?: string,
): Promise<ConvertPOToInventoryResult> {
    const { data: existing } = await supabase
        .from('inventory').select('id, code, qty, po_ordered_qty').eq('po_id', poId);
    const byCode = new Map((existing ?? []).map((r: any) => [String(r.code).toLowerCase(), r]));

    let updated = 0;
    const toInsert: any[] = [];
    for (const item of items) {
        if (!(item.qty > 0) || item.is_promotion) continue;
        const row = buildInventoryRow(item, po, poId, pricelist, vendorPricelist, createdBy);
        const match = byCode.get(String(row.code).toLowerCase());
        if (match) {
            const baseline = Number(match.po_ordered_qty ?? match.qty) || 0;
            const delta = (Number(row.qty) || 0) - baseline;
            const newQty = Math.max(0, (Number(match.qty) || 0) + delta);
            const upd: Record<string, any> = {
                vendor_id: row.vendor_id, vendor_name: row.vendor_name, category: row.category,
                brand: row.brand, model_name: row.model_name, description: row.description,
                warranty_months: row.warranty_months, unit_price: row.unit_price, currency: row.currency,
                tax_type: row.tax_type,
                qty: newQty, po_ordered_qty: row.qty, updated_at: new Date().toISOString(),
            };
            // Only flip status when the on-hand count crosses zero; leave a manual
            // "Reserved" (or other) status untouched otherwise.
            if (newQty <= 0) upd.status = 'Out of Stock';
            else if ((Number(match.qty) || 0) <= 0) upd.status = 'In Stock';
            await inventoryUpdate(match.id, upd);
            updated++;
        } else {
            toInsert.push(row); // line added to the PO after the original conversion
        }
    }
    if (toInsert.length > 0) {
        const { error } = await inventoryInsert(toInsert);
        if (error) throw new Error(error.message);
    }
    return { converted: toInsert.length > 0, alreadyConverted: true, resynced: true, count: updated + toInsert.length };
}

/**
 * Converts a Purchase Order's line items into Inventory rows, enriching each
 * item via a brand/category/model lookup cascade against the main pricelist
 * and vendor pricelist:
 *   Tier 1  — brand/category/model_name stored directly on the PO item (combobox selection)
 *   Tier 2  — main pricelist match by Code === item_number, or Model === item_number
 *   Tier 2b — vendor_pricelist match by model_name === item_number, then that
 *             vendor model_name matched against the main pricelist's Model
 *   Tier 3  — vendor_pricelist match only (no corresponding pricelist entry)
 *   Fallback — raw PO item data
 *
 * Whenever a pricelist match is found (Tier 2/2b), `code`/`model_name` are
 * aligned to that pricelist row's `Code`/`Model` — this is the join key
 * Delivery Order deduction uses to match sales `itemCode` back to inventory.
 *
 * Guards against double-conversion: if inventory rows already exist for this
 * po_id, the conversion is skipped and `alreadyConverted: true` is returned.
 * This is the single entry point for PO→Inventory conversion, used both by
 * the auto-conversion on PO save (status === 'Completed') and the manual
 * "Convert to Inventory" action.
 */
export const convertPurchaseOrderToInventory = async (
    po: PurchaseOrder,
    items: PurchaseOrderItem[],
    options: {
        pricelist?: PricelistItem[] | null;
        vendorPricelist?: VendorPricelistItem[] | null;
        createdBy?: string;
    } = {}
): Promise<ConvertPOToInventoryResult> => {
    if (!po.id) throw new Error('Purchase Order has no id');
    const poId = po.id;

    const alreadyConverted = await hasInventoryForPO(poId);

    const { vendorPricelist, createdBy } = options;

    // Always match against the canonical sales `pricelist` table, regardless of
    // the caller's current B2B/B2C UI mode. In B2B mode, useData() sources
    // `pricelist` from the separate `b2b_pricelist` table, which is normally
    // empty — that silently fails every Tier 2/2b match below and leaves
    // every converted item with category "General" and an unaligned code.
    // PO/Inventory/vendor pricelist are not B2B-isolated, so re-fetch the
    // shared pricelist directly whenever the supplied one is missing/empty.
    let pricelist = options.pricelist;
    if (!pricelist || pricelist.length === 0) {
        const { data, error } = await supabase.from('pricelist').select('*');
        if (error) throw new Error(error.message);
        pricelist = (data ?? []) as PricelistItem[];
    }

    const filteredItems = items.filter(item => item.qty > 0 && !item.is_promotion);

    // Already converted: don't duplicate rows — RE-SYNC the existing inventory to
    // the current (edited) PO instead. Updates cost/vendor/brand/warranty and
    // applies the ordered-qty delta. This closes the "PO edit doesn't reach
    // inventory" gap without ever double-adding stock.
    if (alreadyConverted) {
        return await resyncPurchaseOrderToInventory(po, poId, filteredItems, pricelist, vendorPricelist ?? null, createdBy);
    }

    const inventoryPayload = filteredItems
        .map(item => buildInventoryRow(item, po, poId, pricelist!, vendorPricelist ?? null, createdBy));

    if (inventoryPayload.length === 0) {
        return { converted: false, alreadyConverted: false, count: 0 };
    }

    const { data: insertedRows, error } = await inventoryInsert(inventoryPayload, 'id, code, brand, model_name, description');
    if (error) throw new Error(error.message);

    // Seed serial_numbers rows for any serials captured at PO intake, linked to
    // the newly-created inventory row. Sale-time sync (Invoice/Delivery Order)
    // later finds these by serial_number and updates them with customer/warranty
    // info instead of inserting a duplicate. warranty_period_months uses the
    // real vendor-stated term recorded on the PO line, not a guess — falls
    // back to 12 only when the PO item didn't record one.
    //
    // Link each line's serials to the inventory row by CODE, never by array index:
    // `.insert().select()` does NOT guarantee the returned rows keep the payload's
    // order, so index pairing (insertedRows[i] ↔ filteredItems[i]) silently attaches
    // serials to the wrong product (this scrambled PO-2026-007). Group inserted rows
    // by code and consume one per payload line so repeat codes still map 1:1.
    const rowsByCode = new Map<string, any[]>();
    for (const r of insertedRows ?? []) {
        const key = String(r.code ?? '').trim().toLowerCase();
        if (!rowsByCode.has(key)) rowsByCode.set(key, []);
        rowsByCode.get(key)!.push(r);
    }
    const serialPayload = filteredItems.flatMap((item, i) => {
        // inventoryPayload[i] is buildInventoryRow(filteredItems[i]) — its `code` is
        // the resolved code that was actually inserted (may differ from the raw PO code).
        const key = String((inventoryPayload[i] as any)?.code ?? '').trim().toLowerCase();
        const bucket = rowsByCode.get(key);
        const invRow = bucket && bucket.length ? bucket.shift() : null;
        if (!invRow) return [];
        const serials = (item.serial_number ?? '')
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        const warrantyMonths = item.warranty_months ?? 12;
        return serials.map(sn => ({
            serial_number: sn,
            brand: invRow.brand ?? '',
            model_name: invRow.model_name ?? '',
            description: invRow.description ?? '',
            inventory_id: invRow.id,
            warranty_period_months: warrantyMonths,
            status: 'Active',
            stock_status: 'In Stock',
            created_by: createdBy ?? 'System',
        }));
    });

    if (serialPayload.length > 0) {
        // Dedupe within this PO first — the same serial typed on two lines would
        // otherwise make the whole batch insert fail on the UNIQUE(serial_number)
        // constraint and silently seed no serials at all.
        const seen = new Set<string>();
        const uniqueSerials = serialPayload.filter(s => {
            if (seen.has(s.serial_number)) return false;
            seen.add(s.serial_number);
            return true;
        });
        const { data: existing } = await supabase
            .from('serial_numbers')
            .select('serial_number')
            .in('serial_number', uniqueSerials.map(s => s.serial_number));
        const existingSet = new Set((existing ?? []).map(e => e.serial_number));
        const newSerials = uniqueSerials.filter(s => !existingSet.has(s.serial_number));
        if (newSerials.length > 0) {
            // ignoreDuplicates → ON CONFLICT DO NOTHING: a serial inserted
            // concurrently between the select above and here is skipped instead
            // of failing (and rolling back) the entire batch. Non-fatal to the
            // conversion — log rather than throw so the inventory rows still stand.
            const { error: snErr } = await supabase
                .from('serial_numbers')
                .upsert(newSerials, { onConflict: 'serial_number', ignoreDuplicates: true });
            if (snErr) console.error('[convertPOToInventory] serial seed failed:', snErr.message);
        }
    }

    return { converted: true, alreadyConverted: false, count: inventoryPayload.length };
};

/**
 * Push serial numbers from a PO's line items onto the inventory rows already
 * created from that PO — WITHOUT re-converting or deleting anything. Runs on
 * every PO save so a serial added to the PO after it was committed to inventory
 * flows through to the existing stock rows.
 *
 * Matching within the same po_id, greedy and order-independent:
 *   1) inventory.code === item_number
 *   2) inventory.model_name === item.model_name
 *   3) positional fallback (nth unclaimed row)
 * Only non-empty serials are pushed — an empty PO serial never wipes a serial
 * that was typed directly on the inventory row.
 *
 * Returns the number of inventory rows updated.
 */
export const syncPurchaseOrderSerialsToInventory = async (
    poId: string,
    items: PurchaseOrderItem[],
    createdBy = 'System',
): Promise<number> => {
    const { data: invRows, error } = await supabase
        .from('inventory')
        .select('id, code, model_name, brand, description')
        .eq('po_id', poId)
        .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    if (!invRows || invRows.length === 0) return 0;

    const filtered = items.filter(it => it.qty > 0 && !it.is_promotion);
    const remaining = [...invRows];
    const claim = (predicate: (r: any) => boolean): any | null => {
        const idx = remaining.findIndex(predicate);
        return idx === -1 ? null : remaining.splice(idx, 1)[0];
    };

    // Serials to seed into the structured serial_numbers table. Without this, the
    // common "save the PO first, add serial numbers later" flow leaves the later
    // serials ONLY on the inventory row's text field — never as serial_numbers
    // rows — so they never appear as In-Stock units to pick/track at sale time.
    const serialSeed: any[] = [];

    let count = 0;
    for (const it of filtered) {
        const serial = normalizeSerials(it.serial_number);
        const code = (it.item_number ?? '').trim().toLowerCase();
        const model = (it.model_name ?? '').trim().toLowerCase();

        let row = code ? claim(r => (r.code ?? '').toLowerCase() === code) : null;
        if (!row && model) row = claim(r => (r.model_name ?? '').toLowerCase() === model);
        if (!row) row = remaining.shift() ?? null; // positional fallback keeps 1:1 alignment
        if (!row || !serial) continue; // never wipe an inventory serial with an empty PO serial

        const { error: uErr } = await supabase
            .from('inventory')
            .update({ serial_number: serial, updated_at: new Date().toISOString() })
            .eq('id', row.id);
        if (!uErr) count++;

        // normalizeSerials joins with ", " — split back to individual units.
        for (const sn of serial.split(/[\n,]/).map(s => s.trim()).filter(Boolean)) {
            serialSeed.push({
                serial_number: sn,
                brand: row.brand ?? '',
                model_name: row.model_name ?? '',
                description: row.description ?? '',
                inventory_id: row.id,
                warranty_period_months: it.warranty_months ?? 12,
                created_by: createdBy,
                // so_no / company_name / contact_name / status / stock_status fall
                // to their DB defaults ('', 'Active', 'In Stock') — a fresh unit.
            });
        }
    }

    // Seed only serials that don't already have a row, so a unit already sold (or
    // seeded at intake) is never overwritten or flipped back to In Stock. Dedupe
    // within this PO and use ignoreDuplicates so a concurrent insert can't fail
    // the batch. Non-fatal to the PO save — log rather than throw.
    if (serialSeed.length > 0) {
        const seen = new Set<string>();
        const unique = serialSeed.filter(s => {
            if (seen.has(s.serial_number)) return false;
            seen.add(s.serial_number);
            return true;
        });
        const { data: existing } = await supabase
            .from('serial_numbers')
            .select('serial_number')
            .in('serial_number', unique.map(s => s.serial_number));
        const existingSet = new Set((existing ?? []).map(e => e.serial_number));
        const toSeed = unique.filter(s => !existingSet.has(s.serial_number));
        if (toSeed.length > 0) {
            const { error: seedErr } = await supabase
                .from('serial_numbers')
                .upsert(toSeed, { onConflict: 'serial_number', ignoreDuplicates: true });
            if (seedErr) console.error('[syncPurchaseOrderSerialsToInventory] serial seed failed:', seedErr.message);
        }
    }

    return count;
};

/**
 * Push a serial typed on an inventory row back to its source PO line item, so
 * the two stay consistent. Matches within the inventory row's po_id by
 * item_number → model_name → single-line PO. No-op when the row has no po_id or
 * no serial. Returns true if a PO line item was updated.
 */
export const syncInventorySerialToPurchaseOrder = async (inv: {
    po_id?: string | null;
    code?: string;
    model_name?: string;
    serial_number?: string;
}): Promise<boolean> => {
    const serial = normalizeSerials(inv.serial_number);
    if (!inv.po_id || !serial) return false;

    const { data: poItems, error } = await supabase
        .from('purchase_order_items')
        .select('id, item_number, model_name')
        .eq('po_id', inv.po_id);
    if (error || !poItems || poItems.length === 0) return false;

    const code = (inv.code ?? '').trim().toLowerCase();
    const model = (inv.model_name ?? '').trim().toLowerCase();
    let target = code ? poItems.find(p => (p.item_number ?? '').toLowerCase() === code) : undefined;
    if (!target && model) target = poItems.find(p => (p.model_name ?? '').toLowerCase() === model);
    if (!target && poItems.length === 1) target = poItems[0];
    if (!target) return false;

    const { error: uErr } = await supabase
        .from('purchase_order_items')
        .update({ serial_number: serial })
        .eq('id', target.id);
    return !uErr;
};
