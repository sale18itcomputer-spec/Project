import { supabase } from '../lib/supabase';
import { createJournalEntry, getNextEntryNumber, normalizeBrand, BRAND_ACCOUNT_MAP } from './accountingApi';
import { createRecord, updateRecord, generateInvNo } from './api';
import { computeInvoiceEditDelta, markSerialsSold } from './reconcileInvoiceEdit';

/**
 * Issue the FINAL invoice for a deposit / pre-order invoice once the goods land.
 *
 * The deposit invoice (e.g. TI2026-00002) stays exactly as-is — it keeps its
 * deposit-receipt JE, which already declared VAT on the deposit. This creates a
 * SEPARATE final invoice with the NEXT number in the VAT/INV series (e.g.
 * TI2026-00003) that carries the WHOLE sale:
 *   • recognizes full revenue + COGS, relieves inventory + marks serials Sold,
 *   • declares only the REMAINING VAT (full VAT − VAT already declared on the
 *     deposit), since VAT is booked at both deposit and final,
 *   • applies the NET deposit against AR (DR 25000), so the customer owes the
 *     balance (grand total − deposit),
 *   • links back to the deposit invoice and stamps `deposit_finalized_by` on it
 *     so it drops out of open A/R (no double-count).
 */
const addMonths = (d: string, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + (Number(m) || 0)); return x.toISOString().slice(0, 10); };

export interface IssueFinalResult {
    finalInvNo: string;
    balanceDue: number;
    summary: string;
}

export async function finalizeDepositInvoice(params: {
    depositInvoice: any;           // the full deposit invoice row (stays as-is)
    items: any[];
    brandByCode: Map<string, string>;
    createdBy: string;
    dueDateFromTerm?: (invDate: string, term: string) => string; // optional Due Date calc
}): Promise<IssueFinalResult> {
    const dep = params.depositInvoice;
    const depositInvNo = String(dep['Inv No']);
    const taxable = dep['Taxable'] || 'NON-VAT';
    const isVAT = taxable === 'VAT';

    // ── Idempotency: this deposit invoice must not already be finalized ──────
    if (dep['deposit_finalized_by']) {
        throw new Error(`${depositInvNo} was already finalized into ${dep['deposit_finalized_by']}.`);
    }

    // ── Amounts (deposit is VAT-inclusive; VAT was booked on it already) ─────
    const subtotal = params.items.reduce((s: number, it: any) => s + (Number(it.amount) || 0), 0);
    const grandTotal = isVAT ? Math.round(subtotal * 1.1 * 100) / 100 : subtotal;
    const fullVAT = isVAT ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
    const deposit = Number(dep['Deposit']) || 0;
    const depositVAT = isVAT ? Math.round((deposit - deposit / 1.1) * 100) / 100 : 0;
    const netDeposit = Math.round((deposit - depositVAT) * 100) / 100;
    const remainingVAT = Math.round((fullVAT - depositVAT) * 100) / 100;
    const balanceDue = Math.round((grandTotal - deposit) * 100) / 100;

    // ── 1. Mint the next number in the series + create the final invoice row ─
    const finalInvNo = await generateInvNo(taxable);
    const today = new Date().toISOString().slice(0, 10);
    const invDate = today;
    const dueDate = params.dueDateFromTerm ? params.dueDateFromTerm(invDate, dep['Payment Term'] || '') : '';
    const payload: Record<string, any> = {
        'Inv No': finalInvNo,
        'Inv Date': invDate,
        'Due Date': dueDate || null,
        'SO No': dep['SO No'] || null,
        'Company Name': dep['Company Name'] || '',
        'Company Name (Khmer)': dep['Company Name (Khmer)'] || '',
        'Company Address': dep['Company Address'] || '',
        'Contact Name': dep['Contact Name'] || '',
        'Phone Number': dep['Phone Number'] || '',
        'Email': dep['Email'] || '',
        'Tin No': dep['Tin No'] || '',
        'Payment Term': dep['Payment Term'] || '',
        'Taxable': taxable,
        'Tax Type': dep['Tax Type'] || taxable,
        'Currency': dep['Currency'] || 'USD',
        'Exchange Rate': dep['Exchange Rate'] || null,
        'Amount': grandTotal,
        'Deposit': deposit,
        'Status': 'Completed',
        'ItemsJSON': params.items,
        'Created By': params.createdBy,
        'Remark': `Final invoice for deposit invoice ${depositInvNo}. Deposit ${deposit.toLocaleString()} applied; balance due ${balanceDue.toLocaleString()}.`,
    };
    await createRecord('Invoices', payload);
    // Flag it as a FINAL invoice so the PDF renders the deposit-deducted footer
    // (Total Less Deposit + VAT on the remainder). Best-effort: set separately so a
    // lagging migration for this column can't fail the invoice creation above.
    try { await updateRecord('Invoices', finalInvNo, { finalized_from_deposit: depositInvNo } as any); }
    catch (e: any) { console.warn('[finalizeDepositInvoice] finalized_from_deposit not set (run migration?):', e?.message); }

    // ── 2. Relieve inventory (FIFO) + collect COGS, mark serials Sold ────────
    // Backfill brand for any item the pricelist doesn't cover. PO/inventory-only
    // codes (e.g. Lenovo units bought via PO but never added to the sales pricelist)
    // resolve to no brand → the JE would misroute revenue/COGS/inventory to the
    // "Other Accessories" default. Fill those from the inventory brand so every line
    // posts under the correct brand accounts.
    const brandByCode = new Map(params.brandByCode);
    const missingCodes = [...new Set(
        params.items.map((it: any) => String(it.itemCode || '').trim()).filter((c: string) => c && !brandByCode.get(c)),
    )];
    if (missingCodes.length) {
        const { data: invBrands } = await supabase.from('inventory').select('code, brand').in('code', missingCodes);
        for (const r of invBrands || []) {
            const c = String(r.code || '').trim();
            if (c && r.brand && !brandByCode.get(c)) brandByCode.set(c, r.brand);
        }
    }
    const delta = computeInvoiceEditDelta([], params.items, brandByCode);
    const costItems: { brand: string; qty: number; unit_price: number }[] = [];
    for (const { code, model, brand, delta: qty } of delta.qtyDeltas) {
        if (qty <= 0) continue;
        let rows: any[] | null = null;
        if (code) {
            const { data } = await supabase.from('inventory').select('id, qty, unit_price')
                .eq('status', 'In Stock').gt('qty', 0).eq('code', code)
                .order('created_at', { ascending: true }).limit(1);
            rows = data;
        }
        if ((!rows || !rows.length) && model) {
            const { data } = await supabase.from('inventory').select('id, qty, unit_price')
                .eq('status', 'In Stock').gt('qty', 0).ilike('model_name', `%${model}%`)
                .order('created_at', { ascending: true }).limit(1);
            rows = data;
        }
        if (!rows || !rows.length) continue;
        const lot = rows[0];
        const newQty = Math.max(0, Number(lot.qty) - qty);
        await supabase.from('inventory').update({ qty: newQty, status: newQty <= 0 ? 'Out of Stock' : 'In Stock' }).eq('id', lot.id);
        const unitCost = Number(lot.unit_price) || 0;
        if (unitCost > 0) costItems.push({ brand: normalizeBrand(brand), qty, unit_price: unitCost });
    }
    // Batched — a per-serial round-trip here froze the finalize when many serials
    // were captured. markSerialsSold skips any unit already Sold to a different SO.
    await markSerialsSold(delta.addedSerials, {
        startDate: invDate,
        soNo: dep['SO No'] || finalInvNo,
        companyName: dep['Company Name'] || '',
        contactName: dep['Contact Name'] || '',
        createdBy: params.createdBy,
    });

    // ── 3. Post the final-invoice JE (split VAT + net deposit applied) ───────
    //   DR AR (balance)  DR 25000 (net deposit)
    //   CR revenue/brand  CR VAT (remaining)   [+ COGS DR / Inventory CR]
    const lines: { account_number: string; description: string; debit: number; credit: number }[] = [];
    if (balanceDue > 0.005) lines.push({ account_number: '11900', description: `AR — ${finalInvNo}`, debit: balanceDue, credit: 0 });
    if (netDeposit > 0.005) lines.push({ account_number: '25000', description: `Deposit applied (from ${depositInvNo}) — ${finalInvNo}`, debit: netDeposit, credit: 0 });
    for (const [rawBrand, amt] of Object.entries(delta.revDeltaByBrand)) {
        if (amt <= 0.005) continue;
        const brand = normalizeBrand(rawBrand);
        lines.push({ account_number: BRAND_ACCOUNT_MAP[brand]?.revenue ?? '40600', description: `Revenue ${brand} — ${finalInvNo}`, debit: 0, credit: amt });
    }
    if (isVAT && remainingVAT > 0.005) lines.push({ account_number: '23000', description: `VAT Output (net of deposit VAT) — ${finalInvNo}`, debit: 0, credit: remainingVAT });
    for (const { brand: rawBrand, qty, unit_price } of costItems) {
        const cost = qty * unit_price;
        if (cost <= 0.005) continue;
        const brand = normalizeBrand(rawBrand);
        const entry = BRAND_ACCOUNT_MAP[brand];
        lines.push({ account_number: entry?.cogs ?? '50600', description: `COGS ${brand} — ${finalInvNo}`, debit: cost, credit: 0 });
        lines.push({ account_number: entry?.payable ?? entry?.inventory ?? '12600', description: `${entry?.payable ? 'Payable' : 'Inventory out'} ${brand} — ${finalInvNo}`, debit: 0, credit: cost });
    }
    const entryNumber = await getNextEntryNumber();
    await createJournalEntry(
        { entry_number: entryNumber, entry_date: invDate, description: `Auto: Invoice ${finalInvNo} (final of deposit ${depositInvNo})`, reference: finalInvNo, created_by: params.createdBy, is_posted: true, source: 'invoice' } as any,
        lines,
    );

    // ── 4. Stamp the deposit invoice so it drops out of open A/R ─────────────
    await updateRecord('Invoices', depositInvNo, { deposit_finalized_by: finalInvNo });

    return {
        finalInvNo,
        balanceDue,
        summary: `${finalInvNo} issued — full sale recognized, deposit ${deposit.toLocaleString()} applied, VAT ${remainingVAT.toLocaleString()} (net of deposit VAT), balance due ${balanceDue.toLocaleString()}`,
    };
}
