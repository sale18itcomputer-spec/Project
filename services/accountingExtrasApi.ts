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
