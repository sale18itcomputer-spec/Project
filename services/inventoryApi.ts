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
    /** True if this PO already had inventory rows linked to it (no-op, not re-converted). */
    alreadyConverted: boolean;
    /** Number of inventory rows inserted. */
    count: number;
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

    if (await hasInventoryForPO(poId)) {
        return { converted: false, alreadyConverted: true, count: 0 };
    }

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

    const inventoryPayload = filteredItems
        .map(item => {
            const code = (item.item_number ?? '').trim();
            const hasPOBrand = !!(item.brand ?? '').trim();
            const hasPOModel = !!(item.model_name ?? '').trim();

            // Tier 2 — direct match: PO item_number against pricelist Code or Model
            let plMatch = (pricelist ?? []).find(
                p => (p.Code && p.Code.toLowerCase() === code.toLowerCase())
                    || (p.Model && p.Model.toLowerCase() === code.toLowerCase())
            );
            const vplMatch = (vendorPricelist ?? []).find(
                v => v.model_name && v.model_name.toLowerCase() === code.toLowerCase()
            );

            // Tier 2b — indirect match: vendor pricelist's model_name against pricelist Model
            if (!plMatch && vplMatch?.model_name) {
                plMatch = (pricelist ?? []).find(
                    p => p.Model && p.Model.toLowerCase() === vplMatch.model_name.toLowerCase()
                );
            }

            const resolvedBrand = hasPOBrand ? item.brand!
                : plMatch?.Brand ? plMatch.Brand
                : vplMatch?.brand ? vplMatch.brand
                : '';

            const resolvedCategory = (item.category ?? '').trim() ? item.category!
                : plMatch?.Category ? plMatch.Category
                : 'General';

            const cleanDesc = stripHtml(item.description ?? '');

            const resolvedModel = hasPOModel ? item.model_name!
                : plMatch?.Model ? plMatch.Model
                : vplMatch?.model_name ? vplMatch.model_name
                : code || cleanDesc.substring(0, 80) || 'N/A';

            const resolvedDesc = cleanDesc
                || plMatch?.Description
                || vplMatch?.specification
                || '';

            // Align to the sales pricelist's Code whenever a match is found, so
            // Delivery Order deduction (which matches on sales-side itemCode) can
            // find this row by inventory.code.
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
                unit_price:  item.unit_price ?? 0,
                currency:    po.currency ?? 'USD',
                status:      'In Stock',
                created_by:  createdBy ?? 'System',
                created_at:  new Date().toISOString(),
                updated_at:  new Date().toISOString(),
            };
        });

    if (inventoryPayload.length === 0) {
        return { converted: false, alreadyConverted: false, count: 0 };
    }

    const { data: insertedRows, error } = await supabase
        .from('inventory')
        .insert(inventoryPayload)
        .select('id, brand, model_name, description');
    if (error) throw new Error(error.message);

    // Seed serial_numbers rows for any serials captured at PO intake, linked to
    // the newly-created inventory row. Sale-time sync (Invoice/Delivery Order)
    // later finds these by serial_number and updates them with customer/warranty
    // info instead of inserting a duplicate. warranty_period_months uses the
    // real vendor-stated term recorded on the PO line, not a guess — falls
    // back to 12 only when the PO item didn't record one.
    const serialPayload = (insertedRows ?? []).flatMap((invRow, i) => {
        const serials = (filteredItems[i]?.serial_number ?? '')
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        const warrantyMonths = filteredItems[i]?.warranty_months ?? 12;
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
        const { data: existing } = await supabase
            .from('serial_numbers')
            .select('serial_number')
            .in('serial_number', serialPayload.map(s => s.serial_number));
        const existingSet = new Set((existing ?? []).map(e => e.serial_number));
        const newSerials = serialPayload.filter(s => !existingSet.has(s.serial_number));
        if (newSerials.length > 0) {
            await supabase.from('serial_numbers').insert(newSerials);
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
): Promise<number> => {
    const { data: invRows, error } = await supabase
        .from('inventory')
        .select('id, code, model_name')
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
