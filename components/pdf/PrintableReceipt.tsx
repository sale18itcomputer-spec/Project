import React from 'react';

interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName?: string;
    description: string;
    qty: number | string;
    unitPrice: number | string;
    amount: number;
}

interface PrintableReceiptProps {
    headerData: { [key: string]: any };
    items: LineItem[];
    totals: {
        subTotal: number;
        tax: number;
        grandTotal: number;
    };
    currency: 'USD' | 'KHR';
    signaturePadding?: number;
}

const LOGO_URL = 'https://i.postimg.cc/RFYdrpBC/Limperial-Technology-Logo01-png(004aad).png';
const BRAND_BLUE = '#0056b3';

const getCurrencySymbol = (currency?: 'USD' | 'KHR') => currency === 'KHR' ? '៛' : '$';

const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
    headerData, items, totals, currency, signaturePadding = 0
}) => {
    const sym = getCurrencySymbol(currency);
    const isVAT = headerData['Tax Type'] === 'VAT' || headerData['Taxable'] === 'Yes';

    const fmtNum = (v: number | string) => {
        const n = typeof v === 'number' ? v : parseFloat(String(v)) || 0;
        return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const fmtDate = (ds?: string) => {
        if (!ds) return '';
        const d = new Date(ds + 'T00:00:00');
        if (isNaN(d.getTime())) return ds;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Pad items to at least 3 rows
    const displayItems = [...items.filter(i => i.no > 0)];
    while (displayItems.length < 3) {
        displayItems.push({
            id: `pad-${displayItems.length}`,
            no: displayItems.length + 1,
            itemCode: '', modelName: '', description: '',
            qty: '', unitPrice: 0, amount: 0,
        });
    }

    const subTotal = totals.subTotal;
    const vatAmount = isVAT ? (totals.tax > 0 ? totals.tax : subTotal * 0.1) : 0;
    const grandTotal = isVAT ? subTotal + vatAmount : subTotal;

    const tdBorder: React.CSSProperties = { border: '1px solid #000', padding: '4px 8px' };

    const thStyle: React.CSSProperties = {
        background: BRAND_BLUE, color: '#fff',
        border: '1px solid #000', padding: '5px 4px',
        textAlign: 'center', fontSize: 9, lineHeight: '1.3',
        whiteSpace: 'nowrap',
    };

    const totLbl: React.CSSProperties = {
        ...tdBorder, fontWeight: 'bold', whiteSpace: 'nowrap',
        textAlign: 'right', fontSize: 9, lineHeight: '1.4', padding: '6px 8px',
    };
    const totVal: React.CSSProperties = { ...tdBorder, verticalAlign: 'middle', fontSize: 10 };

    const moneyFlex = (s: string, v: number | null) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span>{s}</span>
            <span>{v !== null && v !== 0 ? fmtNum(v) : '-'}</span>
        </div>
    );

    // Resolve document numbers
    const rvNo = headerData['RV No'] || headerData['Inv No'] || '';
    const rvDate = headerData['RV Date'] || headerData['Inv Date'] || '';
    const invNo = headerData['Inv No'] || '';
    const soNo = headerData['SO No'] || '';
    const doNo = headerData['DO No'] || '';
    const paymentMethod = headerData['Payment Method'] || '';
    const paymentTerm = headerData['Payment Term'] || '';

    // Prepared/Approved
    const preparedBy = headerData['Prepared By'] || '';
    const preparedByPos = headerData['Prepared By Position'] || '';
    const approvedBy = headerData['Approved By'] || '';
    const approvedByPos = headerData['Approved By Position'] || '';

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Koh+Santepheap:wght@400;700&family=Moul&display=swap');
                @media print {
                    @page { size: A4; margin: 0; }
                    body { margin: 0; padding: 0; background: white; }
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible !important; }
                    .printable-area {
                        position: absolute; left: 0; top: 0;
                        width: 100% !important; margin: 0 !important;
                        padding: 15mm 20mm !important;
                        box-sizing: border-box; max-width: none !important;
                        box-shadow: none !important; border: none !important; background: white;
                    }
                }
            `}</style>

            <div
                className="printable-area"
                style={{
                    fontFamily: "'Koh Santepheap', 'Times New Roman', serif",
                    fontSize: 11, color: '#000', background: '#fff',
                    padding: '15mm 20mm', boxSizing: 'border-box',
                    minHeight: '297mm', display: 'flex', flexDirection: 'column',
                }}
            >
                {/* ── Letterhead ── */}
                <div style={{
                    position: 'relative', textAlign: 'center',
                    borderBottom: `3px solid ${BRAND_BLUE}`,
                    paddingBottom: 10, marginBottom: 14, paddingTop: 48,
                }}>
                    <div style={{ position: 'absolute', left: 0, top: 0 }}>
                        <img src={LOGO_URL} alt="Limperial Logo" style={{ height: 24, width: 'auto', objectFit: 'contain' }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 2, fontFamily: "'Moul', serif" }}>លីមភើរៀល ថេកណឡូជី ឯ.ក</div>
                    <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 2, textTransform: 'uppercase', fontFamily: "'Times New Roman', serif" }}>LIMPERIAL TECHNOLOGY CO., LTD.</div>
                    {isVAT && (
                        <div style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 2 }}>លេខអត្តសញ្ញាណកម្មអាករ (VAT TIN)៖ K003-902201968</div>
                    )}
                    <div style={{ fontSize: 9, marginBottom: 1 }}>អាសយដ្ឋាន៖ #B១៥ (ជាន់ផ្ទាល់ដី ជាន់ទី១ ជាន់ទី២ ជាន់ទី៣ និង ជាន់ទី៤) ផ្លូវ អយស្ម័យយានបូព៍ (១៣៩) ភូមិ ១ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</div>
                    <div style={{ fontSize: 7, whiteSpace: 'nowrap', overflow: 'hidden', marginBottom: 2 }}>Address: #B15 (Ground Floor 1st Floor 2nd Floor 3rd Floor and 4th Floor), East Railway (139), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</div>
                    <div style={{ fontSize: 9 }}>E-mail: info@limperialtech.com || លេខទូរស័ព្ទ (Telephone): +855 92 218 333</div>
                </div>

                {/* ── Document Title ── */}
                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 'bold' }}>បង្កាន់ដៃទទួលប្រាក់</div>
                    <div style={{ fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 2 }}>RECEIPT VOUCHER</div>
                    {isVAT && (
                        <div style={{ fontSize: 10, color: BRAND_BLUE, fontWeight: 'bold', marginTop: 2 }}>(VAT Included)</div>
                    )}
                </div>

                {/* ── Info Section ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 0, marginBottom: 20 }}>
                    {/* Left: Payer info */}
                    <div style={{ width: '55%' }}>
                        <table style={{ width: 'auto', borderCollapse: 'collapse', fontSize: 10 }}>
                            <tbody>
                                {[
                                    ['ទទួលប្រាក់ពី (Payment from)', headerData['Company Name'] || ''],
                                    ['អាសយដ្ឋាន (Address)', headerData['Company Address'] || ''],
                                    ...(isVAT ? [['លេខអត្តសញ្ញាណកម្ម (VAT TIN)', headerData['Tin No'] || '']] : []),
                                    ['ទំនាក់ទំនង (Contact Person)', headerData['Contact Name'] || ''],
                                    ['លេខទូរស័ព្ទ (Telephone)', headerData['Phone Number'] || ''],
                                    ['អ៊ីម៉ែល (E-mail)', headerData['Email'] || (headerData as any)?.email || ''],
                                    ...(paymentMethod ? [['វិធីបង់ប្រាក់ (Payment Method)', paymentMethod]] : []),
                                    ...(paymentTerm ? [['លក្ខខណ្ឌ (Payment Term)', paymentTerm]] : []),
                                ].map(([label, value]) => (
                                    <tr key={label}>
                                        <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{label}</td>
                                        <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', width: 10, textAlign: 'center', verticalAlign: 'top' }}>:</td>
                                        <td style={{
                                            border: 'none', padding: '3px 0', whiteSpace: 'pre-wrap',
                                            ...(label === 'អាសយដ្ឋាន (Address)' ? { whiteSpace: 'normal' } : {}),
                                        }}>{label === 'អាសយដ្ឋាន (Address)' ? <div style={{ maxWidth: 220, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'normal' }}>{value}</div> : value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Right: Receipt meta */}
                    <div style={{ width: '45%' }}>
                        <table style={{ width: 'auto', marginLeft: 'auto', borderCollapse: 'collapse', fontSize: 10 }}>
                            <tbody>
                                {[
                                    ['លេខបង្កាន់ដៃ (Receipt Nº)', rvNo],
                                    ['កាលបរិច្ឆេទ (Date)', fmtDate(rvDate)],
                                    ...(invNo ? [['វិក្កយបត្រ (Invoice Nº)', invNo]] : []),
                                    ...(soNo ? [['លេខបញ្ជាទិញ (SO Nº)', soNo]] : []),
                                    ...(doNo ? [['ការដឹកជញ្ជូន (DO Nº)', doNo]] : []),
                                ].map(([label, value]) => (
                                    <tr key={label}>
                                        <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', whiteSpace: 'nowrap' }}>{label}</td>
                                        <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', width: 10, textAlign: 'center' }}>:</td>
                                        <td style={{ border: 'none', padding: '3px 0' }}>{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Items table ── */}
                <div style={{ flexGrow: 1, marginBottom: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                        <colgroup>
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '45%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '13%' }} />
                        </colgroup>

                        <thead>
                            <tr>
                                <th style={thStyle}><div>ល.រ</div><div>Nº</div></th>
                                <th style={thStyle}><div>លេខសម្គាល់ទំនិញ</div><div>Part Number</div></th>
                                <th style={thStyle}><div>បរិយាយទំនិញ</div><div>Description</div></th>
                                <th style={thStyle}><div>បរិមាណ</div><div>Qty</div></th>
                                <th style={thStyle}><div>តម្លៃឯកតា</div><div>Unit Price</div></th>
                                <th style={thStyle}><div>តម្លៃទំនិញ</div><div>Amount</div></th>
                            </tr>
                        </thead>

                        <tbody>
                            {displayItems.map((item, idx) => {
                                const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
                                const amt = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0;
                                return (
                                    <tr key={item.id || idx} style={{ textAlign: 'center' }}>
                                        <td style={{ ...tdBorder, verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>{item.no > 0 ? item.no : ''}</td>
                                        <td style={{ ...tdBorder, verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>{item.itemCode}</td>
                                        <td style={{ ...tdBorder, textAlign: 'left', verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>
                                            <div style={{ fontWeight: item.modelName ? 'bold' : 'normal' }}>{item.modelName}</div>
                                            {item.description && (
                                                <div style={{ fontSize: 8, whiteSpace: 'pre-wrap', marginTop: 4 }}>{item.description}</div>
                                            )}
                                        </td>
                                        <td style={{ ...tdBorder, verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>{item.qty || ''}</td>
                                        <td style={{ ...tdBorder, verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>
                                            {price !== 0
                                                ? <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{sym}</span><span>{fmtNum(price)}</span></div>
                                                : null}
                                        </td>
                                        <td style={{ ...tdBorder, verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{sym}</span><span>{amt !== 0 ? fmtNum(amt) : '-'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>

                        {/* ── Totals footer ── */}
                        <tbody className="break-inside-avoid">
                            {/* Terms + Payment block spans left 3 cols */}
                            <tr>
                                <td colSpan={3} rowSpan={isVAT ? 5 : 4} style={{ border: 'none', verticalAlign: 'top', padding: 12 }}>
                                    <div style={{ fontSize: 10 }}>
                                        <div style={{ marginBottom: 12 }}>
                                            <div style={{ fontWeight: 'bold', fontSize: 11, textDecoration: 'underline', textTransform: 'uppercase', marginBottom: 4 }}>
                                                Term Condition:
                                            </div>
                                            <ul style={{ paddingLeft: 16, margin: 0, listStyleType: 'disc' }}>
                                                <li style={{ marginBottom: 2 }}>Goods sold are not returnable and received in good condition.</li>
                                                <li style={{ marginBottom: 2 }}>For warranty details, please look at details below items.</li>
                                                <li>We look forward to hearing from you.</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: 11, textDecoration: 'underline', textTransform: 'uppercase', marginBottom: 4 }}>
                                                Payment Information:
                                            </div>
                                            <p style={{ margin: '2px 0' }}><strong>Bank:</strong> Adance Bank of Asia Ltd (ABA Bank)</p>
                                            <p style={{ margin: '2px 0' }}><strong>Account Name:</strong> LIMPERIAL TECHNOLOGY CO., LTD.</p>
                                            <p style={{ margin: '2px 0' }}><strong>Account Number:</strong> 003 916 564</p>
                                        </div>
                                    </div>
                                </td>
                                <td colSpan={2} style={totLbl}>សរុប (Sub Total)</td>
                                <td style={totVal}>{moneyFlex(sym, subTotal > 0 ? subTotal : null)}</td>
                            </tr>
                            {isVAT && (
                                <tr>
                                    <td colSpan={2} style={totLbl}>អាករលើតម្លៃបន្ថែម (VAT 10%)</td>
                                    <td style={totVal}>{moneyFlex(sym, vatAmount > 0 ? vatAmount : null)}</td>
                                </tr>
                            )}
                            <tr>
                                <td colSpan={2} style={totLbl}>សរុបរួម (Grand Total)</td>
                                <td style={{ ...totVal, fontWeight: 'bold' }}>{moneyFlex(sym, grandTotal > 0 ? grandTotal : null)}</td>
                            </tr>
                            <tr>
                                <td colSpan={2} style={totLbl}>ជាអក្សរ (In Words)</td>
                                <td style={{ ...totVal, fontSize: 8, fontStyle: 'italic' }}></td>
                            </tr>
                            <tr>
                                <td colSpan={2} style={totLbl}>ស្ថានភាព (Status)</td>
                                <td style={{ ...totVal, fontWeight: 'bold', color: '#059669' }}>
                                    {headerData['Status'] === 'Issued' ? '✓ PAID' : headerData['Status'] || ''}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* ── Signature block ── */}
                <div className="break-inside-avoid" style={{
                    marginTop: signaturePadding,
                    display: 'flex', justifyContent: 'space-between',
                    paddingBottom: 32, paddingLeft: 16, paddingRight: 16,
                }}>
                    <div style={{ width: '35%', textAlign: 'center' }}>
                        <div style={{ borderTop: '2px solid #000', marginBottom: 4 }} />
                        {preparedBy && <div style={{ fontSize: 10, fontWeight: 'bold' }}>{preparedBy}</div>}
                        {preparedByPos && <div style={{ fontSize: 9, color: '#555' }}>{preparedByPos}</div>}
                        <div style={{ fontSize: 11, marginTop: 2 }}>អ្នករៀបចំ (Prepared by)</div>
                    </div>
                    <div style={{ width: '35%', textAlign: 'center' }}>
                        <div style={{ borderTop: '2px solid #000', marginBottom: 4 }} />
                        {approvedBy && <div style={{ fontSize: 10, fontWeight: 'bold' }}>{approvedBy}</div>}
                        {approvedByPos && <div style={{ fontSize: 9, color: '#555' }}>{approvedByPos}</div>}
                        <div style={{ fontSize: 11, marginTop: 2 }}>អ្នកអនុម័ត (Approved by)</div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PrintableReceipt;
