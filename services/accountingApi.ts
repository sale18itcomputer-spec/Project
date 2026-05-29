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

export const deleteJournalEntry = async (id: string): Promise<void> => {
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
    const { data, error } = await supabase
        .from('journal_entries')
        .select('entry_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error || !data) return 'JE-0001';
    const match = data.entry_number.match(/(\d+)$/);
    const next = match ? parseInt(match[1], 10) + 1 : 1;
    return `JE-${String(next).padStart(4, '0')}`;
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
