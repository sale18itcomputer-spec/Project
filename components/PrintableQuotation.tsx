import React from 'react';

interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName: string;
    description: string;
    qty: number;
    unitPrice: number;
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
    const formatCurrency = (value: number) => {
        if (typeof value !== 'number' || isNaN(value)) return `${currencySymbol} 0.00`;
        // The image has space between symbol and number
        return `${currencySymbol} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
            <div className="printable-area bg-white p-8 font-[serif] text-sm text-black shadow-lg border border-gray-200" style={{ fontFamily: "'Times New Roman', serif", fontSize: '12px', maxWidth: '900px', margin: '0 auto' }}>

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
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px 1fr', gap: '8px 15px', marginBottom: '20px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 'normal' }}>Company Name</div>
                    <div style={{ fontWeight: 'normal' }}>: <strong>{headerData['Company Name'] || ''}</strong></div>
                    <div style={{ fontWeight: 'normal' }}>Quotation No</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Quotation ID'] || ''}</div>

                    <div style={{ fontWeight: 'normal', alignSelf: 'start' }}>Address</div>
                    <div style={{ fontWeight: 'normal', whiteSpace: 'pre-line', lineHeight: '1.4' }}>: {headerData['Company Address'] || ''}</div>
                    <div style={{ fontWeight: 'normal' }}>Quote Date</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Quote Date'] ? new Date(headerData['Quote Date'] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>

                    <div style={{ fontWeight: 'normal' }}>Contact Person</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Contact Person'] || ''}</div>
                    <div style={{ fontWeight: 'normal' }}>Validity</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Validity Date'] ? new Date(headerData['Validity Date'] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>

                    <div style={{ fontWeight: 'normal' }}>Tel</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Contact Tel'] || ''}</div>
                    <div style={{ fontWeight: 'normal' }}>Status</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Stock Status'] || ''}</div>

                    <div style={{ fontWeight: 'normal' }}>Email</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Contact Email'] || ''}</div>
                    <div style={{ fontWeight: 'normal' }}>Payment Term</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Payment Term'] || ''}</div>
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
                            <tr key={item.id || `fill-${index}`}>
                                <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'center' }}>{item.no || ''}</td>
                                <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top' }}>{item.itemCode || ''}</td>
                                <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                                    {item.modelName ? (
                                        <>
                                            <strong>{item.modelName}</strong>
                                            {item.description ? '\n' + item.description.split('\n').filter(line => line.trim() !== '').map(line => `  - ${line}`).join('\n') : ''}
                                        </>
                                    ) : ''}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'center' }}>{item.qty || ''}</td>
                                <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>{item.unitPrice ? formatCurrency(item.unitPrice) : ''}</td>
                                <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>{item.amount ? formatCurrency(item.amount) : ''}</td>
                            </tr>
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
                <div style={{ clear: 'both', marginTop: '20px', fontSize: '11px', lineHeight: 1.6 }}>
                    <h4 style={{ fontWeight: 'bold', textDecoration: 'underline' }}>Terms and Conditions</h4>
                    <div style={{ whiteSpace: 'pre-wrap', marginTop: '5px' }}>
                        {headerData['Terms and Conditions']}
                    </div>
                </div>
                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px' }}>
                    <div style={{ textAlign: 'center', width: '35%' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '60px' }}>PREPARED BY</div>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '10px', fontSize: '11px' }}>
                            {headerData['Prepared By'] || headerData['Created By']}<br />
                            {headerData['Prepared By Position'] || 'Senior Corporate Sale'}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', width: '35%' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '60px' }}>APPROVED BY</div>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '10px', fontSize: '11px' }}>
                            {headerData['Approved By'] || <br />}<br />
                            {headerData['Approved By Position'] || <br />}
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
};

export default PrintableQuotation;
