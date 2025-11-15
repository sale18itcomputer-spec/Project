import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Quotation, Company, Contact, PricelistItem } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { createRecord, updateRecord, createQuotationSheet, readQuotationSheetData } from '../services/api';
import { formatToSheetDate, formatToInputDate } from '../utils/time';
import { FormSection, FormInput, FormSelect, FormTextarea } from './FormControls';
import PrintableQuotation from './PrintableQuotation';
import { Trash2, AlertTriangle } from 'lucide-react';
import Spinner from './Spinner';
import SuccessModal from './SuccessModal';
import DocumentEditorContainer from './DocumentEditorContainer';
import { parseSheetValue } from '../utils/formatters';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '../contexts/ToastContext';
import SearchableSelect from './SearchableSelect';

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
const CURRENCY_OPTIONS: ('USD' | 'KHR')[] = ['USD', 'KHR'];

const getCurrencySymbol = (currency?: 'USD' | 'KHR'): string => {
    switch (currency) {
        case 'USD': return '$';
        case 'KHR': return '៛';
        default: return '$';
    }
};

const DEFAULT_TERMS = `For warranty details, please look at details below items. Warranty void if: Electric shock, accident,
Seal broken, misuse, or modification by anyone other than LIMPERIAL TECHNOLOGY.
* Good sold are not returnable and received in good condition.
* We look forward to hearing from you.`;


const QuotationCreator: React.FC<QuotationCreatorProps> = ({ onBack, existingQuotation }) => {
    const { quotations, setQuotations, companies, contacts, pricelist } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    
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
                'Prepared By': existingQuotation['Prepared By'] || currentUser?.Name || '',
                'Prepared By Position': existingQuotation['Prepared By Position'] || '',
                'Approved By': existingQuotation['Approved By'] || '',
                'Approved By Position': existingQuotation['Approved By Position'] || '',
                'Remark': existingQuotation.Remark || '',
                'Terms and Conditions': existingQuotation['Terms and Conditions'] || DEFAULT_TERMS,
            };
        }
        return {
            'Quote No.': nextQuotationNumber,
            'Quote Date': getTodayDateString(),
            'Validity Date': getTodayDateString(),
            'Status': 'Open',
            'Currency': 'USD',
            'Created By': currentUser?.Name || '',
            'Prepared By': currentUser?.Name || '',
            'Prepared By Position': '',
            'Approved By': '',
            'Approved By Position': '',
            'Remark': '',
            'Terms and Conditions': DEFAULT_TERMS,
        };
    });

     useEffect(() => {
        if (!existingQuotation || !existingQuotation['Quote No.'] || !companies || !contacts) {
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

                let updatedQuoteData = {
                    ...existingQuotation,
                    ...header,
                    'Quote Date': header['Quote Date'] ? formatToInputDate(header['Quote Date']) : formatToInputDate(existingQuotation['Quote Date']),
                    'Validity Date': header['Validity Date'] ? formatToInputDate(header['Validity Date']) : formatToInputDate(existingQuotation['Validity Date']),
                };

                const companyName = updatedQuoteData['Company Name'];
                const contactName = updatedQuoteData['Contact Name'];

                if (companyName) {
                    const matchedCompany = companies.find(c => c['Company Name'] === companyName);
                    if (matchedCompany) {
                        if (!updatedQuoteData['Company Address']) updatedQuoteData['Company Address'] = matchedCompany['Address (English)'];
                        if (!updatedQuoteData['Payment Term']) updatedQuoteData['Payment Term'] = matchedCompany['Payment Term'];
                    }
                }

                if (contactName) {
                    const matchedContact = contacts.find(c => c.Name === contactName && c['Company Name'] === companyName);
                    if (matchedContact) {
                        if (!updatedQuoteData['Contact Number']) updatedQuoteData['Contact Number'] = matchedContact['Tel (1)'];
                        if (!updatedQuoteData['Contact Email']) updatedQuoteData['Contact Email'] = matchedContact.Email;
                    }
                }
                
                setQuote(updatedQuoteData);
                
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
    
    const handleCompanySelect = (companyName: string) => {
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
                    const isDescriptionRow = item.no === 0;
                    const updatedItem = { ...item, [field]: value };
                    if (!isDescriptionRow) {
                        updatedItem.amount = updatedItem.qty * updatedItem.unitPrice;
                    }
                    return updatedItem;
                }
                return item;
            });
            let currentNo = 1;
            return newItems.map(item => {
                if(item.itemCode || item.modelName || item.qty || item.unitPrice) {
                    return {...item, no: currentNo++}
                }
                return {...item, no: 0};
            });
        });
    };

    const handlePricelistItemSelect = (lineItem: LineItem, pricelistItem: PricelistItem) => {
        setItems(currentItems => {
            const newItems = currentItems.map(item => {
                if (item.id === lineItem.id) {
                    const unitPrice = parseSheetValue(pricelistItem.SRP);
                    return {
                        ...item,
                        itemCode: pricelistItem['Item Code'],
                        modelName: pricelistItem.Model,
                        description: pricelistItem['Detail Spec'],
                        unitPrice: unitPrice,
                        amount: item.qty * unitPrice,
                    };
                }
                return item;
            });
            return newItems;
        });
    };

    const addItem = () => {
        setItems(prev => {
            const newItem = { id: `item-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 };
            const newItems = [...prev, newItem];
            
            let currentNo = 1;
            return newItems.map(item => {
                if(item.itemCode || item.modelName || item.qty || item.unitPrice) {
                    return {...item, no: currentNo++}
                }
                return {...item, no: 0};
            });
        });
    };
    
    const addDescriptionRow = () => {
        setItems(prev => {
            const newItem = { id: `desc-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 0, unitPrice: 0, amount: 0 };
            return [...prev, newItem];
        });
    };

    const removeItem = (id: string) => {
        setItems(prev => {
            if (prev.length <= 1) return prev; // Don't remove the last item
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
            const masterSheetData: Quotation = {
                'Quote No.': quote['Quote No.'] || nextQuotationNumber,
                'File': quote.File || '',
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
                'Currency': quote.Currency || 'USD',
                'Prepared By': quote['Prepared By'] || '',
                'Prepared By Position': quote['Prepared By Position'] || '',
                'Approved By': quote['Approved By'] || '',
                'Approved By Position': quote['Approved By Position'] || '',
                'Remark': quote.Remark || '',
                'Terms and Conditions': quote['Terms and Conditions'] || '',
            };
            
            const sheetGenerationData = {
                ...masterSheetData,
                'Quote Date': quote['Quote Date'],
                'Validity Date': quote['Validity Date'],
                'ItemsJSON': JSON.stringify(items),
            };

            const { url } = await createQuotationSheet(masterSheetData['Quote No.'], sheetGenerationData);
            masterSheetData.File = `=HYPERLINK("${url}", "${masterSheetData['Quote No.']}")`;

            if (existingQuotation) {
                const originalQuotations = quotations ? [...quotations] : [];
                setQuotations(current => current ? current.map(q => q['Quote No.'] === masterSheetData['Quote No.'] ? masterSheetData : q) : [masterSheetData]);
                try {
                    const updatedRecord = await updateRecord('Quotations', existingQuotation['Quote No.'], masterSheetData);
                    setQuotations(current => current ? current.map(q => q['Quote No.'] === updatedRecord['Quote No.'] ? updatedRecord : q) : [updatedRecord]);
                    setSuccessInfo({ url: url || '#', quoteNo: masterSheetData['Quote No.'] });
                } catch (err) {
                    addToast('Failed to update quotation.', 'error');
                    setQuotations(originalQuotations);
                    throw err;
                }
            } else {
                const originalQuotations = quotations ? [...(quotations || [])] : null;
                setQuotations(current => current ? [masterSheetData, ...current] : [masterSheetData]);
                try {
                    const createdRecord = await createRecord('Quotations', masterSheetData);
                    setQuotations(current => {
                        if (!current) return [createdRecord];
                        const index = current.findIndex(q => q['Quote No.'] === createdRecord['Quote No.']);
                        if (index !== -1) {
                            const newQuotations = [...current];
                            newQuotations[index] = createdRecord;
                            return newQuotations;
                        }
                        return [createdRecord, ...current];
                    });
                    setSuccessInfo({ url: url || '#', quoteNo: masterSheetData['Quote No.'] });
                } catch (err) {
                    addToast('Failed to create quotation.', 'error');
                    setQuotations(originalQuotations);
                    throw err;
                }
            }
            
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const lineItemInputClasses = "w-full text-sm p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition";
    
    const currencySymbol = getCurrencySymbol(quote.Currency);

    // FIX: Define formatCurrency function to correctly format numeric values as currency strings.
    const formatCurrency = (value: number) => {
        if (typeof value !== 'number' || isNaN(value)) return `${currencySymbol}0.00`;
        return `${currencySymbol}${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    };


    const PricelistCombobox: React.FC<{
        item: LineItem;
        onItemChange: (id: string, field: keyof Omit<LineItem, 'id' | 'amount' | 'no'>, value: string | number) => void;
        onPricelistItemSelect: (item: LineItem, pricelistItem: PricelistItem) => void;
        disabled?: boolean;
    }> = ({ item, onItemChange, onPricelistItemSelect, disabled = false }) => {
        const { pricelist } = useData();
        const [isOpen, setIsOpen] = useState(false);
        const wrapperRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            function handleClickOutside(event: MouseEvent) {
                if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                    setIsOpen(false);
                }
            }
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }, [wrapperRef]);
        
        const filteredPricelist = useMemo(() => {
            if (!pricelist || !isOpen) return [];
            const query = item.itemCode?.toLowerCase() || '';
            if (query === '') return pricelist.slice(0, 50);
            return pricelist.filter(p => 
                p['Item Code']?.toLowerCase().includes(query) ||
                p.Model?.toLowerCase().includes(query) ||
                p.Brand?.toLowerCase().includes(query)
            ).slice(0, 50);
        }, [pricelist, item.itemCode, isOpen]);
        
        const handleBlur = () => {
            setTimeout(() => {
                if (!document.body.contains(wrapperRef.current)) return;
                setIsOpen(false);
                const exactMatch = pricelist?.find(p => p['Item Code']?.toLowerCase() === (item.itemCode || '').toLowerCase().trim());
                if (exactMatch && !item.modelName) {
                    onPricelistItemSelect(item, exactMatch);
                }
            }, 200);
        };
    
        return (
            <div ref={wrapperRef} className="relative">
                <input
                    type="text"
                    value={item.itemCode}
                    onChange={e => {
                        onItemChange(item.id, 'itemCode', e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={handleBlur}
                    className={`${lineItemInputClasses} ${disabled ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                    placeholder="Type to search..."
                    autoComplete="off"
                    disabled={disabled}
                />
                {isOpen && !disabled && filteredPricelist.length > 0 && (
                    <div className="absolute z-50 w-[450px] mt-1 bg-white rounded-md shadow-lg border border-slate-200">
                        <ScrollArea className="max-h-72">
                            <ul>
                                {filteredPricelist.map(pItem => (
                                    <li key={pItem['Item Code']}>
                                        <button
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                onPricelistItemSelect(item, pItem);
                                                setIsOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex justify-between w-full items-center">
                                                <div className="truncate pr-4">
                                                    <p className="font-semibold text-slate-800">{pItem.Model}</p>
                                                    <p className="text-xs text-slate-500">{pItem.Brand} - {pItem['Item Code']}</p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                     <p className="font-semibold text-slate-700">{parseSheetValue(pItem.SRP).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
                                                     <p className="text-xs text-slate-500">Stock: {pItem.Qty}</p>
                                                </div>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    </div>
                )}
            </div>
        );
    };


    const printableProps = {
        headerData: {
            'Quotation ID': quote['Quote No.'], 'Quote Date': quote['Quote Date'], 'Validity Date': quote['Validity Date'],
            'Company Name': quote['Company Name'], 'Company Address': quote['Company Address'], 'Contact Person': quote['Contact Name'],
            'Contact Tel': quote['Contact Number'], 'Contact Email': quote['Contact Email'], 'Payment Term': quote['Payment Term'],
            'Stock Status': quote['Stock Status'], 'Created By': quote['Created By'], 'Prepared By': quote['Prepared By'],
            'Prepared By Position': quote['Prepared By Position'], 'Approved By': quote['Approved By'], 'Approved By Position': quote['Approved By Position'],
            'Remark': quote.Remark, 'Terms and Conditions': quote['Terms and Conditions'],
        },
        items: items, totals: totals, currency: quote.Currency || 'USD'
    };


    return (
       <>
         <DocumentEditorContainer
            title={existingQuotation ? `Edit Quotation ${existingQuotation['Quote No.']}` : "Create New Quotation"}
            onBack={onBack} onSave={handleSave} onPrint={() => window.print()} isSubmitting={isSubmitting}
         >
            {error && (
                <div className="mb-6 bg-rose-50 border-l-4 border-rose-400 text-rose-800 p-4 rounded-md text-sm flex items-start gap-3" role="alert">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5"/>
                    <div>
                        <p className="font-bold">Could not save quotation</p>
                        <p>{error}</p>
                    </div>
                </div>
            )}
            <div className="screen-only">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <FormSection title="Customer Info">
                            <SearchableSelect
                                name="Company Name"
                                label="Company Name"
                                value={quote['Company Name'] || ''}
                                onChange={handleCompanySelect}
                                options={companyOptions}
                                required
                                placeholder="Search for a company..."
                            />
                            <FormSelect name="Contact Name" label="Contact Person" value={quote['Contact Name']} onChange={handleContactChange} options={contactOptions} disabled={!quote['Company Name']} />
                            <FormTextarea name="Company Address" label="Address" value={quote['Company Address']} onChange={handleHeaderChange} rows={3} />
                            <FormInput name="Contact Number" label="Tel" value={quote['Contact Number']} onChange={handleHeaderChange} readOnly />
                            <FormInput name="Contact Email" label="Email" value={quote['Contact Email']} onChange={handleHeaderChange} readOnly />
                        </FormSection>

                        <FormSection title="Quotation Info">
                            <FormInput name="Quote No." label="Quotation No." value={quote['Quote No.']} onChange={handleHeaderChange} readOnly required />
                            <FormSelect name="Currency" label="Currency" value={quote.Currency} onChange={handleHeaderChange} options={CURRENCY_OPTIONS} required />
                            <FormInput name="Quote Date" label="Quote Date" value={quote['Quote Date']} onChange={handleHeaderChange} type="date" required />
                            <FormInput name="Validity Date" label="Validity" value={quote['Validity Date']} onChange={handleHeaderChange} type="date" required />
                            <FormInput name="Payment Term" label="Payment Term" value={quote['Payment Term']} onChange={handleHeaderChange} />
                            <FormInput name="Stock Status" label="Stock Status" value={quote['Stock Status']} onChange={handleHeaderChange} />
                            <FormSelect name="Status" label="Status" value={quote.Status} onChange={handleHeaderChange} options={STATUS_OPTIONS} required />
                            <FormTextarea name="Reason" label="Reason (if not Open)" value={quote.Reason} onChange={handleHeaderChange} rows={2} />
                        </FormSection>
                        
                        <FormSection title="Signatures & Remarks">
                            <FormInput name="Prepared By" label="Prepared By" value={quote['Prepared By']} onChange={handleHeaderChange} />
                            <FormInput name="Approved By" label="Approved By" value={quote['Approved By']} onChange={handleHeaderChange} />
                            <FormInput name="Prepared By Position" label="Position" value={quote['Prepared By Position']} onChange={handleHeaderChange} />
                            <FormInput name="Approved By Position" label="Position" value={quote['Approved By Position']} onChange={handleHeaderChange} />
                            <FormTextarea name="Remark" label="Remark" value={quote.Remark} onChange={handleHeaderChange} rows={3} />
                            <FormTextarea name="Terms and Conditions" label="Terms and Conditions" value={quote['Terms and Conditions']} onChange={handleHeaderChange} rows={5} />
                        </FormSection>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Line Items</h3>
                            {itemsLoading ? <div className="text-center p-8"><Spinner /></div> : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[700px]">
                                        <thead>
                                            <tr className="text-left text-xs text-slate-500">
                                                <th className="p-2 w-16">No.</th>
                                                <th className="p-2 w-40">Item Code</th>
                                                <th className="p-2">Item Description</th>
                                                <th className="p-2 w-20">Qty</th>
                                                <th className="p-2 w-28">Unit Price</th>
                                                <th className="p-2 w-28">Amount</th>
                                                <th className="p-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item) => {
                                                const isDescriptionRow = item.no === 0;
                                                return (
                                                <tr key={item.id} className="border-t border-slate-200 group">
                                                    {isDescriptionRow ? (
                                                        <>
                                                            <td className="p-1"></td>
                                                            <td colSpan={5} className="p-1">
                                                                <textarea value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)} className={lineItemInputClasses} rows={1} placeholder="Add a note or description..."/>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="p-1"><input type="text" value={item.no > 0 ? item.no : ''} readOnly className="w-full bg-slate-50 text-center text-slate-600 border-slate-200 rounded-md"/></td>
                                                            <td className="p-1"><PricelistCombobox item={item} onItemChange={handleItemChange} onPricelistItemSelect={handlePricelistItemSelect}/></td>
                                                            <td className="p-1"><textarea value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)} className={lineItemInputClasses} rows={2} /></td>
                                                            <td className="p-1"><input type="number" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', e.target.value)} className={lineItemInputClasses} /></td>
                                                            <td className="p-1"><input type="number" step="0.01" value={item.unitPrice} onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value)} className={lineItemInputClasses} /></td>
                                                            <td className="p-1"><input type="text" value={`${currencySymbol}${item.amount.toFixed(2)}`} readOnly className="w-full bg-slate-50 text-right text-slate-600 border-slate-200 rounded-md"/></td>
                                                        </>
                                                    )}
                                                    <td className="p-1 text-center">
                                                        <button type="button" onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-600 p-1 rounded-full hover:bg-rose-100 opacity-50 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                                                    </td>
                                                </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                    <div className="mt-4 flex gap-4">
                                        <button type="button" onClick={addItem} className="text-sm font-semibold text-brand-600 hover:underline">+ Add Item</button>
                                        <button type="button" onClick={addDescriptionRow} className="text-sm font-semibold text-slate-600 hover:underline">+ Add Note</button>
                                    </div>
                                    <div className="flex justify-end mt-6">
                                        <div className="w-full max-w-sm space-y-2 text-right">
                                            <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Sub Total:</span><span className="text-slate-800 font-semibold">{formatCurrency(totals.subTotal)}</span></div>
                                            <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">VAT (10%):</span><span className="text-slate-800 font-semibold">{formatCurrency(totals.vat)}</span></div>
                                            <div className="flex justify-between items-center border-t border-slate-300 pt-2 mt-2"><span className="text-lg text-slate-800 font-bold">Grand Total:</span><span className="text-lg text-slate-900 font-bold">{formatCurrency(totals.grandTotal)}</span></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="print-only-container">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Live Preview</h3>
                        <div className="w-full bg-slate-200 p-4 sm:p-8 overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                             <PrintableQuotation {...printableProps} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="print-only">
                 <PrintableQuotation {...printableProps} />
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