import React from 'react';

interface LineItem {
  id: string;
  no: number;
  itemCode: string;
  description: string;
  qty: number;
  unitPrice: number;
  commission: number;
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

  const formatCurrency = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return `${currencySymbol} 0.00`;
    return `${currencySymbol} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    // The format in the example is MM/DD/YYYY
    const date = new Date(dateString + 'T00:00:00'); // Ensure it's parsed as local time
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



        {/* Title */}
        <h1 style={{ textAlign: 'center', fontSize: '28px', fontWeight: 'bold', margin: '30px 0', textDecoration: 'underline', color: '#000', textDecorationColor: '#000' }}>SALE ORDER (B2C)</h1>

        {/* Info Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px 1fr', gap: '8px 15px', marginBottom: '20px', fontSize: '12px' }}>
          <div style={{ fontWeight: 'normal' }}>Company Name</div>
          <div style={{ fontWeight: 'normal' }}>: <strong>{headerData['Company Name'] || ''}</strong></div>
          <div style={{ fontWeight: 'normal' }}>SO No</div>
          <div style={{ fontWeight: 'normal' }}>: {headerData['Sale Order ID'] || ''}</div>

          <div style={{ fontWeight: 'normal', alignSelf: 'start' }}>Address</div>
          <div style={{ fontWeight: 'normal', whiteSpace: 'pre-line', lineHeight: '1.4' }}>: {headerData['Company Address'] || ''}</div>
          <div style={{ fontWeight: 'normal' }}>SO Date</div>
          <div style={{ fontWeight: 'normal' }}>: {formatDate(headerData['Order Date'])}</div>

          <div style={{ fontWeight: 'normal' }}>Contact Person</div>
          <div style={{ fontWeight: 'normal' }}>: {headerData['Contact Person'] || ''}</div>
          <div style={{ fontWeight: 'normal' }}>Delivery Date</div>
          <div style={{ fontWeight: 'normal' }}>: {formatDate(headerData['Delivery Date'])}</div>

          <div style={{ fontWeight: 'normal' }}>Tel</div>
          <div style={{ fontWeight: 'normal' }}>: {headerData['Contact Tel'] || ''}</div>
          <div style={{ fontWeight: 'normal' }}>Bill Invoice</div>
          <div style={{ fontWeight: 'normal' }}>: {headerData['Bill Invoice'] || ''}</div>

          <div style={{ fontWeight: 'normal' }}>Email</div>
          <div style={{ fontWeight: 'normal' }}>: {headerData['Email'] || ''}</div>
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
                <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                  {item.description}
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

        {/* Remarks */}
        {headerData['Install Software'] && (
          <div style={{ clear: 'both', marginTop: '20px', fontSize: '11px', lineHeight: 1.6 }}>
            <h4 style={{ fontWeight: 'bold', marginBottom: '5px' }}>*** Install Software :</h4>
            <div style={{ marginLeft: '20px' }}>
              {headerData['Install Software']}
            </div>
          </div>
        )}

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
