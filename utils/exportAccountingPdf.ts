import type { BalanceSheetLine } from '../types';

// ── Shared data types (mirrors AccountingDashboard local aliases) ──────────────

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

// ── Color palette ─────────────────────────────────────────────────────────────

type RGB = [number, number, number];

const NAVY:   RGB = [26,  56,  96];   // section headers + grand totals
const SUBT:   RGB = [209, 225, 246];  // subtotal rows
const ALT:    RGB = [246, 250, 255];  // alternating account rows
const WHITE:  RGB = [255, 255, 255];
const BODY:   RGB = [28,  40,  58];   // main text
const MUTED:  RGB = [100, 116, 139];  // secondary text / account numbers
const LINE:   RGB = [203, 213, 225];  // dividers

const MARGIN = 15; // mm

// ── Formatters ────────────────────────────────────────────────────────────────

const cur = (n: number): string => {
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `(${s})` : s;
};

const fmtDate = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return d; }
};

const fmtMonth = (m: string) => {
    try { return new Date(m + '-01T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }); }
    catch { return m; }
};

// ── Page helpers ──────────────────────────────────────────────────────────────

/** Draw company/title block. Returns Y position to start the table. */
const drawTitle = (doc: any, reportName: string, dateStr: string, pageW: number): number => {
    const cx = pageW / 2;
    let y = MARGIN + 2;

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text('LIMPERIAL TECHNOLOGY CO., LTD.', cx, y, { align: 'center' });
    y += 8;

    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BODY[0], BODY[1], BODY[2]);
    doc.text(reportName, cx, y, { align: 'center' });
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(dateStr, cx, y, { align: 'center' });
    y += 6;

    doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += 6;

    return y;
};

/** Stamp footer on every page after table is drawn. */
const addFooters = (doc: any, pageH: number, pageW: number) => {
    const total = doc.getNumberOfPages();
    const gen = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        const fy = pageH - 8;
        doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, fy - 3, pageW - MARGIN, fy - 3);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(`Generated: ${gen}`, MARGIN, fy);
        doc.text(`Page ${i} / ${total}`, pageW - MARGIN, fy, { align: 'right' });
    }
};

// ── Cell / row builders ───────────────────────────────────────────────────────

type CellDef = { content: string | number; colSpan?: number; styles?: Record<string, any> };
type PDFRow  = (string | number | CellDef)[];

/** Full-width navy section header */
const secRow = (text: string, nc: number): PDFRow => [{
    content: text, colSpan: nc,
    styles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 9,
               cellPadding: { top: 4, bottom: 4, left: 6, right: 4 } },
}];

/** Account detail row (2 or 3 cells) */
const accRow3 = (accNo: string, name: string, amount: number, alt: boolean): PDFRow => [
    { content: accNo,       styles: { textColor: MUTED, fontSize: 8,  fillColor: alt ? ALT : WHITE } },
    { content: name,        styles: { fontSize: 9,                    fillColor: alt ? ALT : WHITE } },
    { content: cur(amount), styles: { halign: 'right', fontSize: 9,   fillColor: alt ? ALT : WHITE } },
];

/** Subtotal row (Total Section) */
const subtRow3 = (label: string, amount: number): PDFRow => [
    { content: '',                  styles: { fillColor: SUBT } },
    { content: `Total ${label}`,    styles: { fillColor: SUBT, fontStyle: 'bold', fontSize: 9 } },
    { content: cur(amount),         styles: { fillColor: SUBT, fontStyle: 'bold', halign: 'right', fontSize: 9 } },
];

/** Grand total row — navy bg full width */
const grandRow3 = (label: string, amount: number): PDFRow => [
    { content: label,       colSpan: 2, styles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 10 } },
    { content: cur(amount),             styles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', halign: 'right', fontSize: 10 } },
];

const blankRow = (nc: number): PDFRow => [
    { content: '', colSpan: nc, styles: { fillColor: WHITE, minCellHeight: 2 } },
];

// ── Zero-filter helpers ───────────────────────────────────────────────────────

/** Filter a BalanceSheetLine list, excluding zero balances when hideZeros=true */
const filt = (ls: BalanceSheetLine[], hideZeros: boolean) =>
    hideZeros ? ls.filter(l => Math.abs(l.balance) > 0.005) : ls;

/** For compare data: keep account only if at least one month is non-zero */
const filtCompare = (
    accts: BalanceSheetLine[],
    getter: (d: any) => BalanceSheetLine[],
    items: { data: any }[],
    hideZeros: boolean,
): BalanceSheetLine[] => {
    if (!hideZeros) return accts;
    return accts.filter(acct =>
        items.some(i => {
            const l = getter(i.data).find((x: BalanceSheetLine) => x.account_number === acct.account_number);
            return l && Math.abs(l.balance) > 0.005;
        }),
    );
};

/** For CF compare: keep item if at least one month is non-zero */
const filtCFCompare = (
    items2: { account_number: string; account_name: string; amount: number }[],
    months: { data: CFData }[],
    list: 'operatingAdjustments' | 'investingItems' | 'financingItems',
    hideZeros: boolean,
) => {
    if (!hideZeros) return items2;
    return items2.filter(a =>
        months.some(m => {
            const x = m.data[list].find(i => i.account_number === a.account_number);
            return x && Math.abs(x.amount) > 0.005;
        }),
    );
};

// ── Balance Sheet body ────────────────────────────────────────────────────────

const bsBody = (bs: BSData, hideZeros: boolean): PDFRow[] => {
    const r: PDFRow[] = [];

    r.push(secRow('ASSETS', 3));
    filt(bs.assets, hideZeros).forEach((l, i) => r.push(accRow3(l.account_number, l.account_name, l.balance, i % 2 === 1)));
    r.push(subtRow3('Assets', bs.totalAssets));
    r.push(blankRow(3));

    r.push(secRow('LIABILITIES', 3));
    filt(bs.liabilities, hideZeros).forEach((l, i) => r.push(accRow3(l.account_number, l.account_name, l.balance, i % 2 === 1)));
    r.push(subtRow3('Liabilities', bs.totalLiabilities));
    r.push(blankRow(3));

    r.push(secRow('EQUITY', 3));
    filt(bs.equity, hideZeros).forEach((l, i) => r.push(accRow3(l.account_number, l.account_name, l.balance, i % 2 === 1)));
    r.push([
        { content: '',                            styles: { fillColor: ALT } },
        { content: 'Net Income (Current Period)', styles: { fillColor: ALT, fontSize: 9, fontStyle: 'italic' } },
        { content: cur(bs.netIncome),             styles: { fillColor: ALT, halign: 'right', fontSize: 9 } },
    ]);
    r.push(subtRow3('Equity', bs.totalEquity));
    r.push(blankRow(3));

    r.push(grandRow3('LIABILITIES + EQUITY', bs.totalLiabilities + bs.totalEquity));
    return r;
};

// ── Cash Flow body ────────────────────────────────────────────────────────────

const cfBody = (cf: CFData, hideZeros: boolean): PDFRow[] => {
    const r: PDFRow[] = [];

    const cfAcc = (code: string, name: string, amount: number, alt: boolean): PDFRow => [
        { content: code,        styles: { textColor: MUTED, fontSize: 8,  fillColor: alt ? ALT : WHITE } },
        { content: name,        styles: { fontSize: 9,                    fillColor: alt ? ALT : WHITE } },
        { content: cur(amount), styles: { halign: 'right', fontSize: 9,   fillColor: alt ? ALT : WHITE } },
    ];
    const cfSub = (label: string, amount: number): PDFRow => [
        { content: '',      styles: { fillColor: SUBT } },
        { content: label,   styles: { fillColor: SUBT, fontStyle: 'bold', fontSize: 9 } },
        { content: cur(amount), styles: { fillColor: SUBT, fontStyle: 'bold', halign: 'right', fontSize: 9 } },
    ];

    const filtCF = (ls: typeof cf.operatingAdjustments) =>
        hideZeros ? ls.filter(i => Math.abs(i.amount) > 0.005) : ls;

    r.push(secRow('OPERATING ACTIVITIES', 3));
    r.push(cfAcc('', 'Net Income', cf.netIncome, false));
    filtCF(cf.operatingAdjustments).forEach((i, idx) => r.push(cfAcc(i.account_number, i.account_name, i.amount, idx % 2 === 1)));
    r.push(cfSub('Net Cash from Operating Activities', cf.netOperating));
    r.push(blankRow(3));

    r.push(secRow('INVESTING ACTIVITIES', 3));
    const visibleInvest = filtCF(cf.investingItems);
    if (visibleInvest.length === 0) r.push([{ content: '—  No investing activity', colSpan: 3, styles: { fillColor: WHITE, textColor: MUTED, fontSize: 8.5, cellPadding: { left: 12 } } }]);
    visibleInvest.forEach((i, idx) => r.push(cfAcc(i.account_number, i.account_name, i.amount, idx % 2 === 1)));
    r.push(cfSub('Net Cash from Investing Activities', cf.netInvesting));
    r.push(blankRow(3));

    r.push(secRow('FINANCING ACTIVITIES', 3));
    const visibleFin = filtCF(cf.financingItems);
    if (visibleFin.length === 0) r.push([{ content: '—  No financing activity', colSpan: 3, styles: { fillColor: WHITE, textColor: MUTED, fontSize: 8.5, cellPadding: { left: 12 } } }]);
    visibleFin.forEach((i, idx) => r.push(cfAcc(i.account_number, i.account_name, i.amount, idx % 2 === 1)));
    r.push(cfSub('Net Cash from Financing Activities', cf.netFinancing));
    r.push(blankRow(3));

    r.push(secRow('CASH SUMMARY', 3));
    r.push(cfAcc('', 'Beginning Cash Balance', cf.beginningCash, false));
    r.push(cfAcc('', 'Net Cash Change', cf.netCashChange, true));
    r.push(grandRow3('ENDING CASH BALANCE', cf.endingCash));

    return r;
};

// ── Profit & Loss body ────────────────────────────────────────────────────────

const plBody = (pl: PLData, hideZeros: boolean): PDFRow[] => {
    const r: PDFRow[] = [];

    const plAlt = (ls: BalanceSheetLine[], startIdx = 0) =>
        filt(ls, hideZeros).forEach((l, i) => r.push(accRow3(l.account_number, l.account_name, l.balance, (i + startIdx) % 2 === 1)));

    const midRow = (label: string, amount: number): PDFRow => [
        { content: label,       colSpan: 2, styles: { fillColor: SUBT, fontStyle: 'bold', fontSize: 9.5 } },
        { content: cur(amount),             styles: { fillColor: SUBT, fontStyle: 'bold', halign: 'right', fontSize: 9.5 } },
    ];

    r.push(secRow('REVENUE', 3));
    plAlt(pl.income);
    r.push(subtRow3('Revenue', pl.totalRevenue));
    r.push(blankRow(3));

    r.push(secRow('COST OF GOODS SOLD', 3));
    plAlt(pl.cogs);
    r.push(subtRow3('Cost of Goods Sold', pl.totalCogs));
    r.push(blankRow(3));

    r.push(midRow('GROSS PROFIT', pl.grossProfit));
    r.push(blankRow(3));

    r.push(secRow('OPERATING EXPENSES', 3));
    plAlt(pl.expenses);
    r.push(subtRow3('Operating Expenses', pl.totalExpenses));
    r.push(blankRow(3));

    r.push(midRow('OPERATING INCOME', pl.operatingIncome));
    r.push(blankRow(3));

    if (pl.otherIncome.length > 0) {
        r.push(secRow('OTHER INCOME', 3));
        plAlt(pl.otherIncome);
        r.push(subtRow3('Other Income', pl.totalOtherIncome));
        r.push(blankRow(3));
    }
    if (pl.otherExpenses.length > 0) {
        r.push(secRow('OTHER EXPENSES', 3));
        plAlt(pl.otherExpenses);
        r.push(subtRow3('Other Expenses', pl.totalOtherExpenses));
        r.push(blankRow(3));
    }

    r.push(grandRow3('NET INCOME', pl.netIncome));
    return r;
};

// ── Core PDF generator ────────────────────────────────────────────────────────

interface PDFConfig {
    orientation: 'portrait' | 'landscape';
    reportName: string;
    dateStr: string;
    headers: string[];
    body: PDFRow[];
    colStyles: Record<number, any>;
    filename: string;
}

const buildPDF = async (cfg: PDFConfig) => {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ]);

    const isLandscape = cfg.orientation === 'landscape';
    const doc          = new jsPDF({ orientation: cfg.orientation, format: 'a4', unit: 'mm' });
    const pageW        = isLandscape ? 297 : 210;
    const pageH        = isLandscape ? 210 : 297;
    const contentW     = pageW - MARGIN * 2;

    const startY = drawTitle(doc, cfg.reportName, cfg.dateStr, pageW);

    autoTable(doc, {
        startY,
        head:  [cfg.headers],
        body:  cfg.body as any,
        theme: 'plain',
        margin: { left: MARGIN, right: MARGIN, top: MARGIN + 10, bottom: 14 },
        tableWidth: contentW,
        styles: {
            font:        'helvetica',
            fontSize:    9,
            textColor:   BODY,
            cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 4 },
            overflow:    'linebreak',
        },
        headStyles: {
            fillColor:   NAVY,
            textColor:   WHITE,
            fontStyle:   'bold',
            fontSize:    9,
            cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 4 },
        },
        columnStyles: cfg.colStyles,
        showHead: 'everyPage',
        didDrawPage: (data: any) => {
            if (data.pageNumber > 1) {
                const cy = MARGIN + 4;
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
                doc.text(`${cfg.reportName} — continued`, pageW / 2, cy, { align: 'center' });
                doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
                doc.setLineWidth(0.3);
                doc.line(MARGIN, cy + 3, pageW - MARGIN, cy + 3);
            }
        },
    });

    addFooters(doc, pageH, pageW);
    doc.save(cfg.filename);
};

// ── Compare-months helpers ────────────────────────────────────────────────────

const compSec = (text: string, nc: number): PDFRow => [{
    content: text, colSpan: nc,
    styles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 9,
               cellPadding: { top: 4, bottom: 4, left: 6, right: 4 } },
}];

const compAcc = (label: string, amounts: number[], alt: boolean): PDFRow => [
    { content: label, styles: { fontSize: 8.5, fillColor: alt ? ALT : WHITE } },
    ...amounts.map(a => ({ content: cur(a), styles: { halign: 'right', fontSize: 8.5, fillColor: alt ? ALT : WHITE } as any })),
];

const compSubt = (label: string, amounts: number[]): PDFRow => [
    { content: `Total ${label}`, styles: { fillColor: SUBT, fontStyle: 'bold', fontSize: 9 } },
    ...amounts.map(a => ({ content: cur(a), styles: { fillColor: SUBT, fontStyle: 'bold', halign: 'right', fontSize: 9 } as any })),
];

const compGrand = (label: string, amounts: number[]): PDFRow => [
    { content: label, styles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 10 } },
    ...amounts.map(a => ({ content: cur(a), styles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', halign: 'right', fontSize: 10 } as any })),
];

const compBlank = (nc: number): PDFRow => [{ content: '', colSpan: nc, styles: { fillColor: WHITE, minCellHeight: 2 } }];

/** Collect unique accounts across all months for a given section getter */
const uniqAccts = <T>(items: { data: T }[], getter: (d: T) => BalanceSheetLine[]): BalanceSheetLine[] =>
    [...new Map(items.flatMap(i => getter(i.data).map(l => [l.account_number, l]))).values()];

/** Pick orientation based on column count */
const orient = (n: number): 'portrait' | 'landscape' => n > 3 ? 'landscape' : 'portrait';

// ── BS compare body ───────────────────────────────────────────────────────────

const bsCompareBody = (items: BSMultiItem[], hideZeros: boolean): PDFRow[] => {
    const NC = 1 + items.length;
    const r: PDFRow[] = [];
    const vals = (getter: (d: BSData) => number) => items.map(i => getter(i.data));
    const acctVals = (acct: BalanceSheetLine, getter: (d: BSData) => BalanceSheetLine[]) =>
        items.map(i => { const l = getter(i.data).find(x => x.account_number === acct.account_number); return l?.balance ?? 0; });
    const fc = (accts: BalanceSheetLine[], getter: (d: BSData) => BalanceSheetLine[]) =>
        filtCompare(accts, getter as (d: any) => BalanceSheetLine[], items, hideZeros);

    r.push(compSec('ASSETS', NC));
    fc(uniqAccts(items, d => d.assets), d => d.assets).forEach((a, i) => r.push(compAcc(`${a.account_number} · ${a.account_name}`, acctVals(a, d => d.assets), i % 2 === 1)));
    r.push(compSubt('Assets', vals(d => d.totalAssets)));
    r.push(compBlank(NC));

    r.push(compSec('LIABILITIES', NC));
    fc(uniqAccts(items, d => d.liabilities), d => d.liabilities).forEach((a, i) => r.push(compAcc(`${a.account_number} · ${a.account_name}`, acctVals(a, d => d.liabilities), i % 2 === 1)));
    r.push(compSubt('Liabilities', vals(d => d.totalLiabilities)));
    r.push(compBlank(NC));

    r.push(compSec('EQUITY', NC));
    fc(uniqAccts(items, d => d.equity), d => d.equity).forEach((a, i) => r.push(compAcc(`${a.account_number} · ${a.account_name}`, acctVals(a, d => d.equity), i % 2 === 1)));
    r.push([
        { content: 'Net Income (Current Period)', styles: { fillColor: ALT, fontStyle: 'italic', fontSize: 8.5 } },
        ...items.map(i => ({ content: cur(i.data.netIncome), styles: { fillColor: ALT, halign: 'right', fontSize: 8.5 } as any })),
    ]);
    r.push(compSubt('Equity', vals(d => d.totalEquity)));
    r.push(compBlank(NC));

    r.push(compGrand('LIABILITIES + EQUITY', items.map(i => i.data.totalLiabilities + i.data.totalEquity)));
    return r;
};

// ── CF compare body ───────────────────────────────────────────────────────────

const cfCompareBody = (items: CFMultiItem[], hideZeros: boolean): PDFRow[] => {
    const NC = 1 + items.length;
    const r: PDFRow[] = [];
    const vals = (getter: (d: CFData) => number) => items.map(i => getter(i.data));

    const allOper   = filtCFCompare([...new Map(items.flatMap(i => i.data.operatingAdjustments.map(x => [x.account_number, x]))).values()], items, 'operatingAdjustments', hideZeros);
    const allInvest = filtCFCompare([...new Map(items.flatMap(i => i.data.investingItems.map(x => [x.account_number, x]))).values()], items, 'investingItems', hideZeros);
    const allFin    = filtCFCompare([...new Map(items.flatMap(i => i.data.financingItems.map(x => [x.account_number, x]))).values()], items, 'financingItems', hideZeros);

    const getAmt = (list: 'operatingAdjustments' | 'investingItems' | 'financingItems', accNo: string) =>
        items.map(i => { const x = i.data[list].find(a => a.account_number === accNo); return x?.amount ?? 0; });

    r.push(compSec('OPERATING ACTIVITIES', NC));
    r.push(compAcc('Net Income', vals(d => d.netIncome), false));
    allOper.forEach((a, i) => r.push(compAcc(`${a.account_number} · ${a.account_name}`, getAmt('operatingAdjustments', a.account_number), i % 2 === 1)));
    r.push(compSubt('Net Operating Cash', vals(d => d.netOperating)));
    r.push(compBlank(NC));

    r.push(compSec('INVESTING ACTIVITIES', NC));
    if (allInvest.length === 0) r.push([{ content: '—  No investing activity', colSpan: NC, styles: { fillColor: WHITE, textColor: MUTED, fontSize: 8.5, cellPadding: { left: 10 } } }]);
    allInvest.forEach((a, i) => r.push(compAcc(`${a.account_number} · ${a.account_name}`, getAmt('investingItems', a.account_number), i % 2 === 1)));
    r.push(compSubt('Net Investing Cash', vals(d => d.netInvesting)));
    r.push(compBlank(NC));

    r.push(compSec('FINANCING ACTIVITIES', NC));
    if (allFin.length === 0) r.push([{ content: '—  No financing activity', colSpan: NC, styles: { fillColor: WHITE, textColor: MUTED, fontSize: 8.5, cellPadding: { left: 10 } } }]);
    allFin.forEach((a, i) => r.push(compAcc(`${a.account_number} · ${a.account_name}`, getAmt('financingItems', a.account_number), i % 2 === 1)));
    r.push(compSubt('Net Financing Cash', vals(d => d.netFinancing)));
    r.push(compBlank(NC));

    r.push(compSec('CASH POSITION', NC));
    r.push(compAcc('Beginning Cash', vals(d => d.beginningCash), false));
    r.push(compAcc('Net Cash Change', vals(d => d.netCashChange), true));
    r.push(compGrand('ENDING CASH BALANCE', vals(d => d.endingCash)));

    return r;
};

// ── PL compare body ───────────────────────────────────────────────────────────

const plCompareBody = (items: PLMultiItem[], hideZeros: boolean): PDFRow[] => {
    const NC = 1 + items.length;
    const r: PDFRow[] = [];
    const vals = (getter: (d: PLData) => number) => items.map(i => getter(i.data));
    const acctVals = (acct: BalanceSheetLine, getter: (d: PLData) => BalanceSheetLine[]) =>
        items.map(i => { const l = getter(i.data).find(x => x.account_number === acct.account_number); return l?.balance ?? 0; });
    const fc = (accts: BalanceSheetLine[], getter: (d: PLData) => BalanceSheetLine[]) =>
        filtCompare(accts, getter as (d: any) => BalanceSheetLine[], items, hideZeros);

    const plMid = (label: string, totals: number[]): PDFRow => [
        { content: label, styles: { fillColor: SUBT, fontStyle: 'bold', fontSize: 9.5 } },
        ...totals.map(a => ({ content: cur(a), styles: { fillColor: SUBT, fontStyle: 'bold', halign: 'right', fontSize: 9.5 } as any })),
    ];

    r.push(compSec('REVENUE', NC));
    fc(uniqAccts(items, d => d.income), d => d.income).forEach((a, i) => r.push(compAcc(`${a.account_number} · ${a.account_name}`, acctVals(a, d => d.income), i % 2 === 1)));
    r.push(compSubt('Revenue', vals(d => d.totalRevenue)));
    r.push(compBlank(NC));

    r.push(compSec('COST OF GOODS SOLD', NC));
    fc(uniqAccts(items, d => d.cogs), d => d.cogs).forEach((a, i) => r.push(compAcc(`${a.account_number} · ${a.account_name}`, acctVals(a, d => d.cogs), i % 2 === 1)));
    r.push(compSubt('Cost of Goods Sold', vals(d => d.totalCogs)));
    r.push(compBlank(NC));

    r.push(plMid('GROSS PROFIT', vals(d => d.grossProfit)));
    r.push(compBlank(NC));

    r.push(compSec('OPERATING EXPENSES', NC));
    fc(uniqAccts(items, d => d.expenses), d => d.expenses).forEach((a, i) => r.push(compAcc(`${a.account_number} · ${a.account_name}`, acctVals(a, d => d.expenses), i % 2 === 1)));
    r.push(compSubt('Operating Expenses', vals(d => d.totalExpenses)));
    r.push(compBlank(NC));

    r.push(plMid('OPERATING INCOME', vals(d => d.operatingIncome)));
    r.push(compBlank(NC));

    const anyOtherInc  = items.some(i => i.data.otherIncome.length > 0);
    const anyOtherExp  = items.some(i => i.data.otherExpenses.length > 0);
    if (anyOtherInc) {
        r.push(compSec('OTHER INCOME', NC));
        fc(uniqAccts(items, d => d.otherIncome), d => d.otherIncome).forEach((a, i) => r.push(compAcc(`${a.account_number} · ${a.account_name}`, acctVals(a, d => d.otherIncome), i % 2 === 1)));
        r.push(compSubt('Other Income', vals(d => d.totalOtherIncome)));
        r.push(compBlank(NC));
    }
    if (anyOtherExp) {
        r.push(compSec('OTHER EXPENSES', NC));
        fc(uniqAccts(items, d => d.otherExpenses), d => d.otherExpenses).forEach((a, i) => r.push(compAcc(`${a.account_number} · ${a.account_name}`, acctVals(a, d => d.otherExpenses), i % 2 === 1)));
        r.push(compSubt('Other Expenses', vals(d => d.totalOtherExpenses)));
        r.push(compBlank(NC));
    }

    r.push(compGrand('NET INCOME', vals(d => d.netIncome)));
    return r;
};

// ── Column styles for compare ─────────────────────────────────────────────────

const compareColStyles = (n: number, contentW: number): Record<number, any> => {
    const nameW  = Math.min(80, contentW * 0.35);
    const monthW = (contentW - nameW) / n;
    const styles: Record<number, any> = { 0: { cellWidth: nameW } };
    for (let i = 1; i <= n; i++) styles[i] = { cellWidth: monthW, halign: 'right' };
    return styles;
};

// ── Public API ────────────────────────────────────────────────────────────────

// Balance Sheet — single date
export const printBSPdf = (bsData: BSData, asOfDate: string, hideZeros = false) =>
    buildPDF({
        orientation: 'portrait',
        reportName:  'Balance Sheet',
        dateStr:     `As of ${fmtDate(asOfDate)}`,
        headers:     ['Account #', 'Account Name', 'Balance ($)'],
        body:        bsBody(bsData, hideZeros),
        colStyles:   { 0: { cellWidth: 20 }, 2: { cellWidth: 35, halign: 'right' } },
        filename:    `LPT_BalanceSheet_${asOfDate}.pdf`,
    });

// Balance Sheet — compare months
export const printBSComparePdf = (items: BSMultiItem[], monthFrom: string, monthTo: string, hideZeros = false) => {
    const n   = items.length;
    const o   = orient(n);
    const cw  = (o === 'landscape' ? 267 : 180) - MARGIN;
    return buildPDF({
        orientation: o,
        reportName:  'Balance Sheet',
        dateStr:     `${fmtMonth(monthFrom)} through ${fmtMonth(monthTo)}`,
        headers:     ['Account', ...items.map(i => i.label)],
        body:        bsCompareBody(items, hideZeros),
        colStyles:   compareColStyles(n, cw),
        filename:    `LPT_BalanceSheet_${monthFrom}_${monthTo}.pdf`,
    });
};

// Cash Flow — single period
export const printCFPdf = (cfData: CFData, dateFrom: string, dateTo: string, hideZeros = false) =>
    buildPDF({
        orientation: 'portrait',
        reportName:  'Statement of Cash Flows',
        dateStr:     `${fmtDate(dateFrom)} through ${fmtDate(dateTo)}`,
        headers:     ['Code', 'Description', 'Amount ($)'],
        body:        cfBody(cfData, hideZeros),
        colStyles:   { 0: { cellWidth: 18 }, 2: { cellWidth: 38, halign: 'right' } },
        filename:    `LPT_CashFlow_${dateFrom}_${dateTo}.pdf`,
    });

// Cash Flow — compare months
export const printCFComparePdf = (items: CFMultiItem[], monthFrom: string, monthTo: string, hideZeros = false) => {
    const n  = items.length;
    const o  = orient(n);
    const cw = (o === 'landscape' ? 267 : 180) - MARGIN;
    return buildPDF({
        orientation: o,
        reportName:  'Statement of Cash Flows',
        dateStr:     `${fmtMonth(monthFrom)} through ${fmtMonth(monthTo)}`,
        headers:     ['Description', ...items.map(i => i.label)],
        body:        cfCompareBody(items, hideZeros),
        colStyles:   compareColStyles(n, cw),
        filename:    `LPT_CashFlow_${monthFrom}_${monthTo}.pdf`,
    });
};

// Profit & Loss — single period
export const printPLPdf = (plData: PLData, dateFrom: string, dateTo: string, hideZeros = false) =>
    buildPDF({
        orientation: 'portrait',
        reportName:  'Profit & Loss',
        dateStr:     `${fmtDate(dateFrom)} through ${fmtDate(dateTo)}`,
        headers:     ['Account #', 'Account Name', 'Amount ($)'],
        body:        plBody(plData, hideZeros),
        colStyles:   { 0: { cellWidth: 20 }, 2: { cellWidth: 35, halign: 'right' } },
        filename:    `LPT_ProfitLoss_${dateFrom}_${dateTo}.pdf`,
    });

// Profit & Loss — compare months
export const printPLComparePdf = (items: PLMultiItem[], monthFrom: string, monthTo: string, hideZeros = false) => {
    const n  = items.length;
    const o  = orient(n);
    const cw = (o === 'landscape' ? 267 : 180) - MARGIN;
    return buildPDF({
        orientation: o,
        reportName:  'Profit & Loss',
        dateStr:     `${fmtMonth(monthFrom)} through ${fmtMonth(monthTo)}`,
        headers:     ['Account', ...items.map(i => i.label)],
        body:        plCompareBody(items, hideZeros),
        colStyles:   compareColStyles(n, cw),
        filename:    `LPT_ProfitLoss_${monthFrom}_${monthTo}.pdf`,
    });
};
