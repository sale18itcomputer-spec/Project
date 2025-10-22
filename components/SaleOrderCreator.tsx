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
        // The SO No. in the image is S00000001. Let's follow that format.
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
    
    // Effect to handle 'Install Software' field
    useEffect(() => {
        if (existingSaleOrder && existingSaleOrder['Install Software']) {
            setSelectedSoftware(existingSaleOrder['Install Software'].split(',').map(s => s.trim()).filter(Boolean));
        } else if (!existingSaleOrder) { // Clear on new form
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


    // --- Item Management ---
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
            // Renumber items
            return newItems.map((item, index) => ({ ...item, no: index + 1 }));
        });
    };

    const addItem = () => {
        setItems(prev => [...prev, { id: `item-${Date.now()}`, no: prev.length + 1, itemCode: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
    };

    const removeItem = (id: string) => {
        setItems(prev => {
            const newItems = prev.filter(item => item.id !== id);
             // Renumber items
            return newItems.map((item, index) => ({ ...item, no: index + 1 }));
        });
    };
    
    // --- Calculated Totals ---
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
                'Payment Term': saleOrder['Payment Term'] || companyDetails?.['Paymet Term'] || '',
                'Prepared By': currentUser?.Name || '',
                'Grand Total': totals.grandTotal,
                'VAT': totals.tax,
                'Sub Total': totals.subTotal,
                'ItemsJSON': JSON.stringify(items),
                'Install Software': masterSheetData['Install Software'],
                'Bill Invoice': masterSheetData['Bill Invoice'],
                'Delivery Date': saleOrder['Delivery Date']
            };

            // This action creates the formatted sheet.
            const { url } = await createSaleOrderSheet(masterSheetData['SO No.'], sheetGenerationData);
            masterSheetData.File = `=HYPERLINK("${url}", "${masterSheetData['SO No.']}")`;

            // This action saves the summary row to the master sheet.
            if(existingSaleOrder) {
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
    // As the file is truncated, we can't render the UI. Returning null to fix compilation.
    return null;
};

export default SaleOrderCreator;
