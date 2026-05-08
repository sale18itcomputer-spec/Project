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

interface PrintableInvoiceProps {
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

const getCurrencySymbol = (currency?: 'USD' | 'KHR'): string =>
    currency === 'KHR' ? '៛' : '$';

const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ headerData, items, totals, currency, signaturePadding = 100 }) => {
    const sym = getCurrencySymbol(currency);
    const isTaxInvoice = headerData['Taxable'] === 'VAT';
    const isCommercial = headerData['Document Type'] === 'Commercial Invoice' || headerData['DocumentType'] === 'Commercial Invoice';
    const hasVatTin = !!(headerData['Tin No'] || headerData['Tin No.'] || headerData['VAT TIN']);

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
    const vatAmount = isTaxInvoice ? (totals.tax > 0 ? totals.tax : subTotal * 0.1) : 0;
    // grandUsd: includes VAT for tax invoice, plain subTotal otherwise
    const grandUsd = isTaxInvoice ? subTotal + vatAmount : subTotal;

    const deposit = parseFloat(String(headerData['Deposit'] || 0)) || 0;
    const hasDeposit = deposit > 0;
    const totalLessDeposit = subTotal - deposit;
    const exchangeRate = headerData['Exchange Rate'] || headerData['ExchangeRate'] || '';
    const rateNum = parseFloat(String(exchangeRate).replace(/,/g, '')) || 0;

    // Commercial: Sub Total shown = grandTotal - deposit (balance after deposit)
    // Non-VAT / Tax: Grand Total in Riel = grandUsd * rate
    const comSubTotal = subTotal - deposit;          // commercial balance after deposit
    const grandRiel = rateNum > 0 ? Math.round((isCommercial ? comSubTotal : grandUsd) * rateNum) : 0;

    // ── Shared styles ──
    const tdBorder: React.CSSProperties = { border: '1px solid #000', padding: '4px 8px' };

    const thStyle: React.CSSProperties = {
        background: BRAND_BLUE, color: '#fff',
        border: '1px solid #000', padding: '5px 4px',
        textAlign: 'center', fontSize: 9, lineHeight: '1.3',
        whiteSpace: 'nowrap',
    };

    // Tax invoice totals row styles (compact, flex money display)
    const taxTotLbl: React.CSSProperties = {
        ...tdBorder, fontWeight: 'bold', whiteSpace: 'nowrap',
        textAlign: 'right', fontSize: 9, lineHeight: '1.4', padding: '6px 8px',
    };
    const taxTotVal: React.CSSProperties = { ...tdBorder, verticalAlign: 'middle', fontSize: 10 };

    // Commercial totals row styles (right-aligned, bold value)
    const comTotLbl: React.CSSProperties = {
        ...tdBorder, fontWeight: 'bold', whiteSpace: 'nowrap',
        textAlign: 'right', fontSize: 9, lineHeight: '1.4', padding: '6px 8px',
    };
    const comTotVal: React.CSSProperties = {
        ...tdBorder, textAlign: 'right', fontWeight: 'bold',
        paddingRight: 8, fontSize: 10,
    };

    const moneyFlex = (s: string, v: number | null) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span>{s}</span>
            <span>{v !== null && v !== 0 ? fmtNum(v) : '-'}</span>
        </div>
    );

    // ── Shared: Terms + Payment block content ──
    const TermsPaymentBlock = () => (
        <div style={{ fontSize: 10 }}>
            <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 'bold', fontSize: 11, textDecoration: 'underline', textTransform: 'uppercase', marginBottom: 4 }}>
                    Term Condition:
                </div>
                <ul style={{ paddingLeft: 16, margin: 0, listStyleType: 'disc' }}>
                    <li style={{ marginBottom: 2 }}><strong>Payment Terms:</strong> Full payment is required as per the agreed terms. Late payments may result in order suspension.</li>
                    <li style={{ marginBottom: 2 }}><strong>Goods Sold:</strong> All goods sold are non-refundable and exchangeable. Please inspect all goods carefully before signing.</li>
                    <li><strong>Warranty:</strong> All goods sold are covered under Limperial Technology's warranty policy. Warranty does not cover unauthorized repairs or broken seals.</li>
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
    );

    // ── Shared: Letterhead ──
    const Header = () => (
        <div style={{
            position: 'relative', textAlign: 'center',
            borderBottom: `3px solid ${BRAND_BLUE}`,
            paddingBottom: 10, marginBottom: 14, paddingTop: 4,
        }}>
            <div style={{ position: 'absolute', left: 0, top: 0 }}>
                <img src={LOGO_URL} alt="Limperial Logo" style={{ height: 24, width: 'auto', objectFit: 'contain' }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 2, fontFamily: "'Moul', serif" }}>លីមភើរៀល ថេកណូឡូជី ឯ.ក</div>
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 2, textTransform: 'uppercase', fontFamily: "'Times New Roman', serif" }}>LIMPERIAL TECHNOLOGY CO., LTD.</div>
            {isTaxInvoice && (
                <div style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 2 }}>លេខអត្តសញ្ញាណកម្មអាករ (VAT TIN)៖ K003-902201968</div>
            )}
            <div style={{ fontSize: 9, marginBottom: 1 }}>អាសយដ្ឋាន៖ #B១៥ (ជាន់ផ្ទាល់ដី ជាន់ទី១ ជាន់ទី២ ជាន់ទី៣ និង ជាន់ទី៤) ផ្លូវ អយស្ម័យយានបូព៍ (១៣៩) ភូមិ ១ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</div>
            <div style={{ fontSize: 7, whiteSpace: 'nowrap', overflow: 'hidden', marginBottom: 2 }}>Address: #B15 (Ground Floor 1st Floor 2nd Floor 3rd Floor and 4th Floor), East Railway (139), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</div>
            <div style={{ fontSize: 9 }}>E-mail: info@limperialtech.com || លេខទូរស័ព្ទ (Telephone): +855 92 218 333</div>
        </div>
    );

    // ── Shared: Document title ──
    const DocTitle = () => {
        if (isCommercial) {
            return (
                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 'bold' }}>វិក្កយបត្រ</div>
                    <div style={{ fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 2 }}>Commercial Invoice</div>
                </div>
            );
        }
        return (
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 'bold' }}>{isTaxInvoice ? 'វិក្កយបត្រអាករ' : 'វិក្កយបត្រ'}</div>
                <div style={{ fontSize: 13, fontWeight: 'bold' }}>{isTaxInvoice ? 'TAX INVOICE' : 'INVOICE'}</div>
            </div>
        );
    };

    // ── Shared: Info section (customer + invoice details) ──
    const InfoSection = () => (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 0, marginBottom: 20 }}>
            {/* Left: Customer */}
            <div style={{ width: '55%' }}>
                <table style={{ width: 'auto', borderCollapse: 'collapse', fontSize: 10 }}>
                    <tbody>
                        <tr>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', whiteSpace: 'nowrap' }}>អតិថិជន</td>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', width: 10, textAlign: 'center' }}>:</td>
                            <td style={{ border: 'none', padding: '3px 0', width: 'auto' }}>{headerData['Company Name (Khmer)'] || headerData['Company Name'] || ''}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', whiteSpace: 'nowrap' }}>Customer</td>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', width: 10, textAlign: 'center' }}>:</td>
                            <td style={{ border: 'none', padding: '3px 0', width: 'auto' }}>{headerData['Company Name'] || ''}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>អាសយដ្ឋាន (Address)</td>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', width: 10, textAlign: 'center', verticalAlign: 'top' }}>:</td>
                            <td style={{ border: 'none', padding: '3px 0', width: 'auto' }}><div style={{ maxWidth: 220, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'normal' }}>{headerData['Company Address'] || ''}</div></td>
                        </tr>
                        {isTaxInvoice && (
                            <tr>
                                <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', whiteSpace: 'nowrap' }}>លេខអត្តសញ្ញាណកម្ម (VAT TIN)</td>
                                <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', width: 10, textAlign: 'center' }}>:</td>
                                <td style={{ border: 'none', padding: '3px 0', width: 'auto' }}>{headerData['Tin No'] || headerData['Tin No.'] || headerData['VAT TIN'] || ''}</td>
                            </tr>
                        )}
                        <tr>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', whiteSpace: 'nowrap' }}>ទំនាក់ទំនង (Contact Person)</td>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', width: 10, textAlign: 'center' }}>:</td>
                            <td style={{ border: 'none', padding: '3px 0', width: 'auto' }}>{headerData['Contact Name'] || ''}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', whiteSpace: 'nowrap' }}>លេខទូរស័ព្ទ (Telephone)</td>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', width: 10, textAlign: 'center' }}>:</td>
                            <td style={{ border: 'none', padding: '3px 0', width: 'auto' }}>{headerData['Phone Number'] || ''}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', whiteSpace: 'nowrap' }}>អ៊ីម៉ែល (E-mail)</td>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', width: 10, textAlign: 'center' }}>:</td>
                            <td style={{ border: 'none', padding: '3px 0', width: 'auto' }}>{headerData['Email'] || ''}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            {/* Right: Invoice meta */}
            <div style={{ width: '45%', display: 'flex', flexDirection: 'column' }}>
                <table style={{ width: 'auto', marginLeft: 'auto', borderCollapse: 'collapse', fontSize: 10 }}>
                    <tbody>
                        <tr>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', whiteSpace: 'nowrap' }}>លេខរៀងវិក្កយបត្រ (Invoice Nº)</td>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', width: 10, textAlign: 'center' }}>:</td>
                            <td style={{ border: 'none', padding: '3px 0', width: 'auto', verticalAlign: 'middle' }}>{headerData['Inv No'] || headerData['Inv No.'] || headerData['Invoice No'] || ''}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', whiteSpace: 'nowrap' }}>កាលបរិច្ឆេទ (Date)</td>
                            <td style={{ fontWeight: 'bold', border: 'none', padding: '3px 0', width: 10, textAlign: 'center' }}>:</td>
                            <td style={{ border: 'none', padding: '3px 0', width: 'auto', verticalAlign: 'middle' }}>{fmtDate(headerData['Inv Date'])}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );

    // ── Shared: items rows (header + data rows, no footer rows) ──
    const ItemRows = () => (
        <>
            <thead>
                <tr>
                    <th style={thStyle}><div>ល.រ</div><div>Nº</div></th>
                    <th style={thStyle}>
                        <div>{isCommercial ? 'លេខកូដទំនិញ' : 'លេខសម្គាល់ទំនិញ'}</div>
                        <div>Part Number</div>
                    </th>
                    <th style={thStyle}><div>បរិយាយទំនិញ</div><div>Description</div></th>
                    <th style={thStyle}><div>បរិមាណ</div><div>{isCommercial ? 'Quantity' : 'Qty'}</div></th>
                    <th style={thStyle}><div>តម្លៃឯកតា</div><div>Unit Price</div></th>
                    <th style={thStyle}>
                        <div>{isCommercial ? 'តម្លៃសរុប' : 'តម្លៃទំនិញ'}</div>
                        <div>Amount</div>
                    </th>
                </tr>
            </thead>
            <tbody>
                {displayItems.map((item, idx) => {
                    const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
                    const amt = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0;
                    return (
                        <React.Fragment key={item.id || idx}>
                            <tr className="break-inside-avoid" style={{ height: isCommercial ? 40 : 'auto', textAlign: 'center' }}>
                                <td style={{ ...tdBorder, verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>{item.no > 0 ? item.no : ''}</td>
                                <td style={{ ...tdBorder, verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>{item.itemCode}</td>
                                <td style={{ ...tdBorder, textAlign: 'left', verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>
                                    <div style={{ fontWeight: item.modelName ? 'bold' : 'normal' }}>{item.modelName}</div>
                                    {item.description && (
                                        <div style={{ fontSize: 8, whiteSpace: 'pre-wrap', marginTop: 4, fontWeight: 'normal' }}>
                                            {item.description}
                                        </div>
                                    )}
                                </td>
                                <td style={{ ...tdBorder, verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>{item.qty || ''}</td>
                                <td style={{ ...tdBorder, verticalAlign: 'top', paddingTop: 8, paddingBottom: 8 }}>
                                    {price !== 0
                                        ? <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}><span>{sym}</span><span>{fmtNum(price)}</span></div>
                                        : null}
                                </td>
                                <td style={{ ...tdBorder, verticalAlign: 'top', textAlign: isCommercial ? 'right' : 'left', fontWeight: isCommercial ? 'bold' : 'normal', paddingTop: 8, paddingBottom: 8, paddingRight: isCommercial ? 8 : undefined }}>
                                    {isCommercial
                                        ? (amt !== 0 ? `${sym}${fmtNum(amt)}` : '')
                                        : <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}><span>{sym}</span><span>{amt !== 0 ? fmtNum(amt) : '-'}</span></div>
                                    }
                                </td>
                            </tr>
                        </React.Fragment>
                    );
                })}
            </tbody>
        </>
    );

    // ── Shared: Signature block ──
    const Signatures = ({ wide = false }: { wide?: boolean }) => (
        <div className="break-inside-avoid" style={{
            marginTop: signaturePadding,
            display: 'flex', justifyContent: 'space-between',
            paddingBottom: 32,
            paddingLeft: wide ? 64 : 16,
            paddingRight: wide ? 64 : 16,
        }}>
            <div style={{ width: '35%', textAlign: 'center' }}>
                <div style={{ borderTop: '2px solid #000', marginBottom: wide ? 16 : 4 }}></div>
                <div style={{ fontSize: 11, marginBottom: 2 }}>ហត្ថលេខា និងឈ្មោះអ្នកទិញ</div>
                <div style={{ fontSize: 11, fontWeight: wide ? 'normal' : 'bold' }}>Customer's Signature &amp; Name</div>
            </div>
            <div style={{ width: '35%', textAlign: 'center' }}>
                <div style={{ borderTop: '2px solid #000', marginBottom: wide ? 16 : 4 }}></div>
                <div style={{ fontSize: 11, marginBottom: 2 }}>ហត្ថលេខា និងឈ្មោះអ្នកលក់</div>
                <div style={{ fontSize: 11, fontWeight: wide ? 'normal' : 'bold' }}>Seller's Signature &amp; Name</div>
            </div>
        </div>
    );

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
                    fontSize: 11,
                    color: '#000',
                    background: '#fff',
                    padding: '15mm 20mm',
                    boxSizing: 'border-box',
                    minHeight: '297mm',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <Header />
                <DocTitle />
                <InfoSection />

                {/* ── Items table + footer totals ── */}
                <div style={{ flexGrow: 1, marginBottom: isCommercial ? 48 : 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                        <colgroup>
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '45%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '13%' }} />
                        </colgroup>

                        <ItemRows />

                        {/* ── COMMERCIAL footer ── */}
                        {/* Order: Sub Total → [Deposit → Total Less Deposit] → Grand Total in Dollar → Exchange Rate → Grand Total in Riel */}
                        {isCommercial && (
                            <tbody className="break-inside-avoid">
                                <tr style={{ height: 96 }}>
                                    {[...Array(6)].map((_, i) => <td key={i} style={tdBorder}></td>)}
                                </tr>
                                <tr>
                                    <td colSpan={3} rowSpan={hasDeposit ? 6 : 4} style={{ border: 'none', verticalAlign: 'top', padding: 16 }}>
                                        <TermsPaymentBlock />
                                    </td>
                                    <td colSpan={2} style={comTotLbl}>សរុប (Sub Total)</td>
                                    <td style={comTotVal}>{`${sym}${fmtNum(subTotal)}`}</td>
                                </tr>
                                {hasDeposit && (
                                    <>
                                        <tr>
                                            <td colSpan={2} style={comTotLbl}>ប្រាក់កក់ (Deposit)</td>
                                            <td style={comTotVal}>{`${sym}${fmtNum(deposit)}`}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} style={comTotLbl}>សរុបដកប្រាក់កក់ (Total Less Deposit)</td>
                                            <td style={comTotVal}>{comSubTotal > 0 ? `${sym}${fmtNum(comSubTotal)}` : '-'}</td>
                                        </tr>
                                    </>
                                )}
                                <tr>
                                    <td colSpan={2} style={comTotLbl}>សរុបរួមជាប្រាក់ដុល្លារ (Grand Total in Dollar)</td>
                                    <td style={comTotVal}>{`${sym}${fmtNum(hasDeposit ? comSubTotal : subTotal)}`}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={comTotLbl}>អត្រាប្តូរប្រាក់ (Exchange Rate)</td>
                                    <td style={comTotVal}>{exchangeRate ? `៛${exchangeRate}` : '-'}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={comTotLbl}>សរុបរួមជាប្រាក់រៀល (Grand Total in Riel)</td>
                                    <td style={{ ...comTotVal, background: '#fff' }}>{grandRiel > 0 ? `៛${grandRiel.toLocaleString('en-US')}` : '-'}</td>
                                </tr>
                            </tbody>
                        )}

                        {/* ── TAX INVOICE footer ── */}
                        {/* Order: Sub Total → [Deposit → Total Less Deposit] → VAT 10% → Grand Total in Dollar → Exchange Rate → Grand Total in Riel */}
                        {isTaxInvoice && !isCommercial && (
                            <tbody className="break-inside-avoid">
                                <tr>
                                    <td colSpan={3} rowSpan={hasDeposit ? 7 : 5} style={{ border: 'none', verticalAlign: 'top', padding: 12 }}>
                                        <TermsPaymentBlock />
                                    </td>
                                    <td colSpan={2} style={taxTotLbl}>សរុប (Sub Total)</td>
                                    <td style={taxTotVal}>{moneyFlex(sym, subTotal > 0 ? subTotal : null)}</td>
                                </tr>
                                {hasDeposit && (
                                    <>
                                        <tr>
                                            <td colSpan={2} style={taxTotLbl}>ប្រាក់កក់ (Deposit)</td>
                                            <td style={taxTotVal}>{moneyFlex(sym, deposit)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} style={taxTotLbl}>សរុបដកប្រាក់កក់ (Total Less Deposit)</td>
                                            <td style={taxTotVal}>{moneyFlex(sym, totalLessDeposit > 0 ? totalLessDeposit : null)}</td>
                                        </tr>
                                    </>
                                )}
                                <tr>
                                    <td colSpan={2} style={taxTotLbl}>អាករលើតម្លៃបន្ថែម (VAT 10%)</td>
                                    <td style={taxTotVal}>{moneyFlex(sym, vatAmount > 0 ? vatAmount : null)}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={taxTotLbl}>សរុបរួមជាប្រាក់ដុល្លារ (Grand Total in Dollar)</td>
                                    <td style={taxTotVal}>{moneyFlex(sym, grandUsd > 0 ? grandUsd : null)}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={taxTotLbl}>អត្រាប្តូរប្រាក់រៀល (Exchange Rate)</td>
                                    <td style={{ ...taxTotVal, verticalAlign: 'middle' }}>{exchangeRate}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={taxTotLbl}>សរុបរួមជាប្រាក់រៀល (Grand Total in Riel)</td>
                                    <td style={taxTotVal}>{moneyFlex('R', grandRiel > 0 ? grandRiel : null)}</td>
                                </tr>
                            </tbody>
                        )}

                        {/* ── NON-VAT INVOICE footer ── */}
                        {/* Order: Sub Total → [Deposit → Total Less Deposit] → Grand Total in Dollar → Exchange Rate → Grand Total in Riel */}
                        {!isTaxInvoice && !isCommercial && (
                            <tbody className="break-inside-avoid">
                                <tr>
                                    <td colSpan={3} rowSpan={hasDeposit ? 6 : 4} style={{ border: 'none', verticalAlign: 'top', padding: 12 }}>
                                        <TermsPaymentBlock />
                                    </td>
                                    <td colSpan={2} style={taxTotLbl}>សរុប (Sub Total)</td>
                                    <td style={taxTotVal}>{moneyFlex(sym, subTotal > 0 ? subTotal : null)}</td>
                                </tr>
                                {hasDeposit && (
                                    <>
                                        <tr>
                                            <td colSpan={2} style={taxTotLbl}>ប្រាក់កក់ (Deposit)</td>
                                            <td style={taxTotVal}>{moneyFlex(sym, deposit)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} style={taxTotLbl}>សរុបដកប្រាក់កក់ (Total Less Deposit)</td>
                                            <td style={taxTotVal}>{moneyFlex(sym, totalLessDeposit > 0 ? totalLessDeposit : null)}</td>
                                        </tr>
                                    </>
                                )}
                                <tr>
                                    <td colSpan={2} style={taxTotLbl}>សរុបរួមជាប្រាក់ដុល្លារ (Grand Total in Dollar)</td>
                                    <td style={taxTotVal}>{moneyFlex(sym, grandUsd > 0 ? grandUsd : null)}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={taxTotLbl}>អត្រាប្តូរប្រាក់រៀល (Exchange Rate)</td>
                                    <td style={{ ...taxTotVal, verticalAlign: 'middle' }}>{exchangeRate}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={taxTotLbl}>សរុបរួមជាប្រាក់រៀល (Grand Total in Riel)</td>
                                    <td style={taxTotVal}>{moneyFlex('R', grandRiel > 0 ? grandRiel : null)}</td>
                                </tr>
                            </tbody>
                        )}
                    </table>
                </div>

                <Signatures wide={isCommercial} />
            </div>
        </>
    );
};

export default PrintableInvoice;
