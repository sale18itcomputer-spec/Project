import { supabase } from '../lib/supabase';
import { ChartOfAccount, JournalEntry, JournalEntryLine, BalanceSheetLine } from '../types';
import { formatToInputDate } from '../utils/time';

// ── Chart of Accounts ─────────────────────────────────────────────────────────

export const fetchChartOfAccounts = async (): Promise<ChartOfAccount[]> => {
    const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        // Order by account number, not sort_order. sort_order only ever mirrored
        // the account number, but new accounts added via the app get sort_order
        // = accounts.length*10+10 (always appended last), which pushed e.g. 11700
        // below the fixed assets on reports. account_numbers are fixed-width
        // numeric strings, so lexicographic order == numeric order.
        .order('account_number', { ascending: true });
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

    // Preferred path: single-transaction RPC — header + lines commit or roll back
    // together, so a failure can never leave an orphaned header.
    // Falls back to two-step inserts if the migration hasn't been applied yet.
    const { data: rpcEntry, error: rpcErr } = await supabase
        .rpc('create_journal_entry_atomic', { p_header: header, p_lines: lines })
        .maybeSingle();
    if (!rpcErr && rpcEntry) {
        const { data: createdLines } = await supabase
            .from('journal_entry_lines')
            .select('*')
            .eq('journal_entry_id', (rpcEntry as any).id);
        return {
            ...(rpcEntry as any),
            lines: createdLines ?? [],
            total_debit:  totalDebit,
            total_credit: totalCredit,
        };
    }
    // PGRST202 = function not found (migration not applied) → legacy fallback.
    // Any other RPC error is a real failure (imbalance, constraint) — surface it.
    if (rpcErr && rpcErr.code !== 'PGRST202') throw new Error(rpcErr.message);

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
    if (linesErr) {
        // Best-effort cleanup so a lines failure doesn't leave an orphaned header
        // (unpost first — RLS only allows deleting unposted entries).
        await supabase.from('journal_entries').update({ is_posted: false }).eq('id', entry.id);
        await supabase.from('journal_entries').delete().eq('id', entry.id);
        throw new Error(linesErr.message);
    }

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
    // Step 1: fetch all posted JEs up to dateTo with their dates (single query).
    const { data: postedJEs, error: jeErr } = await supabase
        .from('journal_entries')
        .select('id, entry_date')
        .eq('is_posted', true)
        .lte('entry_date', dateTo);
    if (jeErr) throw new Error(jeErr.message);

    // Partition IDs by the three date windows needed for cash-flow calculation.
    const allUpToEnd  = (postedJEs ?? []).map(je => je.id as string);
    const beforeStart = (postedJEs ?? []).filter(je => je.entry_date < dateFrom).map(je => je.id as string);
    const inPeriod    = (postedJEs ?? []).filter(je => je.entry_date >= dateFrom).map(je => je.id as string);

    const fetchLines = async (ids: string[]): Promise<any[]> => {
        if (!ids.length) return [];
        const { data, error } = await supabase
            .from('journal_entry_lines')
            .select('account_number, debit, credit')
            .in('journal_entry_id', ids);
        if (error) throw new Error(error.message);
        return data ?? [];
    };

    // Step 2: fetch line sets in parallel.
    const [endLinesRaw, beginLinesRaw, periodLinesRaw] = await Promise.all([
        fetchLines(allUpToEnd),
        fetchLines(beforeStart),
        fetchLines(inPeriod),
    ]);

    const agg = (lines: any[]) => {
        const result: Record<string, { debit: number; credit: number }> = {};
        lines.forEach((l: any) => {
            if (!result[l.account_number]) result[l.account_number] = { debit: 0, credit: 0 };
            result[l.account_number].debit  += Number(l.debit);
            result[l.account_number].credit += Number(l.credit);
        });
        return result;
    };

    const endAgg    = agg(endLinesRaw);
    const beginAgg  = agg(beginLinesRaw);
    const periodAgg = agg(periodLinesRaw);

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
    const { data: jeRows, error: jeErr } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('is_posted', true)
        .gte('entry_date', dateFrom)
        .lte('entry_date', dateTo);
    if (jeErr) throw new Error(jeErr.message);

    const jeIds = (jeRows ?? []).map((r: any) => r.id as string);

    let rawLines: any[] = [];
    if (jeIds.length > 0) {
        const { data: lineRows, error: lineErr } = await supabase
            .from('journal_entry_lines')
            .select('account_number, debit, credit')
            .in('journal_entry_id', jeIds);
        if (lineErr) throw new Error(lineErr.message);
        rawLines = lineRows ?? [];
    }

    const aggregated: Record<string, { debit: number; credit: number }> = {};
    rawLines.forEach((line: any) => {
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

// ── P&L Drill-Down ───────────────────────────────────────────────────────────

export interface PLDetailLine {
    entry_number: string;
    entry_date: string;
    je_description: string;
    reference: string | null;
    line_description: string | null;
    debit: number;
    credit: number;
}

export const fetchAccountPLDetail = async (
    accountNumber: string,
    dateFrom: string,
    dateTo: string,
): Promise<PLDetailLine[]> => {
    // Step 1: posted JEs in date range.
    const { data: jeRows, error: jeErr } = await supabase
        .from('journal_entries')
        .select('id, entry_number, entry_date, description, reference')
        .eq('is_posted', true)
        .gte('entry_date', dateFrom)
        .lte('entry_date', dateTo);
    if (jeErr) throw new Error(jeErr.message);

    const jeIds = (jeRows ?? []).map((r: any) => r.id as string);
    if (!jeIds.length) return [];

    const jeMap = new Map((jeRows ?? []).map((r: any) => [r.id as string, r]));

    // Step 2: lines for this account within those JEs.
    const { data: lineRows, error: lineErr } = await supabase
        .from('journal_entry_lines')
        .select('journal_entry_id, debit, credit, description')
        .eq('account_number', accountNumber)
        .in('journal_entry_id', jeIds);
    if (lineErr) throw new Error(lineErr.message);

    return ((lineRows ?? []) as any[])
        .map(row => {
            const je = jeMap.get(row.journal_entry_id)!;
            return {
                entry_number:     je.entry_number,
                entry_date:       je.entry_date,
                je_description:   je.description,
                reference:        je.reference ?? null,
                line_description: row.description ?? null,
                debit:  Number(row.debit),
                credit: Number(row.credit),
            };
        })
        .sort((a, b) =>
            b.entry_date.localeCompare(a.entry_date) ||
            b.entry_number.localeCompare(a.entry_number),
        );
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
    // Step 1: fetch IDs of posted JEs (optionally up to asOfDate).
    // Two-step avoids relying on PostgREST embedded-resource filter semantics,
    // which can behave as a JSON filter rather than a true WHERE clause.
    let jeQuery = supabase
        .from('journal_entries')
        .select('id')
        .eq('is_posted', true);
    if (asOfDate) jeQuery = jeQuery.lte('entry_date', asOfDate);
    const { data: jeRows, error: jeErr } = await jeQuery;
    if (jeErr) throw new Error(jeErr.message);

    const jeIds = (jeRows ?? []).map((r: any) => r.id as string);

    // Step 2: fetch lines for those JEs only.
    let lines: any[] = [];
    if (jeIds.length > 0) {
        const { data: lineRows, error: lineErr } = await supabase
            .from('journal_entry_lines')
            .select('account_number, debit, credit')
            .in('journal_entry_id', jeIds);
        if (lineErr) throw new Error(lineErr.message);
        lines = lineRows ?? [];
    }

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

// ── Trial Balance ─────────────────────────────────────────────────────────────

export interface TrialBalanceRow {
    account_number: string;
    account_name: string;
    account_type: string;
    debit: number;   // net debit balance (0 when the account is credit-balance)
    credit: number;  // net credit balance (0 when the account is debit-balance)
}

/** Trial balance as of a date (defaults to all-time): every account with activity,
 *  its net balance placed in the debit or credit column. Total debits must equal
 *  total credits — the fundamental double-entry check. */
export const computeTrialBalance = async (
    accounts: ChartOfAccount[],
    asOfDate?: string,
): Promise<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; isBalanced: boolean }> => {
    let jeQuery = supabase.from('journal_entries').select('id').eq('is_posted', true);
    if (asOfDate) jeQuery = jeQuery.lte('entry_date', asOfDate);
    const { data: jeRows, error: jeErr } = await jeQuery;
    if (jeErr) throw new Error(jeErr.message);
    const jeIds = (jeRows ?? []).map((r: any) => r.id as string);

    let lines: any[] = [];
    if (jeIds.length > 0) {
        const { data, error } = await supabase
            .from('journal_entry_lines')
            .select('account_number, debit, credit')
            .in('journal_entry_id', jeIds);
        if (error) throw new Error(error.message);
        lines = data ?? [];
    }

    const agg: Record<string, { debit: number; credit: number }> = {};
    lines.forEach((l: any) => {
        if (!agg[l.account_number]) agg[l.account_number] = { debit: 0, credit: 0 };
        agg[l.account_number].debit  += Number(l.debit);
        agg[l.account_number].credit += Number(l.credit);
    });

    const nameOf = new Map(accounts.map(a => [a.account_number, a]));
    const rows: TrialBalanceRow[] = [];
    let totalDebit = 0, totalCredit = 0;

    Object.keys(agg)
        .sort((a, b) => a.localeCompare(b))
        .forEach(num => {
            const net = Math.round((agg[num].debit - agg[num].credit) * 100) / 100;
            if (net === 0) return; // zero-balance accounts are omitted from the TB
            const acc = nameOf.get(num);
            const debit  = net > 0 ? net : 0;
            const credit = net < 0 ? -net : 0;
            rows.push({
                account_number: num,
                account_name: acc?.account_name ?? '(unknown)',
                account_type: acc?.account_type ?? '',
                debit, credit,
            });
            totalDebit += debit;
            totalCredit += credit;
        });

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;
    return { rows, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
};

// ── Auto-Post Helpers ─────────────────────────────────────────────────────────
// These functions create draft journal entries automatically when business
// transactions (invoices, receipts) are saved. Entries are created with
// is_posted = false so the accountant can review before they affect reports.
// All functions are idempotent: a second call for the same reference is a no-op.

export const PAYMENT_METHOD_TO_ACCOUNT: Record<string, string> = {
    'Cash':          '10100', // Cash on Hand
    'Cheque':        '11800', // Undeposit Cheque
    'ABA':           '11100', // ABA USD-Pisey (default bank)
    'Bank Transfer': '11100',
    'KHQR':          '11100',
    'Other':         '11100',
};

// Mirrors the brand_account_mapping table seeded in 20260529_accounting_security.sql.
// Kept here as a cache so auto-post functions don't need an extra DB round-trip.
export const BRAND_ACCOUNT_MAP: Record<string, { revenue: string; cogs: string; inventory?: string }> = {
    'ASUS':                  { revenue: '40100', cogs: '50100', inventory: '12100' },
    'DELL':                  { revenue: '40200', cogs: '50200', inventory: '12200' },
    'MSI':                   { revenue: '40300', cogs: '50300', inventory: '12300' },
    'Asus Acc. & PW Supply': { revenue: '40400', cogs: '50400', inventory: '12400' },
    'MSI Acc. & PW Supply':  { revenue: '40500', cogs: '50500', inventory: '12500' },
    'Other Accessories':     { revenue: '40600', cogs: '50600', inventory: '12600' },
    'Lenovo':                { revenue: '40700', cogs: '50700', inventory: '12700' },
    'Lenovo Accessories':    { revenue: '40800', cogs: '50800', inventory: '12800' },
    // PC Build: assembled units sold as one line (see autoPostInvoiceJournal costItems
    // cogsBrand). No inventory account of its own — components keep their own real
    // brand's inventory account (12100/12300/12600/etc.), only revenue and COGS
    // consolidate here.
    'PC Build':              { revenue: '40900', cogs: '50900' },
};

/**
 * Normalize a brand string to match a BRAND_ACCOUNT_MAP key.
 * Strips Unicode diacritics and does case-insensitive matching so
 * values like "ÀSUS" (accented A from encoding issues) resolve to "ASUS".
 */
export const normalizeBrand = (raw: string): string => {
    const stripped = raw.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
    const match = Object.keys(BRAND_ACCOUNT_MAP).find(k =>
        k.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() === stripped.toLowerCase()
    );
    return match ?? raw.trim();
};

/** Auto-create a journal entry for a received customer deposit.
 *  DR Bank (per payment method)  (deposit cash received)
 *  CR Customer Deposit 25000     (full VAT-inclusive deposit — liability until
 *                                 the settling receipt applies it: DR 25000 / CR AR)
 *
 *  NO VAT line: VAT is declared in full by the invoice JE. The 25000 balance is
 *  cleared by the invoice JE's deposit-application lines (DR 25000 / CR 11900).
 *
 *  Idempotent: no-op if a deposit_receipt JE already exists for this invNo.
 */
export const autoPostDepositReceiptJournal = async (params: {
    invNo: string;
    depositAmount: number;
    entryDate: string;
    createdBy: string;
    /** Payment method used for the deposit — defaults to Bank Transfer (11100) */
    paymentMethod?: string;
}): Promise<boolean> => {
    if (params.depositAmount <= 0.005) return false;

    const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference', params.invNo)
        .eq('source', 'deposit_receipt')
        .maybeSingle();
    if (existing) return false;

    // Deposit was already received in cash — debit the bank account, not AR.
    // COA 25000 carries the full VAT-inclusive deposit as a liability until
    // it is applied at final payment time.
    const bankAccount = PAYMENT_METHOD_TO_ACCOUNT[params.paymentMethod ?? 'Bank Transfer'] ?? '11100';
    const entryNumber = await getNextEntryNumber();
    const lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id' | 'created_at'>[] = [
        { account_number: bankAccount, description: `Deposit received — ${params.invNo}`, debit: params.depositAmount, credit: 0 },
        { account_number: '25000',     description: `Customer Deposit — ${params.invNo}`, debit: 0, credit: params.depositAmount },
    ];

    await createJournalEntry(
        {
            entry_number: entryNumber,
            entry_date:   params.entryDate,
            description:  `Deposit Receipt — ${params.invNo}`,
            reference:    params.invNo,
            created_by:   params.createdBy,
            is_posted:    true,
            source:       'deposit_receipt',
        },
        lines,
    );
    return true;
};

/** Auto-create a journal entry for a saved invoice.
 *  DR Accounts Receivable 11900 (full grand total)
 *  DR Customer Deposit 25000 / CR AR 11900 (deposit application — consumes the
 *     liability booked by autoPostDepositReceiptJournal, so GL AR matches the
 *     Collection outstanding: Amount − Deposit − Paid)
 *  CR Income 40xxx per brand (unmapped brands → 40600 Other Accessories, never the 40000 parent)
 *  CR VAT Output 23000 (full invoice VAT — the single point where VAT is declared)
 *  DR/CR COGS + Inventory per costItems
 *
 *  Pass brandAmounts for a per-brand revenue breakdown; omit for a single
 *  line against the 40600 Other Accessories account.
 */
export const autoPostInvoiceJournal = async (params: {
    invNo: string;
    entryDate: string;
    grandTotal: number;
    taxAmount: number;
    isVAT: boolean;
    createdBy: string;
    brandAmounts?: { brand: string; subtotal: number }[];
    /** Negative number representing total cashback/promo deductions on the invoice */
    cashbackTotal?: number;
    /** cogsBrand overrides which BRAND_ACCOUNT_MAP entry's COGS account is used
     *  (e.g. 'PC Build' → 50900) while `brand` still controls the inventory
     *  account credited — used when a component is sold as part of a build but
     *  its physical inventory lives under its own real brand. */
    costItems?: { brand: string; qty: number; unit_price: number; cogsBrand?: string }[];
    /** VAT-inclusive deposit already received — applied against AR (DR 25000 / CR 11900) */
    depositAmount?: number;
}): Promise<boolean> => {
    // Idempotent: skip if an auto-entry for this invoice already exists — but
    // ONLY if its AR total actually matches this invoice. A reference that's
    // been mislabeled onto the wrong invoice (or reused/corrupted some other
    // way) must not silently look like "already posted", or the real sale
    // never gets a JE at all while appearing fully reconciled (see
    // INV2026-00002, where JE-2059 actually belonged to a different $1,230
    // invoice but its stale reference blocked this $33,600 sale from ever
    // posting). A mismatch throws instead of failing silently so it surfaces
    // as a visible error, not a permanent gap discovered later on the Balance Sheet.
    const { data: existing } = await supabase
        .from('journal_entries')
        .select('id, entry_number')
        .eq('reference', params.invNo)
        .eq('source', 'invoice')
        .maybeSingle();
    if (existing) {
        const { data: arLines } = await supabase
            .from('journal_entry_lines')
            .select('debit, credit')
            .eq('journal_entry_id', existing.id)
            .eq('account_number', '11900');
        const arNet = (arLines ?? []).reduce((s, l) => s + (Number(l.debit) || 0) - (Number(l.credit) || 0), 0);
        if (Math.abs(arNet - params.grandTotal) <= 1) return false; // genuinely already posted — safe to skip
        throw new Error(
            `${existing.entry_number} already references ${params.invNo} but its AR total ($${arNet.toFixed(2)}) doesn't match this invoice's total ($${params.grandTotal.toFixed(2)}). This looks like a mislabeled or reused reference, not a real duplicate — refusing to silently skip. Fix ${existing.entry_number}'s reference before re-saving this invoice.`
        );
    }

    const entryNumber = await getNextEntryNumber();
    const cashback = params.cashbackTotal && params.cashbackTotal < 0 ? Math.abs(params.cashbackTotal) : 0;
    // grossSubtotal = revenue before cashback deduction; grandTotal already has cashback applied
    const grossSubtotal = params.grandTotal - params.taxAmount + cashback;

    const invoiceVAT = params.taxAmount;

    const lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id' | 'created_at'>[] = [
        {
            account_number: '11900',
            description: `AR — ${params.invNo}`,
            debit: params.grandTotal,
            credit: 0,
        },
    ];

    // DR Sale Discount 41100 when invoice has cashback/promo deductions (contra-revenue, visible in P&L)
    if (cashback > 0.005) {
        lines.push({
            account_number: '41100',
            description: `Sale Discount — ${params.invNo}`,
            debit: cashback,
            credit: 0,
        });
    }

    if (params.brandAmounts && params.brandAmounts.length > 0) {
        // Per-brand revenue lines — route each brand to its specific income account
        for (const { brand: rawBrand, subtotal: brandSubtotal } of params.brandAmounts) {
            if (brandSubtotal <= 0.005) continue;
            const brand = normalizeBrand(rawBrand);
            const revenueAccount = BRAND_ACCOUNT_MAP[brand]?.revenue ?? '40600';
            lines.push({
                account_number: revenueAccount,
                description: `Revenue ${brand} — ${params.invNo}`,
                debit: 0,
                credit: brandSubtotal,
            });
        }
    } else {
        // Fall back to the Other Accessories leaf income account — never the
        // 40000 parent (summary accounts must not hold direct postings).
        lines.push({
            account_number: '40600',
            description: `Revenue — ${params.invNo}`,
            debit: 0,
            credit: grossSubtotal,
        });
    }

    if (params.isVAT && invoiceVAT > 0.005) {
        lines.push({
            account_number: '23000',
            description: `VAT Output — ${params.invNo}`,
            debit: 0,
            credit: invoiceVAT,
        });
    }

    // Deposit application: consume the 25000 liability and offset AR so the GL
    // shows only what the customer still owes (matches Collection outstanding).
    const deposit = params.depositAmount && params.depositAmount > 0.005
        ? Math.round(params.depositAmount * 100) / 100
        : 0;
    if (deposit > 0) {
        lines.push({
            account_number: '25000',
            description: `Deposit applied — ${params.invNo}`,
            debit: deposit,
            credit: 0,
        });
        lines.push({
            account_number: '11900',
            description: `Deposit offset AR — ${params.invNo}`,
            debit: 0,
            credit: deposit,
        });
    }

    // COGS + Inventory reduction — one line pair per item.
    // Routing is via BRAND_ACCOUNT_MAP (after normalization) — NOT per-row DB
    // account fields, whose stale values caused repeat misrouting bugs. Any brand
    // not in the map (PC-build components: Intel / GSkill / Kingston / FSP / etc.)
    // falls back to the Other Accessories LEAF accounts (50600 / 12600), never the
    // 50000 / 12000 parents — parent/summary accounts must not hold direct postings.
    if (params.costItems && params.costItems.length > 0) {
        for (const { brand: rawBrand, qty, unit_price, cogsBrand: rawCogsBrand } of params.costItems) {
            const cost = qty * unit_price;
            if (cost <= 0.005) continue;
            const brand      = normalizeBrand(rawBrand);
            const brandEntry = BRAND_ACCOUNT_MAP[brand];
            const cogsEntry  = rawCogsBrand ? BRAND_ACCOUNT_MAP[normalizeBrand(rawCogsBrand)] : brandEntry;
            const cogsAcct   = cogsEntry?.cogs       ?? '50600';
            const invAcct    = brandEntry?.inventory ?? '12600';
            lines.push({ account_number: cogsAcct, description: `COGS ${brand} — ${params.invNo}`,          debit: cost, credit: 0 });
            lines.push({ account_number: invAcct,  description: `Inventory out ${brand} — ${params.invNo}`, debit: 0,    credit: cost });
        }
    }

    await createJournalEntry(
        {
            entry_number: entryNumber,
            entry_date: params.entryDate,
            description: `Auto: Invoice ${params.invNo}`,
            reference: params.invNo,
            created_by: params.createdBy,
            is_posted: true,
            source: 'invoice',
        },
        lines,
    );
    return true;
};

/** Auto-create a journal entry for a recorded receipt (payment).
 *
 *  DR Bank (per payment method — one line per method for split payments)
 *  CR AR 11900 (cash received — gross)
 *
 *  NO VAT line: VAT Output 23000 is declared once, in full, by the invoice JE
 *  (autoPostInvoiceJournal). Splitting VAT again here double-declares it and
 *  leaves AR with a permanent residual. See 20260623_fix_ti2026_00003_je_amounts.sql.
 *
 *  NO deposit lines: deposits are applied against AR by the invoice JE
 *  (DR 25000 / CR 11900), so receipts only book the cash actually received.
 */
export const autoPostReceiptJournal = async (params: {
    rvNo: string;
    entryDate: string;
    amount: number;
    paymentMethod: string;
    createdBy: string;
    /** Split payments (POS): one DR bank line per method. Overrides paymentMethod/amount. */
    payments?: { method: string; amount: number }[];
}): Promise<void> => {
    // Round each payment to 2dp so line debits always sum exactly to the AR credit
    const payments = (params.payments?.length
        ? params.payments
        : [{ method: params.paymentMethod, amount: params.amount }]
    )
        .map(p => ({ method: p.method, amount: Math.round(p.amount * 100) / 100 }))
        .filter(p => p.amount > 0.005);
    const cashTotal = Math.round(payments.reduce((s, p) => s + p.amount * 100, 0)) / 100;
    if (cashTotal <= 0.005) return;

    // Idempotent: skip if an auto-entry for this receipt already exists — but
    // only if its AR credit actually matches this receipt (see
    // autoPostInvoiceJournal for why a mismatched reference must not
    // silently look like "already posted").
    const { data: existing } = await supabase
        .from('journal_entries')
        .select('id, entry_number')
        .eq('reference', params.rvNo)
        .eq('source', 'receipt')
        .maybeSingle();
    if (existing) {
        const { data: arLines } = await supabase
            .from('journal_entry_lines')
            .select('debit, credit')
            .eq('journal_entry_id', existing.id)
            .eq('account_number', '11900');
        const arCredited = (arLines ?? []).reduce((s, l) => s + (Number(l.credit) || 0) - (Number(l.debit) || 0), 0);
        if (Math.abs(arCredited - cashTotal) <= 1) return; // genuinely already posted — safe to skip
        throw new Error(
            `${existing.entry_number} already references ${params.rvNo} but its AR credit ($${arCredited.toFixed(2)}) doesn't match this receipt's total ($${cashTotal.toFixed(2)}). This looks like a mislabeled or reused reference, not a real duplicate — refusing to silently skip. Fix ${existing.entry_number}'s reference before re-saving this receipt.`
        );
    }

    const entryNumber = await getNextEntryNumber();

    const lines: { account_number: string; description: string; debit: number; credit: number }[] =
        payments.map(p => ({
            account_number: PAYMENT_METHOD_TO_ACCOUNT[p.method] ?? '11100',
            description: `${p.method} — ${params.rvNo}`,
            debit: p.amount,
            credit: 0,
        }));

    lines.push({
        account_number: '11900',
        description: `AR collection — ${params.rvNo}`,
        debit: 0,
        credit: cashTotal,
    });

    await createJournalEntry(
        {
            entry_number: entryNumber,
            entry_date: params.entryDate,
            description: `Auto: Receipt ${params.rvNo}`,
            reference: params.rvNo,
            created_by: params.createdBy,
            is_posted: true,
            source: 'receipt',
        },
        lines,
    );
};

/** Auto-create a draft journal entry when a Purchase Order is received (Completed).
 *  DR Inventory 12xxx per brand / CR Accounts Payable 20000 / CR Purchase Discount 70200
 */
export const autoPostPurchaseOrderJournal = async (params: {
    poNumber: string;
    entryDate: string;
    items: { brand?: string; qty: number; unit_price: number }[];
    createdBy: string;
    /** Negative number representing total cashback/rebate deductions on the PO */
    cashbackTotal?: number;
}): Promise<void> => {
    // Idempotent: skip if an auto-entry for this PO already exists
    const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference', params.poNumber)
        .eq('source', 'purchase_order')
        .maybeSingle();
    if (existing) return;

    // Cross-guard: if a bill referencing this PO already booked its own JE,
    // creating a PO JE now would double-book inventory + AP.
    const { data: billBooked } = await supabase
        .from('bills')
        .select('id')
        .eq('po_reference', params.poNumber)
        .not('journal_entry_id', 'is', null)
        .limit(1);
    if (billBooked?.length) return;

    // Group by brand → total inventory cost
    const brandTotals: Record<string, number> = {};
    let grandTotal = 0;
    for (const item of params.items) {
        const cost = (item.qty || 0) * (item.unit_price || 0);
        if (cost <= 0.005) continue;
        const brand = normalizeBrand(item.brand?.trim() || 'Other Accessories');
        brandTotals[brand] = (brandTotals[brand] ?? 0) + cost;
        grandTotal += cost;
    }
    if (grandTotal <= 0.005) return;

    const entryNumber = await getNextEntryNumber();

    const lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id' | 'created_at'>[] = [];

    const cashback = params.cashbackTotal && params.cashbackTotal < 0 ? Math.abs(params.cashbackTotal) : 0;

    // DR Inventory per brand (at gross cost, before vendor cashback).
    // Unmapped brands (PC-build components) → 12600 Other Accessories leaf, not the 12000 parent.
    for (const [brand, cost] of Object.entries(brandTotals)) {
        const inventoryAccount = BRAND_ACCOUNT_MAP[brand]?.inventory ?? '12600';
        lines.push({
            account_number: inventoryAccount,
            description: `Inventory ${brand} — ${params.poNumber}`,
            debit: cost,
            credit: 0,
        });
    }

    // CR Accounts Payable (net — what we actually owe the vendor after cashback)
    lines.push({
        account_number: '20000',
        description: `AP — ${params.poNumber}`,
        debit: 0,
        credit: grandTotal - cashback,
    });

    // CR Purchase Discount 70200 (vendor rebate / program cashback)
    if (cashback > 0.005) {
        lines.push({
            account_number: '70200',
            description: `Purchase Discount — ${params.poNumber}`,
            debit: 0,
            credit: cashback,
        });
    }

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

    // Nothing to post if no cost data
    let grandTotal = 0;
    for (const item of params.costItems) grandTotal += (item.qty || 0) * (item.unit_price || 0);
    if (grandTotal <= 0.005) return;

    const entryNumber = await getNextEntryNumber();
    const lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id' | 'created_at'>[] = [];

    for (const { brand: rawBrand, qty, unit_price } of params.costItems) {
        const cost = (qty || 0) * (unit_price || 0);
        if (cost <= 0.005) continue;
        const brand      = normalizeBrand(rawBrand?.trim() || 'Other Accessories');
        const brandEntry = BRAND_ACCOUNT_MAP[brand];
        // Unmapped brands (PC-build components) → Other Accessories leaf, not the parent.
        const cogsAcct   = brandEntry?.cogs      ?? '50600';
        const invAcct    = brandEntry?.inventory  ?? '12600';
        lines.push({
            account_number: cogsAcct,
            description: `COGS ${brand} — ${params.doNo}`,
            debit: cost,
            credit: 0,
        });
        lines.push({
            account_number: invAcct,
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

/** Back-fill COGS for already-posted invoice journals that only have Revenue lines.
 *  Creates a new draft journal entry per invoice (source='cogs_backfill').
 *  Existing posted entries are never modified — the companion entry carries the COGS.
 *  Idempotent: skips any invoice that already has a cogs_backfill entry.
 */
export const backfillAllMissingCOGS = async (
    createdBy: string,
): Promise<{ total: number; backfilled: number; skipped: number }> => {
    const allJournals = await fetchJournalEntries();
    const invoiceJournals = allJournals.filter(j => j.source === 'invoice');
    if (invoiceJournals.length === 0) {
        return { total: 0, backfilled: 0, skipped: 0 };
    }

    const needsCOGS = invoiceJournals.filter(j => {
        const lines = j.lines ?? [];
        return !lines.some((l: JournalEntryLine) => String(l.account_number).startsWith('5'));
    });
    if (needsCOGS.length === 0) {
        return { total: invoiceJournals.length, backfilled: 0, skipped: invoiceJournals.length };
    }

    const candidates = needsCOGS.map((j: any) => j.reference).filter(Boolean) as string[];
    const { data: existingBF } = await supabase
        .from('journal_entries')
        .select('reference')
        .eq('source', 'cogs_backfill')
        .in('reference', candidates);
    const done = new Set((existingBF ?? []).map((b: any) => b.reference as string));

    // Pricelist for brand mapping (Code → Brand)
    const { data: plData } = await supabase.from('pricelist').select('"Code", "Brand"');
    const brandMap = new Map<string, string>(
        (plData ?? []).map((p: any) => [p['Code'] as string, p['Brand'] as string]),
    );

    let backfilled = 0;
    let skipped    = 0;

    for (const j of needsCOGS) {
        const invNo: string = j.reference;
        if (!invNo || done.has(invNo)) { skipped++; continue; }

        let inv: any = null;
        { const { data } = await supabase.from('b2b_invoices').select('"Inv No","Inv Date","ItemsJSON"').eq('"Inv No"', invNo).maybeSingle(); inv = data; }
        if (!inv) { const { data } = await supabase.from('invoices').select('"Inv No","Inv Date","ItemsJSON"').eq('"Inv No"', invNo).maybeSingle(); inv = data; }
        if (!inv) { skipped++; continue; }

        let items: any[] = [];
        try {
            items = typeof inv['ItemsJSON'] === 'string'
                ? JSON.parse(inv['ItemsJSON'])
                : (inv['ItemsJSON'] ?? []);
        } catch { items = []; }
        if (items.length === 0) { skipped++; continue; }

        const brandCost: Record<string, number> = {};
        for (const item of items) {
            const qty = Number(item.qty) || 0;
            if (qty <= 0) continue;
            const code  = (item.itemCode  as string | undefined)?.trim();
            const model = (item.modelName as string | undefined)?.trim();

            // Brand: pricelist first, then inventory row, then fallback
            let unitPrice = 0;
            let inventoryBrand: string | undefined;
            let invCogsAcct: string | undefined;
            let invInvAcct:  string | undefined;
            if (code) {
                const { data: rows } = await supabase
                    .from('inventory')
                    .select('unit_price, brand, cogs_account, inventory_account')
                    .eq('code', code)
                    .order('created_at', { ascending: true })
                    .limit(1);
                if (rows?.[0]) {
                    unitPrice      = Number(rows[0].unit_price) || 0;
                    inventoryBrand = (rows[0].brand as string | undefined)?.trim() || undefined;
                    invCogsAcct    = (rows[0].cogs_account as string | undefined)?.trim() || undefined;
                    invInvAcct     = (rows[0].inventory_account as string | undefined)?.trim() || undefined;
                }
            }
            if (unitPrice <= 0 && model) {
                const { data: rows } = await supabase
                    .from('inventory')
                    .select('unit_price, brand, cogs_account, inventory_account')
                    .ilike('model_name', `%${model}%`)
                    .order('created_at', { ascending: true })
                    .limit(1);
                if (rows?.[0]) {
                    unitPrice = Number(rows[0].unit_price) || 0;
                    if (!inventoryBrand) inventoryBrand = (rows[0].brand as string | undefined)?.trim() || undefined;
                    if (!invCogsAcct)    invCogsAcct    = (rows[0].cogs_account as string | undefined)?.trim() || undefined;
                    if (!invInvAcct)     invInvAcct     = (rows[0].inventory_account as string | undefined)?.trim() || undefined;
                }
            }
            const brand = (code && brandMap.get(code)) || inventoryBrand || 'Other Accessories';
            if (unitPrice > 0) {
                const key = JSON.stringify({
                    brand,
                    // item field → brand map → Other Accessories leaf (never the 50000/12000 parent)
                    cogsAcct: invCogsAcct || BRAND_ACCOUNT_MAP[brand]?.cogs      || '50600',
                    invAcct:  invInvAcct  || BRAND_ACCOUNT_MAP[brand]?.inventory || '12600',
                });
                brandCost[key] = (brandCost[key] ?? 0) + qty * unitPrice;
            }
        }

        const totalCost = Object.values(brandCost).reduce((a, b) => a + b, 0);
        if (totalCost <= 0.005) { skipped++; continue; }

        // Build balanced COGS entry lines — accounts come directly from inventory record
        const lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id' | 'created_at'>[] = [];
        for (const [key, cost] of Object.entries(brandCost)) {
            const { brand, cogsAcct, invAcct } = JSON.parse(key) as { brand: string; cogsAcct: string; invAcct: string };
            lines.push({ account_number: cogsAcct, description: `COGS ${brand} — ${invNo}`,          debit: cost, credit: 0 });
            lines.push({ account_number: invAcct,  description: `Inventory out ${brand} — ${invNo}`, debit: 0,    credit: cost });
        }

        const entryNumber = await getNextEntryNumber();
        const rawDate  = inv['Inv Date'] as string | undefined;
        const entryDate = (rawDate ? formatToInputDate(rawDate) : '') || (j.entry_date as string);

        await createJournalEntry(
            {
                entry_number: entryNumber,
                entry_date:   entryDate,
                description:  `COGS back-fill — ${invNo}`,
                reference:    invNo,
                created_by:   createdBy,
                is_posted:    false,
                source:       'cogs_backfill',
            },
            lines,
        );
        backfilled++;
    }

    return { total: invoiceJournals.length, backfilled, skipped };
};
