import React from 'react';
import { PurchaseOrder, PurchaseOrderItem } from "../../types";

interface PrintablePurchaseOrderProps {
    header: Partial<PurchaseOrder> & { vendor_name?: string; vendor_address?: string; vendor_phone?: string };
    items: PurchaseOrderItem[];
    totals: { sub_total: number; vat_amount: number; grand_total: number };
}

const getCurrencySymbol = (currency?: 'USD' | 'KHR'): string => {
    switch (currency) {
        case 'USD': return '$';
        case 'KHR': return '៛';
        default: return '$';
    }
};

const PrintablePurchaseOrder: React.FC<PrintablePurchaseOrderProps> = ({ header, items, totals }) => {
    const currencySymbol = getCurrencySymbol(header.currency);
    const formatCurrency = (value: number) => {
        return `${currencySymbol} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="printable-area bg-white p-10 font-[serif] text-black" style={{ fontFamily: "'Times New Roman', serif", fontSize: '11px', width: '210mm', minHeight: '297mm', margin: '0 auto' }}>
            <style>
                {`
                    @media print {
                        @page { margin: 0; size: auto; }
                        body { margin: 0; padding: 0; background: white; }
                        body * { visibility: hidden; }
                        .printable-area, .printable-area * { visibility: visible; }
                        .printable-area {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 15mm !important;
                            box-sizing: border-box;
                        }
                    }
                `}
            </style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #004aad', paddingBottom: '10px', marginBottom: '20px' }}>
                <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold', color: '#004aad', fontSize: '18px' }}>LIMPERIAL TECHNOLOGY CO., LTD.</div>
                    <div style={{ fontSize: '10px', marginTop: '4px' }}>
                        Building #15, Street 139, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.<br />
                        Tel: (+855) 92 218 333 | Email: info@limperialtech.com
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#004aad' }}>PURCHASE ORDER</h1>
                </div>
            </div>

            {/* Info Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '30px' }}>
                <div>
                    <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px' }}>VENDOR</h3>
                    <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                        <strong>{header.vendor_name}</strong><br />
                        {header.vendor_address && <div style={{ whiteSpace: 'pre-line' }}>{header.vendor_address}</div>}
                        {header.vendor_phone && <div>Tel: {header.vendor_phone}</div>}
                    </div>
                </div>
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '4px', fontSize: '11px' }}>
                        <div style={{ fontWeight: 'bold' }}>PO Number:</div>
                        <div>{header.po_number}</div>
                        <div style={{ fontWeight: 'bold' }}>Date:</div>
                        <div>{header.order_date ? new Date(header.order_date).toLocaleDateString() : ''}</div>
                        <div style={{ fontWeight: 'bold' }}>Delivery Date:</div>
                        <div>{header.delivery_date ? new Date(header.delivery_date).toLocaleDateString() : 'N/A'}</div>
                        <div style={{ fontWeight: 'bold' }}>Payment Term:</div>
                        <div>{header.payment_term || 'N/A'}</div>
                    </div>
                </div>
            </div>

            {/* Shipping & Contact Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '30px' }}>
                <div>
                    <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px' }}>SHIP TO</h3>
                    <div style={{ fontSize: '11px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                        {header.ship_to_address}
                    </div>
                </div>
                <div>
                    <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px' }}>ORDERED BY</h3>
                    <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                        <strong>{header.ordered_by_name}</strong><br />
                        {header.ordered_by_phone && <div>Tel: {header.ordered_by_phone}</div>}
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#004aad', color: 'white' }}>
                        <th style={{ border: '1px solid #004aad', padding: '8px', textAlign: 'center' }}>No.</th>
                        <th style={{ border: '1px solid #004aad', padding: '8px', textAlign: 'left' }}>Item #</th>
                        <th style={{ border: '1px solid #004aad', padding: '8px', textAlign: 'left' }}>Description</th>
                        <th style={{ border: '1px solid #004aad', padding: '8px', textAlign: 'center' }}>Qty</th>
                        <th style={{ border: '1px solid #004aad', padding: '8px', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ border: '1px solid #004aad', padding: '8px', textAlign: 'right' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{item.line_number}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.item_number}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px', whiteSpace: 'pre-wrap' }}>{item.description}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{item.qty}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatCurrency(item.qty * item.unit_price)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={5} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Sub Total ({header.currency})</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(totals.sub_total)}</td>
                    </tr>
                    <tr>
                        <td colSpan={5} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>VAT 10% ({header.currency})</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(totals.vat_amount)}</td>
                    </tr>
                    <tr style={{ backgroundColor: '#f9f9f9' }}>
                        <td colSpan={5} style={{ border: '2px solid #004aad', padding: '8px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>Grand Total ({header.currency})</td>
                        <td style={{ border: '2px solid #004aad', padding: '8px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: '#004aad' }}>{formatCurrency(totals.grand_total)}</td>
                    </tr>
                </tfoot>
            </table>

            {/* Remarks */}
            {header.remarks && (
                <div style={{ marginBottom: '30px' }}>
                    <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '5px' }}>Remarks:</div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{header.remarks}</div>
                </div>
            )}

            {/* Signature Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
                <div style={{ textAlign: 'center', width: '200px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '60px' }}>PREPARED BY</div>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '10px' }}>
                        <strong>{header.prepared_by}</strong><br />
                        {header.prepared_by_position}
                    </div>
                </div>
                <div style={{ textAlign: 'center', width: '200px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '60px' }}>APPROVED BY</div>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '10px' }}>
                        <strong>{header.approved_by || '\u00A0'}</strong><br />
                        {header.approved_by_position}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintablePurchaseOrder;
