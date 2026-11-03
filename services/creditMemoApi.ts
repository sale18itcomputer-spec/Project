import { supabase } from '../lib/supabase';
import { resolveTableByBase } from './api';
import { SERVICE_REMARK_PREFIX } from '../utils/serviceInvoice';
import { Invoice } from '../types';

/**
 * Net credit the GL holds on Accounts Receivable (11900) for a credit memo, from its posted
 * journal entries (reference = memo Inv No). A credit memo is only safe to apply without a new
 * journal entry when its own entry already credited AR — otherwise applying it would shrink the
 * invoice's balance in Collection while the GL still shows the customer owing the full amount.
 */
export async function getCreditMemoArCredit(memoNo: string): Promise<number> {
    const { data: entries, error } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference', memoNo)
        .eq('is_posted', true);
    if (error) throw new Error(`Could not read the credit memo's journal entry: ${error.message}`);
    const ids = (entries ?? []).map(e => e.id);
    if (ids.length === 0) return 0;

    const { data: lines, error: lineErr } = await supabase
        .from('journal_entry_lines')
        .select('debit, credit')
        .in('journal_entry_id', ids)
        .eq('account_number', '11900');
    if (lineErr) throw new Error(`Could not read the credit memo's journal lines: ${lineErr.message}`);
    return Math.round(
        (lines ?? []).reduce((s, l) => s + (Number(l.credit) || 0) - (Number(l.debit) || 0), 0) * 100,
    ) / 100;
}

/**
 * Amount already applied from a memo, read straight from the database (not the client cache) so
 * two people — or two tabs — can't both spend the same credit.
 */
export async function fetchCreditApplied(memoNo: string): Promise<number> {
    const { data, error } = await supabase
        .from(resolveTableByBase('receipts'))
        .select('"Amount"')
        .eq('credit_memo_no', memoNo)
        .neq('Status', 'Cancelled');
    if (error) throw new Error(`Could not read existing credit applications: ${error.message}`);
    return Math.round(
        (data ?? []).reduce((s: number, r: any) => s + (Number(r.Amount) || 0), 0) * 100,
    ) / 100;
}

/**
 * An invoice that has just been fully settled (by cash or by credit) flips to Completed, and a
 * service invoice raised from a ticket resolves the ticket. Best-effort: a failure here must not
 * undo the recorded settlement, so callers get the message back instead of an exception.
 */
export async function completeSettledInvoice(
    invoice: Invoice,
    ctx: {
        setInvoices: (fn: (prev: any) => any) => void;
        setServiceTickets: (fn: (prev: any) => any) => void;
        updateInvoiceStatus: (invNo: string) => Promise<void>;
    },
): Promise<{ completed: boolean; ticketNo?: string; error?: string }> {
    if (invoice.Status === 'Completed' || invoice.Status === 'Cancel') return { completed: false };
    try {
        await ctx.updateInvoiceStatus(invoice['Inv No']);
        ctx.setInvoices(prev => prev
            ? prev.map((i: Invoice) => i['Inv No'] === invoice['Inv No'] ? { ...i, Status: 'Completed' as const } : i)
            : prev);

        let ticketNo: string | undefined;
        const invRemark: string = (invoice as any)['Remark'] ?? '';
        if (invRemark.startsWith(SERVICE_REMARK_PREFIX)) {
            const no = invRemark.slice(SERVICE_REMARK_PREFIX.length).trim();
            const ACTIVE_TICKET_STATUSES = ['Open', 'In Progress', 'Pending Parts'];
            const { error: ticketErr } = await supabase
                .from('service_tickets')
                .update({ status: 'Resolved' })
                .eq('ticket_no', no)
                .in('status', ACTIVE_TICKET_STATUSES);
            if (!ticketErr) {
                ctx.setServiceTickets(prev => prev
                    ? prev.map((t: any) => t.ticket_no === no && ACTIVE_TICKET_STATUSES.includes(t.status)
                        ? { ...t, status: 'Resolved' as const }
                        : t)
                    : prev);
                ticketNo = no;
            }
        }
        return { completed: true, ticketNo };
    } catch (err: any) {
        return { completed: false, error: err?.message ?? String(err) };
    }
}
