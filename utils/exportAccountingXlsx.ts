import * as XLSX from 'xlsx';
import type { ChartOfAccount, JournalEntry, Bill, BillVendor, BalanceSheetLine } from '../types';

const COMPANY = 'Limperial Technology Co., Ltd.';

// ── Internal types matching AccountingDashboard's local type aliases ──────────

type BSData = {
    assets: BalanceSheetLine[];
    liabilities: BalanceSheetLine[];
    equity: BalanceSheetLine[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    netIncome: number;
    isBalanced?: boolean;
};

type CFData = {
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
};

type PLData = {
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
};

export type BSMultiItem = { month: string; label: string; data: BSData };
export type CFMultiItem = { month: string; label: string; data: CFData };
export type PLMultiItem = { month: string; label: string; data: PLData };

// ── Helpers ───────────────────────────────────────────────────────────────────

const f2 = (n: number) => Number(n.toFixed(2));

const saveWb = (wb: XLSX.WorkBook, filename: string) => XLSX.writeFile(wb, filename);

/**
 * Build a worksheet with a QB-style title block (company, report name, date),
 * followed by headers then data rows.
 *
 * Layout:
 *   Row 0 — Company name (merged across all cols)
 *   Row 1 — Report name  (merged)
 *   Row 2 — Date range   (merged)
 *   Row 3 — blank
 *   Row 4 — Column headers
 *   Row 5+ — Data
 */
const makeSheet = (
    reportName: string,
    dateStr: string,
    headers: string[],
    dataRows: (string | number | null)[][],
    colWidths: number[],
): XLSX.WorkSheet => {
    const nc = Math.max(headers.length, colWidths.length, 1);
    const fill = (n: number) => Array(n).fill(null);

    const allRows: (string | number | null)[][] = [
        [COMPANY,     ...fill(nc - 1)],
        [reportName,  ...fill(nc - 1)],
        [dateStr,     ...fill(nc - 1)],
        fill(nc),               // blank separator
        headers as (string | number | null)[],
        ...dataRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(allRows);
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: nc - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: nc - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: nc - 1 } },
    ];
    ws['!cols'] = colWidths.map(wch => ({ wch }));
    return ws;
};

// ── Chart of Accounts ─────────────────────────────────────────────────────────

export const exportCoA = (accounts: ChartOfAccount[], exportDate: string) => {
    const headers = ['Account #', 'Account Name', 'Type', 'Parent #', 'Description'];
    const rows = accounts.map(a => [
        a.account_number,
        a.account_name,
        a.account_type,
        a.parent_account_number ?? '',
        a.description,
    ]);
    const ws = makeSheet(
        'Chart of Accounts',
        `As of ${exportDate}`,
        headers,
        rows,
        [12, 36, 24, 12, 40],
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chart of Accounts');
    saveWb(wb, `LPT_ChartOfAccounts_${exportDate}.xlsx`);
};

// ── Journal Entries ───────────────────────────────────────────────────────────

export const exportJournalEntries = (entries: JournalEntry[], exportDate: string) => {
    const headersH = ['JE #', 'Date', 'Description', 'Reference', 'Status', 'Source', 'Created By', 'Total Debit', 'Total Credit'];
    const rowsH = entries.map(e => [
        e.entry_number,
        e.entry_date,
        e.description,
        e.reference,
        e.is_posted ? 'Posted' : 'Draft',
        e.source ?? '',
        e.created_by,
        f2(e.total_debit ?? 0),
        f2(e.total_credit ?? 0),
    ]);

    const headersL = ['JE #', 'Date', 'Account #', 'Account Name', 'Description', 'Debit', 'Credit'];
    const rowsL: (string | number | null)[][] = [];
    entries.forEach(e => {
        (e.lines ?? []).forEach(l => {
            rowsL.push([
                e.entry_number,
                e.entry_date,
                l.account_number,
                l.account_name ?? '',
                l.description,
                f2(l.debit),
                f2(l.credit),
            ]);
        });
    });

    const wsH = makeSheet('Journal Entries', `As of ${exportDate}`, headersH, rowsH, [12, 12, 40, 20, 8, 16, 14, 14, 14]);
    const wsL = makeSheet(
        'Journal Entry Lines', `As of ${exportDate}`, headersL,
        rowsL.length ? rowsL : [['No line data — expand entries first to load lines']],
        [12, 12, 12, 28, 40, 14, 14],
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsH, 'JE Headers');
    XLSX.utils.book_append_sheet(wb, wsL, 'JE Lines');
    saveWb(wb, `LPT_JournalEntries_${exportDate}.xlsx`);
};

// ── General Ledger ────────────────────────────────────────────────────────────

export const exportGeneralLedger = (entries: JournalEntry[], exportDate: string, accountFilter?: string) => {
    const headers = ['Date', 'JE #', 'Reference', 'JE Description', 'Account #', 'Account Name', 'Line Description', 'Debit', 'Credit', 'Status'];
    const rows: (string | number | null)[][] = [];
    entries.forEach(e => {
        (e.lines ?? []).forEach(l => {
            if (accountFilter && l.account_number !== accountFilter) return;
            rows.push([
                e.entry_date,
                e.entry_number,
                e.reference,
                e.description,
                l.account_number,
                l.account_name ?? '',
                l.description,
                f2(l.debit),
                f2(l.credit),
                e.is_posted ? 'Posted' : 'Draft',
            ]);
        });
    });

    const dateStr = accountFilter
        ? `Account ${accountFilter} · As of ${exportDate}`
        : `As of ${exportDate}`;

    const ws = makeSheet('General Ledger', dateStr, headers,
        rows.length ? rows : [['No line data — open entries first to load lines']],
        [12, 12, 18, 36, 12, 28, 36, 14, 14, 8]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'General Ledger');
    saveWb(wb, `LPT_GeneralLedger_${exportDate}.xlsx`);
};

// ── Balance Sheet — Single Date ───────────────────────────────────────────────

export const exportBalanceSheet = (bsData: BSData, asOfDate: string) => {
    const headers = ['Section', 'Account #', 'Account Name', 'Balance'];
    const rows: (string | number | null)[][] = [];

    const section = (title: string, lines: BalanceSheetLine[], total: number) => {
        rows.push([title, null, null, null]);
        lines.forEach(l => rows.push([null, l.account_number, l.account_name, f2(l.balance)]));
    };

    section('Assets',      bsData.assets,      bsData.totalAssets);
    rows.push(['Total Assets', null, null, f2(bsData.totalAssets)]);
    rows.push([null, null, null, null]);

    section('Liabilities', bsData.liabilities, bsData.totalLiabilities);
    rows.push(['Total Liabilities', null, null, f2(bsData.totalLiabilities)]);
    rows.push([null, null, null, null]);

    section('Equity', bsData.equity, 0);
    rows.push([null, null, 'Net Income (Current Period)', f2(bsData.netIncome)]);
    rows.push(['Total Equity', null, null, f2(bsData.totalEquity)]);
    rows.push([null, null, null, null]);

    rows.push(['Liabilities + Equity', null, null, f2(bsData.totalLiabilities + bsData.totalEquity)]);

    const ws = makeSheet('Balance Sheet', `As of ${asOfDate}`, headers, rows, [22, 12, 36, 16]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `BS ${asOfDate}`);
    saveWb(wb, `LPT_BalanceSheet_${asOfDate}.xlsx`);
};

// ── Balance Sheet — Compare Months ────────────────────────────────────────────

export const exportBSCompare = (items: BSMultiItem[], monthFrom: string, monthTo: string) => {
    const labels = items.map(i => i.label);
    const headers = ['Section', 'Account #', 'Account Name', ...labels];

    const allAccts = (getter: (d: BSData) => BalanceSheetLine[]) =>
        [...new Map(items.flatMap(i => getter(i.data).map(l => [l.account_number, l]))).values()];

    const rows: (string | number | null)[][] = [];
    const blank = () => rows.push([null, null, null, ...items.map(() => null)]);

    // Assets
    rows.push(['Assets', null, null, ...items.map(() => null)]);
    allAccts(d => d.assets).forEach(acct => rows.push([
        null, acct.account_number, acct.account_name,
        ...items.map(i => { const l = i.data.assets.find(x => x.account_number === acct.account_number); return l ? f2(l.balance) : 0; }),
    ]));
    rows.push(['Total Assets', null, null, ...items.map(i => f2(i.data.totalAssets))]);
    blank();

    // Liabilities
    rows.push(['Liabilities', null, null, ...items.map(() => null)]);
    allAccts(d => d.liabilities).forEach(acct => rows.push([
        null, acct.account_number, acct.account_name,
        ...items.map(i => { const l = i.data.liabilities.find(x => x.account_number === acct.account_number); return l ? f2(l.balance) : 0; }),
    ]));
    rows.push(['Total Liabilities', null, null, ...items.map(i => f2(i.data.totalLiabilities))]);
    blank();

    // Equity (accounts + Net Income line)
    rows.push(['Equity', null, null, ...items.map(() => null)]);
    allAccts(d => d.equity).forEach(acct => rows.push([
        null, acct.account_number, acct.account_name,
        ...items.map(i => { const l = i.data.equity.find(x => x.account_number === acct.account_number); return l ? f2(l.balance) : 0; }),
    ]));
    rows.push([null, null, 'Net Income (Current Period)', ...items.map(i => f2(i.data.netIncome))]);
    rows.push(['Total Equity', null, null, ...items.map(i => f2(i.data.totalEquity))]);
    blank();

    // Liabilities + Equity check
    rows.push(['Liabilities + Equity', null, null, ...items.map(i => f2(i.data.totalLiabilities + i.data.totalEquity))]);

    const colWidths = [22, 12, 36, ...items.map(() => 16)];
    const ws = makeSheet('Balance Sheet', `${monthFrom} through ${monthTo}`, headers, rows, colWidths);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BS Compare');
    saveWb(wb, `LPT_BalanceSheet_${monthFrom}_${monthTo}.xlsx`);
};

// ── Cash Flow — Single Period ─────────────────────────────────────────────────

export const exportCashFlow = (cfData: CFData, dateFrom: string, dateTo: string) => {
    const headers = ['Category', 'Item', 'Amount'];
    const rows: (string | number | null)[][] = [
        ['OPERATING ACTIVITIES', null, null],
        ['Net Income', null, f2(cfData.netIncome)],
        ...cfData.operatingAdjustments.map(i => ['Operating Adjustment', `${i.account_number} — ${i.account_name}`, f2(i.amount)]),
        ['Net Operating Cash', null, f2(cfData.netOperating)],
        [null, null, null],
        ['INVESTING ACTIVITIES', null, null],
        ...cfData.investingItems.map(i => ['Investing Item', `${i.account_number} — ${i.account_name}`, f2(i.amount)]),
        ['Net Investing Cash', null, f2(cfData.netInvesting)],
        [null, null, null],
        ['FINANCING ACTIVITIES', null, null],
        ...cfData.financingItems.map(i => ['Financing Item', `${i.account_number} — ${i.account_name}`, f2(i.amount)]),
        ['Net Financing Cash', null, f2(cfData.netFinancing)],
        [null, null, null],
        ['Beginning Cash',  null, f2(cfData.beginningCash)],
        ['Net Cash Change', null, f2(cfData.netCashChange)],
        ['Ending Cash',     null, f2(cfData.endingCash)],
    ];

    const ws = makeSheet('Statement of Cash Flows', `${dateFrom} through ${dateTo}`, headers, rows, [24, 36, 16]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `CF ${dateFrom}`);
    saveWb(wb, `LPT_CashFlow_${dateFrom}_${dateTo}.xlsx`);
};

// ── Cash Flow — Compare Months ────────────────────────────────────────────────

export const exportCFCompare = (items: CFMultiItem[], monthFrom: string, monthTo: string) => {
    const labels = items.map(i => i.label);
    const headers = ['Category', 'Item', ...labels];

    const allOper = [...new Map(items.flatMap(i => i.data.operatingAdjustments.map(x => [x.account_number, x]))).values()];
    const allInvest = [...new Map(items.flatMap(i => i.data.investingItems.map(x => [x.account_number, x]))).values()];
    const allFin = [...new Map(items.flatMap(i => i.data.financingItems.map(x => [x.account_number, x]))).values()];

    const vals = (key: 'netIncome' | 'netOperating' | 'netInvesting' | 'netFinancing' | 'beginningCash' | 'netCashChange' | 'endingCash') =>
        items.map(i => f2(i.data[key]));

    const operRow = (acct: { account_number: string; account_name: string }, list: 'operatingAdjustments' | 'investingItems' | 'financingItems') =>
        items.map(i => { const x = i.data[list].find(a => a.account_number === acct.account_number); return x ? f2(x.amount) : 0; });

    const rows: (string | number | null)[][] = [
        ['OPERATING ACTIVITIES', null, ...items.map(() => null)],
        ['Net Income', null, ...vals('netIncome')],
        ...allOper.map(a => ['Operating Adjustment', `${a.account_number} — ${a.account_name}`, ...operRow(a, 'operatingAdjustments')]),
        ['Net Operating Cash', null, ...vals('netOperating')],
        [null, null, ...items.map(() => null)],
        ['INVESTING ACTIVITIES', null, ...items.map(() => null)],
        ...allInvest.map(a => ['Investing Item', `${a.account_number} — ${a.account_name}`, ...operRow(a, 'investingItems')]),
        ['Net Investing Cash', null, ...vals('netInvesting')],
        [null, null, ...items.map(() => null)],
        ['FINANCING ACTIVITIES', null, ...items.map(() => null)],
        ...allFin.map(a => ['Financing Item', `${a.account_number} — ${a.account_name}`, ...operRow(a, 'financingItems')]),
        ['Net Financing Cash', null, ...vals('netFinancing')],
        [null, null, ...items.map(() => null)],
        ['Beginning Cash',  null, ...vals('beginningCash')],
        ['Net Cash Change', null, ...vals('netCashChange')],
        ['Ending Cash',     null, ...vals('endingCash')],
    ];

    const colWidths = [24, 36, ...items.map(() => 16)];
    const ws = makeSheet('Statement of Cash Flows', `${monthFrom} through ${monthTo}`, headers, rows, colWidths);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CF Compare');
    saveWb(wb, `LPT_CashFlow_${monthFrom}_${monthTo}.xlsx`);
};

// ── Profit & Loss — Single Period ─────────────────────────────────────────────

export const exportProfitLoss = (plData: PLData, dateFrom: string, dateTo: string) => {
    const headers = ['Section', 'Account #', 'Account Name', 'Amount'];
    const rows: (string | number | null)[][] = [];

    const section = (title: string, lines: BalanceSheetLine[], total: number) => {
        rows.push([title, null, null, null]);
        lines.forEach(l => rows.push([null, l.account_number, l.account_name, f2(l.balance)]));
        rows.push([`Total ${title}`, null, null, f2(total)]);
        rows.push([null, null, null, null]);
    };

    section('Revenue',           plData.income,       plData.totalRevenue);
    section('Cost of Goods Sold', plData.cogs,        plData.totalCogs);
    rows.push(['Gross Profit', null, null, f2(plData.grossProfit)]);
    rows.push([null, null, null, null]);
    section('Operating Expenses', plData.expenses,    plData.totalExpenses);
    rows.push(['Operating Income', null, null, f2(plData.operatingIncome)]);
    rows.push([null, null, null, null]);
    section('Other Income',      plData.otherIncome,  plData.totalOtherIncome);
    section('Other Expenses',    plData.otherExpenses, plData.totalOtherExpenses);
    rows.push(['Net Income', null, null, f2(plData.netIncome)]);

    const ws = makeSheet('Profit & Loss', `${dateFrom} through ${dateTo}`, headers, rows, [24, 12, 36, 16]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `PL ${dateFrom}`);
    saveWb(wb, `LPT_ProfitLoss_${dateFrom}_${dateTo}.xlsx`);
};

// ── Profit & Loss — Compare Months ────────────────────────────────────────────

export const exportPLCompare = (items: PLMultiItem[], monthFrom: string, monthTo: string) => {
    const labels = items.map(i => i.label);
    const headers = ['Section', 'Account #', 'Account Name', ...labels];

    const allAccts = (getter: (d: PLData) => BalanceSheetLine[]) =>
        [...new Map(items.flatMap(i => getter(i.data).map(l => [l.account_number, l]))).values()];

    const rows: (string | number | null)[][] = [];

    const section = (title: string, getter: (d: PLData) => BalanceSheetLine[], totalKey: keyof PLData) => {
        rows.push([title, null, null, ...items.map(() => null)]);
        allAccts(getter).forEach(acct => {
            rows.push([
                null,
                acct.account_number,
                acct.account_name,
                ...items.map(i => {
                    const line = getter(i.data).find(l => l.account_number === acct.account_number);
                    return line ? f2(line.balance) : 0;
                }),
            ]);
        });
        rows.push([`Total ${title}`, null, null, ...items.map(i => f2(i.data[totalKey] as number))]);
        rows.push([null, null, null, ...items.map(() => null)]);
    };

    const summary = (label: string, key: keyof PLData) =>
        rows.push([label, null, null, ...items.map(i => f2(i.data[key] as number))]);

    section('Revenue',            d => d.income,       'totalRevenue');
    section('Cost of Goods Sold', d => d.cogs,         'totalCogs');
    summary('Gross Profit',                             'grossProfit');
    rows.push([null, null, null, ...items.map(() => null)]);
    section('Operating Expenses', d => d.expenses,     'totalExpenses');
    summary('Operating Income',                         'operatingIncome');
    rows.push([null, null, null, ...items.map(() => null)]);
    section('Other Income',       d => d.otherIncome,  'totalOtherIncome');
    section('Other Expenses',     d => d.otherExpenses,'totalOtherExpenses');
    summary('Net Income',                               'netIncome');

    const colWidths = [24, 12, 36, ...items.map(() => 16)];
    const ws = makeSheet('Profit & Loss', `${monthFrom} through ${monthTo}`, headers, rows, colWidths);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PL Compare');
    saveWb(wb, `LPT_ProfitLoss_${monthFrom}_${monthTo}.xlsx`);
};

// ── Bills ─────────────────────────────────────────────────────────────────────

export const exportBills = (bills: Bill[], exportDate: string) => {
    const headers = ['Bill #', 'Type', 'Vendor', 'PO Ref', 'Date', 'Due Date', 'Description', 'Status', 'Total ($)'];
    const rows = bills.map(b => [
        b.bill_number, b.bill_type, b.vendor_name ?? '', b.po_reference ?? '',
        b.bill_date, b.due_date ?? '', b.description, b.status, f2(b.total_amount),
    ]);
    const ws = makeSheet('Bills', `As of ${exportDate}`, headers, rows, [14, 8, 28, 16, 12, 12, 36, 8, 14]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bills');
    saveWb(wb, `LPT_Bills_${exportDate}.xlsx`);
};

// ── Bill Vendors ──────────────────────────────────────────────────────────────

export const exportBillVendors = (vendors: BillVendor[], exportDate: string) => {
    const headers = ['Vendor Name', 'Type', 'Status', 'Contact', 'Phone', 'Email', 'Tax ID', 'Default Account', 'Payment Terms', 'Bank Name', 'Bank Account', 'Address', 'Notes'];
    const rows = vendors.map(v => [
        v.vendor_name, v.vendor_type, v.status, v.contact_person, v.phone, v.email,
        v.tax_id, v.default_expense_account, v.payment_terms, v.bank_name, v.bank_account, v.address, v.notes,
    ]);
    const ws = makeSheet('Bill Vendors', `As of ${exportDate}`, headers, rows, [30, 14, 8, 20, 14, 24, 14, 16, 16, 20, 18, 30, 30]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bill Vendors');
    saveWb(wb, `LPT_BillVendors_${exportDate}.xlsx`);
};
