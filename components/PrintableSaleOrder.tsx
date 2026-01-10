import React from 'react';

interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName: string;
    description: string;
    qty: number | string;
    unitPrice: number | string;
    commission: number | string;
    amount: number;
}

interface PrintableSaleOrderProps {
    headerData: { [key: string]: any };
    items: LineItem[];
    totals: {
        subTotal: number;
        tax: number;
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

const PrintableSaleOrder: React.FC<PrintableSaleOrderProps> = ({ headerData, items, totals, currency }) => {
    const actualItems = items.filter(item => item.no > 0);
    const currencySymbol = getCurrencySymbol(currency);

    const formatCurrency = (value: number | string) => {
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        if (typeof numValue !== 'number' || isNaN(numValue)) return `${currencySymbol} 0.00`;
        return `${currencySymbol} ${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString + 'T00:00:00');
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
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
              visibility: visible !important;
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

                {/* Header removed for Sale Order as per request */}

                {/* Title */}
                <h1 style={{ textAlign: 'center', fontSize: '28px', fontWeight: 'bold', margin: '0 0 30px 0', textDecoration: 'underline', color: '#000', textDecorationColor: '#000' }}>SALE ORDER (B2C)</h1>

                {/* Info Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px 1fr', gap: '8px 15px', marginBottom: '20px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Company Name</div>
                    <div style={{ fontWeight: 'normal' }}>: <strong>{headerData['Company Name'] || ''}</strong></div>
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>SO No</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Sale Order ID'] || ''}</div>

                    <div style={{ fontWeight: 'normal', alignSelf: 'start', textAlign: 'left' }}>Address</div>
                    <div style={{ fontWeight: 'normal', whiteSpace: 'pre-line', lineHeight: '1.4' }}>: {headerData['Company Address'] || ''}</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>SO Date</div>
                    <div style={{ fontWeight: 'normal' }}>: {formatDate(headerData['Order Date'])}</div>

                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Contact Person</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Contact Name'] || ''}</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Delivery Date</div>
                    <div style={{ fontWeight: 'normal' }}>: {formatDate(headerData['Delivery Date'])}</div>

                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Tel</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Contact Tel'] || ''}</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Bill Invoice</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Bill Invoice'] || ''}</div>

                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Email</div>
                    <div style={{ fontWeight: 'normal' }}>: {headerData['Email'] || ''}</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Payment Term</div>
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
                        {totals.tax > 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
                                    VAT 10% ({currency})
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
                                    {formatCurrency(totals.tax)}
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

                {/* Software Setup & Remarks */}
                <div style={{ marginTop: '20px', marginBottom: '30px' }}>
                    {(headerData['Install Software'] || '').length > 0 && (
                        <>
                            <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px' }}>Set up software:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                                {(headerData['Install Software'] || '').split(',').map((s: string) => s.trim()).filter((s: string) => s).map((opt: string) => (
                                    <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <div style={{
                                            width: '12px',
                                            height: '12px',
                                            border: '1px solid #000',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative'
                                        }}>
                                            <div style={{ position: 'absolute', top: '2px', left: '2px', right: '2px', bottom: '2px', background: '#000' }}></div>
                                        </div>
                                        <span style={{ fontSize: '11px' }}>{opt}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {headerData['Remark'] && (
                        <div style={{ marginTop: '15px', fontSize: '11px' }}>
                            <div style={{ fontWeight: 'bold' }}>Remark:</div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{headerData['Remark']}</div>
                        </div>
                    )}
                </div>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px' }}>
                    <div style={{ textAlign: 'center', width: '35%' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '60px' }}>ORDERED BY</div>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                            Signature and Name
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', width: '35%' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '60px' }}>RECEIVED BY</div>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                            Signature and Stamp
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
};

export default PrintableSaleOrder;
