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
    isPromotion?: boolean;
}

interface QuotationPreviewProps {
    headerData: { [key: string]: any };
    items: LineItem[];
    totals: {
        subTotal: number;
        vat: number;
        grandTotal: number;
    };
    currency: 'USD' | 'KHR';
    signaturePadding?: number;
}

const LOGO_URL = 'https://i.postimg.cc/RFYdrpBC/Limperial-Technology-Logo01-png(004aad).png';

const getCurrencySymbol = (currency?: 'USD' | 'KHR'): string => {
    switch (currency) {
        case 'KHR': return '៛';
        default: return '$';
    }
};

const QuotationPreview: React.FC<QuotationPreviewProps> = ({ headerData, items, totals, currency, signaturePadding = 40 }) => {
    // Mirror the PDF builder routing: Non-VAT hides VAT TIN in header + customer info
    const isVat = (headerData['Tax Type'] || 'VAT').toUpperCase() !== 'NON-VAT';
    const sym = getCurrencySymbol(currency);
    const actualItems = items.filter(item => item.no > 0 || item.isPromotion);

    const fmtNum = (v: number | string) => {
        const n = typeof v === 'number' ? v : parseFloat(String(v)) || 0;
        if (!n) return '-';
        return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const fmtDate = (ds?: string) => {
        if (!ds) return '';
        const d = new Date(ds + 'T00:00:00');
        if (isNaN(d.getTime())) return ds;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const subTotal = totals.subTotal;
    const tax = totals.vat || 0;
    const grandTotal = totals.grandTotal;

    const termsHtml = headerData['Terms and Conditions']
        ? headerData['Terms and Conditions'].split('\n').map((line: string, i: number) => <p key={i} className="mb-1">{line}</p>)
        : (
            <>
                <ul style={{ paddingLeft: 16, margin: 0, listStyleType: 'disc' }}>
                    <li style={{ marginBottom: 4 }}><strong>Payment Terms:</strong> Full payment is required as per the agreed terms. Late payments may result in order suspension.</li>
                    <li style={{ marginBottom: 4 }}><strong>Goods Sold:</strong> All goods sold are non-refundable and exchangeable. Please inspect all goods carefully before signing.</li>
                    <li style={{ marginBottom: 4 }}><strong>Warranty:</strong> All goods sold are covered under Limperial Technology&apos;s warranty policy. Warranty does not cover unauthorized repairs or broken seals.</li>
                </ul>
            </>
        );

    return (
        <div className="printable-quotation-wrapper">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Koh+Santepheap:wght@400;700&family=Moul&display=swap');
                
                .printable-quotation-wrapper {
                  font-family: 'Koh Santepheap', sans-serif;
                  font-size: 11px;
                  color: #000;
                  background-color: #f3f4f6;
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 2rem 0;
                }
                
                .brand-blue { color: #0056b3; }
                .bg-brand-blue { background-color: #0056b3; }
                .border-brand-blue { border-color: #0056b3; }

                .quotation-table { width: 100%; border-collapse: collapse; }
                .quotation-table th, .quotation-table td { border: 1px solid #000; padding: 4px 8px; }

                @media print {
                  @page { size: A4; margin: 0; }
                  body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    background-color: white !important;
                  }
                  .printable-quotation-wrapper {
                    background-color: transparent;
                    padding: 0 !important;
                    display: block;
                  }
                  .a4-container {
                    box-shadow: none !important;
                    margin: 0 !important;
                    width: 210mm !important;
                    min-height: 297mm !important;
                    padding: 8mm !important;
                  }
                }
            `}</style>

            {/* BEGIN: MainInvoiceContainer */}
            <div className="bg-white p-8 w-[210mm] shadow-lg a4-container flex flex-col relative mx-auto" style={{ minHeight: '297mm' }}>
                {/* BEGIN: HeaderSection */}
                <header className="mb-6">
                    <div className="border-b-[3px] border-brand-blue pb-4 text-center relative pt-12">
                        <div className="absolute left-0 top-0">
                            <img alt="Company Logo" className="w-auto object-contain object-left h-10" src={LOGO_URL} />
                        </div>
                        <h1 className="text-xl font-bold mb-1" style={{ fontFamily: "'Moul', serif" }}>លីមភើរៀល ថេកណូឡូជី ឯ.ក</h1>
                        <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "'Times New Roman', serif" }}>LIMPERIAL TECHNOLOGY CO., LTD.</h2>
                        {isVat && <p className="font-bold mb-0.5">លេខអត្តសញ្ញាណកម្មអាករ (VAT TIN)៖ K003-902201968</p>}
                        <p className="text-[10px] mb-0.5">អាសយដ្ឋាន៖ #B15 (ជាន់ផ្ទាល់ដី ជាន់ទី១ ជាន់ទី២ ជាន់ទី៣ និង ជាន់ទី៤) ផ្លូវ អាយុស្ទើរយានយន្ត (១៣៩) ភូមិ ១ សង្កាត់ស្រះចក ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ</p>
                        <p className="text-[8px] whitespace-nowrap mb-0.5">Address: #B15 (Ground Floor 1st Floor 2nd Floor 3rd Floor and 4th Floor), East Railway (139), Phum 1, Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</p>
                        <p className="text-[10px] mb-0.5">E-mail: info@limperialtech.com || លេខទូរស័ព្ទ (Telephone): +855 92 218 333</p>
                    </div>
                </header>
                {/* END: HeaderSection */}

                {/* BEGIN: TitleSection */}
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold">សម្រង់តម្លៃ</h3>
                    <h4 className="text-lg font-bold">QUOTATION</h4>
                </div>
                {/* END: TitleSection */}

                {/* BEGIN: CustomerInfoSection */}
                <div className="flex justify-between gap-0 mb-6" style={{ alignItems: 'flex-start' }}>
                    {/* Left Column: Customer Details */}
                    <div className="w-[55%]">
                        <table className="border-none" style={{ tableLayout: 'fixed', width: '100%' }}>
                            <colgroup>
                                <col style={{ width: '100px' }} />
                                <col style={{ width: '16px' }} />
                                <col style={{ width: 'auto' }} />
                            </colgroup>
                            <tbody>
                                <tr>
                                    <td className="w-[80px] font-bold bg-white py-1 text-[10px] whitespace-nowrap leading-tight text-left !border-0">Customer</td>
                                    <td className="w-[10px] font-bold py-1 text-[10px] !border-0">:</td>
                                    <td className="w-auto !border-0 py-1 text-[10px]">{headerData['Company Name'] || ''}</td>
                                </tr>
                                <tr>
                                    <td className="w-[90px] font-bold bg-white py-1 text-[10px] whitespace-nowrap leading-tight text-left !border-0" style={{ verticalAlign: 'top' }}>Address</td>
                                    <td className="w-[14px] font-bold py-1 text-[10px] !border-0" style={{ verticalAlign: 'top' }}>:</td>
                                    <td className="w-auto py-1 text-[10px] !border-0" style={{ whiteSpace: 'normal', wordWrap: 'break-word', verticalAlign: 'top' }}>{headerData['Company Address'] || ''}</td>
                                </tr>
                                {isVat && (
                                    <tr>
                                    <td className="w-[80px] font-bold bg-white py-1 text-[10px] whitespace-nowrap leading-tight text-left !border-0">VAT TIN</td>
                                        <td className="w-[10px] font-bold py-1 text-[10px] !border-0">:</td>
                                        <td className="w-auto !border-0 py-1 text-[10px]">{headerData['VAT TIN'] || headerData['Company VAT TIN'] || headerData['Customer VAT TIN'] || ''}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td className="w-[80px] font-bold bg-white py-1 text-[10px] whitespace-nowrap leading-tight text-left !border-0">Contact Person</td>
                                    <td className="w-[10px] font-bold py-1 text-[10px] !border-0">:</td>
                                    <td className="w-auto !border-0 py-1 text-[10px]">{headerData['Contact Person'] || ''}</td>
                                </tr>
                                <tr>
                                    <td className="w-[80px] font-bold bg-white py-1 text-[10px] whitespace-nowrap leading-tight text-left !border-0">Telephone</td>
                                    <td className="w-[10px] font-bold py-1 text-[10px] !border-0">:</td>
                                    <td className="w-auto !border-0 py-1 text-[10px]">{headerData['Contact Tel'] || ''}</td>
                                </tr>
                                <tr>
                                    <td className="w-[80px] font-bold bg-white py-1 text-[10px] whitespace-nowrap leading-tight text-left !border-0">E-mail</td>
                                    <td className="w-[10px] font-bold py-1 text-[10px] !border-0">:</td>
                                    <td className="w-auto !border-0 py-1 text-[10px]">{headerData['Contact Email'] || ''}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {/* Right Column: Quotation Details */}
                    <div className="w-[45%] flex flex-col">
                        <table className="w-auto ml-auto border-none table-fixed">
                            <tbody>
                                <tr>
                                    <td className="w-[90px] font-bold bg-white py-1 text-[10px] whitespace-nowrap leading-tight text-left !border-0">Quotation N°</td>
                                    <td className="w-[10px] font-bold py-1 text-[10px] !border-0">:</td>
                                    <td className="w-auto !border-0 py-1 text-[10px]">{headerData['Quotation ID'] || ''}</td>
                                </tr>
                                <tr>
                                    <td className="w-[90px] font-bold bg-white py-1 text-[10px] whitespace-nowrap leading-tight text-left !border-0">Date</td>
                                    <td className="w-[10px] font-bold py-1 text-[10px] !border-0">:</td>
                                    <td className="w-auto !border-0 py-1 text-[10px]">{fmtDate(headerData['Quote Date'])}</td>
                                </tr>
                                <tr>
                                    <td className="w-[90px] font-bold bg-white py-1 text-[10px] whitespace-nowrap leading-tight text-left !border-0">Validity</td>
                                    <td className="w-[10px] font-bold py-1 text-[10px] !border-0">:</td>
                                    <td className="w-auto !border-0 py-1 text-[10px]">{fmtDate(headerData['Validity Date'])}</td>
                                </tr>
                                <tr>
                                    <td className="w-[90px] font-bold bg-white py-1 text-[10px] whitespace-nowrap leading-tight text-left !border-0">Status</td>
                                    <td className="w-[10px] font-bold py-1 text-[10px] !border-0">:</td>
                                    <td className="w-auto !border-0 py-1 text-[10px]">{headerData['Stock Status'] || ''}</td>
                                </tr>
                                <tr>
                                    <td className="w-[90px] font-bold bg-white py-1 text-[10px] whitespace-nowrap leading-tight text-left !border-0">Payment Term</td>
                                    <td className="w-[10px] font-bold py-1 text-[10px] !border-0">:</td>
                                    <td className="w-auto !border-0 py-1 text-[10px]">{headerData['Payment Term'] || ''}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                {/* END: CustomerInfoSection */}

                {/* BEGIN: ItemsTableSection */}
                <div className="flex-grow mb-12">
                    <table className="quotation-table mx-auto">
                        <thead>
                            <tr className="bg-brand-blue text-white text-center text-[9px]">
                                <th className="w-[5%] py-2 whitespace-nowrap leading-tight text-center font-normal">
                                    <div>ល.រ</div>
                                    <div>N°</div>
                                </th>
                                <th className="w-[15%] py-2 whitespace-nowrap leading-tight text-center font-normal">
                                    <div>លេខកូដទំនិញ</div>
                                    <div>Part Number</div>
                                </th>
                                <th className="w-[45%] py-2 whitespace-nowrap leading-tight text-center font-normal">
                                    <div>បរិយាយទំនិញ</div>
                                    <div>Description</div>
                                </th>
                                <th className="w-[10%] py-2 whitespace-nowrap leading-tight text-center font-normal">
                                    <div>បរិមាណ</div>
                                    <div>Quantity</div>
                                </th>
                                <th className="w-[12%] py-2 whitespace-nowrap leading-tight text-center font-normal">
                                    <div>តម្លៃឯកតា</div>
                                    <div>Unit Price</div>
                                </th>
                                <th className="w-[13%] py-2 whitespace-nowrap leading-tight text-center font-normal">
                                    <div>តម្លៃសរុប</div>
                                    <div>Amount</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {actualItems.map((item, index) => {
                                if (item.isPromotion) {
                                    const promoAmt = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0;
                                    const promoAbs = Math.abs(promoAmt);
                                    return (
                                        <tr key={item.id || index} className="text-center break-inside-avoid">
                                            <td className="align-top py-2"></td>
                                            <td className="align-top py-2"></td>
                                            <td className="text-left italic align-top py-2 text-[12px]" style={{ color: '#666' }}>{item.description || 'Cashback / Promotion'}</td>
                                            <td className="align-top py-2"></td>
                                            <td className="align-top py-2"></td>
                                            <td className="align-top py-2" style={{ color: '#c00000' }}>
                                                <div className="flex justify-between w-full"><span>{sym}</span><span>({fmtNum(promoAbs)})</span></div>
                                            </td>
                                        </tr>
                                    );
                                }
                                const price = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice)) || 0;
                                const amt = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0;
                                return (
                                    <tr key={item.id || index} className="text-center break-inside-avoid">
                                        <td className="align-top py-2">{item.no}</td>
                                        <td className="align-top py-2">{item.itemCode}</td>
                                        <td className="text-left align-top py-2">
                                            <div className="font-bold">{item.modelName}</div>
                                            {item.description && <div className="whitespace-pre-wrap mt-1">{item.description}</div>}
                                        </td>
                                        <td className="align-top py-2">{item.qty}</td>
                                        <td className="align-top py-2">
                                            <div className="flex justify-between w-full"><span>{sym}</span><span>{fmtNum(price)}</span></div>
                                        </td>
                                        <td className="align-top py-2">
                                            <div className="flex justify-between w-full"><span>{sym}</span><span>{fmtNum(amt)}</span></div>
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr>
                                <td className="align-top p-4 !border-none border-t border-black" colSpan={3} rowSpan={tax > 0 ? 3 : 2}>
                                    <div className="w-full text-[10px]">
                                        <p className="font-bold mb-2" style={{ textDecoration: 'underline', textTransform: 'uppercase' }}>*** Terms &amp; Conditions:</p>
                                        {termsHtml}
                                    </div>
                                </td>
                                <td className="font-bold whitespace-nowrap text-[10px] py-1.5 leading-tight text-right pr-2" colSpan={2}>សរុប / Sub Total</td>
                                <td className="align-middle"><div className="flex justify-between w-full font-bold"><span>{sym}</span><span>{fmtNum(subTotal)}</span></div></td>
                            </tr>
                            {tax > 0 && (
                                <tr>
                                    <td className="font-bold whitespace-nowrap text-[10px] py-1.5 leading-tight text-right pr-2" colSpan={2}>អាករលើតម្លៃបន្ថែម / VAT (10%)</td>
                                    <td className="align-middle"><div className="flex justify-between w-full font-bold"><span>{sym}</span><span>{fmtNum(tax)}</span></div></td>
                                </tr>
                            )}
                            <tr>
                                <td className="font-bold whitespace-nowrap text-[10px] py-1.5 leading-tight text-right pr-2" colSpan={2}>សរុបបូកបញ្ចូលប្រាក់ដុល្លារ / Grand Total in Dollar</td>
                                <td className="align-middle"><div className="flex justify-between w-full font-bold"><span>{sym}</span><span>{fmtNum(grandTotal)}</span></div></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                {/* END: ItemsTableSection */}

                {/* BEGIN: SignatureSection */}
                <div className="mt-auto flex justify-between px-4 pb-8 mx-auto w-full pt-10 break-inside-avoid">
                    <div className="w-[35%] text-center">
                        <p className="font-bold text-[11px] mb-20">Prepared By:</p>
                        <div className="border-t-[1.5px] border-black mb-1"></div>
                        <p className="text-[11px]">{headerData['Prepared By'] || headerData['Created By'] || ''}</p>
                        <p className="text-[11px]">{headerData['Prepared By Position'] || ''}</p>
                    </div>
                    <div className="w-[35%] text-center">
                        <p className="font-bold text-[11px] mb-20">Approved By:</p>
                        <div className="border-t-[1.5px] border-black mb-1"></div>
                        <p className="text-[11px]">{headerData['Approved By'] || ''}</p>
                        <p className="text-[11px]">{headerData['Approved By Position'] || ''}</p>
                    </div>
                </div>
                {/* END: SignatureSection */}
            </div>
            {/* END: MainInvoiceContainer */}
        </div>
    );
};

export default QuotationPreview;
