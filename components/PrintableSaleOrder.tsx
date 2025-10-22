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
}

// Make the 'children' prop optional to allow for empty table cells.
const Td: React.FC<{ children?: React.ReactNode; colSpan?: number; rowSpan?: number; className?: string; isHeader?: boolean }> = 
({ children, colSpan, rowSpan, className, isHeader = false }) => {
    const baseClasses = "border border-black p-1 align-top";
    const headerClasses = isHeader ? "font-semibold" : "";
    return <td colSpan={colSpan} rowSpan={rowSpan} className={`${baseClasses} ${headerClasses} ${className}`}>{children}</td>
}


const PrintableSaleOrder: React.FC<PrintableSaleOrderProps> = ({ headerData, items }) => {
  const tableRows = 12; // Minimum number of rows to display in the items table
  const filledItems = [...items, ...Array(Math.max(0, tableRows - items.length)).fill({})];

  return (
    <div className="printable-area bg-white p-2 font-[Arial,sans-serif] text-[9px] text-black shadow-lg border border-gray-200 rounded-lg">
      <table className="w-full border-collapse">
        <tbody>
          {/* Row 1: Title */}
          <tr>
            <td colSpan={8} className="text-center py-2"><h1 className="text-lg font-bold">SALE ORDER</h1></td>
          </tr>
          
          {/* Header section */}
          <tr>
            <Td isHeader={true}>Company Name</Td>
            <Td colSpan={3}>: {headerData['Company Name']}</Td>
            <Td isHeader={true} colSpan={2}>SO No.</Td>
            <Td colSpan={2} isHeader={true}>: {headerData['Sale Order ID']}</Td>
          </tr>
          <tr>
            <Td isHeader={true} rowSpan={2}>Address</Td>
            <Td colSpan={3} rowSpan={2}>: {headerData['Company Address']}</Td>
            <Td isHeader={true} colSpan={2}>SO Date</Td>
            <Td colSpan={2}>: {headerData['Order Date'] ? new Date(headerData['Order Date'] + 'T00:00:00').toLocaleDateString('en-GB') : ''}</Td>
          </tr>
          <tr>
             <Td isHeader={true} colSpan={2}>Delivery Date</Td>
            <Td colSpan={2}>: {headerData['Delivery Date'] ? new Date(headerData['Delivery Date'] + 'T00:00:00').toLocaleDateString('en-GB') : ''}</Td>
          </tr>
          <tr>
            <Td isHeader={true}>Contact Person</Td>
            <Td colSpan={3}>: {headerData['Contact Person']}</Td>
            <Td isHeader={true} colSpan={2}>Payment Terms</Td>
            <Td colSpan={2}>: {headerData['Payment Term']}</Td>
          </tr>
          <tr>
            <Td isHeader={true}>Telephone</Td>
            <Td colSpan={3}>: {headerData['Contact Tel']}</Td>
            <Td isHeader={true} colSpan={2} className="border-b-0">Bill Invoice</Td>
            <Td colSpan={2} className="border-b-0">: {headerData['Bill Invoice']}</Td>
          </tr>
          <tr>
            <Td isHeader={true}>Email</Td>
            <Td colSpan={3}>: {headerData.Email}</Td>
            <Td colSpan={4} className="border-l-0"></Td>
          </tr>

          {/* Empty row for spacing */}
          <tr style={{ height: '10px' }}>
            <td colSpan={8}></td>
          </tr>

          {/* Items Table Header */}
          <tr className="print-bg-blue bg-brand-800 print-text-white text-white font-bold text-center">
            <Td className="w-[4%]">No.</Td>
            <Td className="w-[12%]">Item Code</Td>
            <Td colSpan={2} className="w-[38%]">Item Description</Td>
            <Td className="w-[6%]">Qty</Td>
            <Td className="w-[12%]">Unit Price</Td>
            <Td className="w-[12%]">Commission</Td>
            <Td className="w-[16%]">Amount</Td>
          </tr>

          {/* Items Rows */}
          {filledItems.map((item, index) => (
            <tr key={item.id || `fill-${index}`} style={{height: '40px'}}>
              <Td className="text-center">{item.no || ''}</Td>
              <Td>{item.itemCode || ''}</Td>
              <Td colSpan={2} className="whitespace-pre-wrap">{item.description || ''}</Td>
              <Td className="text-center">{item.qty || ''}</Td>
              <Td className="text-right">{item.unitPrice ? `$${item.unitPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : ''}</Td>
              <Td className="text-right">{item.commission ? `$${item.commission.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : (item.no ? '$ -' : '')}</Td>
              <Td className="text-right">{item.amount ? `$${item.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : (item.no ? '$ -' : '')}</Td>
            </tr>
          ))}
          
          {/* Footer section */}
          <tr>
            <Td colSpan={3} className="border-b-0 font-semibold">Install Software</Td>
            <Td colSpan={5} className="border-b-0">: {headerData['Install Software']}</Td>
          </tr>
          <tr>
            <Td colSpan={8} className="border-t-0"></Td>
          </tr>
          
        </tbody>
      </table>
    </div>
  );
};

export default PrintableSaleOrder;