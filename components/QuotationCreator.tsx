import React, { useState, useMemo, useEffect } from 'react';
import { Quotation, Company, Contact } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { createRecord, updateRecord, createQuotationSheet, readQuotationSheetData } from '../services/api';
import { formatToSheetDate, formatToInputDate } from '../utils/time';
import { FormSection, FormInput, FormSelect, FormTextarea } from './FormControls';
import PrintableQuotation from './PrintableQuotation';
// FIX: Replaced non-modular local icon import with an icon from the 'lucide-react' library.
import { Trash2 } from 'lucide-react';
import Spinner from './Spinner';
import SuccessModal from './SuccessModal';
import DocumentEditorContainer from './DocumentEditorContainer';

interface QuotationCreatorProps {
    onBack: () => void;
    existingQuotation: Quotation | null;
}

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


const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const STATUS_OPTIONS: Quotation['Status'][] = ['Open', 'Close (Win)', 'Close (Lose)', 'Cancel'];

const QuotationCreator: React.FC<QuotationCreatorProps> = ({ onBack, existingQuotation }) => {
    const { quotations, companies, contacts, refetchData } = useData();
    const { currentUser } = useAuth();
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [itemsLoading, setItemsLoading] = useState(false);
    const [successInfo, setSuccessInfo] = useState<{ url: string; quoteNo: string } | null>(null);

    const [items, setItems] = useState<LineItem[]>([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]);
    
    const nextQuotationNumber = useMemo(() => {
        if (existingQuotation) return existingQuotation['Quote No.'];
        if (!quotations || quotations.length === 0) return 'Q-0000001';

        const maxNum = quotations.reduce((max, q) => {
            const numPart = parseInt(q['Quote No.'].replace('Q-', ''), 10);
            return isNaN(numPart) ? max : Math.max(max, numPart);
        }, 0);

        return `Q-${String(maxNum + 1).padStart(7, '0')}`;
    }, [quotations, existingQuotation]);
    
    const [quote, setQuote] = useState<Partial<Quotation & { [key: string]: any }>>(() => {
        if (existingQuotation) {
            return {
                ...existingQuotation,
                'Quote Date': existingQuotation['Quote Date'] ? formatToInputDate(existingQuotation['Quote Date']) : getTodayDateString(),
                'Validity Date': existingQuotation['Validity Date'] ? formatToInputDate(existingQuotation['Validity Date']) : getTodayDateString(),
            };
        }
        return {
            'Quote No.': nextQuotationNumber,
            'Quote Date': getTodayDateString(),
            'Validity Date': getTodayDateString(),
            'Status': 'Open',
            'Created By': currentUser?.Name || '',
        };
    });

     useEffect(() => {
        // Wait until we have an existing quotation and the master data to perform lookups.
        if (!existingQuotation || !existingQuotation['Quote No.'] || !companies || !contacts) {
            // If we have an existing quote but no master data yet, we can still show the items loading spinner
            if (existingQuotation) {
                setItemsLoading(true);
            }
            return;
        }

        const fetchDetails = async () => {
            setItemsLoading(true);
            setError('');
            try {
                const response = await readQuotationSheetData(existingQuotation['Quote No.']);
                if (!response) {
                    throw new Error('Failed to fetch quotation details: empty response.');
                }

                const { header, items: fetchedItems } = response;

                // Start building the quote data by merging the master record with the detailed header info from the sheet.
                // This ensures all fields are populated correctly.
                let updatedQuoteData = {
                    ...existingQuotation,
                    ...header,
                    'Quote Date': header['Quote Date'] ? formatToInputDate(header['Quote Date']) : formatToInputDate(existingQuotation['Quote Date']),
                    'Validity Date': header['Validity Date'] ? formatToInputDate(header['Validity Date']) : formatToInputDate(existingQuotation['Validity Date']),
                };

                // ---- "Smart Fallback" Logic ----
                const companyName = updatedQuoteData['Company Name'];
                const contactName = updatedQuoteData['Contact Name'];

                if (companyName) {
                    const matchedCompany = companies.find(c => c['Company Name'] === companyName);
                    if (matchedCompany) {
                        if (!updatedQuoteData['Company Address']) {
                            updatedQuoteData['Company Address'] = matchedCompany['Address (English)'];
                        }
                        if (!updatedQuoteData['Payment Term']) {
                            updatedQuoteData['Payment Term'] = matchedCompany['Payment Term'];
                        }
                    }
                }

                if (contactName) {
                    const matchedContact = contacts.find(c => c.Name === contactName && c['Company Name'] === companyName);
                    if (matchedContact) {
                        if (!updatedQuoteData['Contact Number']) {
                            updatedQuoteData['Contact Number'] = matchedContact['Tel (1)'];
                        }
                        if (!updatedQuoteData['Contact Email']) {
                            updatedQuoteData['Contact Email'] = matchedContact.Email;
                        }
                    }
                }
                
                setQuote(updatedQuoteData);
                
                // Update line items state
                if (fetchedItems && fetchedItems.length > 0) {
                    const formattedItems = fetchedItems.map((item: any) => ({
                        ...item,
                        id: `item-${Date.now()}-${Math.random()}`,
                    }));
                    setItems(formattedItems);
                } else {
                    setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]);
                }
            } catch(err: any) {
                setError(`Failed to load quotation details: ${err.message}`);
            } finally {
                setItemsLoading(false);
            }
        };

        fetchDetails();

    }, [existingQuotation, companies, contacts]);
    
    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const contactOptions = useMemo(() => contacts?.filter(c => c['Company Name'] === quote['Company Name']).map(c => c.Name) || [], [contacts, quote]);

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setQuote(prev => ({ ...prev, [name]: value }));
    };
    
    const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const companyName = e.target.value;
        const company = companies?.find(c => c['Company Name'] === companyName);
        setQuote(prev => ({
            ...prev,
            'Company Name': companyName,
            'Company Address': company?.['Address (English)'] || '',
            'Contact Name': '',
            'Contact Number': '',
            'Contact Email': '',
            'Payment Term': company?.['Payment Term'] || '',
        }));
    };
    
    const handleContactChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const contactName = e.target.value;
        const contact = contacts?.find(c => c.Name === contactName);
        setQuote(prev => ({ ...prev, 'Contact Name': contactName, 'Contact Number': contact?.['Tel (1)'] || '', 'Contact Email': contact?.Email || '' }));
    };

    const handleItemChange = (id: string, field: keyof Omit<LineItem, 'id' | 'amount' | 'no'>, value: string | number) => {
        setItems(currentItems => {
            const newItems = currentItems.map(item => {
                if (item.id === id) {
                    const updatedItem = { ...item, [field]: value };
                    updatedItem.amount = updatedItem.qty * updatedItem.unitPrice;
                    return updatedItem;
                }
                return item;
            });
            // Renumber items, skipping empty description rows
            let currentNo = 1;
            return newItems.map(item => {
                if(item.itemCode || item.modelName || item.qty || item.unitPrice) {
                    return {...item, no: currentNo++}
                }
                return {...item, no: 0}; // Use 0 for description rows
            });
        });
    };

    const addItem = (afterId?: string) => {
        setItems(prev => {
            const newItem = { id: `item-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 };
            const index = afterId ? prev.findIndex(item => item.id === afterId) + 1 : prev.length;
            const newItems = [...prev.slice(0, index), newItem, ...prev.slice(index)];
            
            let currentNo = 1;
            return newItems.map(item => {
                if(item.itemCode || item.modelName || item.qty || item.unitPrice) {
                    return {...item, no: currentNo++}
                }
                return {...item, no: 0};
            });
        });
    };
    
    const addDescriptionRow = (afterId: string) => {
        setItems(prev => {
            const newItem = { id: `desc-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 0, unitPrice: 0, amount: 0 };
            const index = prev.findIndex(item => item.id === afterId) + 1;
            return [...prev.slice(0, index), newItem, ...prev.slice(index)];
        });
    };

    const removeItem = (id: string) => {
        setItems(prev => {
            const newItems = prev.filter(item => item.id !== id);
             let currentNo = 1;
            return newItems.map(item => {
                if(item.itemCode || item.modelName || item.qty || item.unitPrice) {
                    return {...item, no: currentNo++}
                }
                return {...item, no: 0};
            });
        });
    };
    
    const totals = useMemo(() => {
        const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
        const vat = subTotal * 0.1;
        const grandTotal = subTotal + vat;
        return { subTotal, vat, grandTotal };
    }, [items]);

    const handleSave = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            // Data for master Quotations sheet
            const masterSheetData: Quotation = {
                'Quote No.': quote['Quote No.'] || nextQuotationNumber,
                'File': quote.File || '', // Will be updated after sheet creation
                'Quote Date': formatToSheetDate(quote['Quote Date']),
                'Validity Date': formatToSheetDate(quote['Validity Date']),
                'Company Name': quote['Company Name'] || '',
                'Company Address': quote['Company Address'] || '',
                'Contact Name': quote['Contact Name'] || '',
                'Contact Number': quote['Contact Number'] || '',
                'Contact Email': quote['Contact Email'] || '',
                'Amount': String(totals.grandTotal),
                'CM': quote.CM || '',
                'Status': quote.Status || 'Open',
                'Reason': quote.Reason || '',
                'Payment Term': quote['Payment Term'] || '',
                'Stock Status': quote['Stock Status'] || '',
                'Created By': quote['Created By'] || currentUser?.Name || '',
            };
            
            // Data for individual quotation sheet template
            const sheetGenerationData = {
                'Quotation ID': masterSheetData['Quote No.'],
                'Quote Date': quote['Quote Date'],
                'Validity Date': quote['Validity Date'],
                'Company Name': quote['Company Name'],
                'Company Address': quote['Company Address'],
                'Contact Person': quote['Contact Name'],
                'Contact Tel': quote['Contact Number'],
                'Contact Email': quote['Contact Email'],
                'Payment Term': quote['Payment Term'],
                'Stock Status': quote['Stock Status'],
                'ItemsJSON': JSON.stringify(items.map(i => ({...i, description: `${i.modelName}\n${i.description}`}))),
            };

            const { url } = await createQuotationSheet(masterSheetData['Quote No.'], sheetGenerationData);
            masterSheetData.File = `=HYPERLINK("${url}", "${masterSheetData['Quote No.']}")`;

            if(existingQuotation) {
                await updateRecord('Quotations', existingQuotation['Quote No.'], masterSheetData);
            } else {
                await createRecord('Quotations', masterSheetData);
            }
            
            await refetchData();
            setSuccessInfo({ url: url || '#', quoteNo: masterSheetData['Quote No.'] });
            
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handlePrint = () => {
        window.print();
    }
    
    const lineItemInputClasses = "w-full text-sm p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition";

    return (
       <>
         <DocumentEditorContainer
            title={existingQuotation ? `Edit Quotation ${existingQuotation['Quote No.']}` : "Create New Quotation"}
            onBack={onBack}
            onSave={handleSave}
            onPrint={handlePrint}
            isSubmitting={isSubmitting}
         >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form Section */}
                <div className="space-y-6">
                    <FormSection title="Customer Info">
                        <FormSelect name="Company Name" label="Company Name" value={quote['Company Name']} onChange={handleCompanyChange} options={companyOptions} required />
                        <FormSelect name="Contact Name" label="Contact Person" value={quote['Contact Name']} onChange={handleContactChange} options={contactOptions} disabled={!quote['Company Name']} />
                        <FormTextarea name="Company Address" label="Address" value={quote['Company Address']} onChange={handleHeaderChange} rows={3} />
                        <FormInput name="Contact Number" label="Tel" value={quote['Contact Number']} onChange={handleHeaderChange} readOnly />
                        <FormInput name="Contact Email" label="Email" value={quote['Contact Email']} onChange={handleHeaderChange} readOnly />
                    </FormSection>

                    <FormSection title="Quotation Info">
                        <FormInput name="Quote No." label="Quotation No." value={quote['Quote No.']} onChange={handleHeaderChange} readOnly required />
                        <FormInput name="Quote Date" label="Quote Date" value={quote['Quote Date']} onChange={handleHeaderChange} type="date" required />
                        <FormInput name="Validity Date" label="Validity" value={quote['Validity Date']} onChange={handleHeaderChange} type="date" required />
                        <FormInput name="Payment Term" label="Payment Term" value={quote['Payment Term']} onChange={handleHeaderChange} />
                        <FormInput name="Stock Status" label="Stock Status" value={quote['Stock Status']} onChange={handleHeaderChange} />
                        <FormSelect name="Status" label="Status" value={quote.Status} onChange={handleHeaderChange} options={STATUS_OPTIONS} required />
                        <FormTextarea name="Reason" label="Reason (if not Open)" value={quote.Reason} onChange={handleHeaderChange} rows={2} />
                    </FormSection>
                    
                     <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Line Items</h3>
                        {itemsLoading ? <div className="text-center p-8"><Spinner /></div> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-slate-500">
                                            <th className="p-2 w-16">No.</th>
                                            <th className="p-2">Item Code</th>
                                            <th className="p-2">Description</th>
                                            <th className="p-2 w-20">Qty</th>
                                            <th className="p-2 w-32">Unit Price</th>
                                            <th className="p-2 w-32">Amount</th>
                                            <th className="p-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.id} className="border-t border-slate-200 group">
                                                <td className="p-1"><input type="text" value={item.no || ''} readOnly className="w-full bg-slate-50 text-center text-slate-600 border-slate-200 rounded-md"/></td>
                                                <td className="p-1"><input type="text" value={item.itemCode} onChange={e => handleItemChange(item.id, 'itemCode', e.target.value)} className={lineItemInputClasses} /></td>
                                                <td className="p-1">
                                                    <input type="text" value={item.modelName} onChange={e => handleItemChange(item.id, 'modelName', e.target.value)} placeholder="Model Name" className={`${lineItemInputClasses} mb-1 font-semibold`} />
                                                    <textarea value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)} placeholder="Additional specs..." className={`${lineItemInputClasses} text-xs`} rows={2} />
                                                </td>
                                                <td className="p-1"><input type="number" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', e.target.value)} className={lineItemInputClasses} /></td>
                                                <td className="p-1"><input type="number" step="0.01" value={item.unitPrice} onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value)} className={lineItemInputClasses} /></td>
                                                <td className="p-1"><input type="text" value={`$${item.amount.toFixed(2)}`} readOnly className="w-full bg-slate-50 text-right text-slate-600 border-slate-200 rounded-md"/></td>
                                                <td className="p-1 text-center"><button type="button" onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-600 p-1 rounded-full hover:bg-rose-100 opacity-50 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <button type="button" onClick={() => addItem()} className="mt-4 text-sm font-semibold text-brand-600 hover:underline">+ Add Item</button>
                            </div>
                        )}
                        <div className="mt-6 flex justify-end">
                            <div className="w-full max-w-xs space-y-2 text-sm">
                                <div className="flex justify-between items-center"><span className="text-slate-600">Sub Total:</span><span className="font-semibold text-slate-800">${totals.subTotal.toFixed(2)}</span></div>
                                <div className="flex justify-between items-center"><span className="text-slate-600">VAT (10%):</span><span className="font-semibold text-slate-800">${totals.vat.toFixed(2)}</span></div>
                                <div className="flex justify-between items-center text-base border-t pt-2 mt-2"><span className="font-bold text-slate-800">Grand Total:</span><span className="font-bold text-slate-900">${totals.grandTotal.toFixed(2)}</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Section */}
                <div className="print-only-container">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 screen-only">Live Preview</h3>
                    <div className="w-full bg-slate-200 p-4 sm:p-8 screen-only overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                         <PrintableQuotation
                            headerData={{
                                'Quotation ID': quote['Quote No.'],
                                'Quote Date': quote['Quote Date'],
                                'Validity Date': quote['Validity Date'],
                                'Company Name': quote['Company Name'],
                                'Company Address': quote['Company Address'],
                                'Contact Person': quote['Contact Name'],
                                'Contact Tel': quote['Contact Number'],
                                'Contact Email': quote['Contact Email'],
                                'Payment Term': quote['Payment Term'],
                                'Stock Status': quote['Stock Status'],
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
                title="Quotation Saved!"
                message={<p>Quotation <strong>{successInfo.quoteNo}</strong> has been successfully saved.</p>}
                actionButtonLink={successInfo.url}
                actionButtonText="View Quotation Sheet"
            />
         )}
       </>
    );
};

export default QuotationCreator;