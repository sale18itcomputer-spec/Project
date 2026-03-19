import React from 'react';

interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName: string;
    description: string;
    qty: number | string;
    unitPrice: number | string;
    amount: number;
}

interface PrintableQuotationProps {
    headerData: { [key: string]: any };
    items: LineItem[];
    totals: {
        subTotal: number;
        vat: number;
        grandTotal: number;
    };
    currency: 'USD' | 'KHR';
}

const getCurrencySymbol = (currency?: 'USD' | 'KHR'): string => {
    switch (currency) {
        case 'USD': return '$';
        case 'KHR': return '៛';
        default: return '$';
    }
};

const PrintableQuotation: React.FC<PrintableQuotationProps> = ({ headerData, items, totals, currency }) => {
    const actualItems = items.filter(item => item.no > 0);

    const currencySymbol = getCurrencySymbol(currency);
    const formatCurrency = (value: number | string) => {
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        if (typeof numValue !== 'number' || isNaN(numValue)) return `${currencySymbol} 0.00`;
        // The image has space between symbol and number
        return `${currencySymbol} ${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <>
            <style>
                {`
                    @media print {
                        @page {
                            margin: 0;
                            size: auto;
                        }
                        body {
                            margin: 0;
                            padding: 0;
                            background: white;
                        }
                        body * {
                            visibility: hidden;
                        }
                        .printable-area, .printable-area * {
                            visibility: visible;
                        }
                        .printable-area {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 20mm !important;
                            box-sizing: border-box;
                            max-width: none !important;
                            box-shadow: none !important;
                            border: none !important;
                            background: white;
                        }
                    }
                `}
            </style>
            <div className="printable-area bg-white p-8 font-[serif] text-sm text-black h-full relative" style={{ fontFamily: "'Times New Roman', serif", fontSize: '12px', maxWidth: '900px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #000', paddingBottom: '10px', marginBottom: '30px', gap: '20px' }}>
                    <img
                        src="https://i.postimg.cc/RFYdrpBC/Limperial-Technology-Logo01-png(004aad).png"
                        alt="Limperial Company Logo"
                        style={{
                            height: '40px',
                            width: 'auto'
                        }}
                    />
                    <div style={{ textAlign: 'left', fontSize: '10px', lineHeight: 1.5 }}>
                        <div style={{ fontWeight: 'bold', color: '#004aad', fontSize: '13px', marginBottom: '3px' }}>LIMPERIAL TECHNOLOGY CO., LTD.</div>
                        <div>Tel : (+855) 92 218 333 | Email : info@limperialtech.com | Website : www.limperialtech.com</div>
                        <div>Address : Building #15, Street Ayeaksamrjean Bo (139), Sangkat Srah Chak, Khan Daun Penh, Phnom Penh, Cambodia.</div>
                    </div>
                </div>

                {/* Title */}
                <h1 style={{ textAlign: 'center', fontSize: '28px', fontWeight: 'bold', margin: '30px 0', textDecoration: 'underline', color: '#000', textDecorationColor: '#000' }}>QUOTATION</h1>

                {/* Info Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '85px 10px 1fr 85px 10px 130px', gap: '8px 0', marginBottom: '20px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Company Name</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}><strong>{headerData['Company Name'] || ''}</strong></div>
                    
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Quotation No</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Quotation ID'] || ''}</div>

                    <div style={{ fontWeight: 'normal', alignSelf: 'start', textAlign: 'left' }}>Address</div>
                    <div style={{ fontWeight: 'normal', alignSelf: 'start', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal', whiteSpace: 'pre-line', lineHeight: '1.4' }}>{headerData['Company Address'] || ''}</div>
                    
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Quote Date</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Quote Date'] ? new Date(headerData['Quote Date'] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>

                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Contact Person</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Contact Person'] || ''}</div>
                    
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Validity</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Validity Date'] ? new Date(headerData['Validity Date'] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>

                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Tel</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Contact Tel'] || ''}</div>
                    
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Status</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Stock Status'] || ''}</div>

                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Email</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Contact Email'] || ''}</div>
                    
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Payment Term</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Payment Term'] || ''}</div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0', fontSize: '11px' }}>
                    <thead>
                        <tr>
                            <th style={{ background: '#004aad', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #004aad', width: '40px' }}>No.</th>
                            <th style={{ background: '#004aad', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #004aad', width: '120px' }}>Item Code</th>
                            <th style={{ background: '#004aad', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #004aad' }}>Item Description</th>
                            <th style={{ background: '#004aad', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #004aad', width: '50px' }}>Qty</th>
                            <th style={{ background: '#004aad', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #004aad', width: '90px' }}>Unit Price</th>
                            <th style={{ background: '#004aad', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #004aad', width: '100px' }}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {actualItems.map((item, index) => (
                            <React.Fragment key={item.id || `item-${index}`}>
                                <tr>
                                    <td style={{ padding: '8px', border: '1px solid #000', borderBottom: item.description ? 'none' : '1px solid #000', verticalAlign: 'top', textAlign: 'center' }}>
                                        {item.no || ''}
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #000', borderBottom: item.description ? 'none' : '1px solid #000', verticalAlign: 'top' }}>
                                        {item.itemCode || ''}
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #000', borderBottom: item.description ? 'none' : '1px solid #000', verticalAlign: 'top', fontWeight: 'bold' }}>
                                        {item.modelName || ''}
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #000', borderBottom: item.description ? 'none' : '1px solid #000', verticalAlign: 'top', textAlign: 'center' }}>
                                        {item.qty || ''}
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #000', borderBottom: item.description ? 'none' : '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
                                        {item.unitPrice ? formatCurrency(item.unitPrice) : ''}
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #000', borderBottom: item.description ? 'none' : '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
                                        {item.amount ? formatCurrency(item.amount) : ''}
                                    </td>
                                </tr>
                                {item.description && (
                                    <tr>
                                        <td style={{ border: '1px solid #000', borderTop: 'none' }}></td>
                                        <td style={{ border: '1px solid #000', borderTop: 'none' }}></td>
                                        <td style={{ padding: '8px', border: '1px solid #000', borderTop: 'none', verticalAlign: 'top', whiteSpace: 'pre-wrap', fontSize: '10px', color: '#333' }}>
                                            {item.description}
                                        </td>
                                        <td style={{ border: '1px solid #000', borderTop: 'none' }}></td>
                                        <td style={{ border: '1px solid #000', borderTop: 'none' }}></td>
                                        <td style={{ border: '1px solid #000', borderTop: 'none' }}></td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                    <tfoot style={{ fontSize: '12px' }}>
                        <tr>
                            <td colSpan={5} style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
                                Sub Total ({currency})
                            </td>
                            <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
                                {formatCurrency(totals.subTotal)}
                            </td>
                        </tr>
                        {totals.vat > 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
                                    VAT 10% ({currency})
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
                                    {formatCurrency(totals.vat)}
                                </td>
                            </tr>
                        )}
                        <tr style={{ background: '#f0f0f0' }}>
                            <td colSpan={5} style={{ padding: '8px', border: '1px solid #000', borderTop: '2px solid #000', verticalAlign: 'top', textAlign: 'right', fontWeight: 'bold' }}>
                                Grand Total ({currency})
                            </td>
                            <td style={{ padding: '8px', border: '1px solid #000', borderTop: '2px solid #000', verticalAlign: 'top', textAlign: 'right', fontWeight: 'bold' }}>
                                {formatCurrency(totals.grandTotal)}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                {/* Remarks */}
                <div style={{ clear: 'both', marginTop: '10px', fontSize: '10px', lineHeight: 1.4, pageBreakInside: 'avoid' }}>
                    <h4 style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '11px', marginBottom: '3px' }}>Terms and Conditions</h4>
                    <div style={{ whiteSpace: 'pre-wrap', marginTop: '3px' }}>
                        {headerData['Terms and Conditions']}
                    </div>
                </div>
                {/* Signatures - Positioned near bottom of page */}
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '80px', gap: '40px', pageBreakInside: 'avoid', paddingLeft: '8px', paddingRight: '8px' }}>
                    <div style={{ textAlign: 'center', flex: '1', maxWidth: '200px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '60px' }}>PREPARED BY</div>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                            {headerData['Prepared By'] || headerData['Created By']}<br />
                            {headerData['Prepared By Position'] || 'Senior Corporate Sale'}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', flex: '1', maxWidth: '200px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '60px' }}>APPROVED BY</div>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                            {headerData['Approved By'] || 'Signature and Name'}<br />
                            {headerData['Approved By Position'] || '\u00A0'}
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
};

export default PrintableQuotation;
