
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SaleOrder, Company, Contact, Quotation } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { createRecord, updateRecord, createSaleOrderSheet, readQuotationSheetData, uploadFile } from '../services/api';
import { formatToSheetDate, formatToInputDate } from '../utils/time';
import { FormSection, FormInput, FormSelect, FormTextarea } from './FormControls';
import PrintableSaleOrder from './PrintableSaleOrder';
import SuccessModal from './SuccessModal';
import Spinner from './Spinner';
import DocumentEditorContainer from './DocumentEditorContainer';
import { Trash2, X, Upload, Printer } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import SearchableSelect from './SearchableSelect';

interface SaleOrderCreatorProps {
    onBack: () => void;
    existingSaleOrder: SaleOrder | null;
    initialData?: Partial<SaleOrder>;
}

interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    description: string;
    qty: number | string;
    unitPrice: number | string;
    commission: number | string;
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
const CURRENCY_OPTIONS: ('USD' | 'KHR')[] = ['USD', 'KHR'];

const getCurrencySymbol = (currency?: 'USD' | 'KHR'): string => {
    switch (currency) {
        case 'USD': return '$';
        case 'KHR': return '៛';
        default: return '$';
    }
};


const SaleOrderCreator: React.FC<SaleOrderCreatorProps> = ({ onBack, existingSaleOrder, initialData }) => {
    const { saleOrders, setSaleOrders, companies, contacts, quotations, pricelist } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { handleNavigation } = useNavigation();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successInfo, setSuccessInfo] = useState<{ soNo: string } | null>(null);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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


    const fetchQuoteItems = React.useCallback(async (quoteId: string) => {
        setItemsLoading(true);
        setError('');
        try {
            const { items: fetchedItems } = await readQuotationSheetData(quoteId);
            if (fetchedItems && fetchedItems.length > 0) {
                const newItems: LineItem[] = fetchedItems.map((item: any, index: number) => {
                    let description = '';
                    // Find the corresponding item in the main pricelist using the itemCode.
                    const pricelistEntry = pricelist?.find(p => p['Item Code'] === item.itemCode);

                    if (pricelistEntry) {
                        // If found, construct the description from the Model and Item Description.
                        description = `${pricelistEntry.Model} ${pricelistEntry['Item Description']}`.trim();
                    } else {
                        // Fallback to the original logic if not found in the pricelist.
                        const modelName = (item.modelName || '').trim();
                        const itemDescription = (item.description || '').trim();
                        const descriptionParts = [];
                        if (modelName) descriptionParts.push(modelName);
                        if (itemDescription) descriptionParts.push(itemDescription);
                        description = descriptionParts.join('\n');
                    }

                    return {
                        id: `item-${Date.now()}-${index}`,
                        no: item.no || index + 1,
                        itemCode: item.itemCode || '',
                        description: description,
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
            addToast(`Failed to fetch items from quote: ${err.message}`, 'error');
            setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
        } finally {
            setItemsLoading(false);
        }
    }, [pricelist, addToast]);

    useEffect(() => {
        if (existingSaleOrder) {
            const baseData = {
                ...existingSaleOrder,
                'SO No.': existingSaleOrder['SO No.'] || nextSaleOrderNumber,
                'SO Date': existingSaleOrder['SO Date'] ? formatToInputDate(existingSaleOrder['SO Date']) : getTodayDateString(),
                'Delivery Date': existingSaleOrder['Delivery Date'] ? formatToInputDate(existingSaleOrder['Delivery Date']) : getTodayDateString(),
                'Currency': (existingSaleOrder.Currency === 'KHR' ? 'KHR' : 'USD') as ('USD' | 'KHR'),
            };

            if (!baseData['Bill Invoice']) {
                if (parseFloat(baseData.Tax || '0') > 0) {
                    baseData['Bill Invoice'] = 'VAT';
                } else {
                    baseData['Bill Invoice'] = 'NON-VAT';
                }
            }
            setSaleOrder(baseData);


            if (existingSaleOrder.ItemsJSON) {
                try {
                    const parsedItems = typeof existingSaleOrder.ItemsJSON === 'string'
                        ? JSON.parse(existingSaleOrder.ItemsJSON)
                        : existingSaleOrder.ItemsJSON;

                    if (Array.isArray(parsedItems)) {
                        setItems(parsedItems.map((item: any) => ({
                            ...item,
                            id: item.id || `item-${Date.now()}-${Math.random()}`
                        })));
                    }
                } catch (e) {
                    console.error("Failed to parse ItemsJSON", e);
                }
            } else if (existingSaleOrder['Quote No.']) {
                fetchQuoteItems(existingSaleOrder['Quote No.']);
            }
        } else {
            // Check for ItemsJSON in initialData
            if (initialData?.ItemsJSON) {
                try {
                    const parsedItems = typeof initialData.ItemsJSON === 'string'
                        ? JSON.parse(initialData.ItemsJSON)
                        : initialData.ItemsJSON;

                    if (Array.isArray(parsedItems)) {
                        setItems(parsedItems.map((item: any) => ({
                            ...item,
                            id: item.id || `item-${Date.now()}-${Math.random()}`
                        })));
                    } else {
                        setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
                    }
                } catch (e) {
                    console.error("Failed to parse initial ItemsJSON", e);
                    setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
                }
            } else if (initialData?.['Quote No.']) {
                fetchQuoteItems(initialData['Quote No.']);
            } else {
                setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
            }

            setSaleOrder({
                'SO No.': nextSaleOrderNumber,
                'SO Date': getTodayDateString(),
                'Delivery Date': getTodayDateString(),
                'Status': 'Pending',
                'Tax': '0',
                'Bill Invoice': 'NON-VAT',
                'Created By': currentUser?.Name || '',
                'Currency': 'USD',
                ...initialData
            });
        }
    }, [existingSaleOrder, nextSaleOrderNumber, currentUser, isFromQuote, pricelist, initialData]);

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

    // Auto-fill customer details from companies/contacts when coming from initialData (+Create SO)
    useEffect(() => {
        if (!existingSaleOrder && initialData && companies && contacts) {
            const companyName = initialData['Company Name'];
            const contactName = initialData['Contact Name'];

            if (companyName || contactName) {
                const company = companies.find(c => c['Company Name'] === companyName);
                const contact = contacts.find(c => c.Name === contactName && (!companyName || c['Company Name'] === companyName));

                setSaleOrder(prev => ({
                    ...prev,
                    'Phone Number': contact?.['Tel (1)'] || prev['Phone Number'] || '',
                    'Email': contact?.Email || prev['Email'] || '',
                    'Payment Term': company?.['Payment Term'] || prev['Payment Term'] || '',
                }));
            }
        }
    }, [initialData, companies, contacts, existingSaleOrder]);

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
                    const updatedItem = { ...item, [field]: value } as any;

                    const q = parseFloat(String(updatedItem.qty)) || 0;
                    const p = parseFloat(String(updatedItem.unitPrice)) || 0;
                    updatedItem.amount = q * p;
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
        const commission = items.reduce((sum, item) => sum + (parseFloat(String(item.commission)) || 0), 0);
        const isVat = saleOrder['Bill Invoice'] === 'VAT';
        const tax = isVat ? subTotal * 0.1 : 0;
        const grandTotal = subTotal + tax;
        return { subTotal, tax, grandTotal, commission };
    }, [items, saleOrder['Bill Invoice']]);

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSaleOrder(prev => ({ ...prev, [name]: value }));
    }

    const handleCompanySelect = (companyName: string) => {
        const company = companies?.find(c => c['Company Name'] === companyName);
        setSaleOrder(prev => ({
            ...prev,
            'Company Name': companyName,
            'Contact Name': '',
            'Phone Number': '',
            'Email': '',
            'Quote No.': '',
            'Payment Term': company?.['Payment Term'] || ''
        }));
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
            setSaleOrder(prev => ({
                ...prev,
                'Quote No.': quoteId,
                'Company Name': quote['Company Name'],
                'Contact Name': quote['Contact Name'],
                'Phone Number': quote['Contact Number'],
                'Total Amount': quote.Amount,
                'Bill Invoice': quote['Tax Type'] === 'NON-VAT' ? 'NON-VAT' : 'VAT',
                Status: 'Confirmed'
            }));
            fetchQuoteItems(quoteId);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const response = await uploadFile(file);
            setSaleOrder(prev => ({ ...prev, 'Attachment': response.url }));
            addToast('File uploaded successfully!', 'success');
        } catch (err: any) {
            addToast(err.message || 'File upload failed.', 'error');
        } finally {
            setIsUploading(false);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveFile = () => {
        setSaleOrder(prev => ({ ...prev, 'Attachment': '' }));
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const masterSheetData: SaleOrder = {
                'SO No.': saleOrder['SO No.'] || nextSaleOrderNumber,
                'SO Date': saleOrder['SO Date'] || null,
                'File': '',
                'Quote No.': saleOrder['Quote No.'] || '',
                'Company Name': saleOrder['Company Name'] || '',
                'Contact Name': saleOrder['Contact Name'] || '',
                'Phone Number': saleOrder['Phone Number'] || '',
                'Email': saleOrder.Email || '',
                'Tax': String(totals.tax),
                'Total Amount': String(totals.grandTotal),
                // FIX: Ensure Commission is '0' if empty string, to prevent Supabase invalid input syntax for type numeric
                'Commission': saleOrder.Commission ? String(saleOrder.Commission) : '0',
                'Status': saleOrder.Status || 'Pending',
                'Delivery Date': saleOrder['Delivery Date'],
                'Payment Term': saleOrder['Payment Term'],
                'Bill Invoice': saleOrder['Bill Invoice'],
                'Install Software': saleOrder['Install Software'],
                'Currency': saleOrder.Currency || 'USD',
                'Created By': saleOrder['Created By'] || currentUser?.Name || '',
                'Attachment': saleOrder['Attachment'] || '',
            };

            const companyDetails = companies?.find(c => c['Company Name'] === masterSheetData['Company Name']);

            // Combine master data with line items for Supabase storage
            const payload = {
                ...masterSheetData,
                'ItemsJSON': items
            };

            // Database write handled by createSaleOrderSheet (upsert)
            await createSaleOrderSheet(masterSheetData['SO No.'], payload);

            if (existingSaleOrder && existingSaleOrder['SO No.']) {
                const originalSaleOrders = saleOrders ? [...saleOrders] : [];
                // Optimistic update
                setSaleOrders(current => current ? current.map(so => so['SO No.'] === masterSheetData['SO No.'] ? masterSheetData : so) : [masterSheetData]);
                setSuccessInfo({ soNo: masterSheetData['SO No.'] });
            } else { // Create
                // Optimistic update
                setSaleOrders(current => current ? [masterSheetData, ...current] : [masterSheetData]);
                setSuccessInfo({ soNo: masterSheetData['SO No.'] });
            }

        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewQuote = () => {
        if (saleOrder['Quote No.']) {
            const quote = quotations?.find(q => q['Quote No.'] === saleOrder['Quote No.']);
            if (quote) {
                handleNavigation({ view: 'quotations', payload: quote });
            } else {
                handleNavigation({ view: 'quotations', filter: saleOrder['Quote No.'] });
            }
        } else {
            addToast('No linked quotation found for this order.', 'info');
        }
    };

    const handleConvertToInvoice = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            // Update status to Completed for the Sale Order
            const updatedSO = {
                ...saleOrder,
                Status: 'Completed' as const
            };

            setSaleOrder(updatedSO);

            const masterSheetData: SaleOrder = {
                'SO No.': saleOrder['SO No.'] || nextSaleOrderNumber,
                'SO Date': saleOrder['SO Date'] || null,
                'File': '',
                'Quote No.': saleOrder['Quote No.'] || '',
                'Company Name': saleOrder['Company Name'] || '',
                'Contact Name': saleOrder['Contact Name'] || '',
                'Phone Number': saleOrder['Phone Number'] || '',
                'Email': saleOrder.Email || '',
                'Tax': String(totals.tax),
                'Total Amount': String(totals.grandTotal),
                'Commission': saleOrder.Commission ? String(saleOrder.Commission) : '0',
                'Status': 'Completed',
                'Delivery Date': saleOrder['Delivery Date'],
                'Payment Term': saleOrder['Payment Term'],
                'Bill Invoice': saleOrder['Bill Invoice'],
                'Install Software': saleOrder['Install Software'],
                'Currency': saleOrder.Currency || 'USD',
                'Created By': saleOrder['Created By'] || currentUser?.Name || '',
                'Attachment': saleOrder['Attachment'] || '',
            };

            const payload = {
                ...masterSheetData,
                'ItemsJSON': items
            };

            // Save the sale order with updated status
            await createSaleOrderSheet(masterSheetData['SO No.'], payload);

            if (setSaleOrders) {
                setSaleOrders(prev => {
                    const base = prev ? prev.filter(so => so['SO No.'] !== masterSheetData['SO No.']) : [];
                    return [masterSheetData as any, ...base];
                });
            }

            // Navigate directly to invoice creator
            handleNavigation({
                view: 'invoice-do',
                payload: {
                    action: 'create',
                    soData: {
                        ...masterSheetData,
                        'ItemsJSON': items
                    }
                }
            });

            addToast('Sale Order marked as Completed and converted to Invoice.', 'success');
        } catch (err: any) {
            setError(err.message || 'Failed to convert to invoice');
            addToast('Error during conversion: ' + err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRequestApprove = async () => {
        setIsSubmitting(true);
        try {
            await handleSave();
            addToast('Approval request for Sale Order has been saved.', 'info');
        } catch (err: any) {
            setError(err.message || 'Failed to request approval.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const contactOptions = useMemo(() => contacts?.filter(c => c['Company Name'] === saleOrder['Company Name']).map(c => c.Name) || [], [contacts, saleOrder]);
    const quoteOptions = useMemo(() => quotations?.filter(q => q['Company Name'] === saleOrder['Company Name']).map(q => q['Quote No.']) || [], [quotations, saleOrder]);
    const currencySymbol = getCurrencySymbol(saleOrder.Currency);

    // FIX: Define formatCurrency function to correctly format numeric values as currency strings.
    const formatCurrency = (value: number) => {
        if (typeof value !== 'number' || isNaN(value)) return `${currencySymbol}0.00`;
        return `${currencySymbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const printableProps = {
        headerData: {
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
        },
        items: items,
        totals: totals,
        currency: saleOrder.Currency || 'USD',
    };

    const headerLeft = (
        <div className="flex items-center ml-4">
            <button
                onClick={handleConvertToInvoice}
                disabled={isSubmitting}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-6 rounded-md transition shadow-sm text-sm min-w-[140px] flex items-center justify-center"
            >
                {isSubmitting ? <Spinner className="w-4 h-4" /> : "Convert to Invoice"}
            </button>
        </div>
    );

    const headerRight = (
        <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="bg-white hover:bg-slate-100 text-slate-700 font-semibold py-2 px-4 rounded-md border border-slate-300 transition flex items-center gap-2 shadow-sm text-sm">
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print</span>
            </button>
            <button
                onClick={handleViewQuote}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md transition shadow-sm whitespace-nowrap text-sm"
            >
                View Quote No.
            </button>
            <button onClick={handleSave} disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-6 rounded-md transition shadow-sm min-w-[100px] flex items-center justify-center text-sm">
                {isSubmitting ? <Spinner className="w-4 h-4" /> : "Save"}
            </button>
        </div>
    );

    return (
        <>
            <DocumentEditorContainer
                title={existingSaleOrder ? `Edit Sale Order ${existingSaleOrder['SO No.']}` : "Create New Sale Order"}
                onBack={onBack}
                onSave={handleSave}
                onPrint={() => window.print()}
                isSubmitting={isSubmitting}
                leftActions={headerLeft}
                rightActions={headerRight}
            >
                <div className="screen-only">
                    <div className="grid grid-cols-1 gap-8">
                        {/* Form Section */}
                        <div className="space-y-6">
                            <FormSection title="Customer & Order Info">
                                <SearchableSelect
                                    name="Company Name"
                                    label="Company"
                                    value={saleOrder['Company Name'] || ''}
                                    onChange={handleCompanySelect}
                                    options={companyOptions}
                                    required
                                    placeholder="Search companies..."
                                />
                                <FormSelect name="Contact Name" label="Contact" value={saleOrder['Contact Name']} onChange={handleContactChange} options={contactOptions} disabled={!saleOrder['Company Name']} />
                                <FormInput name="Pipeline No." label="Pipeline No." value={saleOrder['Pipeline No.']} onChange={handleHeaderChange} readOnly />
                            </FormSection>

                            <FormSection title="Order Details">
                                <FormInput name="SO No." label="Sale Order No." value={saleOrder['SO No.']} onChange={handleHeaderChange} readOnly required />
                                <FormInput name="SO Date" label="Order Date" value={saleOrder['SO Date']} onChange={handleHeaderChange} type="date" required />
                                <FormSelect name="Status" label="Status" value={saleOrder.Status} onChange={handleHeaderChange} options={STATUS_OPTIONS} required />
                                <FormSelect name="Bill Invoice" label="Bill Invoice" value={saleOrder['Bill Invoice']} onChange={handleHeaderChange} options={BILL_INVOICE_OPTIONS} />
                                <FormSelect name="Currency" label="Currency" value={saleOrder.Currency} onChange={handleHeaderChange} options={CURRENCY_OPTIONS} required />
                                <FormInput name="Delivery Date" label="Delivery Date" value={saleOrder['Delivery Date']} onChange={handleHeaderChange} type="date" />
                            </FormSection>

                            <FormSection title="Financial & Delivery">
                                <FormSelect name="Quote No." label="From Quotation" value={saleOrder['Quote No.']} onChange={handleQuoteChange} options={quoteOptions} disabled={!saleOrder['Company Name']} />
                                <FormInput name="Payment Term" label="Payment Term" value={saleOrder['Payment Term']} onChange={handleHeaderChange} />
                            </FormSection>

                            <FormSection title="Attachment">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Attach File</label>
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                    {isUploading ? (
                                        <div className="flex items-center gap-3 text-sm text-slate-600 p-3 rounded-lg bg-slate-100 border border-slate-200">
                                            <Spinner size="sm" />
                                            <span>Uploading...</span>
                                        </div>
                                    ) : saleOrder['Attachment'] ? (
                                        <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                                            <a href={saleOrder['Attachment']} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 hover:underline truncate max-w-xs sm:max-w-md">
                                                View Uploaded File
                                            </a>
                                            <button type="button" onClick={handleRemoveFile} className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-100 rounded-full transition-colors ml-2 flex-shrink-0">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full text-center py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors flex items-center justify-center gap-2">
                                            <Upload className="w-4 h-4" />
                                            Click to Upload File
                                        </button>
                                    )}
                                </div>
                            </FormSection>

                            <FormSection title="Software Installation">
                                <div className="md:col-span-2">
                                    <div className="flex gap-2 items-end">
                                        <FormSelect name="software_select" label="Select Software" value={""} onChange={(e) => handleAddSoftware(e.target.value)} options={SOFTWARE_OPTIONS.filter(s => !selectedSoftware.includes(s))} />
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
                                                <th className="p-2 w-10">No.</th><th className="p-2 w-40">Item Code</th><th className="p-2">Description</th>
                                                <th className="p-2 w-20">Qty</th><th className="p-2 w-28">Unit Price</th><th className="p-2 w-20">Commission</th>
                                                <th className="p-2 w-32">Amount</th><th className="p-2 w-8"></th>
                                            </tr></thead>
                                            <tbody>
                                                {items.map((item) => (
                                                    <tr key={item.id} className="border-t border-slate-200 group">
                                                        <td className="p-1"><input type="text" value={item.no} readOnly className="w-full bg-slate-50 text-center text-slate-600 border-slate-200 rounded-md" /></td>
                                                        <td className="p-1"><input type="text" value={item.itemCode} onChange={e => handleItemChange(item.id, 'itemCode', e.target.value)} className={lineItemInputClasses} /></td>
                                                        <td className="p-1"><textarea value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)} className={lineItemInputClasses} rows={2} /></td>
                                                        <td className="p-1"><input type="number" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', e.target.value)} className={lineItemInputClasses} /></td>
                                                        <td className="p-1"><input type="number" step="0.01" value={item.unitPrice} onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value)} className={lineItemInputClasses} /></td>
                                                        <td className="p-1"><input type="number" step="0.01" value={item.commission} onChange={e => handleItemChange(item.id, 'commission', e.target.value)} className={lineItemInputClasses} /></td>
                                                        <td className="p-1"><input type="text" value={`${currencySymbol}${item.amount.toFixed(2)}`} readOnly className="w-full bg-slate-50 text-right text-slate-600 border-slate-200 rounded-md" /></td>
                                                        <td className="p-1 text-center"><button type="button" onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-600 p-1 rounded-full hover:bg-rose-100 opacity-50 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <button type="button" onClick={addItem} className="mt-4 text-sm font-semibold text-brand-600 hover:underline">+ Add Item</button>
                                        <div className="flex justify-end mt-6">
                                            <div className="w-full max-w-sm space-y-2 text-right">
                                                <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Sub Total:</span><span className="text-slate-800 font-semibold">{formatCurrency(totals.subTotal)}</span></div>
                                                <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Commission:</span><span className="text-slate-800 font-semibold">{formatCurrency(totals.commission)}</span></div>
                                                <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">VAT (10%):</span><span className="text-slate-800 font-semibold">{formatCurrency(totals.tax)}</span></div>
                                                <div className="flex justify-between items-center border-t border-slate-300 pt-2 mt-2"><span className="text-lg text-slate-800 font-bold">Grand Total:</span><span className="text-lg text-slate-900 font-bold">{formatCurrency(totals.grandTotal)}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Preview Section */}
                        <div className="print-only-container">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Live Preview</h3>
                            <div className="w-full bg-slate-200 p-4 sm:p-8 overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                                <PrintableSaleOrder {...printableProps} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="print-only">
                    <PrintableSaleOrder {...printableProps} />
                </div>
            </DocumentEditorContainer>
            {successInfo && (
                <SuccessModal
                    isOpen={true}
                    onClose={() => { setSuccessInfo(null); onBack(); }}
                    title="Sale Order Saved!"
                    message={<p>Sale Order <strong>{successInfo.soNo}</strong> has been successfully saved.</p>}
                    actionButtonLink={null}
                    actionButtonText="Back to List"
                    onAction={() => { setSuccessInfo(null); onBack(); }}
                    extraActions={
                        <button
                            onClick={() => window.print()}
                            className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-2.5 rounded-md font-semibold hover:bg-brand-700 transition shadow-sm"
                        >
                            <Printer className="w-4 h-4" /> Print Sale Order
                        </button>
                    }
                />
            )
            }
        </>
    );
};

export default SaleOrderCreator;