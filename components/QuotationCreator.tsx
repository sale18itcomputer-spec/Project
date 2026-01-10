
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Quotation, Company, Contact, PricelistItem } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { createRecord, updateRecord, createQuotationSheet, readQuotationSheetData, getSetting, saveSetting } from '../services/api';
import { formatToSheetDate, formatToInputDate } from '../utils/time';
import { FormSection, FormInput, FormSelect, FormTextarea } from './FormControls';
import PrintableQuotation from './PrintableQuotation';
import { Trash2, AlertTriangle, Printer, Download, SlidersHorizontal, PanelRight, Send, Save, Plus, Minus, RotateCcw, ImageIcon, Type, Ruler, ScrollText, Layout } from 'lucide-react';
import { PDFLayoutConfig, defaultLayoutConfig, generatePDF } from '../utils/pdfGenerator';
import PDFConfigModal from './PDFConfigModal';
import PDFControlField from './PDFControlField';
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
    initialData?: Partial<Quotation>;
}

interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName: string;
    description: string;
    qty: number | string;
    unitPrice: number | string;
    amount: number;
    commission: number | string;
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
const TAX_TYPE_OPTIONS: ('VAT' | 'NON-VAT')[] = ['VAT', 'NON-VAT'];

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

const lineItemInputClasses = "w-full text-sm p-2 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition";

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
                                                <p className="font-semibold text-slate-700">{parseSheetValue(pItem['End User Price']).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
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







const QuotationCreator: React.FC<QuotationCreatorProps> = ({ onBack, existingQuotation, initialData }) => {
    const { quotations, setQuotations, companies, contacts, pricelist } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { handleNavigation } = useNavigation();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [itemsLoading, setItemsLoading] = useState(false);
    const [successInfo, setSuccessInfo] = useState<{ quoteNo: string; isWin?: boolean } | null>(null);

    const [items, setItems] = useState<LineItem[]>([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0, commission: 0 }]);
    const [showPdfConfig, setShowPdfConfig] = useState(false);
    const [pdfLayout, setPdfLayout] = useState<PDFLayoutConfig>(defaultLayoutConfig);
    const [activeTab, setActiveTab] = useState<'header' | 'table' | 'footer'>('header');
    const [hoveredPath, setHoveredPath] = useState<string | null>(null);
    const [previewScale, setPreviewScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showPdfControls, setShowPdfControls] = useState(false);
    const [showRightPanel, setShowRightPanel] = useState(true);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);



    const updateLayout = (path: string, value: number) => {
        setPdfLayout(prev => {
            const newState = JSON.parse(JSON.stringify(prev));

            // Helper to set value at path
            const setVal = (obj: any, p: string, v: number) => {
                const k = p.split('.');
                let c = obj;
                for (let i = 0; i < k.length - 1; i++) c = c[k[i]];
                c[k[k.length - 1]] = Number(v);
            };

            setVal(newState, path, value);

            // Smart updates for Header Grouping
            if (path === 'header.companyName.x') {
                const newX = Number(value);
                setVal(newState, 'header.contactInfo.x', newX);
                setVal(newState, 'header.address.x', newX);
            }
            if (path === 'header.companyName.y') {
                const oldY = prev.header.companyName.y;
                const newY = Number(value);
                const delta = newY - oldY;

                setVal(newState, 'header.contactInfo.y', prev.header.contactInfo.y + delta);
                setVal(newState, 'header.address.y', prev.header.address.y + delta);
                setVal(newState, 'header.separatorLine.y', prev.header.separatorLine.y + delta);
                setVal(newState, 'title.y', prev.title.y + delta);
            }

            // Sync to localStorage
            localStorage.setItem('global_pdf_layout', JSON.stringify(newState));
            return newState;
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

    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const padding = 32;
                const availableWidth = containerRef.current.offsetWidth - padding;
                const availableHeight = containerRef.current.offsetHeight - padding;

                const pageWidth = 210 * 3;
                const pageHeight = 297 * 3;

                const scaleX = availableWidth / pageWidth;
                const scaleY = availableHeight / pageHeight;

                setPreviewScale(Math.min(scaleX, scaleY));
            }
        };

        setTimeout(updateScale, 350);
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [showPdfControls, showRightPanel]);

    // Calculate the next ID based on the MAX number in the list.
    const nextQuotationNumber = useMemo(() => {
        if (existingQuotation) return existingQuotation['Quote No.'];
        if (!quotations || quotations.length === 0) return 'Q-0000001';

        const maxNum = quotations.reduce((max, q) => {
            // Robust parsing to handle potential non-standard IDs like 'Q-000001' or 'Q-1'
            const match = q['Quote No.'].match(/Q-(\d+)/);
            if (!match) return max;
            const numPart = parseInt(match[1], 10);
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
            'Tax Type': 'VAT',
            ...initialData // Spread initial data to override defaults
        };
    });

    // Update local state when the calculated ID changes (only for new quotes)
    useEffect(() => {
        if (!existingQuotation) {
            setQuote(prev => ({ ...prev, 'Quote No.': nextQuotationNumber }));
        }
    }, [nextQuotationNumber, existingQuotation]);

    // Auto-fill customer details from companies/contacts when coming from initialData (+Create)
    useEffect(() => {
        if (!existingQuotation && initialData && companies && contacts) {
            const companyName = initialData['Company Name'];
            const contactName = initialData['Contact Name'];

            if (companyName || contactName) {
                const company = companies.find(c => c['Company Name'] === companyName);
                const contact = contacts.find(c => c.Name === contactName && (!companyName || c['Company Name'] === companyName));

                setQuote(prev => ({
                    ...prev,
                    'Company Address': company?.['Address (English)'] || prev['Company Address'] || '',
                    'Payment Term': company?.['Payment Term'] || prev['Payment Term'] || '',
                    'Contact Number': contact?.['Tel (1)'] || prev['Contact Number'] || '',
                    'Contact Email': contact?.Email || prev['Contact Email'] || '',
                }));
            }
        }
    }, [initialData, companies, contacts, existingQuotation]);


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
                    // If header has data, use it, otherwise fallback. 
                    // Note: Supabase readQuotationSheetData returns the full record in 'header'.
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
                        commission: item.commission || 0,
                    }));
                    setItems(formattedItems);
                } else {
                    setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0, commission: 0 }]);
                }
            } catch (err: any) {
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
                        const q = parseFloat(String(updatedItem.qty)) || 0;
                        const p = parseFloat(String(updatedItem.unitPrice)) || 0;
                        const c = parseFloat(String(updatedItem.commission)) || 0;
                        updatedItem.amount = (q * p) + c;
                    }
                    return updatedItem;
                }
                return item;
            });
            let currentNo = 1;
            return newItems.map(item => {
                if (item.itemCode || item.modelName || item.qty || item.unitPrice) {
                    return { ...item, no: currentNo++ }
                }
                return { ...item, no: 0 };
            });
        });
    };

    const handlePricelistItemSelect = (lineItem: LineItem, pricelistItem: PricelistItem) => {
        setItems(currentItems => {
            const newItems = currentItems.map(item => {
                if (item.id === lineItem.id) {
                    const unitPrice = parseSheetValue(pricelistItem['End User Price']);
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

    const addItem = () => {
        setItems(prev => {
            const newItem = { id: `item-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0, commission: 0 };
            const newItems = [...prev, newItem];

            let currentNo = 1;
            return newItems.map(item => {
                if (item.itemCode || item.modelName || item.qty || item.unitPrice) {
                    return { ...item, no: currentNo++ }
                }
                return { ...item, no: 0 };
            });
        });
    };

    const addDescriptionRow = () => {
        setItems(prev => {
            const newItem = { id: `desc-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 0, unitPrice: 0, amount: 0, commission: 0 };
            return [...prev, newItem];
        });
    };

    const removeItem = (id: string) => {
        setItems(prev => {
            if (prev.length <= 1) return prev; // Don't remove the last item
            const newItems = prev.filter(item => item.id !== id);
            let currentNo = 1;
            return newItems.map(item => {
                if (item.itemCode || item.modelName || item.qty || item.unitPrice) {
                    return { ...item, no: currentNo++ }
                }
                return { ...item, no: 0 };
            });
        });
    };

    const totals = useMemo(() => {
        const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
        const commission = items.reduce((sum, item) => sum + (parseFloat(String(item.commission)) || 0), 0);
        const vat = quote['Tax Type'] === 'NON-VAT' ? 0 : subTotal * 0.1;
        const grandTotal = subTotal + vat;
        return { subTotal, vat, grandTotal, commission };
    }, [items, quote['Tax Type']]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            const headerData = {
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
                'Created By': quote['Created By'],
                'Prepared By': quote['Prepared By'],
                'Prepared By Position': quote['Prepared By Position'],
                'Approved By': quote['Approved By'],
                'Approved By Position': quote['Approved By Position'],
                'Remark': quote.Remark,
                'Terms and Conditions': quote['Terms and Conditions'],
            };

            const url = await generatePDF({
                title: 'Quotation',
                headerData,
                items,
                totals,
                currency: quote.Currency || 'USD',
                filename: 'preview.pdf',
                type: 'Quotation',
                layout: pdfLayout,
                previewMode: true
            });
            if (typeof url === 'string') setPdfPreviewUrl(url);
        }, 800);
        return () => clearTimeout(timer);
    }, [quote, items, totals, pdfLayout]);

    const handleSave = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const masterSheetData: Quotation = {
                'Quote No.': quote['Quote No.'] || nextQuotationNumber,
                'File': '', // No external file link anymore
                'Quote Date': quote['Quote Date'] || null,
                'Validity Date': quote['Validity Date'] || null,
                'Company Name': quote['Company Name'] || '',
                'Company Address': quote['Company Address'] || '',
                'Contact Name': quote['Contact Name'] || '',
                'Contact Number': quote['Contact Number'] || '',
                'Contact Email': quote['Contact Email'] || '',
                'Amount': String(totals.grandTotal),
                'CM': String(totals.commission),
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
                'Tax Type': quote['Tax Type'] || 'VAT',
            };

            const sheetGenerationData = {
                ...masterSheetData,
                'Quote Date': quote['Quote Date'],
                'Validity Date': quote['Validity Date'],
                'ItemsJSON': JSON.stringify(items),
            };

            // This now saves to Supabase directly
            await createQuotationSheet(masterSheetData['Quote No.'], sheetGenerationData);

            // Handle "Close (Win)" auto-conversion logic
            if (masterSheetData.Status === 'Close (Win)') {
                // Open Success Modal with option to create Sale Order
                setSuccessInfo({ quoteNo: masterSheetData['Quote No.'], isWin: true });
            } else {
                setSuccessInfo({ quoteNo: masterSheetData['Quote No.'], isWin: false });
            }

        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRequestApprove = async () => {
        setIsSubmitting(true);
        try {
            // Simply save the document when requesting approval.
            // Custom logic like notification can be added here.
            await handleSave();
            addToast('Approval request has been saved.', 'info');
        } catch (err: any) {
            setError(err.message || 'Failed to request approval.');
        } finally {
            setIsSubmitting(false);
        }
    };





    const currencySymbol = getCurrencySymbol(quote.Currency);

    // FIX: Define formatCurrency function to correctly format numeric values as currency strings.
    const formatCurrency = (value: number) => {
        if (typeof value !== 'number' || isNaN(value)) return `${currencySymbol}0.00`;
        return `${currencySymbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handleDownloadPDF = () => {
        generatePDF({
            type: 'Quotation',
            title: 'Quotation',
            headerData: {
                ...quote,
                'Quotation ID': quote['Quote No.'],
                'Quote Date': quote['Quote Date'],
                'Validity Date': quote['Validity Date'],
                'Company Name': quote['Company Name'],
                'Company Address': quote['Company Address'],
                'Contact Person': quote['Contact Name'],
                'Contact Tel': quote['Contact Number'],
                'Contact Email': quote['Contact Email'],
                'Stock Status': quote['Stock Status'],
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
                tax: totals.vat,
                vat: totals.vat,
                grandTotal: totals.grandTotal
            },
            currency: quote.Currency || 'USD',
            filename: `Quotation_${quote['Quote No.']}.pdf`,
            layout: pdfLayout
        });
    };

    const generateFinalPDF = (layout: PDFLayoutConfig) => {
        setPdfLayout(layout);
        setShowPdfConfig(false);
        generatePDF({
            type: 'Quotation',
            title: 'Quotation',
            headerData: {
                ...quote,
                'Quotation ID': quote['Quote No.'],
                'Quote Date': quote['Quote Date'],
                'Validity Date': quote['Validity Date'],
                'Company Name': quote['Company Name'],
                'Company Address': quote['Company Address'],
                'Contact Person': quote['Contact Name'],
                'Contact Tel': quote['Contact Number'],
                'Contact Email': quote['Contact Email'],
                'Stock Status': quote['Stock Status'],
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
                tax: totals.vat,
                vat: totals.vat,
                grandTotal: totals.grandTotal
            },
            currency: quote.Currency || 'USD',
            filename: `Quotation_${quote['Quote No.']}.pdf`,
            layout: layout
        });
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


    const headerLeft = (
        <div className="flex items-center ml-4">
            <div className="relative inline-block">
                <select
                    value={quote.Status}
                    onChange={handleHeaderChange}
                    name="Status"
                    className="appearance-none bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-8 rounded-md transition cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 pr-10 text-sm"
                >
                    {STATUS_OPTIONS.map(opt => (
                        <option key={opt} value={opt} className="text-slate-900 bg-white">{opt === 'Open' ? 'Quote Status' : opt}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
            </div>
        </div>
    );

    const headerRight = (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-2 border-r border-gray-200 pr-4">
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
                    onClick={() => setShowPdfControls(!showPdfControls)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${showPdfControls ? 'bg-slate-100 text-slate-900 shadow-inner' : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-sm'}`}
                    title="Toggle Layout Controls"
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden lg:inline">{showPdfControls ? 'Hide Controls' : 'Layout'}</span>
                </button>
                <button
                    onClick={() => setShowRightPanel(!showRightPanel)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${showRightPanel ? 'bg-slate-100 text-slate-900 shadow-inner' : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-sm'}`}
                    title="Toggle Form Panel"
                >
                    <PanelRight className="w-4 h-4" />
                    <span className="hidden lg:inline">{showRightPanel ? 'Hide Form' : 'Form'}</span>
                </button>
            </div>

            <div className="flex items-center gap-2 mr-2">
                <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-6 py-2 text-sm font-bold bg-white text-brand-600 border border-brand-200 rounded-md hover:bg-brand-50 hover:border-brand-300 shadow-sm transition-all active:scale-95">
                    <Download className="w-4 h-4" />
                    Download PDF
                </button>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleRequestApprove} disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Request Approve</span>
                </button>
                <button onClick={handleSave} disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm transition-all min-w-[100px] justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? <Spinner className="w-4 h-4" /> : <><Save className="w-4 h-4" /> Save</>}
                </button>
            </div>
        </div>
    );

    return (
        <>
            <DocumentEditorContainer
                title={existingQuotation ? `Edit Quotation ${existingQuotation['Quote No.']}` : "Create New Quotation"}
                onBack={onBack}
                onSave={handleSave}
                isSubmitting={isSubmitting}
                leftActions={headerLeft}
                rightActions={headerRight}
            >
                {error && (
                    <div className="mb-6 bg-rose-50 border-l-4 border-rose-400 text-rose-800 p-4 rounded-md text-sm flex items-start gap-3" role="alert">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Could not save quotation</p>
                            <p>{error}</p>
                        </div>
                    </div>
                )}

                {/* Three-Panel Layout */}
                <div className="screen-only h-full flex relative overflow-hidden">
                    {/* Center: PDF Layout Configuration Container */}
                    <div className="flex-1 flex flex-col relative overflow-hidden">
                        {/* Top: Collapsible Layout Controls */}
                        <div className={`w-full border-b border-gray-200 flex flex-col bg-white transition-all duration-300 ease-in-out flex-shrink-0 ${showPdfControls ? 'h-[320px] opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}>
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
                                <div className="border-l border-gray-200">
                                    <button
                                        onClick={handleSaveLayout}
                                        className="h-full px-6 text-sm font-bold text-gray-700 hover:bg-brand-50 hover:text-brand-600 flex items-center gap-2 transition-all active:scale-95 group"
                                    >
                                        <Save className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                        Save Layout
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
                                                <div className="grid grid-cols-1 gap-1">
                                                    <PDFControlField label="X (mm)" path="header.logo.x" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                    <PDFControlField label="Y (mm)" path="header.logo.y" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                    <PDFControlField label="Width (mm)" path="header.logo.width" min={10} max={120} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> Company Name</h3>
                                                <button onClick={() => {
                                                    updateLayout('header.companyName.x', defaultLayoutConfig.header.companyName.x);
                                                    updateLayout('header.companyName.y', defaultLayoutConfig.header.companyName.y);
                                                    updateLayout('header.companyName.fontSize', defaultLayoutConfig.header.companyName.fontSize);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-blue-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100 shadow-sm">
                                                <div className="divide-y divide-blue-50/50">
                                                    <PDFControlField label="X Position" path="header.companyName.x" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                    <PDFControlField label="Y Position" path="header.companyName.y" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                    <PDFControlField label="Co. Font" path="header.companyName.fontSize" min={8} max={24} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                    <PDFControlField label="Contact Font" path="header.contactInfo.fontSize" min={6} max={14} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                    <PDFControlField label="Address Font" path="header.address.fontSize" min={6} max={14} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                </div>
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
                                                <h3 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1.5"><ScrollText className="w-3.5 h-3.5" /> Customer Info</h3>
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
                                                <h3 className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-1.5"><Layout className="w-3.5 h-3.5" /> Table Setup</h3>
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-purple-700 uppercase flex items-center gap-1.5"><ScrollText className="w-3.5 h-3.5" /> Terms & Conditions</h3>
                                                <button onClick={() => {
                                                    updateLayout('terms.spacingBefore', defaultLayoutConfig.terms.spacingBefore);
                                                    updateLayout('terms.titleFontSize', defaultLayoutConfig.terms.titleFontSize);
                                                    updateLayout('terms.contentFontSize', defaultLayoutConfig.terms.contentFontSize);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-purple-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-purple-50/50 p-2 rounded-xl border border-purple-100 shadow-sm space-y-1">
                                                <PDFControlField label="Spacing Above" path="terms.spacingBefore" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Title Size" path="terms.titleFontSize" min={8} max={16} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Content Size" path="terms.contentFontSize" min={6} max={12} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-purple-700 uppercase flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> Signatures</h3>
                                                <button onClick={() => {
                                                    updateLayout('footer.y', defaultLayoutConfig.footer.y);
                                                    updateLayout('footer.preparedBy.x', defaultLayoutConfig.footer.preparedBy.x);
                                                    updateLayout('footer.approvedBy.x', defaultLayoutConfig.footer.approvedBy.x);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-purple-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-purple-50/50 p-2 rounded-xl border border-purple-100 shadow-sm space-y-1">
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
                            <div ref={containerRef} className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-800">PDF Layout Preview</h3>
                                            <p className="text-[10px] text-gray-500">{quote['Quote No.']} • {quote['Company Name'] || 'No Company'}</p>
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
                                            <Spinner className="w-8 h-8 text-blue-500" />
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

                    {/* Right: Quotation Form Panel (Side-by-Side) */}
                    <div
                        className={`relative h-full bg-white shadow-xl transition-all duration-300 ease-in-out z-20 ${showRightPanel ? 'translate-x-0 opacity-100' : 'translate-x-[20px] opacity-0 overflow-hidden'
                            } ${showPdfPreview ? 'border-l-2 border-gray-200 flex-shrink-0' : 'flex-1 max-w-4xl mx-auto'
                            }`}
                        style={{ width: showRightPanel ? (showPdfPreview ? '500px' : 'auto') : '0px' }}
                    >
                        <div className={`h-full flex flex-col ${showPdfPreview ? 'w-[500px]' : 'w-full'}`}>
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                                    <h3 className="text-sm font-bold text-gray-800">Quotation Details</h3>
                                </div>
                                <button
                                    onClick={() => setShowRightPanel(false)}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white/60 rounded-md transition-all"
                                    aria-label="Close panel"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <ScrollArea className="flex-1 px-5 py-4">
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
                                        <FormSelect name="Tax Type" label="Tax Type" value={quote['Tax Type']} onChange={handleHeaderChange} options={TAX_TYPE_OPTIONS} />
                                        <FormInput name="Quote Date" label="Quote Date" value={quote['Quote Date']} onChange={handleHeaderChange} type="date" required />
                                        <FormInput name="Validity Date" label="Validity" value={quote['Validity Date']} onChange={handleHeaderChange} type="date" required />
                                        <FormInput name="Payment Term" label="Payment Term" value={quote['Payment Term']} onChange={handleHeaderChange} />
                                        <FormInput name="Stock Status" label="Stock Status" value={quote['Stock Status']} onChange={handleHeaderChange} />
                                        {quote.Status !== 'Open' && <FormTextarea name="Reason" label="Reason" value={quote.Reason} onChange={handleHeaderChange} rows={2} />}
                                    </FormSection>

                                    <FormSection title="Signatures & Remarks">
                                        <FormInput name="Prepared By" label="Prepared By" value={quote['Prepared By']} onChange={handleHeaderChange} />
                                        <FormInput name="Approved By" label="Approved By" value={quote['Approved By']} onChange={handleHeaderChange} />
                                        <FormInput name="Prepared By Position" label="Position" value={quote['Prepared By Position']} onChange={handleHeaderChange} />
                                        <FormInput name="Approved By Position" label="Position" value={quote['Approved By Position']} onChange={handleHeaderChange} />
                                        <FormTextarea name="Remark" label="Remark" value={quote.Remark} onChange={handleHeaderChange} rows={3} />
                                        <FormTextarea name="Terms and Conditions" label="Terms and Conditions" value={quote['Terms and Conditions']} onChange={handleHeaderChange} rows={5} />
                                    </FormSection>

                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Line Items</h3>
                                        {itemsLoading ? <div className="text-center p-8"><Spinner /></div> : (
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
                                                                        <div className="w-24">
                                                                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Comm.</label>
                                                                            <input type="number" step="0.01" value={item.commission} onChange={e => handleItemChange(item.id, 'commission', e.target.value)} className="w-full h-9 px-2 text-right text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-blue-200 text-slate-500 shadow-sm" />
                                                                        </div>
                                                                        <div className="flex-1 text-right pt-4">
                                                                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Total Amount</div>
                                                                            {(() => {
                                                                                const currencySymbol = quote.Currency === 'KHR' ? '៛' : '$';
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
                                                    <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium">Sub Total</span><span className="text-slate-700 font-semibold">{formatCurrency(totals.subTotal)}</span></div>
                                                    <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium">Commission</span><span className="text-slate-700 font-semibold">{formatCurrency(totals.commission)}</span></div>
                                                    <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium">VAT (10%)</span><span className="text-slate-700 font-semibold">{formatCurrency(totals.vat)}</span></div>
                                                    <div className="flex justify-between items-center pt-3 border-t border-slate-200/60 mt-2">
                                                        <span className="text-base text-slate-800 font-extrabold uppercase tracking-wide">Grand Total</span>
                                                        <span className="text-xl text-blue-700 font-black">{formatCurrency(totals.grandTotal)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </div >

                <div className="print-only">
                    <PrintableQuotation {...printableProps} />
                </div>
            </DocumentEditorContainer >
            {successInfo && (
                <SuccessModal
                    isOpen={true}
                    onClose={() => { setSuccessInfo(null); onBack(); }}
                    title={successInfo.isWin ? "Quotation Won!" : "Quotation Saved!"}
                    message={<p>{successInfo.isWin ? "Quotation marked as Won. Create Sale Order now?" : `Quotation ${successInfo.quoteNo} has been successfully saved.`}</p>}
                    actionButtonLink={null}
                    actionButtonText={successInfo.isWin ? "Create Sale Order" : "Back to List"}
                    onAction={() => {
                        if (successInfo.isWin) {
                            const wonQuote = quotations?.find(q => q['Quote No.'] === successInfo.quoteNo);
                            handleNavigation({ view: 'sale-orders', payload: wonQuote });
                        } else {
                            setSuccessInfo(null);
                            onBack();
                        }
                    }}
                    secondaryActionText={successInfo.isWin ? "Later" : undefined}
                    onSecondaryAction={() => { setSuccessInfo(null); onBack(); }}
                />
            )}
            <PDFConfigModal
                isOpen={showPdfConfig}
                onClose={() => setShowPdfConfig(false)}
                onGenerate={generateFinalPDF}
                currentLayout={pdfLayout}
            />
        </>
    );
};

export default QuotationCreator;