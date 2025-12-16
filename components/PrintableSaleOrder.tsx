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
  const currencySymbol = getCurrencySymbol(currency);

  const formatCurrency = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return `${currencySymbol}0.00`;
    return `${currencySymbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    // The format in the example is MM/DD/YYYY
    const date = new Date(dateString + 'T00:00:00'); // Ensure it's parsed as local time
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US');
  };

  // Styles from the provided HTML
  const styles: { [key: string]: React.CSSProperties } = {
    document: {
      maxWidth: '900px',
      margin: '0 auto',
      background: 'white',
      padding: '40px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: 'black',
    },
    header: {
      textAlign: 'right',
      marginBottom: '30px',
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '20px',
    },
    infoSection: {
      fontSize: '12px',
      lineHeight: 1.8,
      marginBottom: '20px',
    },
    infoRow: {
      display: 'grid',
      gridTemplateColumns: '120px 20px 1fr 150px 20px 200px',
      marginBottom: '8px',
    },
    infoLabel: {
      fontWeight: 'normal',
    },
    infoColon: {
      textAlign: 'center',
    },
    infoValue: {
      fontWeight: 'normal',
    },
    rightLabel: {
      textAlign: 'right',
      fontWeight: 'normal',
    },
    rightValue: {
      fontWeight: 'normal',
    },
    boldValue: {
      fontWeight: 'bold',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      margin: '20px 0',
      fontSize: '11px',
    },
    th: {
      background: '#1e4d8b',
      color: 'white',
      padding: '10px 8px',
      textAlign: 'center',
      fontWeight: 'bold',
      border: '1px solid #1e4d8b',
    },
    td: {
      padding: '10px 8px',
      border: '1px solid #000',
      verticalAlign: 'top',
    },
    itemDescription: {
      lineHeight: 1.5,
      whiteSpace: 'pre-wrap',
    },
    textCenter: {
      textAlign: 'center',
    },
    textRight: {
      textAlign: 'right',
    },
    remarks: {
      marginTop: '30px',
      fontSize: '11px',
      lineHeight: 1.6,
    },
    remarksTitle: {
      fontWeight: 'bold',
      marginBottom: '10px',
    },
    signatures: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: '100px',
    },
    signatureBlock: {
      textAlign: 'center',
      width: '45%',
    },
    signatureLine: {
      borderTop: '1px solid #000',
      paddingTop: '10px',
      fontSize: '12px',
    },
  };

  return (
    <div style={styles.document} className="printable-area">
      <div style={styles.header}>
        <div style={styles.title}>SALE ORDER (B2C)</div>
      </div>

      <div style={styles.infoSection}>
        <div style={styles.infoRow}>
          <div style={styles.infoLabel}>Company Name</div>
          <div style={styles.infoColon}>:</div>
          <div style={styles.infoValue}>{headerData['Company Name']}</div>
          <div style={styles.rightLabel}></div>
          <div style={styles.infoColon}></div>
          <div style={styles.rightValue}></div>
        </div>

        <div style={styles.infoRow}>
          <div style={styles.infoLabel}>Address</div>
          <div style={styles.infoColon}>:</div>
          <div style={{ ...styles.infoValue, whiteSpace: 'pre-wrap' }}>{headerData['Company Address']}</div>
          <div style={styles.rightLabel}>SO No.</div>
          <div style={styles.infoColon}>:</div>
          <div style={{ ...styles.rightValue, ...styles.boldValue }}>{headerData['Sale Order ID']}</div>
        </div>

        <div style={styles.infoRow}>
          <div style={styles.infoLabel}></div>
          <div style={styles.infoColon}></div>
          <div style={styles.infoValue}></div>
          <div style={styles.rightLabel}>SO Date</div>
          <div style={styles.infoColon}>:</div>
          <div style={styles.rightValue}>{formatDate(headerData['Order Date'])}</div>
        </div>

        <div style={styles.infoRow}>
          <div style={styles.infoLabel}>Contact Person</div>
          <div style={styles.infoColon}>:</div>
          <div style={styles.infoValue}>{headerData['Contact Person']}</div>
          <div style={styles.rightLabel}>Delivery Date</div>
          <div style={styles.infoColon}>:</div>
          <div style={styles.rightValue}>{formatDate(headerData['Delivery Date'])}</div>
        </div>

        <div style={styles.infoRow}>
          <div style={styles.infoLabel}>Telephone</div>
          <div style={styles.infoColon}>:</div>
          <div style={styles.infoValue}>{headerData['Contact Tel']}</div>
          <div style={styles.rightLabel}>Payment Terms</div>
          <div style={styles.infoColon}>:</div>
          <div style={styles.rightValue}>{headerData['Payment Term']}</div>
        </div>

        <div style={styles.infoRow}>
          <div style={styles.infoLabel}>Email</div>
          <div style={styles.infoColon}>:</div>
          <div style={styles.infoValue}>{headerData.Email}</div>
          <div style={styles.rightLabel}>Bill Invoice</div>
          <div style={styles.infoColon}>:</div>
          <div style={{ ...styles.rightValue, ...styles.boldValue }}>{headerData['Bill Invoice']}</div>
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '40px' }}>No.</th>
            <th style={{ ...styles.th, width: '100px' }}>Item Code</th>
            <th style={styles.th}>Item Description</th>
            <th style={{ ...styles.th, width: '50px' }}>Qty</th>
            <th style={{ ...styles.th, width: '100px' }}>Unit Price</th>
            <th style={{ ...styles.th, width: '100px' }}>Commission</th>
            <th style={{ ...styles.th, width: '100px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ ...styles.td, ...styles.textCenter }}>{item.no}</td>
              <td style={{ ...styles.td, ...styles.textCenter }}>{item.itemCode}</td>
              <td style={{ ...styles.td, ...styles.itemDescription }}>{item.description}</td>
              <td style={{ ...styles.td, ...styles.textCenter }}>{item.qty}</td>
              <td style={{ ...styles.td, ...styles.textRight }}>{item.unitPrice ? formatCurrency(item.unitPrice) : ''}</td>
              <td style={{ ...styles.td, ...styles.textRight }}>{item.commission ? formatCurrency(item.commission) : ''}</td>
              <td style={{ ...styles.td, ...styles.textRight }}>{item.amount ? formatCurrency(item.amount) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot style={{ fontSize: '12px' }}>
          <tr>
            <td colSpan={6} style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
              Sub Total ({currency})
            </td>
            <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
              {formatCurrency(totals.subTotal)}
            </td>
          </tr>
          {totals.tax > 0 && (
            <tr>
              <td colSpan={6} style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
                VAT 10% ({currency})
              </td>
              <td style={{ padding: '8px', border: '1px solid #000', verticalAlign: 'top', textAlign: 'right' }}>
                {formatCurrency(totals.tax)}
              </td>
            </tr>
          )}
          <tr style={{ background: '#f0f0f0' }}>
            <td colSpan={6} style={{ padding: '8px', border: '1px solid #000', borderTop: '2px solid #000', verticalAlign: 'top', textAlign: 'right', fontWeight: 'bold' }}>
              Grand Total ({currency})
            </td>
            <td style={{ padding: '8px', border: '1px solid #000', borderTop: '2px solid #000', verticalAlign: 'top', textAlign: 'right', fontWeight: 'bold' }}>
              {formatCurrency(totals.grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>

      {headerData['Install Software'] && (
        <div style={styles.remarks}>
          <div style={styles.remarksTitle}>*** Install Software :</div>
          <div style={{ marginLeft: '20px' }}>{headerData['Install Software']}</div>
        </div>
      )}

      <div style={styles.signatures}>
        <div style={styles.signatureBlock}>
          <div style={styles.signatureLine}>
            Ordered By
          </div>
        </div>
        <div style={styles.signatureBlock}>
          <div style={styles.signatureLine}>
            Received By
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintableSaleOrder;
