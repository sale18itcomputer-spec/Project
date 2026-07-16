'use client';

import { supabase } from '../lib/supabase';
import { createJournalEntry, getNextEntryNumber } from './accountingApi';

// ── Recurring journal-entry templates ─────────────────────────────────────────

export interface RecurringLine {
    account_number: string;
    description?: string;
    debit: number;
    credit: number;
}

export interface RecurringTemplate {
    id?: string;
    name: string;
    description?: string | null;
    frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    is_active: boolean;
    lines: RecurringLine[];
    last_generated_date?: string | null;
    created_by?: string | null;
}

export const fetchRecurring = async (): Promise<RecurringTemplate[]> => {
    const { data, error } = await supabase
        .from('recurring_journal_entries')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as RecurringTemplate[];
};

export const createRecurring = async (t: Omit<RecurringTemplate, 'id'>): Promise<RecurringTemplate> => {
    const { data, error } = await supabase
        .from('recurring_journal_entries')
        .insert(t)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data as RecurringTemplate;
};

export const updateRecurring = async (id: string, patch: Partial<RecurringTemplate>): Promise<void> => {
    const { error } = await supabase
        .from('recurring_journal_entries')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw new Error(error.message);
};

export const deleteRecurring = async (id: string): Promise<void> => {
    const { error } = await supabase.from('recurring_journal_entries').delete().eq('id', id);
    if (error) throw new Error(error.message);
};

/** Post a real journal entry from a template for the given date.
 *  createJournalEntry enforces that the template's debits equal its credits. */
export const generateRecurringJE = async (
    t: RecurringTemplate,
    entryDate: string,
    createdBy: string,
): Promise<string> => {
    const entryNumber = await getNextEntryNumber();
    const je = await createJournalEntry(
        {
            entry_number: entryNumber,
            entry_date: entryDate,
            description: `Recurring — ${t.name}`,
            reference: t.name,
            created_by: createdBy,
            is_posted: true,
            source: 'recurring',
        },
        t.lines.map(l => ({
            account_number: l.account_number,
            description: l.description || t.name,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
        })),
    );
    if (t.id) await updateRecurring(t.id, { last_generated_date: entryDate });
    return je.entry_number;
};

// ── Bank reconciliation ────────────────────────────────────────────────────────

export interface LedgerLine {
    line_id: string;
    entry_number: string;
    entry_date: string;
    description: string;
    reference: string | null;
    debit: number;
    credit: number;
    reconciled: boolean;
}

/** All posted journal lines hitting one account, oldest first, with cleared flag. */
export const fetchAccountLedger = async (accountNumber: string): Promise<LedgerLine[]> => {
    const { data: lines, error } = await supabase
        .from('journal_entry_lines')
        .select('id, journal_entry_id, debit, credit, description')
        .eq('account_number', accountNumber);
    if (error) throw new Error(error.message);
    if (!lines?.length) return [];

    const jeIds = [...new Set(lines.map((l: any) => l.journal_entry_id))];
    const { data: jes, error: jeErr } = await supabase
        .from('journal_entries')
        .select('id, entry_number, entry_date, description, reference, is_posted')
        .in('id', jeIds);
    if (jeErr) throw new Error(jeErr.message);
    const jeMap = new Map((jes ?? []).map((j: any) => [j.id, j]));

    const lineIds = lines.map((l: any) => l.id);
    const marked = new Set<string>();
    if (lineIds.length) {
        const { data: marks } = await supabase.from('bank_rec_marks').select('line_id').in('line_id', lineIds);
        (marks ?? []).forEach((m: any) => marked.add(m.line_id));
    }

    return lines
        .map((l: any) => {
            const je = jeMap.get(l.journal_entry_id);
            if (!je || !je.is_posted) return null; // only posted entries hit the ledger
            return {
                line_id: l.id,
                entry_number: je.entry_number,
                entry_date: je.entry_date,
                description: l.description || je.description || '',
                reference: je.reference ?? null,
                debit: Number(l.debit),
                credit: Number(l.credit),
                reconciled: marked.has(l.id),
            } as LedgerLine;
        })
        .filter((x): x is LedgerLine => x !== null)
        .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.entry_number.localeCompare(b.entry_number));
};

export const setLineReconciled = async (lineId: string, on: boolean, by?: string): Promise<void> => {
    if (on) {
        const { error } = await supabase
            .from('bank_rec_marks')
            .upsert({ line_id: lineId, reconciled_by: by ?? null, reconciled_at: new Date().toISOString() }, { onConflict: 'line_id' });
        if (error) throw new Error(error.message);
    } else {
        const { error } = await supabase.from('bank_rec_marks').delete().eq('line_id', lineId);
        if (error) throw new Error(error.message);
    }
};

// ── Deposit Cheque ──────────────────────────────────────────────────────────────
// Cheque receipts post DR 11800 "Undeposit Cheque" (see PAYMENT_METHOD_TO_ACCOUNT
// in accountingApi.ts) because a cheque isn't cash in the bank yet. This sweeps
// selected undeposited cheques into a real bank account with one JE, without
// ever touching the original posted lines.

const UNDEPOSITED_CHEQUE_ACCOUNT = '11800';

export interface UndepositedCheque {
    line_id: string;
    entry_number: string;
    entry_date: string;
    description: string;
    reference: string | null;
    amount: number;
}

/** Cheque-receipt debit lines into 11800 that haven't yet been swept into a bank deposit. */
export const fetchUndepositedCheques = async (): Promise<UndepositedCheque[]> => {
    const { data: lines, error } = await supabase
        .from('journal_entry_lines')
        .select('id, journal_entry_id, debit, credit, description')
        .eq('account_number', UNDEPOSITED_CHEQUE_ACCOUNT)
        .gt('debit', 0);
    if (error) throw new Error(error.message);
    if (!lines?.length) return [];

    const jeIds = [...new Set(lines.map((l: any) => l.journal_entry_id))];
    const { data: jes, error: jeErr } = await supabase
        .from('journal_entries')
        .select('id, entry_number, entry_date, description, reference, is_posted')
        .in('id', jeIds);
    if (jeErr) throw new Error(jeErr.message);
    const jeMap = new Map((jes ?? []).map((j: any) => [j.id, j]));

    const lineIds = lines.map((l: any) => l.id);
    const deposited = new Set<string>();
    if (lineIds.length) {
        const { data: marks } = await supabase.from('cheque_deposit_marks').select('line_id').in('line_id', lineIds);
        (marks ?? []).forEach((m: any) => deposited.add(m.line_id));
    }

    return lines
        .map((l: any) => {
            if (deposited.has(l.id)) return null; // already swept into a bank deposit
            const je = jeMap.get(l.journal_entry_id);
            if (!je || !je.is_posted) return null;
            return {
                line_id: l.id,
                entry_number: je.entry_number,
                entry_date: je.entry_date,
                description: l.description || je.description || '',
                reference: je.reference ?? null,
                amount: Number(l.debit),
            } as UndepositedCheque;
        })
        .filter((x): x is UndepositedCheque => x !== null)
        .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.entry_number.localeCompare(b.entry_number));
};

/** Sweep selected undeposited-cheque lines into a real bank account: one JE,
 *  DR targetAccount / CR 11800, for the sum of the selected lines' debits.
 *  Re-verifies each line server-side (account, amount, not-already-deposited)
 *  before posting, so a stale client view can't double-deposit or misstate a cheque. */
export const depositCheques = async (params: {
    lineIds: string[];
    targetAccount: string;
    entryDate: string;
    createdBy: string;
}): Promise<string> => {
    if (params.lineIds.length === 0) throw new Error('Select at least one cheque to deposit.');
    if (params.targetAccount === UNDEPOSITED_CHEQUE_ACCOUNT) {
        throw new Error('Deposit target must be a real bank account, not Undeposit Cheque itself.');
    }

    const { data: lines, error } = await supabase
        .from('journal_entry_lines')
        .select('id, debit, account_number')
        .in('id', params.lineIds);
    if (error) throw new Error(error.message);
    if (!lines || lines.length !== params.lineIds.length) {
        throw new Error('One or more selected cheques could not be found — refresh and try again.');
    }
    const bad = lines.find(l => l.account_number !== UNDEPOSITED_CHEQUE_ACCOUNT || !(Number(l.debit) > 0.005));
    if (bad) throw new Error('One or more selected lines are not valid undeposited-cheque debits.');

    const { data: existingMarks } = await supabase
        .from('cheque_deposit_marks')
        .select('line_id')
        .in('line_id', params.lineIds);
    if (existingMarks && existingMarks.length > 0) {
        throw new Error('One or more selected cheques were already deposited by someone else — refresh and try again.');
    }

    const total = Math.round(lines.reduce((s, l) => s + Number(l.debit), 0) * 100) / 100;
    if (total <= 0.005) throw new Error('Selected cheques total to zero.');

    const entryNumber = await getNextEntryNumber();
    const je = await createJournalEntry(
        {
            entry_number: entryNumber,
            entry_date: params.entryDate,
            description: `Cheque deposit — ${params.lineIds.length} item(s) to ${params.targetAccount}`,
            reference: entryNumber,
            created_by: params.createdBy,
            is_posted: true,
            source: 'cheque_deposit',
        },
        [
            { account_number: params.targetAccount, description: 'Cheque deposit', debit: total, credit: 0 },
            { account_number: UNDEPOSITED_CHEQUE_ACCOUNT, description: 'Cheque deposit — clear Undeposit Cheque', debit: 0, credit: total },
        ],
    );

    const marks = params.lineIds.map(id => ({ line_id: id, deposit_je_id: je.id, deposited_by: params.createdBy ?? null }));
    const { error: markErr } = await supabase.from('cheque_deposit_marks').insert(marks);
    if (markErr) {
        throw new Error(
            `Deposit JE ${je.entry_number} was posted but marking the cheques as deposited failed: ${markErr.message}. ` +
            `Do not repeat this deposit — reconcile ${je.entry_number} and the cheque_deposit_marks table manually.`
        );
    }

    return je.entry_number;
};
