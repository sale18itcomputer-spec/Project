import React from 'react';

interface BuildComponent {
    itemCode: string;
    modelName: string;
    qty: number | string;
    serialNumber?: string;
    warrantyMonths?: number;
}

interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName?: string;
    description: string;
    qty: number | string;
    serialNumber?: string;
    serialNumbers?: string[];
    isPromotion?: boolean;
    isPCBuild?: boolean;
    buildComponents?: BuildComponent[];
}

interface PrintableDOProps {
    headerData: { [key: string]: any };
    items: LineItem[];
    signaturePadding?: number;
}

const LOGO_URL = 'https://i.postimg.cc/RFYdrpBC/Limperial-Technology-Logo01-png(004aad).png';
const BRAND_BLUE = '#0056b3';

const PrintableDO: React.FC<PrintableDOProps> = ({ headerData, items, signaturePadding = 0 }) => {
    // Pad regular items to at least 3 rows, then append promo rows after
    const regularItems = items.filter(item => item.no > 0);
    const promoItems   = items.filter(item => item.isPromotion);
    const displayItems = [...regularItems];
    while (displayItems.length < 3) {
        displayItems.push({
            id: `pad-${displayItems.length}`,
            no: displayItems.length + 1,
            itemCode: '', modelName: '', description: '', qty: '',
        });
    }
    displayItems.push(...promoItems);

    const fmtDate = (ds?: string) => {
        if (!ds) return '';
        const d = new Date(ds + 'T00:00:00');
        if (isNaN(d.getTime())) return ds;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const doNo = headerData['Inv No.'] || headerData['Inv No']
        ? (headerData['Inv No.'] || headerData['Inv No']).replace('INV', 'DO')
        : (headerData['DO No'] || '');
    const doDate = fmtDate(headerData['Inv Date'] || headerData['DO Date'] || '');
    const vatTin = headerData['Tin No.'] || headerData['Tin No'] || headerData['VAT TIN'] || '';

    const tdBorder: React.CSSProperties = { border: '1px solid #000', padding: '4px 8px' };
    const thStyle: React.CSSProperties = {
        background: BRAND_BLUE, color: '#fff',
        border: '1px solid #000', padding: '5px 4px',
        textAlign: 'center', fontSize: 9, lineHeight: 1.3, whiteSpace: 'nowrap',
    };
    const infoLbl: React.CSSProperties = {
        fontWeight: 'bold', whiteSpace: 'nowrap', fontSize: 9,
        border: 'none', padding: '3px 0', width: '35%',
    };
    const infoSep: React.CSSProperties = {
        fontWeight: 'bold', border: 'none', padding: '3px 4px',
        textAlign: 'center', width: '5%',
    };
    const infoVal: React.CSSProperties = { border: 'none', padding: '3px 0' };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Koh+Santepheap:wght@400;700&display=swap');
                @media print {
                    @page { margin: 10mm 11mm 14mm; size: A4; }
                    body { margin: 0; padding: 0; background: white; }
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible !important; }
                    .printable-area {
                        position: absolute; left: 0; top: 0;
                        width: 100% !important; margin: 0 !important; padding: 0 !important;
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
                    padding: '10mm 11mm 14mm',
                    boxSizing: 'border-box',
                    minHeight: '277mm',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* ── Header ── */}
                <div style={{ position: 'relative', textAlign: 'center', borderBottom: `3px solid ${BRAND_BLUE}`, paddingBottom: 8, marginBottom: 14, paddingTop: 48 }}>
                    <div style={{ position: 'absolute', left: 0, top: 0 }}>
                        <img src={LOGO_URL} alt="Limperial Logo" style={{ height: 22, width: 'auto', objectFit: 'contain' }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 2 }}>លីមភើរៀល ថេកណឡូជី ឯ.ក</div>
                    <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 2 }}>LIMPERIAL TECHNOLOGY CO., LTD.</div>
                    <div style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 2 }}>លេខអត្តសញ្ញាណកម្មអតប (VAT TIN)&#x3a; K003-902201968</div>
                    <div style={{ fontSize: 8, marginBottom: 1 }}>អាសយដ្ឋាន៖ #B15 (ជាន់ផ្ទាល់ដី ជាន់ទី ១ ជាន់ទី ២ ជាន់ទី ៣ និង ជាន់ទី ៤) ផ្លូវ អយស្ម័យយានបូព៌ (១៣៩), ភូមិ១ សង្កាត់ ស្រះចក ខណ្ឌ ដូនពេញ រាជធានីភ្នំពេញ</div>
                    <div style={{ fontSize: 7, whiteSpace: 'nowrap', overflow: 'hidden', marginBottom: 2 }}>Address: #B15 ( Ground Floor 1st Floor 2nd Floor 3rd Floor and 4th Floor ), East Railway ( 139 ), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</div>
                    <div style={{ fontSize: 9 }}>E-mail: info@limperialtech.com || ទូរស័ព្ទ (Telephone): +855 92 218 333</div>
                </div>

                {/* ── Title ── */}
                <div style={{ textAlign: 'center', margin: '10px 0 12px' }}>
                    <div style={{ fontSize: 14, fontWeight: 'bold' }}>លិខិតប្រគល់ទំនិញ</div>
                    <div style={{ fontSize: 13, fontWeight: 'bold' }}>DELIVERY NOTE</div>
                </div>

                {/* ── Info section ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 0, marginBottom: 12 }}>
                    {/* Left: Customer details */}
                    <div style={{ width: '58%' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                            <tbody>
                                <tr>
                                    <td style={infoLbl}>Customer</td>
                                    <td style={infoSep}>:</td>
                                    <td style={{ ...infoVal, fontWeight: 'bold' }}>{headerData['Company Name'] || ''}</td>
                                </tr>
                                <tr>
                                    <td style={{ ...infoLbl, verticalAlign: 'top' }}>Address</td>
                                    <td style={{ ...infoSep, verticalAlign: 'top' }}>:</td>
                                    <td style={{ ...infoVal }}><div style={{ maxWidth: 220, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'normal' }}>{headerData['Company Address'] || ''}</div></td>
                                </tr>
                                {vatTin && (
                                    <tr>
                                        <td style={{ ...infoLbl, fontWeight: 'bold' }}>VAT TIN</td>
                                        <td style={infoSep}>:</td>
                                        <td style={{ ...infoVal, fontWeight: 'bold' }}>{vatTin}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td style={{ ...infoLbl, fontWeight: 'bold' }}>Contact Person</td>
                                    <td style={infoSep}>:</td>
                                    <td style={{ ...infoVal, fontWeight: 'bold' }}>{headerData['Contact Name'] || ''}</td>
                                </tr>
                                <tr>
                                    <td style={{ ...infoLbl, fontWeight: 'bold' }}>Telephone</td>
                                    <td style={infoSep}>:</td>
                                    <td style={{ ...infoVal, fontWeight: 'bold' }}>{headerData['Phone Number'] || ''}</td>
                                </tr>
                                <tr>
                                    <td style={{ ...infoLbl, fontWeight: 'bold' }}>E-mail</td>
                                    <td style={infoSep}>:</td>
                                    <td style={{ ...infoVal, fontWeight: 'bold' }}>{headerData['Email'] || ''}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {/* Right: Document details */}
                    <div style={{ width: '42%' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                            <tbody>
                                <tr>
                                    <td style={{ ...infoLbl, width: '45%' }}>Delivery N°</td>
                                    <td style={infoSep}>:</td>
                                    <td style={{ ...infoVal, fontWeight: 'bold' }}>{doNo}</td>
                                </tr>
                                <tr>
                                    <td style={{ ...infoLbl, width: '45%' }}>Date</td>
                                    <td style={infoSep}>:</td>
                                    <td style={{ ...infoVal, fontWeight: 'bold' }}>{doDate}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Items table ── */}
                <div style={{ flexGrow: 1, marginBottom: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                        <colgroup>
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '47%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '22%' }} />
                        </colgroup>
                        <thead>
                            <tr style={{ background: BRAND_BLUE, color: '#fff', textAlign: 'center' }}>
                                <th style={thStyle}><div>ល.រ</div><div>N°</div></th>
                                <th style={thStyle}><div>លេខកូដទំនិញ</div><div>Part Number</div></th>
                                <th style={thStyle}><div>បរិយាយទំនិញ</div><div>Description</div></th>
                                <th style={thStyle}><div>បរិមាណ</div><div>Qty</div></th>
                                <th style={thStyle}><div>លេខស៊េរី</div><div>Serial Number</div></th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayItems.map((item, idx) => {
                                if (item.isPromotion) {
                                    return (
                                        <React.Fragment key={item.id || idx}>
                                            <tr style={{ height: 48, textAlign: 'center' }}>
                                                <td style={tdBorder}></td>
                                                <td style={tdBorder}></td>
                                                <td style={{ ...tdBorder, textAlign: 'left', fontStyle: 'italic', color: '#666', fontSize: 10, whiteSpace: 'pre-wrap' }}>
                                                    {item.description || 'Cashback / Promotion'}
                                                </td>
                                                <td style={tdBorder}></td>
                                                <td style={tdBorder}></td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                }
                                // PC Build: sold as one priced line, but the delivery note
                                // must list each real part being handed over — one row per
                                // component with its own item code, qty, and serial.
                                if (item.isPCBuild && item.buildComponents && item.buildComponents.length > 0) {
                                    return (
                                        <React.Fragment key={item.id || idx}>
                                            <tr style={{ textAlign: 'center' }}>
                                                <td style={{ ...tdBorder, borderBottom: 'none', verticalAlign: 'top', paddingTop: 6 }}>{item.no > 0 ? item.no : ''}</td>
                                                <td style={{ ...tdBorder, borderBottom: 'none', verticalAlign: 'top', paddingTop: 6 }}>{item.itemCode}</td>
                                                <td style={{ ...tdBorder, borderBottom: 'none', textAlign: 'left', fontWeight: 'bold', verticalAlign: 'top', paddingTop: 6 }}>{item.modelName || ''}</td>
                                                <td style={{ ...tdBorder, borderBottom: 'none', verticalAlign: 'top', paddingTop: 6 }}>{item.qty || ''}</td>
                                                <td style={{ ...tdBorder, borderBottom: 'none' }}></td>
                                            </tr>
                                            {item.buildComponents.map((c, ci) => {
                                                const isLast = ci === item.buildComponents!.length - 1;
                                                const compBorder = { ...tdBorder, borderTop: 'none', borderBottom: isLast ? '1px solid #000' : 'none' };
                                                return (
                                                    <tr key={`${item.id}-comp-${ci}`} style={{ textAlign: 'center' }}>
                                                        <td style={compBorder}></td>
                                                        <td style={{ ...compBorder, fontSize: 9, verticalAlign: 'top', paddingTop: 2 }}>{c.itemCode}</td>
                                                        <td style={{ ...compBorder, textAlign: 'left', fontWeight: 'normal', fontSize: 9, verticalAlign: 'top', paddingTop: 2 }}>
                                                            {c.modelName}
                                                            {c.warrantyMonths && <div style={{ fontSize: 7, color: '#666' }}>{c.warrantyMonths} months warranty</div>}
                                                        </td>
                                                        <td style={{ ...compBorder, fontSize: 9, verticalAlign: 'top', paddingTop: 2 }}>{c.qty}</td>
                                                        <td style={{ ...compBorder, textAlign: 'left', fontSize: 8, verticalAlign: 'top', paddingTop: 2 }}>{c.serialNumber || ''}</td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                }
                                return (
                                    <React.Fragment key={item.id || idx}>
                                        <tr style={{ height: 48, textAlign: 'center' }}>
                                            <td style={tdBorder}>{item.no > 0 ? item.no : ''}</td>
                                            <td style={tdBorder}>{item.itemCode}</td>
                                            <td style={{ ...tdBorder, textAlign: 'left', fontWeight: 'bold' }}>{item.modelName || ''}</td>
                                            <td style={tdBorder}>{item.qty || ''}</td>
                                            {(() => {
                                                const sns = (item.serialNumbers && item.serialNumbers.length > 0)
                                                    ? item.serialNumbers
                                                    : item.serialNumber ? [item.serialNumber] : [];
                                                const filtered = sns.filter(s => s.trim());
                                                return (
                                                    <td style={{ ...tdBorder, textAlign: 'left', fontSize: 8, verticalAlign: 'top', paddingTop: 6 }}>
                                                        {filtered.map((s, i) => (
                                                            <div key={i} style={{ lineHeight: 1.6 }}>{s}</div>
                                                        ))}
                                                    </td>
                                                );
                                            })()}
                                        </tr>
                                        {item.description && (
                                            <tr>
                                                <td style={{ ...tdBorder, borderTop: 'none' }}></td>
                                                <td style={{ ...tdBorder, borderTop: 'none' }}></td>
                                                <td style={{ ...tdBorder, borderTop: 'none', fontSize: 8, whiteSpace: 'pre-wrap', fontWeight: 'normal' }}>{item.description}</td>
                                                <td style={{ ...tdBorder, borderTop: 'none' }}></td>
                                                <td style={{ ...tdBorder, borderTop: 'none' }}></td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {/* Spacer */}
                            <tr style={{ height: 80 }}>
                                <td style={tdBorder}></td>
                                <td style={tdBorder}></td>
                                <td style={tdBorder}></td>
                                <td style={tdBorder}></td>
                                <td style={tdBorder}></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* ── Delivery notice ── */}
                <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 'bold', color: '#ba1a1a', marginBottom: 12 }}>
                    <div>សូមផ្ដល់ពត៍មានចំពោះការខ្វះខាតផ្នែកសេវាដឹកជញ្ជូនទំនិញ</div>
                    <div style={{ marginTop: 4 }}>Please call, in case of delivery&apos;s problem (+855 92 218 333)</div>
                </div>

                {/* ── For Customer Only ── */}
                <div style={{ border: '1px solid #000', padding: '8px 12px', marginBottom: 24, fontSize: 9 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 6, textDecoration: 'underline', textTransform: 'uppercase' }}>For Customer Only:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[
                            'Checked & accepted all received goods are in good condition.',
                            'Received all goods as ordered',
                            'Unaccepted',
                        ].map(label => (
                            <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 12, height: 12, border: '1px solid #000', flexShrink: 0 }}></div>
                                <span>{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* ── Signatures ── */}
                <div style={{ marginTop: signaturePadding, display: 'flex', justifyContent: 'space-between', padding: '0 16px 32px' }}>
                    <div style={{ width: '35%', textAlign: 'center' }}>
                        <div style={{ borderTop: '2px solid #000', marginBottom: 4 }}></div>
                        <div style={{ fontSize: 9, marginBottom: 2 }}>ហត្ថលេខា និងឈ្មោះអ្នកទទួល</div>
                        <div style={{ fontSize: 9, fontWeight: 'bold' }}>Receiver&apos;s Signature &amp; Name</div>
                        <div style={{ fontSize: 9, marginTop: 16 }}>Date: _____/_____/_______</div>
                    </div>
                    <div style={{ width: '35%', textAlign: 'center' }}>
                        <div style={{ borderTop: '2px solid #000', marginBottom: 4 }}></div>
                        <div style={{ fontSize: 9, marginBottom: 2 }}>ហត្ថលេខា និងឈ្មោះអ្នកប្រគល់</div>
                        <div style={{ fontSize: 9, fontWeight: 'bold' }}>Deliverer&apos;s Signature &amp; Name</div>
                        <div style={{ fontSize: 9, marginTop: 16 }}>Date: _____/_____/_______</div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PrintableDO;
