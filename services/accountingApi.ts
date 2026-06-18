import { supabase } from '../lib/supabase';
import { ChartOfAccount, JournalEntry, JournalEntryLine, BalanceSheetLine } from '../types';

// ── Chart of Accounts ─────────────────────────────────────────────────────────

export const fetchChartOfAccounts = async (): Promise<ChartOfAccount[]> => {
    const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
};

export const createAccount = async (payload: Omit<ChartOfAccount, 'id' | 'created_at' | 'updated_at'>): Promise<ChartOfAccount> => {
    const { data, error } = await supabase
        .from('chart_of_accounts')
        .insert(payload)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export const updateAccount = async (id: number, payload: Partial<ChartOfAccount>): Promise<ChartOfAccount> => {
    const { data, error } = await supabase
        .from('chart_of_accounts')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
};

// ── Journal Entries ───────────────────────────────────────────────────────────

export const fetchJournalEntries = async (): Promise<JournalEntry[]> => {
    const { data: entries, error } = await supabase
        .from('journal_entries')
        .select('*')
        .order('entry_date', { ascending: false });
    if (error) throw new Error(error.message);
    if (!entries?.length) return [];

    const ids = entries.map(e => e.id);
    const { data: lines, error: linesErr } = await supabase
        .from('journal_entry_lines')
        .select('*')
        .in('journal_entry_id', ids);
    if (linesErr) throw new Error(linesErr.message);

    return entries.map(entry => {
        const entryLines = (lines ?? []).filter(l => l.journal_entry_id === entry.id);
        return {
            ...entry,
            lines: entryLines,
            total_debit:  entryLines.reduce((s, l) => s + Number(l.debit),  0),
            total_credit: entryLines.reduce((s, l) => s + Number(l.credit), 0),
        };
    });
};

export const createJournalEntry = async (
    header: Omit<JournalEntry, 'id' | 'lines' | 'total_debit' | 'total_credit' | 'created_at' | 'updated_at'>,
    lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id' | 'created_at'>[],
): Promise<JournalEntry> => {
    const totalDebit  = lines.reduce((s, l) => s + l.debit,  0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(`Journal entry is not balanced: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}`);
    }

    const { data: entry, error } = await supabase
        .from('journal_entries')
        .insert(header)
        .select()
        .single();
    if (error) throw new Error(error.message);

    const lineRows = lines.map(l => ({ ...l, journal_entry_id: entry.id }));
    const { data: createdLines, error: linesErr } = await supabase
        .from('journal_entry_lines')
        .insert(lineRows)
        .select();
    if (linesErr) throw new Error(linesErr.message);

    return {
        ...entry,
        lines: createdLines ?? [],
        total_debit:  totalDebit,
        total_credit: totalCredit,
    };
};

export const updateJournalEntry = async (
    id: string,
    header: Partial<Pick<JournalEntry, 'entry_date' | 'description' | 'reference'>>,
    lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id' | 'created_at'>[],
): Promise<JournalEntry> => {
    // Guard: posted entries are immutable
    const { data: existing, error: checkErr } = await supabase
        .from('journal_entries')
        .select('is_posted, entry_number')
        .eq('id', id)
        .maybeSingle();
    if (checkErr) throw new Error(checkErr.message);
    if (existing?.is_posted) {
        throw new Error(`Cannot edit posted entry ${existing.entry_number}. Unpost it first.`);
    }

    const totalDebit  = lines.reduce((s, l) => s + l.debit,  0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(`Entry is not balanced: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}`);
    }

    // 1. Update header
    const { data: updatedEntry, error: updateErr } = await supabase
        .from('journal_entries')
        .update({ ...header, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (updateErr) throw new Error(updateErr.message);

    // 2. Replace lines: delete old, insert new
    const { error: deleteErr } = await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('journal_entry_id', id);
    if (deleteErr) throw new Error(deleteErr.message);

    const lineRows = lines.map(l => ({ ...l, journal_entry_id: id }));
    const { data: createdLines, error: linesErr } = await supabase
        .from('journal_entry_lines')
        .insert(lineRows)
        .select();
    if (linesErr) throw new Error(linesErr.message);

    return {
        ...updatedEntry,
        lines: createdLines ?? [],
        total_debit:  totalDebit,
        total_credit: totalCredit,
    };
};

export const deleteJournalEntry = async (id: string): Promise<void> => {
    // Client-side guard: verify not posted before sending to DB.
    // The DB also enforces this via RLS (NOT is_posted on DELETE policy).
    const { data: entry, error: checkErr } = await supabase
        .from('journal_entries')
        .select('is_posted, entry_number')
        .eq('id', id)
        .maybeSingle();
    if (checkErr) throw new Error(checkErr.message);
    if (entry?.is_posted) {
        throw new Error(`Cannot delete posted entry ${entry.entry_number}. Unpost it first.`);
    }

    const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);
    if (error) throw new Error(error.message);
};

export const togglePostJournalEntry = async (id: string, isPosted: boolean): Promise<JournalEntry> => {
    const { data, error } = await supabase
        .from('journal_entries')
        .update({ is_posted: isPosted })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
};

// ── Next Entry Number ─────────────────────────────────────────────────────────

export const getNextEntryNumber = async (): Promise<string> => {
    // Fetch all JE-NNNN entry numbers and find the true maximum to avoid
    // race conditions from ORDER BY created_at when entries are created quickly.
    const { data, error } = await supabase
        .from('journal_entries')
        .select('entry_number')
        .like('entry_number', 'JE-%');
    if (error || !data?.length) return 'JE-0001';
    const max = data.reduce((m, row) => {
        const match = row.entry_number.match(/^JE-(\d+)$/);
        const n = match ? parseInt(match[1], 10) : 0;
        return Math.max(m, n);
    }, 0);
    return `JE-${String(max + 1).padStart(4, '0')}`;
};

// ── Cash Flow Statement (Indirect Method) ────────────────────────────────────

export const computeCashFlow = async (
    accounts: ChartOfAccount[],
    dateFrom: string,
    dateTo: string,
): Promise<{
    netIncome: number;
    operatingAdjustments: { account_number: string; account_name: string; amount: number }[];
    investingItems: { account_number: string; account_name: string; amount: number }[];
    financingItems: { account_number: string; account_name: string; amount: number }[];
    netOperating: number;
    netInvesting: number;
    netFinancing: number;
    beginningCash: number;
    endingCash: number;
    netCashChange: number;
}> => {
    const [endResult, beginResult, periodResult] = await Promise.all([
        supabase
            .from('journal_entry_lines')
            .select('account_number, debit, credit, journal_entries!inner(is_posted, entry_date)')
            .eq('journal_entries.is_posted', true)
            .lte('journal_entries.entry_date', dateTo),
        supabase
            .from('journal_entry_lines')
            .select('account_number, debit, credit, journal_entries!inner(is_posted, entry_date)')
            .eq('journal_entries.is_posted', true)
            .lt('journal_entries.entry_date', dateFrom),
        supabase
            .from('journal_entry_lines')
            .select('account_number, debit, credit, journal_entries!inner(is_posted, entry_date)')
            .eq('journal_entries.is_posted', true)
            .gte('journal_entries.entry_date', dateFrom)
            .lte('journal_entries.entry_date', dateTo),
    ]);
    if (endResult.error)    throw new Error(endResult.error.message);
    if (beginResult.error)  throw new Error(beginResult.error.message);
    if (periodResult.error) throw new Error(periodResult.error.message);

    const agg = (lines: any[]) => {
        const result: Record<string, { debit: number; credit: number }> = {};
        (lines ?? []).forEach((l: any) => {
            if (!result[l.account_number]) result[l.account_number] = { debit: 0, credit: 0 };
            result[l.account_number].debit  += Number(l.debit);
            result[l.account_number].credit += Number(l.credit);
        });
        return result;
    };

    const endAgg    = agg(endResult.data ?? []);
    const beginAgg  = agg(beginResult.data ?? []);
    const periodAgg = agg(periodResult.data ?? []);

    const getBal = (num: string, type: string, a: Record<string, { debit: number; credit: number }>) => {
        const r = a[num] ?? { debit: 0, credit: 0 };
        return DEBIT_NORMAL.has(type) ? r.debit - r.credit : r.credit - r.debit;
    };

    // Net income from P&L accounts during the period
    let netIncome = 0;
    accounts.forEach(acc => {
        if (acc.account_type === 'Income' || acc.account_type === 'Other Income') {
            netIncome += getBal(acc.account_number, acc.account_type, periodAgg);
        } else if (acc.account_type === 'Cost of Goods Sold' || acc.account_type === 'Expense' || acc.account_type === 'Other Expense') {
            netIncome -= getBal(acc.account_number, acc.account_type, periodAgg);
        }
    });

    // Cash balances (Bank accounts)
    const beginningCash = accounts
        .filter(a => a.account_type === 'Bank')
        .reduce((s, a) => s + getBal(a.account_number, a.account_type, beginAgg), 0);
    const endingCash = accounts
        .filter(a => a.account_type === 'Bank')
        .reduce((s, a) => s + getBal(a.account_number, a.account_type, endAgg), 0);

    // Operating adjustments: changes in non-cash current accounts
    const OPER_ASSET = new Set(['Accounts Receivable', 'Other Current Asset']);
    const OPER_LIAB  = new Set(['Accounts Payable', 'Other Current Liability']);
    const operatingAdjustments: { account_number: string; account_name: string; amount: number }[] = [];

    accounts
        .filter(a => OPER_ASSET.has(a.account_type) || OPER_LIAB.has(a.account_type))
        .forEach(acc => {
            const change = getBal(acc.account_number, acc.account_type, endAgg)
                         - getBal(acc.account_number, acc.account_type, beginAgg);
            if (Math.abs(change) < 0.005) return;
            // Asset increase = cash outflow; liability increase = cash inflow
            const amount = OPER_ASSET.has(acc.account_type) ? -change : change;
            operatingAdjustments.push({ account_number: acc.account_number, account_name: acc.account_name, amount });
        });

    // Investing: changes in fixed asset accounts
    const investingItems: { account_number: string; account_name: string; amount: number }[] = [];
    accounts.filter(a => a.account_type === 'Fixed Asset').forEach(acc => {
        const change = getBal(acc.account_number, acc.account_type, endAgg)
                     - getBal(acc.account_number, acc.account_type, beginAgg);
        if (Math.abs(change) < 0.005) return;
        investingItems.push({ account_number: acc.account_number, account_name: acc.account_name, amount: -change });
    });

    // Financing: changes in equity accounts
    const financingItems: { account_number: string; account_name: string; amount: number }[] = [];
    accounts.filter(a => a.account_type === 'Equity').forEach(acc => {
        const change = getBal(acc.account_number, acc.account_type, endAgg)
                     - getBal(acc.account_number, acc.account_type, beginAgg);
        if (Math.abs(change) < 0.005) return;
        financingItems.push({ account_number: acc.account_number, account_name: acc.account_name, amount: change });
    });

    const netOperating = netIncome + operatingAdjustments.reduce((s, i) => s + i.amount, 0);
    const netInvesting  = investingItems.reduce((s, i) => s + i.amount, 0);
    const netFinancing  = financingItems.reduce((s, i) => s + i.amount, 0);

    return {
        netIncome,
        operatingAdjustments,
        investingItems,
        financingItems,
        netOperating,
        netInvesting,
        netFinancing,
        beginningCash,
        endingCash,
        netCashChange: netOperating + netInvesting + netFinancing,
    };
};

// ── Profit & Loss Computation (period-based) ──────────────────────────────────

export const computeProfitLoss = async (
    accounts: ChartOfAccount[],
    dateFrom: string,
    dateTo: string,
): Promise<{
    income: BalanceSheetLine[];
    cogs: BalanceSheetLine[];
    expenses: BalanceSheetLine[];
    otherIncome: BalanceSheetLine[];
    otherExpenses: BalanceSheetLine[];
    totalRevenue: number;
    totalCogs: number;
    grossProfit: number;
    totalExpenses: number;
    operatingIncome: number;
    totalOtherIncome: number;
    totalOtherExpenses: number;
    netOther: number;
    netIncome: number;
}> => {
    const { data: lines, error } = await supabase
        .from('journal_entry_lines')
        .select('account_number, debit, credit, journal_entries!inner(is_posted, entry_date)')
        .eq('journal_entries.is_posted', true)
        .gte('journal_entries.entry_date', dateFrom)
        .lte('journal_entries.entry_date', dateTo);
    if (error) throw new Error(error.message);

    const aggregated: Record<string, { debit: number; credit: number }> = {};
    (lines ?? []).forEach((line: any) => {
        if (!aggregated[line.account_number]) aggregated[line.account_number] = { debit: 0, credit: 0 };
        aggregated[line.account_number].debit  += Number(line.debit);
        aggregated[line.account_number].credit += Number(line.credit);
    });

    const getBalance = (acc: ChartOfAccount): number => {
        const agg = aggregated[acc.account_number] ?? { debit: 0, credit: 0 };
        return DEBIT_NORMAL.has(acc.account_type)
            ? agg.debit - agg.credit
            : agg.credit - agg.debit;
    };

    const makeLine = (acc: ChartOfAccount): BalanceSheetLine => ({
        account_number:        acc.account_number,
        account_name:          acc.account_name,
        parent_account_number: acc.parent_account_number,
        account_type:          acc.account_type,
        balance:               getBalance(acc),
        is_parent:             accounts.some(a => a.parent_account_number === acc.account_number),
    });

    const byType = (types: string[]): BalanceSheetLine[] =>
        accounts.filter(a => types.includes(a.account_type)).map(makeLine);

    const income       = byType(['Income']);
    const cogs         = byType(['Cost of Goods Sold']);
    const expenses     = byType(['Expense']);
    const otherIncome  = byType(['Other Income']);
    const otherExpenses = byType(['Other Expense']);

    const sum = (ls: BalanceSheetLine[]) => ls.reduce((s, l) => s + l.balance, 0);

    const totalRevenue       = sum(income);
    const totalCogs          = sum(cogs);
    const grossProfit        = totalRevenue - totalCogs;
    const totalExpenses      = sum(expenses);
    const operatingIncome    = grossProfit - totalExpenses;
    const totalOtherIncome   = sum(otherIncome);
    const totalOtherExpenses = sum(otherExpenses);
    const netOther           = totalOtherIncome - totalOtherExpenses;
    const netIncome          = operatingIncome + netOther;

    return {
        income, cogs, expenses, otherIncome, otherExpenses,
        totalRevenue, totalCogs, grossProfit,
        totalExpenses, operatingIncome,
        totalOtherIncome, totalOtherExpenses, netOther, netIncome,
    };
};

// ── Balance Sheet Computation ─────────────────────────────────────────────────

// Account types that carry a DEBIT normal balance (positive = debit > credit)
const DEBIT_NORMAL = new Set([
    'Bank',
    'Accounts Receivable',
    'Other Current Asset',
    'Fixed Asset',
    'Cost of Goods Sold',
    'Expense',
    'Other Expense',
]);

export const computeBalanceSheet = async (
    accounts: ChartOfAccount[],
    asOfDate?: string,
): Promise<{
    assets: BalanceSheetLine[];
    liabilities: BalanceSheetLine[];
    equity: BalanceSheetLine[];
    income: BalanceSheetLine[];
    cogs: BalanceSheetLine[];
    expenses: BalanceSheetLine[];
    otherIncome: BalanceSheetLine[];
    otherExpenses: BalanceSheetLine[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    netIncome: number;
    isBalanced: boolean;
}> => {
    let query = supabase
        .from('journal_entry_lines')
        .select('account_number, debit, credit, journal_entries!inner(is_posted, entry_date)');

    if (asOfDate) {
        query = query.lte('journal_entries.entry_date', asOfDate);
    }

    // Only include posted entries in the balance sheet
    query = query.eq('journal_entries.is_posted', true);

    const { data: lines, error } = await query;
    if (error) throw new Error(error.message);

    // Aggregate debit/credit per account
    const aggregated: Record<string, { debit: number; credit: number }> = {};
    (lines ?? []).forEach((line: any) => {
        if (!aggregated[line.account_number]) {
            aggregated[line.account_number] = { debit: 0, credit: 0 };
        }
        aggregated[line.account_number].debit  += Number(line.debit);
        aggregated[line.account_number].credit += Number(line.credit);
    });

    // Build balance per account (respecting normal balance rules)
    const getBalance = (acc: ChartOfAccount): number => {
        const agg = aggregated[acc.account_number] ?? { debit: 0, credit: 0 };
        return DEBIT_NORMAL.has(acc.account_type)
            ? agg.debit - agg.credit
            : agg.credit - agg.debit;
    };

    // Build a BSLine for a single account
    const makeLine = (acc: ChartOfAccount): BalanceSheetLine => ({
        account_number:        acc.account_number,
        account_name:          acc.account_name,
        parent_account_number: acc.parent_account_number,
        account_type:          acc.account_type,
        balance:               getBalance(acc),
        is_parent:             accounts.some(a => a.parent_account_number === acc.account_number),
    });

    // Group accounts by type, sorted
    const byType = (types: string[]): BalanceSheetLine[] =>
        accounts
            .filter(a => types.includes(a.account_type))
            .map(makeLine);

    const assets      = byType(['Bank', 'Accounts Receivable', 'Other Current Asset', 'Fixed Asset']);
    const liabilities = byType(['Accounts Payable', 'Other Current Liability']);
    const equity      = byType(['Equity']);
    const income      = byType(['Income']);
    const cogs        = byType(['Cost of Goods Sold']);
    const expenses    = byType(['Expense']);
    const otherIncome = byType(['Other Income']);
    const otherExpenses = byType(['Other Expense']);

    const sum = (lines: BalanceSheetLine[]) => lines.reduce((s, l) => s + l.balance, 0);

    const totalAssets      = sum(assets);
    const totalLiabilities = sum(liabilities);
    const totalEquityBase  = sum(equity);
    const netIncome        = sum(income) + sum(otherIncome) - sum(cogs) - sum(expenses) - sum(otherExpenses);
    const totalEquity      = totalEquityBase + netIncome;

    return {
        assets,
        liabilities,
        equity,
        income,
        cogs,
        expenses,
        otherIncome,
        otherExpenses,
        totalAssets,
        totalLiabilities,
        totalEquity,
        netIncome,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
};

// ── Auto-Post Helpers ─────────────────────────────────────────────────────────
// These functions create draft journal entries automatically when business
// transactions (invoices, receipts) are saved. Entries are created with
// is_posted = false so the accountant can review before they affect reports.
// All functions are idempotent: a second call for the same reference is a no-op.

const PAYMENT_METHOD_TO_ACCOUNT: Record<string, string> = {
    'Cash':          '10100', // Cash on Hand
    'Cheque':        '11800', // Undeposit Cheque
    'ABA':           '11100', // ABA USD-Pisey (default bank)
    'Bank Transfer': '11100',
    'KHQR':          '11100',
    'Other':         '11100',
};

// Mirrors the brand_account_mapping table seeded in 20260529_accounting_security.sql.
// Kept here as a cache so auto-post functions don't need an extra DB round-trip.
export const BRAND_ACCOUNT_MAP: Record<string, { revenue: string; cogs: string; inventory: string }> = {
    'ASUS':                  { revenue: '40100', cogs: '50100', inventory: '12100' },
    'DELL':                  { revenue: '40200', cogs: '50200', inventory: '12200' },
    'MSI':                   { revenue: '40300', cogs: '50300', inventory: '12300' },
    'Asus Acc. & PW Supply': { revenue: '40400', cogs: '50400', inventory: '12400' },
    'MSI Acc. & PW Supply':  { revenue: '40500', cogs: '50500', inventory: '12500' },
    'Other Accessories':     { revenue: '40600', cogs: '50600', inventory: '12600' },
    'Lenovo':                { revenue: '40700', cogs: '50700', inventory: '12700' },
    'Lenovo Accessories':    { revenue: '40800', cogs: '50800', inventory: '12800' },
};

/** Auto-create a draft journal entry for a saved invoice.
 *  DR Accounts Receivable 11900
 *  CR Income 40xxx per brand (falls back to 40000 if brand unknown)
 *  CR VAT Output 23000 (if VAT invoice)
 *
 *  Pass brandAmounts for a per-brand revenue breakdown; omit for a single
 *  line against the general Income parent account 40000.
 */
export const autoPostInvoiceJournal = async (params: {
    invNo: string;
    entryDate: string;
    grandTotal: number;
    taxAmount: number;
    isVAT: boolean;
    createdBy: string;
    brandAmounts?: { brand: string; subtotal: number }[];
}): Promise<boolean> => {
    // Idempotent: skip if an auto-entry for this invoice already exists
    const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference', params.invNo)
        .eq('source', 'invoice')
        .maybeSingle();
    if (existing) return false;

    const entryNumber = await getNextEntryNumber();
    const subtotal = params.grandTotal - params.taxAmount;

    const lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id' | 'created_at'>[] = [
        {
            account_number: '11900',
            description: `AR — ${params.invNo}`,
            debit: params.grandTotal,
            credit: 0,
        },
    ];

    if (params.brandAmounts && params.brandAmounts.length > 0) {
        // Per-brand revenue lines — route each brand to its specific income account
        for (const { brand, subtotal: brandSubtotal } of params.brandAmounts) {
            if (brandSubtotal <= 0.005) continue;
            const revenueAccount = BRAND_ACCOUNT_MAP[brand]?.revenue ?? '40000';
            lines.push({
                account_number: revenueAccount,
                description: `Revenue ${brand} — ${params.invNo}`,
                debit: 0,
                credit: brandSubtotal,
            });
        }
    } else {
        // Fall back to the generic parent income account
        lines.push({
            account_number: '40000',
            description: `Revenue — ${params.invNo}`,
            debit: 0,
            credit: subtotal,
        });
    }

    if (params.isVAT && params.taxAmount > 0.005) {
        lines.push({
            account_number: '23000',
            description: `VAT Output — ${params.invNo}`,
            debit: 0,
            credit: params.taxAmount,
        });
    }

    await createJournalEntry(
        {
            entry_number: entryNumber,
            entry_date: params.entryDate,
            description: `Auto: Invoice ${params.invNo}`,
            reference: params.invNo,
            created_by: params.createdBy,
            is_posted: false,
            source: 'invoice',
        },
        lines,
    );
    return true;
};

/** Auto-create a draft journal entry for a recorded receipt (payment).
 *  DR Bank account / CR Accounts Receivable 11900
 */
export const autoPostReceiptJournal = async (params: {
    rvNo: string;
    entryDate: string;
    amount: number;
    paymentMethod: string;
    createdBy: string;
}): Promise<void> => {
    // Idempotent: skip if an auto-entry for this receipt already exists
    const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference', params.rvNo)
        .eq('source', 'receipt')
        .maybeSingle();
    if (existing) return;

    const bankAccount = PAYMENT_METHOD_TO_ACCOUNT[params.paymentMethod] ?? '11100';
    const entryNumber = await getNextEntryNumber();

    await createJournalEntry(
        {
            entry_number: entryNumber,
            entry_date: params.entryDate,
            description: `Auto: Receipt ${params.rvNo}`,
            reference: params.rvNo,
            created_by: params.createdBy,
            is_posted: false,
            source: 'receipt',
        },
        [
            {
                account_number: bankAccount,
                description: `Bank — ${params.rvNo}`,
                debit: params.amount,
                credit: 0,
            },
            {
                account_number: '11900',
                description: `AR collection — ${params.rvNo}`,
                debit: 0,
                credit: params.amount,
            },
        ],
    );
};

/** Auto-create a draft journal entry when a Purchase Order is received (Completed).
 *  DR Inventory 12xxx per brand / CR Accounts Payable 20000
 */
export const autoPostPurchaseOrderJournal = async (params: {
    poNumber: string;
    entryDate: string;
    items: { brand?: string; qty: number; unit_price: number }[];
    createdBy: string;
}): Promise<void> => {
    // Idempotent: skip if an auto-entry for this PO already exists
    const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference', params.poNumber)
        .eq('source', 'purchase_order')
        .maybeSingle();
    if (existing) return;

    // Group by brand → total inventory cost
    const brandTotals: Record<string, number> = {};
    let grandTotal = 0;
    for (const item of params.items) {
        const cost = (item.qty || 0) * (item.unit_price || 0);
        if (cost <= 0.005) continue;
        const brand = item.brand?.trim() || 'Other Accessories';
        brandTotals[brand] = (brandTotals[brand] ?? 0) + cost;
        grandTotal += cost;
    }
    if (grandTotal <= 0.005) return;

    const entryNumber = await getNextEntryNumber();

    const lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id' | 'created_at'>[] = [];

    // DR Inventory per brand
    for (const [brand, cost] of Object.entries(brandTotals)) {
        const inventoryAccount = BRAND_ACCOUNT_MAP[brand]?.inventory ?? '12000';
        lines.push({
            account_number: inventoryAccount,
            description: `Inventory ${brand} — ${params.poNumber}`,
            debit: cost,
            credit: 0,
        });
    }

    // CR Accounts Payable (single line — total)
    lines.push({
        account_number: '20000',
        description: `AP — ${params.poNumber}`,
        debit: 0,
        credit: grandTotal,
    });

    await createJournalEntry(
        {
            entry_number: entryNumber,
            entry_date: params.entryDate,
            description: `Auto: PO ${params.poNumber}`,
            reference: params.poNumber,
            created_by: params.createdBy,
            is_posted: false,
            source: 'purchase_order',
        },
        lines,
    );
};

/** Auto-create a draft journal entry when a Delivery Order is marked Delivered.
 *  Recognises COGS (cost of goods sold) at the point goods leave the warehouse.
 *
 *  DR Cost of Goods Sold 50xxx per brand (falls back to 50000)
 *  CR Inventory 12xxx per brand (falls back to 12000)
 *
 *  costItems should contain the inventory cost (unit_price) per item, grouped by
 *  brand. If cost information is unavailable the entry is skipped rather than
 *  creating an unbalanced or zero entry.
 *
 *  Idempotent: a second call for the same DO No is a no-op.
 */
export const autoPostDeliveryOrderJournal = async (params: {
    doNo: string;
    entryDate: string;
    costItems: { brand?: string; qty: number; unit_price: number }[];
    createdBy: string;
}): Promise<void> => {
    // Idempotent guard
    const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference', params.doNo)
        .eq('source', 'delivery_order')
        .maybeSingle();
    if (existing) return;

    // Group cost by brand
    const brandTotals: Record<string, number> = {};
    let grandTotal = 0;
    for (const item of params.costItems) {
        const cost = (item.qty || 0) * (item.unit_price || 0);
        if (cost <= 0.005) continue;
        const brand = item.brand?.trim() || 'Other Accessories';
        brandTotals[brand] = (brandTotals[brand] ?? 0) + cost;
        grandTotal += cost;
    }
    // Nothing to post if no cost data
    if (grandTotal <= 0.005) return;

    const entryNumber = await getNextEntryNumber();
    const lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id' | 'created_at'>[] = [];

    for (const [brand, cost] of Object.entries(brandTotals)) {
        const cogsAccount      = BRAND_ACCOUNT_MAP[brand]?.cogs      ?? '50000';
        const inventoryAccount = BRAND_ACCOUNT_MAP[brand]?.inventory ?? '12000';
        lines.push({
            account_number: cogsAccount,
            description: `COGS ${brand} — ${params.doNo}`,
            debit: cost,
            credit: 0,
        });
        lines.push({
            account_number: inventoryAccount,
            description: `Inventory out ${brand} — ${params.doNo}`,
            debit: 0,
            credit: cost,
        });
    }

    await createJournalEntry(
        {
            entry_number: entryNumber,
            entry_date:   params.entryDate,
            description:  `Auto: DO ${params.doNo}`,
            reference:    params.doNo,
            created_by:   params.createdBy,
            is_posted:    false,
            source:       'delivery_order',
        },
        lines,
    );
};
