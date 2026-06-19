'use client';

import { supabase } from '../lib/supabase';
import { Bill, BillLine } from '../types';
import { createJournalEntry, getNextEntryNumber } from './accountingApi';

const PAYMENT_TO_ACCOUNT: Record<string, string> = {
    'Cash':          '10100',
    'ABA':           '11100',
    'Bank Transfer': '11100',
    'KHQR':          '11100',
    'Cheque':        '11800',
    'Other':         '11100',
};

export const getNextBillNumber = async (): Promise<string> => {
    const { data, error } = await supabase
        .from('bills')
        .select('bill_number')
        .like('bill_number', 'BILL-%');
    if (error || !data?.length) return 'BILL-0001';
    const max = data.reduce((m, row) => {
        const match = row.bill_number.match(/^BILL-(\d+)$/);
        const n = match ? parseInt(match[1], 10) : 0;
        return Math.max(m, n);
    }, 0);
    return `BILL-${String(max + 1).padStart(4, '0')}`;
};

export const fetchBills = async (): Promise<Bill[]> => {
    const { data: bills, error } = await supabase
        .from('bills')
        .select('*')
        .order('bill_date', { ascending: false });
    if (error) throw new Error(error.message);
    if (!bills?.length) return [];

    const ids = bills.map(b => b.id);
    const { data: lines, error: linesErr } = await supabase
        .from('bill_lines')
        .select('*')
        .in('bill_id', ids);
    if (linesErr) throw new Error(linesErr.message);

    return bills.map(bill => ({
        ...bill,
        lines: (lines ?? []).filter((l: BillLine) => l.bill_id === bill.id),
    }));
};

export const createBill = async (
    header: Omit<Bill, 'id' | 'lines' | 'created_at' | 'updated_at'>,
    lines: Omit<BillLine, 'id' | 'bill_id' | 'created_at'>[],
): Promise<Bill> => {
    const { data: bill, error } = await supabase
        .from('bills')
        .insert(header)
        .select()
        .single();
    if (error) throw new Error(error.message);

    if (lines.length > 0) {
        const { data: createdLines, error: linesErr } = await supabase
            .from('bill_lines')
            .insert(lines.map(l => ({ ...l, bill_id: bill.id })))
            .select();
        if (linesErr) throw new Error(linesErr.message);
        return { ...bill, lines: createdLines ?? [] };
    }
    return { ...bill, lines: [] };
};

export const updateBill = async (
    id: string,
    updates: Partial<Bill>,
    lines?: Omit<BillLine, 'id' | 'bill_id' | 'created_at'>[],
): Promise<Bill> => {
    const { data: bill, error } = await supabase
        .from('bills')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);

    if (lines !== undefined) {
        await supabase.from('bill_lines').delete().eq('bill_id', id);
        if (lines.length > 0) {
            await supabase.from('bill_lines').insert(lines.map(l => ({ ...l, bill_id: id })));
        }
    }

    const { data: updatedLines } = await supabase.from('bill_lines').select('*').eq('bill_id', id);
    return { ...bill, lines: updatedLines ?? [] };
};

export const deleteBill = async (id: string): Promise<void> => {
    const { data: bill, error: checkErr } = await supabase
        .from('bills').select('status').eq('id', id).maybeSingle();
    if (checkErr) throw new Error(checkErr.message);
    if (bill?.status !== 'draft') throw new Error('Only draft bills can be deleted.');
    await supabase.from('bill_lines').delete().eq('bill_id', id);
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (error) throw new Error(error.message);
};

export const postBill = async (id: string, createdBy: string): Promise<Bill> => {
    const { data: bill, error: billErr } = await supabase
        .from('bills').select('*').eq('id', id).single();
    if (billErr) throw new Error(billErr.message);
    if (bill.status !== 'draft') throw new Error('Bill is already posted.');

    const { data: lines, error: linesErr } = await supabase
        .from('bill_lines').select('*').eq('bill_id', id);
    if (linesErr) throw new Error(linesErr.message);
    if (!lines?.length) throw new Error('Add at least one line before posting.');

    const total = lines.reduce((s: number, l: BillLine) => s + Number(l.amount), 0);
    if (total <= 0) throw new Error('Bill total must be greater than zero.');

    // If this bill references a PO that already has a posted purchase_order JE,
    // skip creating a duplicate JE (inventory + AP were already booked by that PO JE).
    let jeId: string | null = null;
    let skipJe = false;
    if (bill.po_reference) {
        const { data: existingPOJe } = await supabase
            .from('journal_entries')
            .select('id')
            .eq('source', 'purchase_order')
            .eq('reference', bill.po_reference)
            .eq('is_posted', true)
            .maybeSingle();
        if (existingPOJe?.id) {
            // Reuse the existing PO JE — do not double-book AP/Inventory
            jeId = existingPOJe.id;
            skipJe = true;
        }
    }

    if (!skipJe) {
        // DR each expense/asset account, CR Accounts Payable 20000
        const jeLines = [
            ...lines.map((l: BillLine) => ({
                account_number: l.account_number,
                description: `${l.description || bill.description} — ${bill.bill_number}`,
                debit: Number(l.amount),
                credit: 0,
            })),
            {
                account_number: '20000',
                description: `AP — ${bill.vendor_name || bill.description} — ${bill.bill_number}`,
                debit: 0,
                credit: total,
            },
        ];

        const entryNumber = await getNextEntryNumber();
        const je = await createJournalEntry(
            {
                entry_number: entryNumber,
                entry_date: bill.bill_date,
                description: `Bill — ${bill.vendor_name || bill.description} — ${bill.bill_number}`,
                reference: bill.bill_number,
                created_by: createdBy,
                is_posted: true,
                source: 'bill',
            },
            jeLines,
        );
        jeId = je.id;
    }

    const { data: updated, error: updateErr } = await supabase
        .from('bills')
        .update({ status: 'posted', journal_entry_id: jeId, total_amount: total })
        .eq('id', id)
        .select()
        .single();
    if (updateErr) throw new Error(updateErr.message);
    return { ...updated, lines };
};

export const unpostBill = async (id: string): Promise<Bill> => {
    const { data: bill, error: billErr } = await supabase
        .from('bills').select('*').eq('id', id).single();
    if (billErr) throw new Error(billErr.message);
    if (bill.status !== 'posted') throw new Error('Bill is not posted.');

    if (bill.journal_entry_id) {
        await supabase
            .from('journal_entries')
            .update({ is_posted: false })
            .eq('id', bill.journal_entry_id);
    }

    const { data: updated, error } = await supabase
        .from('bills')
        .update({ status: 'draft', journal_entry_id: null })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    const { data: lines } = await supabase.from('bill_lines').select('*').eq('bill_id', id);
    return { ...updated, lines: lines ?? [] };
};

export const markBillPaid = async (
    id: string,
    params: { paymentDate: string; paymentMethod: string; paymentReference?: string; createdBy: string },
): Promise<Bill> => {
    const { data: bill, error: billErr } = await supabase
        .from('bills').select('*').eq('id', id).single();
    if (billErr) throw new Error(billErr.message);
    if (bill.status !== 'posted') throw new Error('Bill must be posted before marking as paid.');

    const bankAccount = PAYMENT_TO_ACCOUNT[params.paymentMethod] ?? '11100';
    const entryNumber = await getNextEntryNumber();

    const je = await createJournalEntry(
        {
            entry_number: entryNumber,
            entry_date: params.paymentDate,
            description: `Bill Payment — ${bill.vendor_name || bill.description} — ${bill.bill_number}`,
            reference: bill.bill_number,
            created_by: params.createdBy,
            is_posted: true,
            source: 'bill',
        },
        [
            { account_number: '20000',      description: `AP cleared — ${bill.bill_number}`, debit: Number(bill.total_amount), credit: 0 },
            { account_number: bankAccount,  description: `Payment — ${bill.bill_number}`,    debit: 0, credit: Number(bill.total_amount) },
        ],
    );

    const { data: updated, error } = await supabase
        .from('bills')
        .update({
            status: 'paid',
            payment_journal_id: je.id,
            payment_date: params.paymentDate,
            payment_method: params.paymentMethod,
            payment_reference: params.paymentReference ?? null,
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    const { data: lines } = await supabase.from('bill_lines').select('*').eq('bill_id', id);
    return { ...updated, lines: lines ?? [] };
};
