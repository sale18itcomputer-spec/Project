import React from 'react';

interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName?: string;
    description: string;
    qty: number | string;
}

interface PrintableDOProps {
    headerData: { [key: string]: any };
    items: LineItem[];
}

const PrintableDO: React.FC<PrintableDOProps> = ({ headerData, items }) => {
    const actualItems = items.filter(item => item.no > 0);

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
                <h1 style={{ textAlign: 'center', fontSize: '28px', fontWeight: 'bold', margin: '30px 0', textDecoration: 'underline', color: '#000', textDecorationColor: '#000' }}>DELIVERY ORDER</h1>

                {/* Info Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '85px 10px 1fr 85px 10px 130px', gap: '8px 0', marginBottom: '20px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Company Name</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}><strong>{headerData['Company Name'] || ''}</strong></div>
                    
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>DO No</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Inv No.'] ? headerData['Inv No.'].replace('INV', 'DO') : ''}</div>

                    <div style={{ fontWeight: 'normal', alignSelf: 'start', textAlign: 'left' }}>Address</div>
                    <div style={{ fontWeight: 'normal', alignSelf: 'start', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal', whiteSpace: 'pre-line', lineHeight: '1.4' }}>{headerData['Company Address'] || ''}</div>
                    
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>DO Date</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{formatDate(headerData['Inv Date'])}</div>

                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Contact Person</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Contact Name'] || ''}</div>
                    
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>SO Ref.</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['SO No.'] || ''}</div>

                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Tel</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Phone Number'] || ''}</div>
                    
                    <div style={{ fontWeight: 'normal', textAlign: 'left' }}>Email</div>
                    <div style={{ fontWeight: 'normal', textAlign: 'center' }}>:</div>
                    <div style={{ fontWeight: 'normal' }}>{headerData['Email'] || ''}</div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0', fontSize: '11px' }}>
                    <thead>
                        <tr>
                            <th style={{ background: '#004aad', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #004aad', width: '40px' }}>No.</th>
                            <th style={{ background: '#004aad', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #004aad', width: '150px' }}>Item Code</th>
                            <th style={{ background: '#004aad', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #004aad' }}>Item Description</th>
                            <th style={{ background: '#004aad', color: 'white', padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #004aad', width: '80px' }}>Qty</th>
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
                                </tr>
                                {item.description && (
                                    <tr>
                                        <td style={{ border: '1px solid #000', borderTop: 'none' }}></td>
                                        <td style={{ border: '1px solid #000', borderTop: 'none' }}></td>
                                        <td style={{ padding: '8px', border: '1px solid #000', borderTop: 'none', verticalAlign: 'top', whiteSpace: 'pre-wrap', fontSize: '10px', color: '#333' }}>
                                            {item.description}
                                        </td>
                                        <td style={{ border: '1px solid #000', borderTop: 'none' }}></td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>

                {/* Signatures - Positioned near bottom of page */}
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '80px', gap: '20px', pageBreakInside: 'avoid', paddingLeft: '8px', paddingRight: '8px' }}>
                    <div style={{ textAlign: 'center', flex: '1', maxWidth: '180px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '60px' }}>PREPARED BY</div>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                            {headerData['Prepared By'] || headerData['Created By'] || 'Signature and Name'}<br />
                            {headerData['Prepared By Position'] || '\u00A0'}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', flex: '1', maxWidth: '180px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '60px' }}>DELIVERED BY</div>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                            Signature and Name
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', flex: '1', maxWidth: '180px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '60px' }}>RECEIVED BY</div>
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

export default PrintableDO;
