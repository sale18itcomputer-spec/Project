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
    subTotal: number; // Sum of item amounts (pre-tax)
    vat: number;
    grandTotal: number; // Final total (post-tax)
  };
}

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="grid grid-cols-[100px_auto_1fr] gap-x-2">
        <span className="font-semibold">{label}</span>
        <span>:</span>
        <span className="break-words">{value}</span>
    </div>
);


const PrintableQuotation: React.FC<PrintableQuotationProps> = ({ headerData, items, totals }) => {
  return (
    <div className="printable-area bg-white p-8 font-[Arial,sans-serif] text-sm text-black shadow-lg border border-gray-200 rounded-lg">
      {/* Header */}
      <header className="flex justify-between items-start pb-4">
        <div className="flex items-center pt-2">
            <img src="https://i.imgur.com/Hur36Vc.png" alt="L'IMPERIAL TECHNOLOGY CO., LTD." className="h-12 w-auto" />
        </div>
        <div className="text-right text-[10px] text-gray-700">
          <h1 className="text-xl font-bold text-[#004aad]">L'IMPERIAL TECHNOLOGY CO., LTD.</h1>
          <p>Tel : (+855) 92 218 333 || Email : info@limperialtech.com || Website : www.limperialtech.com</p>
          <p>Address : Building #15, Street Ayeaksmalyean Ho (139), Sangkat Srah Chak, Khan Daun Penh, Phnom Penh, Cambodia.</p>
        </div>
      </header>

      {/* Title */}
      <div className="text-center my-4">
        <h2 className="text-2xl font-extrabold underline tracking-wider" style={{textDecorationThickness: '2px'}}>QUOTATION</h2>
      </div>

      {/* Customer and Order Details */}
      <section className="grid grid-cols-2 gap-8 my-6 text-[11px]">
        {/* Left Side: Customer Info */}
        <div className="space-y-1">
            <DetailRow label="Company Name" value={headerData['Company Name'] || '{{Company Name}}'} />
            {/* Custom Address Row to simulate merged rows and handle multiline addresses */}
            <div className="grid grid-cols-[100px_auto_1fr] gap-x-2">
                <span className="font-semibold self-start">Address</span>
                <span className="self-start">:</span>
                <span className="break-words whitespace-pre-wrap min-h-[3em]">{headerData['Company Address'] || '{{Company Address}}'}</span>
            </div>
            <DetailRow label="Contact Person" value={headerData['Contact Person'] || '{{Contact Person}}'} />
            <DetailRow label="Tel" value={headerData['Contact Tel'] || '{{Contact Tel}}'} />
            <DetailRow label="Email" value={headerData['Contact Email'] || '{{Contact Email}}'} />
        </div>
        {/* Right Side: Quote Info */}
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <span className="font-semibold text-right">Quotation No:</span>
            <span className="font-bold text-base">{headerData['Quotation ID'] || '{{Quotation ID}}'}</span>
            
            <span className="font-semibold text-right">Quote Date:</span>
            <span>{headerData['Quote Date'] ? new Date(headerData['Quote Date'] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric'}) : '{{Quote Date}}'}</span>
            
            <span className="font-semibold text-right">Validity:</span>
            <span>{headerData['Validity Date'] ? new Date(headerData['Validity Date'] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric'}) : '{{Validity Date}}'}</span>

            <span className="font-semibold text-right">Status:</span>
            <span>{headerData['Stock Status'] || '{{Stock Status}}'}</span>
            
            <span className="font-semibold text-right">Payment Term:</span>
            <span>{headerData['Payment Term'] || '{{Payment Term}}'}</span>
        </div>
      </section>

      {/* Items Table */}
      <table className="w-full border-collapse border-t border-l border-r border-black text-[11px]">
        <thead>
          <tr className="print-bg-blue bg-[#004aad] print-text-white text-white font-bold">
            <th className="p-1 w-[4%] text-center border-b border-r border-black">No.</th>
            <th className="p-1 w-[12%] border-b border-r border-black">Item Code</th>
            <th className="p-1 w-[48%] border-b border-r border-black">Item Description</th>
            <th className="p-1 w-[6%] text-center border-b border-r border-black">Qty</th>
            <th className="p-1 w-[15%] text-center border-b border-r border-black">Unit Price</th>
            <th className="p-1 w-[15%] text-center border-b border-black">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.flatMap((item) => {
            const specs = (item.description || '').split('\n').filter(line => line.trim() !== '');

            const mainRow = (
              <tr key={item.id}>
                <td className="p-1 text-center border-b border-r border-black align-top">{item.no}</td>
                <td className="p-1 border-b border-r border-black align-top">{item.itemCode || ''}</td>
                <td className="p-1 border-b border-r border-black align-top">
                  <strong className="font-bold">{item.modelName}</strong>
                </td>
                <td className="p-1 text-center border-b border-r border-black align-top">{item.qty}</td>
                <td className="p-1 text-right border-b border-r border-black align-top">${item.unitPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td className="p-1 text-right font-semibold border-b border-black align-top">${item.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
            );
            
            if (specs.length === 0) {
              return [mainRow];
            }

            const descriptionRow = (
              <tr key={`${item.id}-desc`}>
                <td className="p-1 border-b border-r border-black">&nbsp;</td>
                <td className="p-1 border-b border-r border-black">&nbsp;</td>
                <td className="p-1 border-b border-r border-black align-top">
                  <div className="whitespace-pre-wrap pl-4 text-gray-700 text-[10px]">{specs.map(spec => `- ${spec}`).join('\n')}</div>
                </td>
                <td className="p-1 border-b border-r border-black">&nbsp;</td>
                <td className="p-1 border-b border-r border-black">&nbsp;</td>
                <td className="p-1 border-b border-black">&nbsp;</td>
              </tr>
            );

            return [mainRow, descriptionRow];
          })}
          
          {[...Array(Math.max(0, 10 - items.reduce((totalRows, item) => totalRows + (item.description && item.description.trim() ? 2 : 1), 0)))].map((_, i) => (
              <tr key={`fill-${i}`} style={{height: '24px'}}>
                  <td className="p-1 border-b border-r border-black">&nbsp;</td>
                  <td className="p-1 border-b border-r border-black"></td>
                  <td className="p-1 border-b border-r border-black"></td>
                  <td className="p-1 border-b border-r border-black"></td>
                  <td className="p-1 border-b border-r border-black"></td>
                  <td className="p-1 border-b border-black"></td>
              </tr>
          ))}
        </tbody>
        <tfoot className="text-[11px]">
          <tr>
            <td colSpan={4} className="p-1 border-b border-r border-black align-top" rowSpan={3}>
              <p className="font-bold">*** Remark :</p>
            </td>
            <td className="p-1 font-bold text-right border-b border-r border-black">Sub Total (USD)</td>
            <td className="p-1 text-right font-bold border-b border-black w-[130px]">
              ${totals.subTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </td>
          </tr>
          <tr>
            <td className="p-1 font-bold text-right border-b border-r border-black">VAT 10% (USD)</td>
            <td className="p-1 text-right border-b border-black w-[130px]">
              ${totals.vat.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </td>
          </tr>
          <tr>
            <td className="p-1 font-bold text-right border-b border-r border-black">Grand Total (USD)</td>
            <td className="p-1 text-right border-b border-black w-[130px]">
              ${totals.grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </td>
          </tr>
        </tfoot>
      </table>

    </div>
  );
};

export default PrintableQuotation;
