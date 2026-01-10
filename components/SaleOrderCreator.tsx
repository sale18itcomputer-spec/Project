
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SaleOrder, Company, Contact, Quotation } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { createRecord, updateRecord, createSaleOrderSheet, readQuotationSheetData, uploadFile, getSetting, saveSetting } from '../services/api';
import { formatToSheetDate, formatToInputDate } from '../utils/time';
import { FormSection, FormInput, FormSelect, FormTextarea } from './FormControls';
import PrintableSaleOrder from './PrintableSaleOrder';
import SuccessModal from './SuccessModal';
import Spinner from './Spinner';
import DocumentEditorContainer from './DocumentEditorContainer';
import { Trash2, X, Upload, Printer, Download, SlidersHorizontal, PanelRight, Save, RotateCcw, ImageIcon, Type, Ruler, ScrollText, Layout, AlertTriangle } from 'lucide-react';
import { PDFLayoutConfig, defaultLayoutConfig, generatePDF } from '../utils/pdfGenerator';
import PDFConfigModal from './PDFConfigModal';
import PDFControlField from './PDFControlField';
import { useToast } from '../contexts/ToastContext';
import SearchableSelect from './SearchableSelect';
import { ScrollArea } from './ui/scroll-area';

interface SaleOrderCreatorProps {
    onBack: () => void;
    existingSaleOrder: SaleOrder | null;
    initialData?: Partial<SaleOrder>;
}

interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName: string;
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

const lineItemInputClasses = "w-full text-sm p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition";

const PricelistCombobox: React.FC<{
    item: LineItem;
    onItemChange: (id: string, field: keyof Omit<LineItem, 'id' | 'amount' | 'no'>, value: string | number) => void;
    onPricelistItemSelect: (item: LineItem, pricelistItem: any) => void;
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
            p.Code?.toLowerCase().includes(query) ||
            p.Model?.toLowerCase().includes(query) ||
            p.Brand?.toLowerCase().includes(query)
        ).slice(0, 50);
    }, [pricelist, item.itemCode, isOpen]);

    const handleBlur = () => {
        setTimeout(() => {
            if (!document.body.contains(wrapperRef.current)) return;
            setIsOpen(false);
            const exactMatch = pricelist?.find(p => p.Code?.toLowerCase() === (item.itemCode || '').toLowerCase().trim());
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
                                <li key={pItem.Code}>
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
                                                <p className="text-xs text-slate-500">{pItem.Brand} - {pItem.Code}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-semibold text-slate-700">{pItem['End User Price']}</p>
                                                <p className="text-xs text-slate-500">{pItem.Status}</p>
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

    const [items, setItems] = useState<LineItem[]>([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
    const [selectedSoftware, setSelectedSoftware] = useState<string[]>([]);

    // PDF Configuration State
    const [pdfLayout, setPdfLayout] = useState<PDFLayoutConfig>(defaultLayoutConfig);
    const [showPdfConfig, setShowPdfConfig] = useState(false);
    const [showLayoutControls, setShowLayoutControls] = useState(false);
    const [showFormPanel, setShowFormPanel] = useState(true);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'header' | 'table' | 'footer'>('header');
    const [hoveredPath, setHoveredPath] = useState<string | null>(null);

    const updateLayout = (path: string, value: any) => {
        setPdfLayout(prev => {
            // Use deep clone for safety given the depth
            const next = JSON.parse(JSON.stringify(prev));

            // Helper to set value at path
            const setVal = (obj: any, p: string, v: any) => {
                const k = p.split('.');
                let c = obj;
                for (let i = 0; i < k.length - 1; i++) c = c[k[i]];
                c[k[k.length - 1]] = v;
            };

            setVal(next, path, value);

            // Smart updates for Header Grouping
            if (path === 'header.companyName.x') {
                const newX = Number(value);
                setVal(next, 'header.contactInfo.x', newX);
                setVal(next, 'header.address.x', newX);
            }
            if (path === 'header.companyName.y') {
                const oldY = prev.header.companyName.y;
                const newY = Number(value);
                const delta = newY - oldY;

                setVal(next, 'header.contactInfo.y', prev.header.contactInfo.y + delta);
                setVal(next, 'header.address.y', prev.header.address.y + delta);
                setVal(next, 'header.separatorLine.y', prev.header.separatorLine.y + delta);
                setVal(next, 'title.y', prev.title.y + delta);
            }

            // Sync to localStorage
            localStorage.setItem('global_pdf_layout', JSON.stringify(next));
            return next;
        });
    };

    // Load layout from database or localStorage
    useEffect(() => {
        const loadGlobalLayout = async () => {
            // Priority 1: Database
            const dbLayout = await getSetting('global_pdf_layout');
            if (dbLayout && typeof dbLayout === 'object' && Object.keys(dbLayout).length > 0) {
                setPdfLayout(dbLayout);
                localStorage.setItem('global_pdf_layout', JSON.stringify(dbLayout));
                return;
            }

            // Priority 2: LocalStorage
            const savedLayout = localStorage.getItem('global_pdf_layout');
            if (savedLayout) {
                try {
                    const parsed = JSON.parse(savedLayout);
                    if (parsed && typeof parsed === 'object') {
                        setPdfLayout(parsed);
                    }
                } catch (e) {
                    console.error("Failed to load global PDF layout", e);
                }
            }
        };

        loadGlobalLayout();
    }, []);

    const handleSaveLayout = async () => {
        try {
            await saveSetting('global_pdf_layout', pdfLayout);
            addToast('Layout saved as global default!', 'success');
        } catch (e: any) {
            addToast(`Failed to save layout: ${e.message}`, 'error');
        }
    };

    const isFromQuote = useMemo(() => !!existingSaleOrder?.['Quote No.'], [existingSaleOrder]);

    const nextSaleOrderNumber = useMemo(() => {
        if (!saleOrders || saleOrders.length === 0) return 'SO-0000001';

        const maxNum = saleOrders.reduce((max, so) => {
            // Match trailing digits regardless of prefix format (S, S-, SO-)
            const numPartMatch = so['SO No.'].match(/\d+$/);
            if (!numPartMatch) return max;
            const numPart = parseInt(numPartMatch[0], 10);
            return isNaN(numPart) ? max : Math.max(max, numPart);
        }, 0);

        return `SO-${String(maxNum + 1).padStart(7, '0')}`;
    }, [saleOrders]);

    const [saleOrder, setSaleOrder] = useState<Partial<SaleOrder & { [key: string]: any }>>({});



    const fetchQuoteItems = React.useCallback(async (quoteId: string) => {
        setItemsLoading(true);
        setError('');
        try {
            const { items: fetchedItems } = await readQuotationSheetData(quoteId);
            if (fetchedItems && fetchedItems.length > 0) {
                const newItems: LineItem[] = fetchedItems.map((item: any, index: number) => {
                    let description = '';
                    // Find the corresponding item in the main pricelist using the itemCode.
                    const pricelistEntry = pricelist?.find(p => p.Code === item.itemCode);

                    if (pricelistEntry) {
                        // If found, use the Description from the pricelist.
                        description = pricelistEntry.Description || '';
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
                        modelName: item.modelName || '',
                        description: item.description || '',
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
        if (existingSaleOrder && companies && contacts) {
            const companyName = existingSaleOrder['Company Name'];
            const contactName = existingSaleOrder['Contact Name'];
            const company = companies.find(c => c['Company Name'] === companyName);
            const contact = contacts.find(c => c.Name === contactName && (!companyName || c['Company Name'] === companyName));

            const baseData = {
                ...existingSaleOrder,
                'SO No.': existingSaleOrder['SO No.'] || nextSaleOrderNumber,
                'SO Date': existingSaleOrder['SO Date'] ? formatToInputDate(existingSaleOrder['SO Date']) : getTodayDateString(),
                'Delivery Date': existingSaleOrder['Delivery Date'] ? formatToInputDate(existingSaleOrder['Delivery Date']) : getTodayDateString(),
                'Currency': (existingSaleOrder.Currency === 'KHR' ? 'KHR' : 'USD') as ('USD' | 'KHR'),
                // Fallback for missing fields in old records
                'Company Address': existingSaleOrder['Company Address'] || company?.['Address (English)'] || '',
                'Payment Term': existingSaleOrder['Payment Term'] || company?.['Payment Term'] || '',
                'Phone Number': existingSaleOrder['Phone Number'] || contact?.['Tel (1)'] || '',
                'Email': existingSaleOrder.Email || contact?.Email || '',
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
                'Tax': initialData?.Tax || '0',
                'Bill Invoice': initialData?.['Tax Type'] === 'VAT' ? 'VAT' : 'NON-VAT',
                'Created By': currentUser?.Name || '',
                'Currency': initialData?.Currency || 'USD',
                'Phone Number': initialData?.['Contact Number'] || '',
                'Email': initialData?.['Contact Email'] || initialData?.Email || '',
                'Company Address': initialData?.['Company Address'] || '',
                'Payment Term': initialData?.['Payment Term'] || '',
                'Prepared By': initialData?.['Prepared By'] || '',
                'Approved By': initialData?.['Approved By'] || '',
                'Remark': initialData?.Remark || '',
                'Terms and Conditions': initialData?.['Terms and Conditions'] || '',
                ...initialData
            });
        }
    }, [existingSaleOrder, nextSaleOrderNumber, currentUser, isFromQuote, pricelist, initialData, companies, contacts]);

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
                    'Phone Number': contact?.['Tel (1)'] || prev['Phone Number'] || initialData?.['Contact Number'] || '',
                    'Email': contact?.Email || prev['Email'] || initialData?.['Contact Email'] || initialData?.Email || '',
                    'Company Address': company?.['Address (English)'] || prev['Company Address'] || initialData?.['Company Address'] || '',
                    'Payment Term': company?.['Payment Term'] || prev['Payment Term'] || initialData?.['Payment Term'] || '',
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

    const handlePricelistItemSelect = (lineItem: LineItem, pricelistItem: any) => {
        setItems(currentItems => {
            const newItems = currentItems.map(item => {
                if (item.id === lineItem.id) {
                    const unitPrice = typeof pricelistItem['End User Price'] === 'number' ? pricelistItem['End User Price'] : parseFloat(String(pricelistItem['End User Price']).replace(/[^0-9.]/g, '')) || 0;
                    return {
                        ...item,
                        itemCode: pricelistItem.Code,
                        modelName: pricelistItem.Model,
                        description: pricelistItem.Description || '',
                        unitPrice: unitPrice,
                        amount: ((typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0) * unitPrice) + (parseFloat(String(item.commission)) || 0),
                        commission: item.commission, // preserve commission
                    };
                }
                return item;
            });
            return newItems;
        });
    };

    const handleItemChange = (id: string, field: keyof Omit<LineItem, 'id' | 'amount'>, value: string | number) => {
        setItems(currentItems => {
            const newItems = currentItems.map(item => {
                if (item.id === id) {
                    const updatedItem = { ...item, [field]: value } as any;

                    const q = parseFloat(String(updatedItem.qty)) || 0;
                    const p = parseFloat(String(updatedItem.unitPrice)) || 0;
                    const c = parseFloat(String(updatedItem.commission)) || 0;
                    updatedItem.amount = (q * p) + c;
                    return updatedItem;
                }
                return item;
            });
            return newItems.map((item, index) => ({ ...item, no: index + 1 }));
        });
    };

    const addItem = () => {
        setItems(prev => [...prev, { id: `item-${Date.now()}`, no: prev.length + 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
    };

    const removeItem = (id: string) => {
        setItems(prev => {
            const newItems = prev.filter(item => item.id !== id);
            return newItems.map((item, index) => ({ ...item, no: index + 1 }));
        });
    };

    const addDescriptionRow = () => {
        setItems(prev => [...prev, { id: `item-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 0, unitPrice: 0, commission: 0, amount: 0 }]);
    };

    const totals = useMemo(() => {
        const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
        const commission = items.reduce((sum, item) => sum + (parseFloat(String(item.commission)) || 0), 0);
        const isVat = saleOrder['Bill Invoice'] === 'VAT';
        const tax = isVat ? subTotal * 0.1 : 0;
        const grandTotal = subTotal + tax;
        return { subTotal, tax, grandTotal, commission };
    }, [items, saleOrder['Bill Invoice']]);

    useEffect(() => {
        const updatePreview = async () => {
            const previewUrl = await generatePDF({
                title: 'SALE ORDER',
                headerData: {
                    ...saleOrder,
                    'Company Name': saleOrder['Company Name'],
                    'Company Address': saleOrder['Company Address'] || companies?.find(c => c['Company Name'] === saleOrder['Company Name'])?.['Address (English)'] || '',
                    'Contact Person': saleOrder['Contact Name'],
                    'Contact Tel': saleOrder['Phone Number'],
                    'Email': saleOrder['Email'],
                    'Sale Order ID': saleOrder['SO No.'],
                    'Order Date': saleOrder['SO Date'],
                    'Delivery Date': saleOrder['Delivery Date'],
                    'Bill Invoice': saleOrder['Bill Invoice'],
                    'Payment Term': saleOrder['Payment Term'],
                    'Remark': saleOrder['Remark'] || '',
                },
                items: items.map(item => ({
                    no: item.no,
                    itemCode: item.itemCode,
                    description: item.description,
                    modelName: item.modelName,
                    qty: item.qty,
                    unitPrice: item.unitPrice,
                    amount: item.amount,
                    commission: item.commission
                })),
                totals: {
                    subTotal: totals.subTotal,
                    tax: totals.tax,
                    grandTotal: totals.grandTotal
                },
                currency: saleOrder.Currency || 'USD',
                filename: 'preview.pdf',
                type: 'Sale Order',
                layout: pdfLayout,
                previewMode: true
            });
            if (previewUrl) {
                setPdfPreviewUrl(previewUrl as string);
            }
        };

        const timer = setTimeout(updatePreview, 500);
        return () => clearTimeout(timer);
    }, [saleOrder, items, totals, pdfLayout, companies]);

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSaleOrder(prev => ({ ...prev, [name]: value }));
    }

    const handleCompanySelect = (companyName: string) => {
        const company = companies?.find(c => c['Company Name'] === companyName);
        setSaleOrder(prev => ({
            ...prev,
            'Company Name': companyName,
            'Company Address': company?.['Address (English)'] || '',
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
                'Company Address': quote['Company Address'] || '',
                'Contact Name': quote['Contact Name'],
                'Phone Number': quote['Contact Number'] || '',
                'Email': quote['Contact Email'] || quote.Email || '',
                'Total Amount': quote.Amount,
                'Currency': quote.Currency || 'USD',
                'Payment Term': quote['Payment Term'] || '',
                'Prepared By': quote['Prepared By'] || '',
                'Approved By': quote['Approved By'] || '',
                'Remark': quote.Remark || '',
                'Terms and Conditions': quote['Terms and Conditions'] || '',
                'Bill Invoice': quote['Tax Type'] === 'VAT' ? 'VAT' : 'NON-VAT',
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
                'Company Address': saleOrder['Company Address'] || '',
                'Prepared By': saleOrder['Prepared By'] || '',
                'Approved By': saleOrder['Approved By'] || '',
                'Prepared By Position': saleOrder['Prepared By Position'] || '',
                'Approved By Position': saleOrder['Approved By Position'] || '',
                'Remark': saleOrder['Remark'] || '',
                'Terms and Conditions': saleOrder['Terms and Conditions'] || '',
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
                'Company Address': saleOrder['Company Address'] || '',
                'Prepared By': saleOrder['Prepared By'] || '',
                'Approved By': saleOrder['Approved By'] || '',
                'Prepared By Position': saleOrder['Prepared By Position'] || '',
                'Approved By Position': saleOrder['Approved By Position'] || '',
                'Remark': saleOrder['Remark'] || '',
                'Terms and Conditions': saleOrder['Terms and Conditions'] || '',
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


    const resetLayout = () => {
        setPdfLayout(defaultLayoutConfig);
    };

    // PDF Generation Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!saleOrder['Company Name']) return;

            try {
                const selectedCompany = companies?.find(c => c['Company Name'] === saleOrder['Company Name']);

                const url = await generatePDF({
                    type: 'Sale Order',
                    title: 'Sale Order (B2C)',
                    headerData: {
                        ...saleOrder,
                        'Sale Order ID': saleOrder['SO No.'],
                        'Order Date': saleOrder['SO Date'],
                        'Delivery Date': saleOrder['Delivery Date'],
                        'Company Name': saleOrder['Company Name'],
                        'Company Address': selectedCompany?.['Address (English)'] || '',
                        'Contact Person': saleOrder['Contact Name'],
                        'Contact Tel': saleOrder['Phone Number'],
                        'Email': saleOrder.Email,
                        'Payment Term': saleOrder['Payment Term'],
                        'Bill Invoice': saleOrder['Bill Invoice'],
                    },
                    items: items.filter(item => item.no > 0).map(item => ({
                        no: item.no,
                        itemCode: item.itemCode,
                        modelName: item.modelName,
                        description: item.description,
                        qty: item.qty,
                        unitPrice: item.unitPrice,
                        amount: item.amount,
                        commission: item.commission
                    })),
                    totals: {
                        subTotal: totals.subTotal,
                        tax: totals.tax,
                        grandTotal: totals.grandTotal
                    },
                    currency: saleOrder.Currency || 'USD',
                    layout: pdfLayout,
                    previewMode: true,
                    filename: `SaleOrder_${saleOrder['SO No.'] || 'preview'}.pdf`
                });

                if (typeof url === 'string') {
                    setPdfPreviewUrl(url);
                }
            } catch (error) {
                console.error('PDF generation error:', error);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [saleOrder, items, totals, pdfLayout, companies]);

    const handleDownloadPDF = () => {
        generatePDF({
            type: 'Sale Order',
            title: 'Sale Order (B2C)',
            headerData: {
                ...saleOrder,
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
            },
            items: items.filter(item => item.no > 0).map(item => ({
                no: item.no,
                itemCode: item.itemCode,
                modelName: item.modelName,
                description: item.description,
                qty: item.qty,
                unitPrice: item.unitPrice,
                amount: item.amount,
                commission: item.commission
            })),
            totals: {
                subTotal: totals.subTotal,
                tax: totals.tax,
                grandTotal: totals.grandTotal
            },
            currency: saleOrder.Currency || 'USD',
            layout: pdfLayout,
            previewMode: false,
            filename: `SaleOrder_${saleOrder['SO No.']}.pdf`
        });
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
            'Remark': saleOrder['Remark'] || '',
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
            <div className="flex items-center gap-2 border-r border-slate-200 pr-3 mr-1">
                <button
                    onClick={() => setShowPdfPreview(!showPdfPreview)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${showPdfPreview ? 'bg-slate-100 text-slate-900 shadow-inner' : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-sm'}`}
                    title="Toggle PDF Preview"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="hidden lg:inline">{showPdfPreview ? 'Hide PDF' : 'PDF'}</span>
                </button>
                <button
                    onClick={() => setShowLayoutControls(!showLayoutControls)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${showLayoutControls ? 'bg-slate-100 text-slate-900 shadow-inner' : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-sm'}`}
                    title="Toggle Layout Controls"
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden lg:inline">{showLayoutControls ? 'Hide Controls' : 'Layout'}</span>
                </button>
                <button
                    onClick={() => setShowFormPanel(!showFormPanel)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${showFormPanel ? 'bg-slate-100 text-slate-900 shadow-inner' : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-sm'}`}
                    title="Toggle Form Panel"
                >
                    <PanelRight className="w-4 h-4" />
                    <span className="hidden lg:inline">{showFormPanel ? 'Hide Form' : 'Form'}</span>
                </button>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-6 py-2 text-sm font-bold bg-white text-brand-600 border border-brand-200 rounded-md hover:bg-brand-50 hover:border-brand-300 shadow-sm transition-all active:scale-95">
                    <Download className="w-4 h-4" />
                    Download PDF
                </button>
            </div>

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
                isSubmitting={isSubmitting}
                leftActions={headerLeft}
                rightActions={headerRight}
            >
                Riverside:
                Riverside:
                Riverside:
                Riverside:
                Riverside:
                Riverside:
                Riverside:
                {/* Main Content Area - Matching QuotationCreator Layout */}
                <div className="screen-only h-full flex relative overflow-hidden">
                    {/* Center area: PDF Layout + Preview */}
                    <div className="flex-1 flex flex-col relative overflow-hidden">
                        {/* Top: Collapsible Layout Controls with Horizontal Tabs */}
                        <div className={`w-full border-b border-gray-200 flex flex-col bg-white transition-all duration-300 ease-in-out flex-shrink-0 ${showLayoutControls ? 'h-[320px] opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}>
                            <div className="flex justify-center border-b border-gray-200 bg-gray-50">
                                <button
                                    onClick={() => setActiveTab('header')}
                                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'header' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Header
                                </button>
                                <button
                                    onClick={() => setActiveTab('table')}
                                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'table' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Table
                                </button>
                                <button
                                    onClick={() => setActiveTab('footer')}
                                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'footer' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Footer
                                </button>
                                <div className="border-l border-gray-200 flex items-center">
                                    <button
                                        onClick={handleSaveLayout}
                                        className="h-full px-6 text-sm font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2 transition-all active:scale-95 group"
                                    >
                                        <Save className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                        Save Layout
                                    </button>
                                </div>
                                <div className="border-l border-gray-200 flex items-center px-4 bg-gray-50/50">
                                    <button
                                        onClick={() => setShowPdfConfig(true)}
                                        className="px-3 py-1.5 text-[10px] font-bold text-gray-500 bg-white hover:bg-gray-100 rounded-md border border-gray-200 transition-colors uppercase tracking-wider flex items-center gap-1.5"
                                    >
                                        Advanced
                                    </button>
                                </div>
                            </div>

                            <ScrollArea className="flex-1 p-4">
                                {activeTab === 'header' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Logo Positioning</h3>
                                                <button onClick={() => {
                                                    updateLayout('header.logo.x', defaultLayoutConfig.header.logo.x);
                                                    updateLayout('header.logo.y', defaultLayoutConfig.header.logo.y);
                                                    updateLayout('header.logo.width', defaultLayoutConfig.header.logo.width);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-blue-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100 shadow-sm space-y-1">
                                                <PDFControlField label="X (mm)" path="header.logo.x" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Y (mm)" path="header.logo.y" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Width (mm)" path="header.logo.width" min={10} max={120} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> Company Name</h3>
                                                <button onClick={() => {
                                                    updateLayout('header.companyName.fontSize', defaultLayoutConfig.header.companyName.fontSize);
                                                    updateLayout('header.contactInfo.fontSize', defaultLayoutConfig.header.contactInfo.fontSize);
                                                    updateLayout('header.address.fontSize', defaultLayoutConfig.header.address.fontSize);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-blue-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100 shadow-sm space-y-1">
                                                <PDFControlField label="Co. Font" path="header.companyName.fontSize" min={8} max={24} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Contact Font" path="header.contactInfo.fontSize" min={6} max={14} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Address Font" path="header.address.fontSize" min={6} max={14} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" /> Separator & Title</h3>
                                                <button onClick={() => {
                                                    updateLayout('header.separatorLine.y', defaultLayoutConfig.header.separatorLine.y);
                                                    updateLayout('title.y', defaultLayoutConfig.title.y);
                                                    updateLayout('title.fontSize', defaultLayoutConfig.title.fontSize);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-blue-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100 shadow-sm space-y-1">
                                                <PDFControlField label="Separator Y" path="header.separatorLine.y" min={10} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Title Y" path="title.y" min={20} max={150} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Title Size" path="title.fontSize" min={12} max={24} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1.5"><ScrollText className="w-3.5 h-3.5" /> Order Info</h3>
                                                <button onClick={() => {
                                                    updateLayout('info.startY', defaultLayoutConfig.info.startY);
                                                    updateLayout('info.fontSize', defaultLayoutConfig.info.fontSize);
                                                    updateLayout('info.rowHeight', defaultLayoutConfig.info.rowHeight);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-blue-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100 shadow-sm space-y-1">
                                                <PDFControlField label="Start Y" path="info.startY" min={30} max={150} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Font Size" path="info.fontSize" min={6} max={14} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Row Spacing" path="info.rowHeight" min={4} max={12} step={0.5} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'table' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" /> Table Setup</h3>
                                                <button onClick={() => {
                                                    updateLayout('table.startY', defaultLayoutConfig.table.startY);
                                                    updateLayout('table.fontSize', defaultLayoutConfig.table.fontSize);
                                                    updateLayout('table.descriptionFontSize', defaultLayoutConfig.table.descriptionFontSize);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-emerald-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-100 shadow-sm space-y-1">
                                                <PDFControlField label="Start Y" path="table.startY" min={60} max={250} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Header Size" path="table.fontSize" min={6} max={14} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Content Size" path="table.descriptionFontSize" min={6} max={12} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" /> Margins</h3>
                                                <button onClick={() => {
                                                    updateLayout('table.margins.left', defaultLayoutConfig.table.margins.left);
                                                    updateLayout('table.margins.right', defaultLayoutConfig.table.margins.right);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-emerald-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-100 shadow-sm space-y-1">
                                                <PDFControlField label="Left Margin" path="table.margins.left" min={5} max={40} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Right Margin" path="table.margins.right" min={5} max={40} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                            </div>
                                        </div>

                                        <div className="lg:col-span-2 space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-1.5"><Layout className="w-3.5 h-3.5" /> Column Widths</h3>
                                                <button onClick={() => {
                                                    updateLayout('table.columnWidths.no', defaultLayoutConfig.table.columnWidths.no);
                                                    updateLayout('table.columnWidths.itemCode', defaultLayoutConfig.table.columnWidths.itemCode);
                                                    updateLayout('table.columnWidths.qty', defaultLayoutConfig.table.columnWidths.qty);
                                                    updateLayout('table.columnWidths.unitPrice', defaultLayoutConfig.table.columnWidths.unitPrice);
                                                    updateLayout('table.columnWidths.total', defaultLayoutConfig.table.columnWidths.total);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-emerald-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-100 shadow-sm">
                                                <div className="divide-y divide-emerald-50/50">
                                                    <PDFControlField label="No. Column" path="table.columnWidths.no" min={5} max={30} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                    <PDFControlField label="Code Column" path="table.columnWidths.itemCode" min={10} max={60} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                    <PDFControlField label="Qty Column" path="table.columnWidths.qty" min={10} max={40} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                    <PDFControlField label="Price Column" path="table.columnWidths.unitPrice" min={15} max={60} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                    <PDFControlField label="Total Column" path="table.columnWidths.total" min={15} max={60} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'footer' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-purple-700 uppercase flex items-center gap-1.5"><ScrollText className="w-3.5 h-3.5" /> Terms & Signature</h3>
                                                <button onClick={() => {
                                                    updateLayout('terms.spacingBefore', defaultLayoutConfig.terms.spacingBefore);
                                                    updateLayout('footer.y', defaultLayoutConfig.footer.y);
                                                    updateLayout('footer.preparedBy.x', defaultLayoutConfig.footer.preparedBy.x);
                                                    updateLayout('footer.approvedBy.x', defaultLayoutConfig.footer.approvedBy.x);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-purple-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-purple-50/50 p-2 rounded-xl border border-purple-100 shadow-sm space-y-1">
                                                <PDFControlField label="Terms Spacing" path="terms.spacingBefore" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Vertical Y" path="footer.y" min={150} max={290} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Prepared X" path="footer.preparedBy.x" min={10} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Approved X" path="footer.approvedBy.x" min={100} max={200} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                        {/* Center: PDF Preview OR Pricelist */}
                        {showPdfPreview ? (
                            <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-800">PDF Layout Preview</h3>
                                            <p className="text-[10px] text-gray-500">{saleOrder['SO No.'] || 'SO-0000000'} • {saleOrder['Company Name'] || 'No Company'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-xs text-slate-500 font-medium px-2">Real-time Preview</div>
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col items-center justify-center bg-slate-100/50 relative overflow-hidden p-6">
                                    {pdfPreviewUrl ? (
                                        <iframe
                                            src={pdfPreviewUrl}
                                            className="w-full h-full border-none shadow-lg rounded-lg bg-white"
                                            title="PDF Preview"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <Spinner size="sm" />
                                            <span>Generating Preview...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col bg-white relative overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-800">Pricelist Reference</h3>
                                            <p className="text-[10px] text-gray-500">{pricelist?.length || 0} items available</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 sticky top-0 z-10">
                                            <tr className="border-b border-slate-200">
                                                <th className="px-4 py-2 text-left font-semibold text-slate-700">Code</th>
                                                <th className="px-4 py-2 text-left font-semibold text-slate-700">Brand</th>
                                                <th className="px-4 py-2 text-left font-semibold text-slate-700">Model</th>
                                                <th className="px-4 py-2 text-left font-semibold text-slate-700">Description</th>
                                                <th className="px-4 py-2 text-right font-semibold text-slate-700">Unit Price</th>
                                                <th className="px-4 py-2 text-center font-semibold text-slate-700">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pricelist && pricelist.length > 0 ? (
                                                pricelist.map((item, index) => (
                                                    <tr key={item.Code || index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-2 text-slate-600 font-mono text-xs">{item.Code}</td>
                                                        <td className="px-4 py-2 text-slate-700">{item.Brand}</td>
                                                        <td className="px-4 py-2 text-slate-800 font-medium">{item.Model}</td>
                                                        <td className="px-4 py-2 text-slate-600 text-xs max-w-md truncate">{item.Description}</td>
                                                        <td className="px-4 py-2 text-right text-slate-800 font-semibold">{item['End User Price']}</td>
                                                        <td className="px-4 py-2 text-center">
                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${item.Status === 'Available' ? 'bg-green-100 text-green-700' :
                                                                item.Status === 'Out of Stock' ? 'bg-red-100 text-red-700' :
                                                                    'bg-yellow-100 text-yellow-700'
                                                                }`}>
                                                                {item.Status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                                        No pricelist items available
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Form Sidebar */}
                    <div className={`bg-white transition-all duration-300 ease-in-out flex flex-col ${showFormPanel ? 'opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'
                        } ${showPdfPreview ? 'border-l border-gray-200 flex-shrink-0 w-[500px]' : 'flex-1 max-w-4xl mx-auto'
                        }`}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                                <h3 className="text-sm font-bold text-gray-800">Sale Order Details</h3>
                            </div>
                            <button
                                onClick={() => setShowFormPanel(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white/60 rounded-md transition-all"
                                aria-label="Close panel"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <ScrollArea className="flex-1 px-5 py-4">
                            <div className="space-y-6">
                                <FormSection title="Customer Info">
                                    <SearchableSelect
                                        name="Company Name"
                                        label="Company Name"
                                        value={saleOrder['Company Name'] || ''}
                                        onChange={handleCompanySelect}
                                        options={companyOptions}
                                        required
                                        placeholder="Search for a company..."
                                    />
                                    <FormSelect name="Contact Name" label="Contact Person" value={saleOrder['Contact Name']} onChange={handleContactChange} options={contactOptions} disabled={!saleOrder['Company Name']} />
                                    <FormTextarea name="Company Address" label="Address" value={saleOrder['Company Address']} onChange={handleHeaderChange} rows={3} />
                                    <FormInput name="Phone Number" label="Tel" value={saleOrder['Phone Number']} onChange={handleHeaderChange} readOnly />
                                    <FormInput name="Email" label="Email" value={saleOrder['Email']} onChange={handleHeaderChange} readOnly />
                                </FormSection>

                                <FormSection title="Order Info">
                                    <FormInput name="SO No." label="Sale Order No." value={saleOrder['SO No.']} onChange={handleHeaderChange} readOnly required />
                                    <FormInput name="Pipeline No." label="Pipeline No." value={saleOrder['Pipeline No.']} onChange={handleHeaderChange} readOnly />
                                    <FormSelect name="Currency" label="Currency" value={saleOrder.Currency} onChange={handleHeaderChange} options={CURRENCY_OPTIONS} required />
                                    <FormSelect name="Bill Invoice" label="Bill Invoice" value={saleOrder['Bill Invoice']} onChange={handleHeaderChange} options={BILL_INVOICE_OPTIONS} />
                                    <FormInput name="SO Date" label="Order Date" value={saleOrder['SO Date']} onChange={handleHeaderChange} type="date" required />
                                    <FormInput name="Delivery Date" label="Delivery Date" value={saleOrder['Delivery Date']} onChange={handleHeaderChange} type="date" />
                                    <FormInput name="Payment Term" label="Payment Term" value={saleOrder['Payment Term']} onChange={handleHeaderChange} />
                                    <FormSelect name="Status" label="Status" value={saleOrder.Status} onChange={handleHeaderChange} options={STATUS_OPTIONS} />
                                    <FormSelect name="Quote No." label="From Quotation" value={saleOrder['Quote No.']} onChange={handleQuoteChange} options={quoteOptions} disabled={!saleOrder['Company Name']} />
                                </FormSection>

                                <FormSection title="Signatures & Remarks">
                                    <FormInput name="Prepared By" label="Prepared By" value={saleOrder['Prepared By']} onChange={handleHeaderChange} />
                                    <FormInput name="Approved By" label="Approved By" value={saleOrder['Approved By']} onChange={handleHeaderChange} />
                                    <FormInput name="Prepared By Position" label="Position" value={saleOrder['Prepared By Position']} onChange={handleHeaderChange} />
                                    <FormInput name="Approved By Position" label="Position" value={saleOrder['Approved By Position']} onChange={handleHeaderChange} />
                                    <FormTextarea name="Remark" label="Remark" value={saleOrder.Remark} onChange={handleHeaderChange} rows={3} />


                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Set up software</label>

                                        <div className="flex gap-2 mb-3">
                                            <input
                                                type="text"
                                                placeholder="Add other software..."
                                                className="flex-1 text-sm px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-500 font-normal shadow-sm"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const val = e.currentTarget.value.trim();
                                                        if (val) {
                                                            handleAddSoftware(val);
                                                            e.currentTarget.value = '';
                                                        }
                                                    }
                                                }}
                                                id="custom-software-input"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const input = document.getElementById('custom-software-input') as HTMLInputElement;
                                                    if (input && input.value.trim()) {
                                                        handleAddSoftware(input.value.trim());
                                                        input.value = '';
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-sm font-semibold border border-slate-200 transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            {[...new Set([...SOFTWARE_OPTIONS, ...selectedSoftware])].sort().map(option => (
                                                <label key={option} className={`flex items-center gap-2 cursor-pointer p-2 rounded-md border transition-all ${selectedSoftware.includes(option) ? 'bg-brand-50 border-brand-200' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSoftware.includes(option)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                handleAddSoftware(option);
                                                            } else {
                                                                handleRemoveSoftware(option);
                                                            }
                                                        }}
                                                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                                    />
                                                    <span className={`text-sm ${selectedSoftware.includes(option) ? 'text-brand-700 font-medium' : 'text-slate-700'}`}>{option}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </FormSection>

                                <FormSection title="Attachment">
                                    <div>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                        {isUploading ? (
                                            <div className="flex items-center gap-3 text-sm text-slate-600 p-4 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200">
                                                <Spinner size="sm" />
                                                <span className="font-bold">Uploading...</span>
                                            </div>
                                        ) : saleOrder['Attachment'] ? (
                                            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-100 shadow-sm">
                                                <a href={saleOrder['Attachment']} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-700 hover:underline truncate max-w-[200px]">
                                                    View Uploaded File
                                                </a>
                                                <button type="button" onClick={handleRemoveFile} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-full transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full text-center p-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-300 transition-all flex flex-col items-center gap-2">
                                                <Upload className="w-5 h-5 text-slate-400" />
                                                <span className="text-[10px] uppercase tracking-widest">Click to Upload File</span>
                                            </button>
                                        )}
                                    </div>
                                </FormSection>

                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Line Items</h3>
                                    {itemsLoading ? (
                                        <div className="text-center p-8"><Spinner /></div>
                                    ) : (
                                        <div className="space-y-4">
                                            {items.map((item) => {
                                                const isDescriptionRow = item.no === 0;
                                                return (
                                                    <div key={item.id} className="relative p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-blue-400 hover:shadow-md group">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(item.id)}
                                                            className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all z-10"
                                                            title="Remove Item"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>

                                                        {isDescriptionRow ? (
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Note / Description</label>
                                                                <textarea
                                                                    value={item.description}
                                                                    onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                                    className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
                                                                    rows={2}
                                                                    placeholder="Add clear note..."
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex flex-wrap gap-3 pr-8 mb-3">
                                                                    <div className="w-10">
                                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block text-center">No.</label>
                                                                        <div className="h-9 flex items-center justify-center bg-white rounded-lg border border-slate-200 font-mono text-sm font-semibold text-slate-600 shadow-sm">
                                                                            {item.no}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex-1 min-w-[140px]">
                                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Item Code</label>
                                                                        <PricelistCombobox item={item} onItemChange={handleItemChange} onPricelistItemSelect={handlePricelistItemSelect} />
                                                                    </div>

                                                                    <div className="flex-[1.5] min-w-[160px]">
                                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Model</label>
                                                                        <input
                                                                            type="text"
                                                                            value={item.modelName}
                                                                            onChange={e => handleItemChange(item.id, 'modelName', e.target.value)}
                                                                            className="w-full h-9 px-3 text-sm font-medium border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm "
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap gap-3 mb-3">
                                                                    <div className="w-20">
                                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Qty</label>
                                                                        <input type="number" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', e.target.value)} className="w-full h-9 px-2 text-center text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-blue-200 shadow-sm" />
                                                                    </div>
                                                                    <div className="w-28">
                                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Unit Price</label>
                                                                        <input type="number" step="0.01" value={item.unitPrice} onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value)} className="w-full h-9 px-2 text-right text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-blue-200 shadow-sm" />
                                                                    </div>
                                                                    <div className="flex-1 text-right pt-4">
                                                                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Total Amount</div>
                                                                        {(() => {
                                                                            const currencySymbol = saleOrder.Currency === 'KHR' ? '៛' : '$';
                                                                            return <div className="text-lg font-bold text-slate-700">{currencySymbol}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                                        })()}
                                                                    </div>
                                                                </div>

                                                                <div className="pt-2 border-t border-slate-200/60">
                                                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block flex items-center gap-2">
                                                                        Description / Spec
                                                                        <span className="text-[9px] normal-case font-normal bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200">Expanded View</span>
                                                                    </label>
                                                                    <textarea
                                                                        value={item.description}
                                                                        onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                                        className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white shadow-inner resize-y min-h-[80px]"
                                                                        rows={3}
                                                                        placeholder="Detailed product description..."
                                                                    />
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            <div className="flex gap-3 pt-2">
                                                <button type="button" onClick={addItem} className="flex-1 py-2.5 rounded-lg border border-dashed border-blue-300 text-blue-600 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                                                    <span>+ Add Product Line</span>
                                                </button>
                                                <button type="button" onClick={addDescriptionRow} className="flex-1 py-2.5 rounded-lg border border-dashed border-slate-300 text-slate-600 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                                                    <span>+ Add Note Block</span>
                                                </button>
                                            </div>

                                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mt-6 space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-500 font-medium">Sub Total</span>
                                                    <span className="text-slate-700 font-black">{formatCurrency(totals.subTotal)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-500 font-medium">Tax</span>
                                                    <span className="text-slate-700 font-black">{formatCurrency(totals.tax)}</span>
                                                </div>
                                                <div className="flex justify-between items-center pt-3 border-t border-slate-300">
                                                    <span className="text-xs text-slate-800 font-black uppercase tracking-wider">Grand Total</span>
                                                    <span className="text-lg text-blue-700 font-black">{formatCurrency(totals.grandTotal)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                {/* Print-only content */}
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

            {/* PDF Configuration Modal */}
            <PDFConfigModal
                isOpen={showPdfConfig}
                onClose={() => setShowPdfConfig(false)}
                onGenerate={(layout) => {
                    setPdfLayout(layout);
                    setShowPdfConfig(false);
                }}
                currentLayout={pdfLayout}
            />
        </>
    );
};

export default SaleOrderCreator;