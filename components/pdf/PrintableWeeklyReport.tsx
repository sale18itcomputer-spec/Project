import React from 'react';
import { SaleOrder, Quotation, Invoice, ContactLog, SiteSurveyLog } from '../../types';
import { buildFuzzyQuoteMap } from '../../utils/matchQuoteToSO';

interface PrintableWeeklyReportProps {
    saleOrders: SaleOrder[];
    quotations?: Quotation[];
    invoices?: Invoice[];
    contactLogs?: ContactLog[];
    siteSurveys?: SiteSurveyLog[];
    preparedBy?: string;
    reportMonth?: string;
    weekStart?: Date;
}

interface DealRow {
    _key: string;
    _winPct?: string;
    'Company Name': string;
    'Quote No': string;
    'SO No Display': string;
    'SO No': string;
    'Sub Date': string;
    'Follow Up': string;
    'ItemsJSON': any;
    'Total Amount': string;
    'Currency': string;
    'Status': string;
    'Remark': string;
}

const fmt = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const parseItems = (raw: any): string => {
    if (typeof raw === 'string' && !raw.startsWith('[') && !raw.startsWith('{')) return raw;
    try {
        const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(items)) {
            return items
                .map((i: any) => {
                    const name = i.modelName || i.Model || i.Description || i.description || i.Code || i.itemCode || '';
                    const qty = i.qty || i.Qty || 1;
                    return name ? `${name} (${qty}units)` : '';
                })
                .filter(Boolean)
                .join(', ');
        }
    } catch { /* ignore */ }
    return '';
};

const _normaliseStatus = (so: SaleOrder | null, q: Quotation | null): string => {
    if (so) {
        if (so.Status === 'Completed') return 'Won';
        if (so.Status === 'Cancel') return 'Lost';
        return 'Followup';
    }
    if (q) {
        if (q.Status === 'Close (Win)') return 'Won';
        if (q.Status === 'Close (Lose)' || q.Status === 'Cancel') return 'Lost';
        if (q.Status === 'Open') return 'Pending';
        return 'Followup';
    }
    return 'Followup';
};

const winPctFromRow = (row: DealRow): string => {
    if (row._winPct) return row._winPct;
    if (row.Status === 'Won') return '>75%';
    if (row.Status === 'Lost') return '0%';
    return '50%';
};

const _isClosedOrLost = (status: string) => status === 'Won' || status === 'Lost';

// ── Customer List table (Contact Logs) ──────────────────────────────────────
const CustomerListTable: React.FC<{ rows: ContactLog[] }> = ({ rows }) => (
    <div style={{ marginBottom: 16, pageBreakInside: 'avoid' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
                <tr><th colSpan={8} style={{ ...thStyle, fontSize: 10, letterSpacing: 1, padding: '7px 6px' }}>CUSTOMER LIST</th></tr>
                <tr>{['No.', 'COMPANY NAME', 'CONTACT NAME', 'PHONE', 'POSITION', 'OPPORTUNITY NAME', 'HAPPEN', 'REMARK'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
                {rows.length === 0
                    ? <tr><td colSpan={8} style={{ ...tdBase, textAlign: 'center', color: '#888', fontStyle: 'italic' }}>No records</td></tr>
                    : rows.map((r, i) => {
                        const bg = i % 2 === 0 ? '#f4f7fc' : '#ffffff';
                        return (
                            <tr key={r['Log ID'] || i} style={{ background: bg }}>
                                <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700, background: bg }}>{i + 1}</td>
                                <td style={{ ...tdBase, fontWeight: 600, wordBreak: 'break-word', background: bg }}>{r['Company Name'] || ''}</td>
                                <td style={{ ...tdBase, background: bg }}>{r['Contact Name'] || ''}</td>
                                <td style={{ ...tdBase, textAlign: 'center', background: bg }}>{r['Phone Number'] || ''}</td>
                                <td style={{ ...tdBase, background: bg }}>{r['Position'] || ''}</td>
                                <td style={{ ...tdBase, wordBreak: 'break-word', background: bg }}>{r['Remarks'] || ''}</td>
                                <td style={{ ...tdBase, textAlign: 'center', background: bg }}>{fmt(r['Contact Date'])}</td>
                                <td style={{ ...tdBase, wordBreak: 'break-word', fontSize: 8, background: bg }}>{r['Type'] || ''}</td>
                            </tr>
                        );
                    })}
            </tbody>
        </table>
    </div>
);

// ── Site Survey table ────────────────────────────────────────────────────────
const SiteSurveyTable: React.FC<{ rows: SiteSurveyLog[] }> = ({ rows }) => (
    <div style={{ marginBottom: 16, pageBreakInside: 'avoid' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
                <tr><th colSpan={8} style={{ ...thStyle, fontSize: 10, letterSpacing: 1, padding: '7px 6px' }}>LOCATION (SITE SURVEY)</th></tr>
                <tr>{['No.', 'LOCATION', 'CONTACT NAME', 'PHONE', 'POSITION', 'OPPORTUNITY NAME', 'HAPPEN', 'REMARK'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
                {rows.length === 0
                    ? <tr><td colSpan={8} style={{ ...tdBase, textAlign: 'center', color: '#888', fontStyle: 'italic' }}>No records</td></tr>
                    : rows.map((r, i) => {
                        const bg = i % 2 === 0 ? '#f4f7fc' : '#ffffff';
                        return (
                            <tr key={r['Site ID'] || i} style={{ background: bg }}>
                                <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700, background: bg }}>{i + 1}</td>
                                <td style={{ ...tdBase, fontWeight: 600, wordBreak: 'break-word', background: bg }}>{r['Location'] || ''}</td>
                                <td style={{ ...tdBase, background: bg }}>{r['Responsible By'] || ''}</td>
                                <td style={{ ...tdBase, textAlign: 'center', background: bg }}>{(r as any)['Phone'] || (r as any)['Phone Number'] || ''}</td>
                                <td style={{ ...tdBase, background: bg }}>{(r as any)['Position'] || ''}</td>
                                <td style={{ ...tdBase, wordBreak: 'break-word', background: bg }}>{(r as any)['Opportunity'] || (r as any)['Remarks'] || ''}</td>
                                <td style={{ ...tdBase, textAlign: 'center', background: bg }}>{fmt(r['Date'])}</td>
                                <td style={{ ...tdBase, wordBreak: 'break-word', fontSize: 8, background: bg }}>{r['Remark'] || ''}</td>
                            </tr>
                        );
                    })}
            </tbody>
        </table>
    </div>
);

const BLUE = '#004AAD';
const LIGHT_BLUE = '#D6E4F7';

const thStyle: React.CSSProperties = {
    background: BLUE,
    color: '#fff',
    padding: '6px 5px',
    fontWeight: 700,
    fontSize: 9,
    textAlign: 'center',
    border: '1px solid #B0C4DE',
    whiteSpace: 'nowrap',
};

const tdBase: React.CSSProperties = {
    padding: '5px 5px',
    fontSize: 9,
    border: '1px solid #dde3ed',
    verticalAlign: 'middle',
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const cfg: Record<string, { bg: string; color: string }> = {
        Won:      { bg: '#c6efce', color: '#276221' },
        Followup: { bg: '#ffeb9c', color: '#9c5700' },
        Pending:  { bg: '#dce6f7', color: '#004AAD' },
        Lost:     { bg: '#ffffff', color: '#333333' },
    };
    const c = cfg[status] ?? { bg: '#fff', color: '#333' };
    return (
        <span style={{
            display: 'inline-block',
            background: c.bg,
            color: c.color,
            borderRadius: 3,
            padding: '2px 8px',
            fontWeight: 700,
            fontSize: 9,
            border: status === 'Lost' ? '1px solid #ccc' : 'none',
        }}>{status}</span>
    );
};

const WinBadge: React.FC<{ pct: string; status: string }> = ({ pct, status }) => {
    if (status === 'Lost') return <span style={{ fontSize: 9, color: '#999' }}></span>;
    return (
        <span style={{
            display: 'inline-block',
            background: '#c6efce',
            color: '#276221',
            borderRadius: 3,
            padding: '2px 6px',
            fontWeight: 700,
            fontSize: 9,
        }}>{pct}</span>
    );
};

const COL_COUNT = 10;

const DealTable: React.FC<{ title: string; rows: DealRow[] }> = ({ title, rows }) => (
    <div style={{ marginBottom: 16, pageBreakInside: 'avoid' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
                <tr>
                    <th colSpan={COL_COUNT} style={{ ...thStyle, fontSize: 10, letterSpacing: 1, padding: '7px 6px' }}>{title}</th>
                </tr>
                <tr>
                    {['No.', 'PREVIOUS DEAL', 'QUOTE No.', 'SO No.', 'SUB.DATE', 'FOLLOW UP', 'ITEM DESCRIPTION', 'STATUS', 'WIN %', 'REMARK'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr>
                        <td colSpan={COL_COUNT} style={{ ...tdBase, textAlign: 'center', color: '#888', fontStyle: 'italic' }}>No records</td>
                    </tr>
                ) : rows.map((row, i) => {
                    const bg = i % 2 === 0 ? '#f4f7fc' : '#ffffff';
                    return (
                        <tr key={row._key} style={{ background: bg }}>
                            <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700, background: bg }}>{i + 1}</td>
                            <td style={{ ...tdBase, fontWeight: 600, wordBreak: 'break-word', background: bg }}>{row['Company Name']}</td>
                            <td style={{ ...tdBase, textAlign: 'center', background: bg }}>{row['Quote No']}</td>
                            <td style={{ ...tdBase, textAlign: 'center', background: bg }}>{row['SO No Display']}</td>
                            <td style={{ ...tdBase, textAlign: 'center', background: bg }}>{fmt(row['Sub Date'])}</td>
                            <td style={{ ...tdBase, textAlign: 'center', background: bg }}>{fmt(row['Follow Up'])}</td>
                            <td style={{ ...tdBase, wordBreak: 'break-word', background: bg }}>{parseItems(row['ItemsJSON'])}</td>
                            <td style={{ ...tdBase, textAlign: 'center', background: bg }}><StatusBadge status={row.Status} /></td>
                            <td style={{ ...tdBase, textAlign: 'center', background: bg }}><WinBadge pct={winPctFromRow(row)} status={row.Status} /></td>
                            <td style={{ ...tdBase, wordBreak: 'break-word', fontSize: 8, background: bg }}>{row['Remark']}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const PrintableWeeklyReport: React.FC<PrintableWeeklyReportProps> = ({
    saleOrders,
    quotations = [],
    invoices = [],
    contactLogs = [],
    siteSurveys = [],
    preparedBy = 'Sales Team',
    reportMonth = '',
    weekStart,
}) => {
    // Invoice lookup by SO No
    const invBySo = new Map<string, string>();
    for (const inv of invoices) {
        if (inv['SO No'] && inv['Inv No']) invBySo.set(inv['SO No'], inv['Inv No']);
    }

    // Build SO lookup by Quote No and by SO No
    const soByQuoteNo = new Map<string, SaleOrder>();
    const soBySONo = new Map<string, SaleOrder>();
    for (const so of saleOrders) {
        if (so['Quote No']) soByQuoteNo.set(so['Quote No'], so);
        if (so['SO No']) soBySONo.set(so['SO No'], so);
    }

    // Fuzzy-match: for SOs with no Quote No, find best matching quotation
    const fuzzyQuoteMap = buildFuzzyQuoteMap(saleOrders, quotations);
    // Reverse: Quote No → SO (from fuzzy matches)
    const fuzzySOByQuoteNo = new Map<string, SaleOrder>();
    for (const [soNo, q] of fuzzyQuoteMap.entries()) {
        const so = soBySONo.get(soNo);
        if (so) fuzzySOByQuoteNo.set(q['Quote No'], so);
    }

    // QUOTATION-FIRST: every row starts from a quotation
    const allRows: DealRow[] = [...quotations]
        .sort((a, b) => new Date(a['Quote Date'] || 0).getTime() - new Date(b['Quote Date'] || 0).getTime())
        .map(q => {
            // Find linked SO: explicit link first, then fuzzy
            const linkedSO = soByQuoteNo.get(q['Quote No']) ?? fuzzySOByQuoteNo.get(q['Quote No']);

            // Status: SO wins if exists, else use quotation status
            let status: string;
            if (linkedSO) {
                if (linkedSO.Status === 'Completed') status = 'Won';
                else if (linkedSO.Status === 'Cancel') status = 'Lost';
                else status = 'Followup';
            } else {
                if (q.Status === 'Close (Win)') status = 'Won';
                else if (q.Status === 'Close (Lose)' || q.Status === 'Cancel') status = 'Lost';
                else status = 'Followup';
            }

            return {
                _key: q['Quote No'],
                _winPct: linkedSO ? (linkedSO as any)['_winPct'] : undefined,
                'Company Name': q['Company Name'] || '',
                'Quote No': q['Quote No'] || '',
                'SO No Display': linkedSO?.['SO No'] || '',
                'SO No': linkedSO?.['SO No'] || '',
                'Sub Date': q['Quote Date'] || '',
                'Follow Up': linkedSO?.['Delivery Date'] || q['Validity Date'] || '',
                'ItemsJSON': linkedSO?.['ItemsJSON'] || q['ItemsJSON'] || '',
                'Total Amount': String(linkedSO?.['Total Amount'] || q['Amount'] || '0'),
                'Currency': linkedSO?.['Currency'] || q['Currency'] || 'USD',
                'Status': status,
                'Remark': linkedSO?.['Remark'] || q['Remark'] || '',
            };
        });

    // SOs with no quotation at all (no Quote No and no fuzzy match) — append as extra rows
    const coveredSONos = new Set<string>();
    for (const q of quotations) {
        const so = soByQuoteNo.get(q['Quote No']);
        if (so) coveredSONos.add(so['SO No']);
    }
    for (const [soNo] of fuzzyQuoteMap.entries()) coveredSONos.add(soNo);

    for (const so of saleOrders) {
        if (coveredSONos.has(so['SO No'])) continue;
        let status: string;
        if (so.Status === 'Completed') status = 'Won';
        else if (so.Status === 'Cancel') status = 'Lost';
        else status = 'Followup';
        allRows.push({
            _key: so['SO No'] || String(Math.random()),
            _winPct: (so as any)['_winPct'],
            'Company Name': so['Company Name'] || '',
            'Quote No': '',
            'SO No Display': so['SO No'] || '',
            'SO No': so['SO No'] || '',
            'Sub Date': so['SO Date'] || '',
            'Follow Up': so['Delivery Date'] || '',
            'ItemsJSON': so['ItemsJSON'] || '',
            'Total Amount': String(so['Total Amount'] || '0'),
            'Currency': so['Currency'] || 'USD',
            'Status': status,
            'Remark': so['Remark'] || '',
        });
    }

    // Use _isPreviousDeal flag set by the dashboard (same override/historic logic as the screen).
    // Fall back to status-based heuristic if the flag is absent (backward compat).
    const prevDeals = allRows.filter(r => {
        const q = quotations.find(q => q['Quote No'] === r['Quote No']);
        if ((q as any)?._isPreviousDeal !== undefined) return (q as any)._isPreviousDeal;
        return r.Status === 'Followup' || r.Status === 'Pending';
    });
    const newDeals  = allRows.filter(r => {
        const q = quotations.find(q => q['Quote No'] === r['Quote No']);
        if ((q as any)?._isPreviousDeal !== undefined) return !(q as any)._isPreviousDeal;
        return r.Status !== 'Followup' && r.Status !== 'Pending';
    });

    const weeklyAmount = allRows
        .filter(r => r.Status === 'Won')
        .reduce((sum, r) => sum + (parseFloat(r['Total Amount']) || 0), 0);

    const formatAmt = (n: number) =>
        `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const dayAmounts: number[] = DAYS.map((_, di) => {
        const targetDate = weekStart ? new Date(weekStart) : null;
        if (targetDate) targetDate.setDate(targetDate.getDate() + di);
        return allRows
            .filter(r => {
                if (r.Status !== 'Won') return false;
                if (!r['Sub Date']) return false;
                const d = new Date(r['Sub Date']);
                if (targetDate) {
                    return d.getFullYear() === targetDate.getFullYear() &&
                        d.getMonth() === targetDate.getMonth() &&
                        d.getDate() === targetDate.getDate();
                }
                const moIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
                return moIdx === di;
            })
            .reduce((sum, r) => sum + (parseFloat(r['Total Amount']) || 0), 0);
    });

    return (
        <>
            <style>{`
                @media print {
                    @page { size: A3 landscape; margin: 10mm; }
                    body { margin: 0; padding: 0; background: white; }
                }
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            `}</style>

            <div className="wr-printable" style={{ fontFamily: "'Century Gothic', 'Calibri', sans-serif", color: '#000', background: '#fff', padding: 20 }}>

                {/* HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${BLUE}`, paddingBottom: 8, marginBottom: 12 }}>
                    <img src="https://i.postimg.cc/RFYdrpBC/Limperial-Technology-Logo01-png(004aad).png" alt="Limperial Technology" style={{ height: 38, width: 'auto' }} />
                    <div style={{ textAlign: 'right', fontSize: 8.5, lineHeight: 1.6 }}>
                        <div style={{ fontWeight: 700, color: BLUE, fontSize: 12 }}>LIMPERIAL TECHNOLOGY CO., LTD.</div>
                        <div>Tel : (+855) 92 218 333 &nbsp;|&nbsp; Email : info@limperialtech.com</div>
                        <div>Address : Building #15, Street Ayeaksamrjean Bo (139), Sangkat Srah Chak, Khan Daun Penh, Phnom Penh, Cambodia.</div>
                    </div>
                </div>

                {/* TITLE */}
                <div style={{ background: BLUE, color: '#fff', textAlign: 'center', fontWeight: 700, fontSize: 14, letterSpacing: 2, padding: '8px 0', marginBottom: 10, borderRadius: 2 }}>
                    WEEKLY CORPORATE SALES REPORT
                </div>

                {/* META ROW */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 20px', background: LIGHT_BLUE, padding: '7px 10px', borderRadius: 2, marginBottom: 10, fontSize: 9 }}>
                    <div>
                        <div style={{ fontWeight: 700, color: BLUE, fontSize: 8, marginBottom: 1 }}>REPORT WEEK OF</div>
                        <div style={{ fontWeight: 600 }}>{reportMonth}</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, color: BLUE, fontSize: 8, marginBottom: 1 }}>PREPARED BY</div>
                        <div style={{ fontWeight: 600 }}>{preparedBy}</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, color: BLUE, fontSize: 8, marginBottom: 1 }}>POSITION</div>
                        <div style={{ fontWeight: 600 }}>SENIOR CORPORATE SALES</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, color: BLUE, fontSize: 8, marginBottom: 1 }}>WEEKLY AMOUNT (COMPLETED)</div>
                        <div style={{ fontWeight: 700, fontSize: 10, color: BLUE }}>{formatAmt(weeklyAmount)}</div>
                    </div>
                </div>

                {/* DAILY BREAKDOWN */}
                <div style={{ marginBottom: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <tbody>
                            <tr>
                                <td style={{ ...tdBase, fontWeight: 700, background: BLUE, color: '#fff', width: '11.11%', textAlign: 'center' }}>DAY</td>
                                {DAYS.map(day => (
                                    <td key={day} style={{ ...tdBase, textAlign: 'center', fontWeight: 700, background: LIGHT_BLUE, width: '11.11%' }}>{day}</td>
                                ))}
                            </tr>
                            <tr>
                                <td style={{ ...tdBase, fontWeight: 700, background: BLUE, color: '#fff', textAlign: 'center' }}>Amount</td>
                                {dayAmounts.map((amt, i) => (
                                    <td key={i} style={{ ...tdBase, textAlign: 'center', background: amt > 0 ? '#c6efce' : '#fff', color: amt > 0 ? '#276221' : '#999', fontWeight: amt > 0 ? 700 : 400 }}>
                                        {amt > 0 ? formatAmt(amt) : '$ -'}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* SECTION 1: PREVIOUS DEAL — closed/won/lost (quote-only or older) */}
                <DealTable title="PREVIOUS DEAL" rows={prevDeals} />

                {/* SECTION 2: NEW DEAL — follow-up / pending this week */}
                <DealTable title="NEW DEAL" rows={newDeals} />

                {/* SECTION 3: CUSTOMER LIST — contact logs */}
                <CustomerListTable rows={contactLogs} />

                {/* SECTION 4: LOCATION — site surveys */}
                <SiteSurveyTable rows={siteSurveys} />

                {/* SUMMARY */}
                <div style={{ marginTop: 12, pageBreakInside: 'avoid', display: 'flex', justifyContent: 'flex-end' }}>
                    <table style={{ width: '35%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr><th colSpan={2} style={{ ...thStyle, fontSize: 10 }}>WEEKLY SUMMARY</th></tr>
                        </thead>
                        <tbody>
                            {[
                                ['Won', formatAmt(allRows.filter(r => r.Status === 'Won').reduce((s, r) => s + (parseFloat(r['Total Amount']) || 0), 0))],
                                ['Follow Up', formatAmt(allRows.filter(r => r.Status === 'Followup').reduce((s, r) => s + (parseFloat(r['Total Amount']) || 0), 0))],
                                ['Lost', formatAmt(allRows.filter(r => r.Status === 'Lost').reduce((s, r) => s + (parseFloat(r['Total Amount']) || 0), 0))],
                            ].map(([label, value], i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? '#f4f7fc' : '#fff' }}>
                                    <td style={{ ...tdBase, fontWeight: 600 }}>{label}</td>
                                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600 }}>{value}</td>
                                </tr>
                            ))}
                            <tr style={{ background: LIGHT_BLUE }}>
                                <td style={{ ...tdBase, fontWeight: 700, color: BLUE }}>TOTAL (Won)</td>
                                <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700, color: BLUE }}>{formatAmt(weeklyAmount)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* SIGNATURES */}
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 40, paddingTop: 8 }}>
                    {['PREPARED BY', 'REVIEWED BY', 'APPROVED BY'].map(role => (
                        <div key={role} style={{ textAlign: 'center', minWidth: 160 }}>
                            <div style={{ fontWeight: 700, fontSize: 9, marginBottom: 44 }}>{role}</div>
                            <div style={{ borderTop: '1px solid #000', paddingTop: 6, fontSize: 9 }}>
                                {role === 'PREPARED BY' ? preparedBy : 'Signature and Name'}
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </>
    );
};

export default PrintableWeeklyReport;
