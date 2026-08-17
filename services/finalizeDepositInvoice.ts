import { supabase } from '../lib/supabase';
import { autoPostInvoiceJournal, normalizeBrand } from './accountingApi';
import { computeInvoiceEditDelta } from './reconcileInvoiceEdit';

/**
 * Finalize a deposit / pre-order invoice once the goods have arrived.
 *
 * The pre-order flow: a deposit is taken up front (autoPostDepositReceiptJournal
 * books DR Bank / CR 25000) but the SALE is deliberately NOT recognized — no
 * revenue, no COGS, no inventory relief — because the goods aren't in yet
 * (revenue-recognition rule). The invoice therefore sits with a deposit_receipt
 * JE but NO invoice JE. This finalizes it when stock lands:
 *   • relieve inventory qty (FIFO) + mark its serials Sold
 *   • post the sale JE via autoPostInvoiceJournal, which recognizes revenue + VAT
 *     + COGS AND applies the deposit (DR 25000 / CR AR) so AR nets to the balance
 *     still owed (grand total − deposit).
 *
 * Idempotent: refuses to run if an invoice JE already exists (already finalized).
 * The deposit receipt is NOT re-posted (it was booked when the deposit was taken).
 */
export interface FinalizeResult {
    jePosted: boolean;
    inventoryRelieved: boolean;
    serialsSold: boolean;
    outstanding: number;
    summary: string;
}

export async function finalizeDepositInvoice(params: {
    invNo: string;
    invoiceDate: string;
    isVAT: boolean;
    soNo?: string;
    companyName?: string;
    contactName?: string;
    createdBy: string;
    items: any[];
    brandByCode: Map<string, string>;
    grandTotal: number;
    taxAmount: number;
    depositAmount: number;
}): Promise<FinalizeResult> {
    const entryDate = (params.invoiceDate || new Date().toISOString()).slice(0, 10);

    // ── Idempotency: the sale must not already be recognized ────────────────
    const { data: existingJe } = await supabase
        .from('journal_entries')
        .select('id, entry_number')
        .eq('reference', params.invNo)
        .eq('source', 'invoice')
        .maybeSingle();
    if (existingJe?.id) {
        throw new Error(
            `${params.invNo} already has a sale journal entry (${existingJe.entry_number}) — it's already been finalized. Refresh the page.`,
        );
    }

    // Empty → full items: every line is an "addition", so this yields the qty to
    // deduct, the serials to sell, and the revenue per brand — reusing the tested
    // pure delta function.
    const delta = computeInvoiceEditDelta([], params.items, params.brandByCode);

    // ── 1. Relieve inventory (FIFO oldest lot) + collect COGS ───────────────
    let inventoryRelieved = false;
    const costItems: { brand: string; qty: number; unit_price: number }[] = [];
    for (const { code, model, brand, delta: qty } of delta.qtyDeltas) {
        if (qty <= 0) continue;
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
        if (!rows || !rows.length) continue;
        const lot = rows[0];
        const newQty = Math.max(0, Number(lot.qty) - qty);
        await supabase.from('inventory').update({
            qty: newQty, status: newQty <= 0 ? 'Out of Stock' : 'In Stock',
        }).eq('id', lot.id);
        inventoryRelieved = true;
        const unitCost = Number(lot.unit_price) || 0;
        if (unitCost > 0) costItems.push({ brand: normalizeBrand(brand), qty, unit_price: unitCost });
    }

    // ── 2. Mark serials Sold (Reserved/In Stock → Sold) ─────────────────────
    let serialsSold = false;
    const startDate = entryDate;
    const addMonths = (d: string, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + (Number(m) || 0)); return x.toISOString().slice(0, 10); };
    for (const { serial, info } of delta.addedSerials) {
        const { data: existing } = await supabase.from('serial_numbers')
            .select('id, warranty_period_months, stock_status, so_no').eq('serial_number', serial).limit(1);
        const brand = info.brand || '';
        if (existing && existing.length) {
            const row = existing[0];
            // Don't hijack a unit already Sold to a different sale.
            if (row.stock_status === 'Sold' && row.so_no && params.soNo && row.so_no !== params.soNo) continue;
            const months = row.warranty_period_months ?? info.warrantyMonths ?? 12;
            await supabase.from('serial_numbers').update({
                brand, model_name: info.modelName || '', description: info.description || '',
                so_no: params.soNo || params.invNo, company_name: params.companyName || '', contact_name: params.contactName || '',
                warranty_start_date: startDate, warranty_period_months: months, warranty_end_date: addMonths(startDate, months),
                status: 'Active', stock_status: 'Sold',
            }).eq('id', row.id);
        } else {
            const months = info.warrantyMonths ?? 12;
            await supabase.from('serial_numbers').insert({
                serial_number: serial, brand, model_name: info.modelName || '', description: info.description || '',
                so_no: params.soNo || params.invNo, company_name: params.companyName || '', contact_name: params.contactName || '',
                warranty_start_date: startDate, warranty_period_months: months, warranty_end_date: addMonths(startDate, months),
                status: 'Active', stock_status: 'Sold', created_by: params.createdBy,
            });
        }
        serialsSold = true;
    }

    // ── 3. Post the sale JE (recognizes revenue + VAT + COGS, applies deposit) ──
    const brandAmounts = Object.entries(delta.revDeltaByBrand)
        .map(([brand, subtotal]) => ({ brand, subtotal }))
        .filter(b => b.subtotal > 0.005);
    await autoPostInvoiceJournal({
        invNo: params.invNo,
        entryDate,
        grandTotal: params.grandTotal,
        taxAmount: params.taxAmount,
        isVAT: params.isVAT,
        createdBy: params.createdBy,
        brandAmounts: brandAmounts.length ? brandAmounts : undefined,
        costItems: costItems.length ? costItems : undefined,
        depositAmount: params.depositAmount > 0.005 ? params.depositAmount : undefined,
    });

    const outstanding = Math.max(0, params.grandTotal - (params.depositAmount || 0));
    const parts: string[] = ['sale recognized'];
    if (inventoryRelieved) parts.push('stock relieved');
    if (serialsSold) parts.push('serials sold');
    if (params.depositAmount > 0.005) parts.push(`deposit ${params.depositAmount.toFixed(2)} applied`);
    return {
        jePosted: true,
        inventoryRelieved,
        serialsSold,
        outstanding,
        summary: parts.join(', ') + ` — balance due ${outstanding.toFixed(2)}`,
    };
}
