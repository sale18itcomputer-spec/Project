import React, { useState, useMemo, useEffect } from 'react';
import { SaleOrder, Company, Contact, Quotation } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { createRecord, updateRecord, createSaleOrderSheet, readQuotationSheetData } from '../services/api';
import { formatToSheetDate, formatToInputDate } from '../utils/time';
import { FormSection, FormInput, FormSelect, FormTextarea } from './FormControls';
import PrintableSaleOrder from './PrintableSaleOrder';
import SuccessModal from './SuccessModal';
import Spinner from './Spinner';
import DocumentEditorContainer from './DocumentEditorContainer';
import { Trash2, X } from 'lucide-react';

interface SaleOrderCreatorProps {
    onBack: () => void;
    existingSaleOrder: SaleOrder | null;
}

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

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const STATUS_OPTIONS: SaleOrder['Status'][] = ['Pending', 'Completed', 'Cancel'];
const BILL_INVOICE_OPTIONS = ['VAT', 'NON-VAT'];
const SOFTWARE_OPTIONS = ["Assembly", "Office User", "Design User", "Window 11", "Window 10", "Window 8", "Window 7"];


const SaleOrderCreator: React.FC<SaleOrderCreatorProps> = ({ onBack, existingSaleOrder }) => {
    const { saleOrders, companies, contacts, quotations, refetchData } = useData();
    const { currentUser } = useAuth();
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successInfo, setSuccessInfo] = useState<{ url: string; soNo: string } | null>(null);
    const [itemsLoading, setItemsLoading] = useState(false);

    const [items, setItems] = useState<LineItem[]>([{ id: `item-${Date.now()}`, no: 1, itemCode: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
    const [selectedSoftware, setSelectedSoftware] = useState<string[]>([]);

    const isFromQuote = useMemo(() => !!existingSaleOrder?.['Quote No.'], [existingSaleOrder]);
    
    const nextSaleOrderNumber = useMemo(() => {
        if (!saleOrders || saleOrders.length === 0) return 'S00000001';

        const maxNum = saleOrders.reduce((max, so) => {
            const numPartMatch = so['SO No.'].match(/\d+$/);
            if (!numPartMatch) return max;
            const numPart = parseInt(numPartMatch[0], 10);
            return isNaN(numPart) ? max : Math.max(max, numPart);
        }, 0);

        return `S${String(maxNum + 1).padStart(8, '0')}`;
    }, [saleOrders]);
    
    const [saleOrder, setSaleOrder] = useState<Partial<SaleOrder & { [key: string]: any }>>({});
    
    const lineItemInputClasses = "w-full text-sm p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition";


    useEffect(() => {
        const fetchQuoteItems = async (quoteId: string) => {
            setItemsLoading(true);
            setError('');
            try {
                const { items: fetchedItems } = await readQuotationSheetData(quoteId);
                if (fetchedItems && fetchedItems.length > 0) {
                    const newItems: LineItem[] = fetchedItems.map((item: any, index: number) => {
                        const modelName = (item.modelName || '').trim();
                        const itemDescription = (item.description || '').trim();
                        const descriptionParts = [];
                        if (modelName) descriptionParts.push(modelName);
                        if (itemDescription) descriptionParts.push(itemDescription);

                        return {
                            id: `item-${Date.now()}-${index}`,
                            no: item.no || index + 1,
                            itemCode: item.itemCode || '',
                            description: descriptionParts.join('\n'),
                            qty: item.qty || 1,
                            unitPrice: item.unitPrice || 0,
                            commission: 0, // Default commission to 0
                            amount: (item.qty || 1) * (item.unitPrice || 0),
                        };
                    });
                    setItems(newItems);
                }
            } catch (err: any) {
                setError(`Failed to fetch items from quote: ${err.message}`);
                setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
            } finally {
                setItemsLoading(false);
            }
        };
        
        if (existingSaleOrder) {
             setSaleOrder({
                ...existingSaleOrder,
                'SO No.': existingSaleOrder['SO No.'] || nextSaleOrderNumber,
                'SO Date': existingSaleOrder['SO Date'] ? formatToInputDate(existingSaleOrder['SO Date']) : getTodayDateString(),
                'Delivery Date': existingSaleOrder['Delivery Date'] ? formatToInputDate(existingSaleOrder['Delivery Date']) : getTodayDateString(),
            });

            if (existingSaleOrder['Quote No.']) {
                fetchQuoteItems(existingSaleOrder['Quote No.']);
            }
        } else {
             setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
            setSaleOrder({
                'SO No.': nextSaleOrderNumber,
                'SO Date': getTodayDateString(),
                'Delivery Date': getTodayDateString(),
                'Status': 'Pending',
                'Tax': '0',
                'Bill Invoice': 'NON-VAT',
                'Created By': currentUser?.Name || '',
            });
        }
    }, [existingSaleOrder, nextSaleOrderNumber, currentUser]);
    
    useEffect(() => {
        if (existingSaleOrder && existingSaleOrder['Install Software']) {
            setSelectedSoftware(existingSaleOrder['Install Software'].split(',').map(s => s.trim()).filter(Boolean));
        } else if (!existingSaleOrder) {
            setSelectedSoftware([]);
        }
    }, [existingSaleOrder]);

    useEffect(() => {
        setSaleOrder(prev => ({ ...prev, 'Install Software': selectedSoftware.join(', ') }));
    }, [selectedSoftware]);

    const handleAddSoftware = (software: string) => {
        if (software && !selectedSoftware.includes(software)) {
            setSelectedSoftware(prev => [...prev, software].sort());
        }
    };

    const handleRemoveSoftware = (softwareToRemove: string) => {
        setSelectedSoftware(prev => prev.filter(s => s !== softwareToRemove));
    };

    const handleItemChange = (id: string, field: keyof Omit<LineItem, 'id' | 'amount'>, value: string) => {
        setItems(currentItems => {
            const newItems = currentItems.map(item => {
                if (item.id === id) {
                    const updatedItem = { ...item } as any;
                    
                    if (field === 'qty' || field === 'unitPrice' || field === 'commission') {
                        const numericValue = parseFloat(String(value));
                        updatedItem[field] = isNaN(numericValue) ? 0 : numericValue;
                    } else {
                        updatedItem[field] = value;
                    }

                    updatedItem.amount = updatedItem.qty * updatedItem.unitPrice;
                    return updatedItem;
                }
                return item;
            });
            return newItems.map((item, index) => ({ ...item, no: index + 1 }));
        });
    };

    const addItem = () => {
        setItems(prev => [...prev, { id: `item-${Date.now()}`, no: prev.length + 1, itemCode: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
    };

    const removeItem = (id: string) => {
        setItems(prev => {
            const newItems = prev.filter(item => item.id !== id);
            return newItems.map((item, index) => ({ ...item, no: index + 1 }));
        });
    };
    
    const totals = useMemo(() => {
        const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
        const tax = parseFloat(saleOrder.Tax || '0') || 0;
        const grandTotal = subTotal + tax;
        return { subTotal, tax, grandTotal };
    }, [items, saleOrder.Tax]);

    useEffect(() => {
        setSaleOrder(prev => ({...prev, 'Total Amount': String(totals.grandTotal)}));
    }, [totals.grandTotal])

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSaleOrder(prev => ({...prev, [name]: value}));
    }

    const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const companyName = e.target.value;
        setSaleOrder(prev => ({ ...prev, 'Company Name': companyName, 'Contact Name': '', 'Phone Number': '', 'Email': '', 'Quote No.': '' }));
    }
    
    const handleContactChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const contactName = e.target.value;
        const contact = contacts?.find(c => c.Name === contactName);
        setSaleOrder(prev => ({ ...prev, 'Contact Name': contactName, 'Phone Number': contact?.['Tel (1)'] || '', 'Email': contact?.Email || '' }));
    };
    
    const handleQuoteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const quoteId = e.target.value;
        const quote = quotations?.find(q => q['Quote No.'] === quoteId);
        if (quote) {
            setSaleOrder(prev => ({ ...prev, 'Quote No.': quoteId, 'Company Name': quote['Company Name'], 'Contact Name': quote['Contact Name'], 'Phone Number': quote['Contact Number'], 'Total Amount': quote.Amount, Status: 'Confirmed' }));
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const masterSheetData: SaleOrder = {
                'SO No.': saleOrder['SO No.'] || nextSaleOrderNumber,
                'SO Date': formatToSheetDate(saleOrder['SO Date']),
                'File': saleOrder.File || '',
                'Quote No.': saleOrder['Quote No.'] || '',
                'Company Name': saleOrder['Company Name'] || '',
                'Contact Name': saleOrder['Contact Name'] || '',
                'Phone Number': saleOrder['Phone Number'] || '',
                'Email': saleOrder.Email || '',
                'Tax': saleOrder.Tax || '0',
                'Total Amount': String(totals.grandTotal),
                'Commission': saleOrder.Commission || '',
                'Status': saleOrder.Status || 'Pending',
                'Delivery Date': saleOrder['Delivery Date'],
                'Payment Term': saleOrder['Payment Term'],
                'Bill Invoice': saleOrder['Bill Invoice'],
                'Install Software': saleOrder['Install Software'],
                'Created By': saleOrder['Created By'] || currentUser?.Name || '',
            };

            const companyDetails = companies?.find(c => c['Company Name'] === masterSheetData['Company Name']);
            const sheetGenerationData = {
                'SO NO.': masterSheetData['SO No.'], // Match key for Apps Script
                'Sale Order ID': masterSheetData['SO No.'],
                'Order Date': saleOrder['SO Date'],
                'Company Name': masterSheetData['Company Name'],
                'Company Address': companyDetails?.['Address (English)'] || '',
                'Contact Person': masterSheetData['Contact Name'],
                'Contact Tel': masterSheetData['Phone Number'],
                'Email': masterSheetData.Email,
                'Payment Term': saleOrder['Payment Term'] || companyDetails?.['Payment Term'] || '',
                'Prepared By': currentUser?.Name || '',
                'Grand Total': totals.grandTotal,
                'VAT': totals.tax,
                'Sub Total': totals.subTotal,
                'ItemsJSON': JSON.stringify(items),
                'Install Software': masterSheetData['Install Software'],
                'Bill Invoice': masterSheetData['Bill Invoice'],
                'Delivery Date': saleOrder['Delivery Date']
            };

            const { url } = await createSaleOrderSheet(masterSheetData['SO No.'], sheetGenerationData);
            masterSheetData.File = `=HYPERLINK("${url}", "${masterSheetData['SO No.']}")`;

            if(existingSaleOrder && existingSaleOrder['SO No.']) {
                await updateRecord('Sale Orders', existingSaleOrder['SO No.'], masterSheetData);
            } else {
                await createRecord('Sale Orders', masterSheetData);
            }
            
            await refetchData();
            setSuccessInfo({ url: url || '#', soNo: masterSheetData['SO No.'] });

        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const contactOptions = useMemo(() => contacts?.filter(c => c['Company Name'] === saleOrder['Company Name']).map(c => c.Name) || [], [contacts, saleOrder]);
    const quoteOptions = useMemo(() => quotations?.filter(q => q['Company Name'] === saleOrder['Company Name']).map(q => q['Quote No.']) || [], [quotations, saleOrder]);

    return (
       <>
         <DocumentEditorContainer
            title={existingSaleOrder ? `Edit Sale Order ${existingSaleOrder['SO No.']}` : "Create New Sale Order"}
            onBack={onBack}
            onSave={handleSave}
            onPrint={() => window.print()}
            isSubmitting={isSubmitting}
            saveButtonText="Save & Generate File"
         >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form Section */}
                <div className="space-y-6">
                    <FormSection title="Customer & Order Info">
                        <FormSelect name="Company Name" label="Company" value={saleOrder['Company Name']} onChange={handleCompanyChange} options={companyOptions} required />
                        <FormSelect name="Contact Name" label="Contact" value={saleOrder['Contact Name']} onChange={handleContactChange} options={contactOptions} disabled={!saleOrder['Company Name']} />
                        <FormInput name="SO No." label="Sale Order No." value={saleOrder['SO No.']} onChange={handleHeaderChange} readOnly required />
                        <FormInput name="SO Date" label="Order Date" value={saleOrder['SO Date']} onChange={handleHeaderChange} type="date" required />
                    </FormSection>

                    <FormSection title="Financial & Delivery">
                        <FormSelect name="Quote No." label="From Quotation" value={saleOrder['Quote No.']} onChange={handleQuoteChange} options={quoteOptions} disabled={!saleOrder['Company Name']} />
                        <FormInput name="Payment Term" label="Payment Term" value={saleOrder['Payment Term']} onChange={handleHeaderChange} />
                        <FormSelect name="Bill Invoice" label="Bill Invoice" value={saleOrder['Bill Invoice']} onChange={handleHeaderChange} options={BILL_INVOICE_OPTIONS} />
                        <FormInput name="Delivery Date" label="Delivery Date" value={saleOrder['Delivery Date']} onChange={handleHeaderChange} type="date" />
                    </FormSection>
                    
                    <FormSection title="Software Installation">
                        <div className="md:col-span-2">
                             <div className="flex gap-2 items-end">
                                <FormSelect name="software_select" label="Select Software" value={""} onChange={(e) => handleAddSoftware(e.target.value)} options={SOFTWARE_OPTIONS.filter(s => !selectedSoftware.includes(s))}/>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {selectedSoftware.map(software => (
                                    <span key={software} className="inline-flex items-center py-1.5 pl-3 pr-2 bg-brand-100 text-brand-800 rounded-full text-sm font-medium">
                                        {software}
                                        <button type="button" onClick={() => handleRemoveSoftware(software)} className="ml-2 flex-shrink-0 bg-brand-200 hover:bg-brand-300 text-brand-700 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </FormSection>
                    
                     <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Line Items</h3>
                        {itemsLoading ? <div className="text-center p-8"><Spinner /></div> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="text-left text-xs text-slate-500">
                                        <th className="p-2 w-12">No.</th><th className="p-2">Item Code</th><th className="p-2">Description</th>
                                        <th className="p-2 w-20">Qty</th><th className="p-2 w-28">Unit Price</th><th className="p-2 w-28">Commission</th>
                                        <th className="p-2 w-28">Amount</th><th className="p-2 w-10"></th>
                                    </tr></thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.id} className="border-t border-slate-200 group">
                                                <td className="p-1"><input type="text" value={item.no} readOnly className="w-full bg-slate-50 text-center text-slate-600 border-slate-200 rounded-md"/></td>
                                                <td className="p-1"><input type="text" value={item.itemCode} onChange={e => handleItemChange(item.id, 'itemCode', e.target.value)} className={lineItemInputClasses} /></td>
                                                <td className="p-1"><textarea value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)} className={lineItemInputClasses} rows={2} /></td>
                                                <td className="p-1"><input type="number" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', e.target.value)} className={lineItemInputClasses} /></td>
                                                <td className="p-1"><input type="number" step="0.01" value={item.unitPrice} onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value)} className={lineItemInputClasses} /></td>
                                                <td className="p-1"><input type="number" step="0.01" value={item.commission} onChange={e => handleItemChange(item.id, 'commission', e.target.value)} className={lineItemInputClasses} /></td>
                                                <td className="p-1"><input type="text" value={`$${item.amount.toFixed(2)}`} readOnly className="w-full bg-slate-50 text-right text-slate-600 border-slate-200 rounded-md"/></td>
                                                <td className="p-1 text-center"><button type="button" onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-600 p-1 rounded-full hover:bg-rose-100 opacity-50 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <button type="button" onClick={addItem} className="mt-4 text-sm font-semibold text-brand-600 hover:underline">+ Add Item</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Preview Section */}
                <div className="print-only-container">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 screen-only">Live Preview</h3>
                    <div className="w-full bg-slate-200 p-4 sm:p-8 screen-only overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                         <PrintableSaleOrder
                            headerData={{
                                'Sale Order ID': saleOrder['SO No.'],
                                'Order Date': saleOrder['SO Date'],
                                'Delivery Date': saleOrder['Delivery Date'],
                                'Company Name': saleOrder['Company Name'],
                                'Company Address': companies?.find(c => c['Company Name'] === saleOrder['Company Name'])?.['Address (English)'] || '',
                                'Contact Person': saleOrder['Contact Name'],
                                'Contact Tel': saleOrder['Phone Number'],
                                'Email': saleOrder.Email,
                                'Payment Term': saleOrder['Payment Term'],
                                'Bill Invoice': saleOrder['Bill Invoice'],
                                'Install Software': saleOrder['Install Software'],
                            }}
                            items={items}
                            totals={totals}
                        />
                    </div>
                </div>
            </div>
         </DocumentEditorContainer>
         {successInfo && (
            <SuccessModal
                isOpen={true}
                onClose={() => { setSuccessInfo(null); onBack(); }}
                title="Sale Order Saved!"
                message={<p>Sale Order <strong>{successInfo.soNo}</strong> has been successfully saved.</p>}
                actionButtonLink={successInfo.url}
                actionButtonText="View Sale Order Sheet"
            />
         )}
       </>
    );
};

export default SaleOrderCreator;