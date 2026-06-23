import * as XLSX from 'xlsx';
import type { ChartOfAccount, JournalEntry, Bill, BillVendor, BalanceSheetLine } from '../types';

type BSData = {
    assets: BalanceSheetLine[];
    liabilities: BalanceSheetLine[];
    equity: BalanceSheetLine[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
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

const saveWorkbook = (wb: XLSX.WorkBook, filename: string) => {
    XLSX.writeFile(wb, filename);
};

const fmt2 = (n: number) => Number(n.toFixed(2));

// ── Chart of Accounts ─────────────────────────────────────────────────────────

export const exportCoA = (accounts: ChartOfAccount[], exportDate: string) => {
    const rows = accounts.map(a => ({
        'Account #':     a.account_number,
        'Account Name':  a.account_name,
        'Type':          a.account_type,
        'Parent #':      a.parent_account_number ?? '',
        'Description':   a.description,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 36 }, { wch: 24 }, { wch: 12 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chart of Accounts');
    saveWorkbook(wb, `LPT_ChartOfAccounts_${exportDate}.xlsx`);
};

// ── Journal Entries ───────────────────────────────────────────────────────────

export const exportJournalEntries = (entries: JournalEntry[], exportDate: string) => {
    const headers: object[] = [];
    const lines: object[] = [];

    entries.forEach(e => {
        headers.push({
            'JE #':        e.entry_number,
            'Date':        e.entry_date,
            'Description': e.description,
            'Reference':   e.reference,
            'Status':      e.is_posted ? 'Posted' : 'Draft',
            'Source':      e.source ?? '',
            'Created By':  e.created_by,
            'Total Debit': fmt2(e.total_debit ?? 0),
            'Total Credit':fmt2(e.total_credit ?? 0),
        });
        (e.lines ?? []).forEach(l => {
            lines.push({
                'JE #':         e.entry_number,
                'Date':         e.entry_date,
                'Account #':    l.account_number,
                'Account Name': l.account_name ?? '',
                'Description':  l.description,
                'Debit':        fmt2(l.debit),
                'Credit':       fmt2(l.credit),
            });
        });
    });

    const wsH = XLSX.utils.json_to_sheet(headers);
    const wsL = XLSX.utils.json_to_sheet(lines.length ? lines : [{ Note: 'No line data loaded' }]);
    wsH['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    wsL['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 40 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsH, 'JE Headers');
    XLSX.utils.book_append_sheet(wb, wsL, 'JE Lines');
    saveWorkbook(wb, `LPT_JournalEntries_${exportDate}.xlsx`);
};

// ── General Ledger ────────────────────────────────────────────────────────────

export const exportGeneralLedger = (entries: JournalEntry[], exportDate: string, accountFilter?: string) => {
    const rows: object[] = [];
    entries.forEach(e => {
        (e.lines ?? []).forEach(l => {
            if (accountFilter && l.account_number !== accountFilter) return;
            rows.push({
                'Date':         e.entry_date,
                'JE #':         e.entry_number,
                'Reference':    e.reference,
                'JE Description': e.description,
                'Account #':    l.account_number,
                'Account Name': l.account_name ?? '',
                'Line Description': l.description,
                'Debit':        fmt2(l.debit),
                'Credit':       fmt2(l.credit),
                'Status':       e.is_posted ? 'Posted' : 'Draft',
            });
        });
    });
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No line data loaded — open entries first to load lines' }]);
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 36 }, { wch: 12 }, { wch: 28 }, { wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'General Ledger');
    saveWorkbook(wb, `LPT_GeneralLedger_${exportDate}.xlsx`);
};

// ── Balance Sheet ─────────────────────────────────────────────────────────────

export const exportBalanceSheet = (bsData: BSData, asOfDate: string) => {
    const rows: object[] = [];

    const section = (title: string, lines: BalanceSheetLine[], total: number) => {
        rows.push({ Section: title, 'Account #': '', 'Account Name': '', Balance: '' });
        lines.forEach(l => rows.push({
            Section:        '',
            'Account #':    l.account_number,
            'Account Name': l.account_name,
            Balance:        fmt2(l.balance),
        }));
        rows.push({ Section: `Total ${title}`, 'Account #': '', 'Account Name': '', Balance: fmt2(total) });
        rows.push({ Section: '', 'Account #': '', 'Account Name': '', Balance: '' });
    };

    section('Assets',      bsData.assets,      bsData.totalAssets);
    section('Liabilities', bsData.liabilities, bsData.totalLiabilities);
    section('Equity',      bsData.equity,       bsData.totalEquity);

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 36 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `BS As Of ${asOfDate}`);
    saveWorkbook(wb, `LPT_BalanceSheet_${asOfDate}.xlsx`);
};

// ── Cash Flow ─────────────────────────────────────────────────────────────────

export const exportCashFlow = (cfData: CFData, dateFrom: string, dateTo: string) => {
    const rows: object[] = [
        { Category: 'OPERATING ACTIVITIES',   Item: '', Amount: '' },
        { Category: 'Net Income',             Item: '', Amount: fmt2(cfData.netIncome) },
    ];

    cfData.operatingAdjustments.forEach(i => rows.push({
        Category: 'Operating Adjustment',
        Item: `${i.account_number} — ${i.account_name}`,
        Amount: fmt2(i.amount),
    }));
    rows.push({ Category: 'Net Operating Cash',  Item: '', Amount: fmt2(cfData.netOperating) });
    rows.push({ Category: '', Item: '', Amount: '' });

    rows.push({ Category: 'INVESTING ACTIVITIES', Item: '', Amount: '' });
    cfData.investingItems.forEach(i => rows.push({
        Category: 'Investing Item',
        Item: `${i.account_number} — ${i.account_name}`,
        Amount: fmt2(i.amount),
    }));
    rows.push({ Category: 'Net Investing Cash', Item: '', Amount: fmt2(cfData.netInvesting) });
    rows.push({ Category: '', Item: '', Amount: '' });

    rows.push({ Category: 'FINANCING ACTIVITIES', Item: '', Amount: '' });
    cfData.financingItems.forEach(i => rows.push({
        Category: 'Financing Item',
        Item: `${i.account_number} — ${i.account_name}`,
        Amount: fmt2(i.amount),
    }));
    rows.push({ Category: 'Net Financing Cash',  Item: '', Amount: fmt2(cfData.netFinancing) });
    rows.push({ Category: '', Item: '', Amount: '' });

    rows.push({ Category: 'Beginning Cash',  Item: '', Amount: fmt2(cfData.beginningCash) });
    rows.push({ Category: 'Net Cash Change', Item: '', Amount: fmt2(cfData.netCashChange) });
    rows.push({ Category: 'Ending Cash',     Item: '', Amount: fmt2(cfData.endingCash) });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 36 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `CF ${dateFrom} to ${dateTo}`);
    saveWorkbook(wb, `LPT_CashFlow_${dateFrom}_${dateTo}.xlsx`);
};

// ── Profit & Loss ─────────────────────────────────────────────────────────────

export const exportProfitLoss = (plData: PLData, dateFrom: string, dateTo: string) => {
    const rows: object[] = [];

    const section = (title: string, lines: BalanceSheetLine[], total: number) => {
        rows.push({ Section: title, 'Account #': '', 'Account Name': '', Amount: '' });
        lines.forEach(l => rows.push({
            Section:        '',
            'Account #':    l.account_number,
            'Account Name': l.account_name,
            Amount:         fmt2(l.balance),
        }));
        rows.push({ Section: `Total ${title}`, 'Account #': '', 'Account Name': '', Amount: fmt2(total) });
        rows.push({ Section: '', 'Account #': '', 'Account Name': '', Amount: '' });
    };

    section('Revenue',        plData.income,       plData.totalRevenue);
    section('Cost of Goods',  plData.cogs,         plData.totalCogs);
    rows.push({ Section: 'Gross Profit',      'Account #': '', 'Account Name': '', Amount: fmt2(plData.grossProfit) });
    rows.push({ Section: '', 'Account #': '', 'Account Name': '', Amount: '' });
    section('Operating Expenses', plData.expenses, plData.totalExpenses);
    rows.push({ Section: 'Operating Income',  'Account #': '', 'Account Name': '', Amount: fmt2(plData.operatingIncome) });
    rows.push({ Section: '', 'Account #': '', 'Account Name': '', Amount: '' });
    section('Other Income',   plData.otherIncome,  plData.totalOtherIncome);
    section('Other Expenses', plData.otherExpenses, plData.totalOtherExpenses);
    rows.push({ Section: 'Net Income',        'Account #': '', 'Account Name': '', Amount: fmt2(plData.netIncome) });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 36 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `PL ${dateFrom} to ${dateTo}`);
    saveWorkbook(wb, `LPT_ProfitLoss_${dateFrom}_${dateTo}.xlsx`);
};

// ── Bills ─────────────────────────────────────────────────────────────────────

export const exportBills = (bills: Bill[], exportDate: string) => {
    const rows = bills.map(b => ({
        'Bill #':       b.bill_number,
        'Type':         b.bill_type,
        'Vendor':       b.vendor_name ?? '',
        'PO Ref':       b.po_reference ?? '',
        'Date':         b.bill_date,
        'Due Date':     b.due_date ?? '',
        'Description':  b.description,
        'Status':       b.status,
        'Total ($)':    fmt2(b.total_amount),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 36 }, { wch: 8 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bills');
    saveWorkbook(wb, `LPT_Bills_${exportDate}.xlsx`);
};

// ── Bill Vendors ──────────────────────────────────────────────────────────────

export const exportBillVendors = (vendors: BillVendor[], exportDate: string) => {
    const rows = vendors.map(v => ({
        'Vendor Name':       v.vendor_name,
        'Type':              v.vendor_type,
        'Status':            v.status,
        'Contact':           v.contact_person,
        'Phone':             v.phone,
        'Email':             v.email,
        'Tax ID':            v.tax_id,
        'Default Account':   v.default_expense_account,
        'Payment Terms':     v.payment_terms,
        'Bank Name':         v.bank_name,
        'Bank Account':      v.bank_account,
        'Address':           v.address,
        'Notes':             v.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 30 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bill Vendors');
    saveWorkbook(wb, `LPT_BillVendors_${exportDate}.xlsx`);
};
