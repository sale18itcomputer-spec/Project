'use client';


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Quotation, PricelistItem } from "../../../types";
import { useB2BData } from "../../../hooks/useB2BData";
import { useB2B } from "../../../contexts/B2BContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useNavigation } from "../../../contexts/NavigationContext";
import { createQuotationSheet, readQuotationSheetData } from "../../../services/b2bDb";
import { getSetting, saveSetting } from "../../../services/api";
import { formatToInputDate } from "../../../utils/time";
import Spinner from "../../common/Spinner";
import { FormSection, FormInput, FormSelect, FormTextarea } from "../../common/FormControls";
import PrintableQuotation from "../../pdf/PrintableQuotation";
import { Trash2, AlertTriangle, Download, SlidersHorizontal, PanelRight, Send, Save, Plus, RotateCcw, ImageIcon, Type, Ruler, ScrollText, Layout, Search, Copy, Check, Package, Tag, Layers, ArrowUpDown, ChevronUp, ChevronDown, List, Loader2 } from 'lucide-react';
import { PDFLayoutConfig, defaultLayoutConfig, generatePDF } from "../../pdf/pdfGenerator";
import PDFConfigModal from "../../modals/PDFConfigModal";
import PDFControlField from "../../pdf/PDFControlField";
import SuccessModal from "../../modals/SuccessModal";
import DocumentEditorContainer from "../../layout/DocumentEditorContainer";
import { parseSheetValue } from "../../../utils/formatters";
import { ScrollArea } from "../../ui/scroll-area";
import { useToast } from "../../../contexts/ToastContext";

interface QuotationCreatorProps {
    onBack: () => void;
    existingQuotation: Quotation | null;
    initialData?: Partial<Quotation>;
}

const BULLET_TYPES = [
    { label: 'None', char: '' },
    { label: 'Dot', char: '• ' },
    { label: 'Dash', char: '- ' }
];

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

const lineItemInputClasses = "w-full text-sm p-2 bg-muted/50 border border-border rounded-md focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-foreground placeholder-muted-foreground transition";

const PricelistCombobox: React.FC<{
    item: LineItem;
    onItemChange: (id: string, field: keyof Omit<LineItem, 'id' | 'amount' | 'no'>, value: string | number) => void;
    onPricelistItemSelect: (item: LineItem, pricelistItem: PricelistItem) => void;
    disabled?: boolean;
}> = ({ item, onItemChange, onPricelistItemSelect, disabled = false }) => {
    const { pricelist } = useB2BData();
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
            p.Brand?.toLowerCase().includes(query) ||
            p.Category?.toLowerCase().includes(query)
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
                className={`${lineItemInputClasses} ${disabled ? 'bg-muted opacity-50 cursor-not-allowed' : 'hover:bg-muted'}`}
                placeholder="Type to search..."
                autoComplete="off"
                disabled={disabled}
            />
            {isOpen && !disabled && filteredPricelist.length > 0 && (
                <div className="absolute z-[100] w-[450px] mt-1 bg-card rounded-md shadow-xl border border-border ring-1 ring-black/5">
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
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
                                    >
                                        <div className="flex justify-between w-full items-center text-foreground">
                                            <div className="truncate pr-4">
                                                <p className="font-semibold text-foreground">{pItem.Model}</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-muted-foreground">{pItem.Brand} - {pItem.Code}</p>
                                                    {pItem.Category && (
                                                        <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1 rounded font-bold uppercase border border-emerald-500/20">{pItem.Category}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-semibold text-foreground">{parseSheetValue(pItem['End User Price']).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
                                                <p className="text-xs text-muted-foreground">{pItem.Status}</p>
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
    const { quotations, setQuotations, companies, contacts, pricelist } = useB2BData();
    const { isB2B } = useB2B();
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
    const [pricelistSearch, setPricelistSearch] = useState('');
    const [brandFilter, setBrandFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [addedItemId, setAddedItemId] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' | null = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = null;
        }
        setSortConfig({ key: direction ? key : '', direction });
    };



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
                // Migration: Update old layouts with low footer.y to new default
                if (dbLayout.footer && dbLayout.footer.y < 260) {
                    console.log('📝 Migrating old PDF layout: updating footer.y from', dbLayout.footer.y, 'to', defaultLayoutConfig.footer.y);
                    dbLayout.footer.y = defaultLayoutConfig.footer.y;
                    // Save the migrated layout back to database
                    await saveSetting('global_pdf_layout', dbLayout);
                }
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
                        // Migration: Update old layouts with low footer.y to new default
                        if (parsed.footer && parsed.footer.y < 260) {
                            console.log('📝 Migrating old PDF layout from localStorage: updating footer.y from', parsed.footer.y, 'to', defaultLayoutConfig.footer.y);
                            parsed.footer.y = defaultLayoutConfig.footer.y;
                            localStorage.setItem('global_pdf_layout', JSON.stringify(parsed));
                            // Also save to database
                            await saveSetting('global_pdf_layout', parsed);
                        }
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
    // B2B and B2C have separate sequences
    const nextQuotationNumber = useMemo(() => {
        if (existingQuotation) return existingQuotation['Quote No.'];

        const prefix = isB2B ? 'BQ-' : 'Q-';
        const regex = isB2B ? /BQ-(\d+)/ : /Q-(\d+)/;
        const defaultId = `${prefix}0000001`;

        if (!quotations || quotations.length === 0) return defaultId;

        const maxNum = quotations.reduce((max, q) => {
            const quoteNo = q['Quote No.'];
            if (!quoteNo) return max;

            const match = quoteNo.match(regex);
            if (!match) return max;

            const numPart = parseInt(match[1], 10);
            return isNaN(numPart) ? max : Math.max(max, numPart);
        }, 0);

        return `${prefix}${String(maxNum + 1).padStart(7, '0')}`;
    }, [quotations, existingQuotation, isB2B]);

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
                const response = await readQuotationSheetData(existingQuotation['Quote No.'], isB2B);
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
        if (company) {
            setQuote(prev => ({
                ...prev,
                'Company Name': companyName,
                'Company Address': company['Address (English)'] || '',
                'Contact Name': '',
                'Contact Number': '',
                'Contact Email': '',
                'Payment Term': company['Payment Term'] || '',
            }));
        } else {
            setQuote(prev => ({ ...prev, 'Company Name': companyName }));
        }
    };

    const handleContactChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const contactName = e.target.value;
        const contact = contacts?.find(c => c.Name === contactName);
        setQuote(prev => ({ ...prev, 'Contact Name': contactName, 'Contact Number': contact?.['Tel (1)'] || prev['Contact Number'] || '', 'Contact Email': contact?.Email || prev['Contact Email'] || '' }));
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
                        updatedItem.amount = q * (p + c);
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

    const applyBullet = (id: string, bulletChar: string) => {
        setItems(currentItems => currentItems.map(item => {
            if (item.id === id) {
                const lines = item.description.split('\n');
                const newDescription = lines.map(line => {
                    let cleanLine = line.trimStart();
                    // Remove any existing bullet from our library
                    BULLET_TYPES.forEach(bt => {
                        if (bt.char && cleanLine.startsWith(bt.char)) {
                            cleanLine = cleanLine.substring(bt.char.length).trimStart();
                        }
                    });
                    return bulletChar + cleanLine;
                }).join('\n');
                return { ...item, description: newDescription };
            }
            return item;
        }));
    };

    const handlePricelistItemSelect = (lineItem: LineItem, pricelistItem: PricelistItem) => {
        setItems(currentItems => {
            const newItems = currentItems.map(item => {
                if (item.id === lineItem.id) {
                    const unitPrice = parseSheetValue(pricelistItem['End User Price']);
                    const qty = typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0;
                    const c = parseFloat(String(item.commission)) || 0;
                    return {
                        ...item,
                        itemCode: pricelistItem.Code,
                        modelName: pricelistItem.Model,
                        description: pricelistItem.Description || '',
                        unitPrice: unitPrice,
                        amount: qty * (unitPrice + c),
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
        // subTotal = sum of item.amount, where each amount already includes commission (qty * (unitPrice + commission))
        const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
        // commission is informational: sum of (qty * commissionPerUnit) across all items
        const commission = items.reduce((sum, item) => {
            const qty = parseFloat(String(item.qty)) || 0;
            const c = parseFloat(String(item.commission)) || 0;
            return sum + (qty * c);
        }, 0);
        // VAT and Grand Total are based on subTotal (which already includes commission)
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
            await createQuotationSheet(masterSheetData['Quote No.'], sheetGenerationData, isB2B);

            console.log('🚀 Quotation saved, adding to list optimistically:', masterSheetData['Quote No.']);

            // Optimistic update: Add quotation to list immediately
            setQuotations(current => {
                if (!current) return [masterSheetData as Quotation];
                // Check if already exists (update case)
                const exists = current.some(q => q['Quote No.'] === masterSheetData['Quote No.']);
                if (exists) {
                    // Update existing
                    return current.map(q =>
                        q['Quote No.'] === masterSheetData['Quote No.'] ? masterSheetData as Quotation : q
                    );
                } else {
                    // Add new
                    return [masterSheetData as Quotation, ...current];
                }
            });

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
                    className="appearance-none bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-8 rounded-lg transition cursor-pointer shadow-lg shadow-brand-500/20 focus:outline-none focus:ring-2 focus:ring-brand-500 pr-10 text-sm hover:scale-[1.02] active:scale-[0.98]"
                >
                    {STATUS_OPTIONS.map(opt => (
                        <option key={opt} value={opt} className="bg-card text-foreground">{opt === 'Open' ? 'Quote Status' : opt}</option>
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
            <div className="flex items-center gap-2 mr-2 border-r border-border pr-4">
                <button
                    onClick={() => setShowPdfPreview(!showPdfPreview)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 border ${showPdfPreview ? 'bg-brand-500/10 text-brand-600 border-brand-500/30' : 'bg-card text-muted-foreground hover:text-foreground border-border shadow-sm'}`}
                    title="Toggle PDF Preview"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="hidden lg:inline">
                        {isB2B
                            ? (showPdfPreview ? 'Catalog' : 'PDF')
                            : (showPdfPreview ? 'Hide PDF' : 'PDF')
                        }
                    </span>
                </button>
                <button
                    onClick={() => setShowPdfControls(!showPdfControls)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 border ${showPdfControls ? 'bg-brand-500/10 text-brand-600 border-brand-500/30' : 'bg-card text-muted-foreground hover:text-foreground border-border shadow-sm'}`}
                    title="Toggle Layout Controls"
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden lg:inline">{showPdfControls ? 'Hide Controls' : 'Layout'}</span>
                </button>
                <button
                    onClick={() => setShowRightPanel(!showRightPanel)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 border ${showRightPanel ? 'bg-brand-500/10 text-brand-600 border-brand-500/30' : 'bg-card text-muted-foreground hover:text-foreground border-border shadow-sm'}`}
                    title="Toggle Form Panel"
                >
                    <PanelRight className="w-4 h-4" />
                    <span className="hidden lg:inline">{showRightPanel ? 'Hide Form' : 'Form'}</span>
                </button>
            </div>

            <div className="flex items-center gap-2 mr-2">
                <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-6 py-2 text-sm font-bold bg-card text-brand-600 border border-brand-500/30 rounded-lg hover:bg-brand-500/10 transition-all active:scale-95 shadow-sm">
                    <Download className="w-4 h-4" />
                    Download PDF
                </button>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleRequestApprove} disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Request Approve</span>
                </button>
                <button onClick={handleSave} disabled={isSubmitting} className="flex items-center gap-2 px-8 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] min-w-[100px] justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
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
                    <div className="mb-6 bg-rose-500/10 border-l-4 border-rose-500 text-rose-500 p-4 rounded-md text-sm flex items-start gap-3" role="alert">
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
                    <div className={`flex-1 flex flex-col relative overflow-hidden ${(!isB2B && !showPdfPreview && !showPdfControls) ? 'hidden' : ''}`}>
                        {/* Top: Collapsible Layout Controls */}
                        <div className={`w-full border-b border-border flex flex-col bg-card transition-all duration-300 ease-in-out flex-shrink-0 ${showPdfControls ? 'h-[320px] opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}>
                            <div className="flex px-4 items-center justify-between border-b border-border bg-muted/30 h-10">
                                <div className="flex gap-1 h-full items-center">
                                    {[
                                        { id: 'header', label: 'Header', activeColor: 'bg-blue-500', textColor: 'text-blue-500' },
                                        { id: 'table', label: 'Table', activeColor: 'bg-emerald-500', textColor: 'text-emerald-500' },
                                        { id: 'footer', label: 'Footer', activeColor: 'bg-purple-500', textColor: 'text-purple-500' }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`px-4 h-7 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-2 ${activeTab === tab.id
                                                ? `bg-background ${tab.textColor} shadow-sm border border-border`
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                                }`}
                                        >
                                            <div className={`w-2 h-2 rounded-full ${activeTab === tab.id ? tab.activeColor : 'bg-muted-foreground/30'}`} />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={handleSaveLayout}
                                    className="px-4 h-8 bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-2 transition-all shadow-sm active:scale-95"
                                >
                                    <Save className="w-3 h-3" />
                                    Save Default
                                </button>
                            </div>

                            <ScrollArea className="flex-1 p-4">
                                {activeTab === 'header' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-blue-500 uppercase flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Logo Positioning</h3>
                                                <button onClick={() => {
                                                    updateLayout('header.logo.x', defaultLayoutConfig.header.logo.x);
                                                    updateLayout('header.logo.y', defaultLayoutConfig.header.logo.y);
                                                    updateLayout('header.logo.width', defaultLayoutConfig.header.logo.width);
                                                }} className="text-[9px] font-bold text-muted-foreground hover:text-brand-500 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-muted/40 p-2 rounded-xl border border-border/50 shadow-sm space-y-1">
                                                <div className="grid grid-cols-1 gap-1">
                                                    <PDFControlField label="X (mm)" path="header.logo.x" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                    <PDFControlField label="Y (mm)" path="header.logo.y" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                    <PDFControlField label="Width (mm)" path="header.logo.width" min={10} max={120} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-foreground uppercase flex items-center gap-1.5 opacity-80"><Type className="w-3.5 h-3.5" /> Company Name</h3>
                                                <button onClick={() => {
                                                    updateLayout('header.companyName.x', defaultLayoutConfig.header.companyName.x);
                                                    updateLayout('header.companyName.y', defaultLayoutConfig.header.companyName.y);
                                                    updateLayout('header.companyName.fontSize', defaultLayoutConfig.header.companyName.fontSize);
                                                }} className="text-[9px] font-bold text-muted-foreground hover:text-brand-500 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-muted/40 p-2 rounded-xl border border-border/50 shadow-sm">
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
                                            <div className="bg-muted/40 p-2 rounded-xl border border-border/50 shadow-sm space-y-1">
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
                                            <div className="bg-muted/40 p-2 rounded-xl border border-border/50 shadow-sm space-y-1">
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
                                                <h3 className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-1.5"><Layout className="w-3.5 h-3.5" /> Table Setup</h3>
                                                <button onClick={() => {
                                                    updateLayout('table.startY', defaultLayoutConfig.table.startY);
                                                    updateLayout('table.fontSize', defaultLayoutConfig.table.fontSize);
                                                    updateLayout('table.descriptionFontSize', defaultLayoutConfig.table.descriptionFontSize);
                                                }} className="text-[9px] font-bold text-muted-foreground hover:text-brand-500 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-muted/40 p-2 rounded-xl border border-border/50 shadow-sm space-y-1">
                                                <PDFControlField label="Start Y" path="table.startY" min={60} max={250} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Header Size" path="table.fontSize" min={6} max={14} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Content Size" path="table.descriptionFontSize" min={6} max={12} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" /> Margins</h3>
                                                <button onClick={() => {
                                                    updateLayout('table.margins.left', defaultLayoutConfig.table.margins.left);
                                                    updateLayout('table.margins.right', defaultLayoutConfig.table.margins.right);
                                                }} className="text-[9px] font-bold text-muted-foreground hover:text-brand-500 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-muted/40 p-2 rounded-xl border border-border/50 shadow-sm space-y-1">
                                                <PDFControlField label="Left Margin" path="table.margins.left" min={5} max={40} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Right Margin" path="table.margins.right" min={5} max={40} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                            </div>
                                        </div>

                                        <div className="lg:col-span-2 space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-1.5"><Layout className="w-3.5 h-3.5" /> Column Widths</h3>
                                                <button onClick={() => {
                                                    updateLayout('table.columnWidths.no', defaultLayoutConfig.table.columnWidths.no);
                                                    updateLayout('table.columnWidths.itemCode', defaultLayoutConfig.table.columnWidths.itemCode);
                                                    updateLayout('table.columnWidths.qty', defaultLayoutConfig.table.columnWidths.qty);
                                                    updateLayout('table.columnWidths.unitPrice', defaultLayoutConfig.table.columnWidths.unitPrice);
                                                    updateLayout('table.columnWidths.total', defaultLayoutConfig.table.columnWidths.total);
                                                }} className="text-[9px] font-bold text-muted-foreground hover:text-brand-500 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-muted/40 p-2 rounded-xl border border-border/50 shadow-sm">
                                                <div className="divide-y divide-border/20">
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
                                                <h3 className="text-xs font-bold text-purple-500 uppercase flex items-center gap-1.5"><ScrollText className="w-3.5 h-3.5" /> Terms & Conditions</h3>
                                                <button onClick={() => {
                                                    updateLayout('terms.spacingBefore', defaultLayoutConfig.terms.spacingBefore);
                                                    updateLayout('terms.titleFontSize', defaultLayoutConfig.terms.titleFontSize);
                                                    updateLayout('terms.contentFontSize', defaultLayoutConfig.terms.contentFontSize);
                                                }} className="text-[9px] font-bold text-muted-foreground hover:text-brand-500 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-muted/40 p-2 rounded-xl border border-border/50 shadow-sm space-y-1">
                                                <PDFControlField label="Spacing Above" path="terms.spacingBefore" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Title Size" path="terms.titleFontSize" min={8} max={16} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Content Size" path="terms.contentFontSize" min={6} max={12} step={0.5} unit="pt" layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-purple-500 uppercase flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> Signatures</h3>
                                                <button onClick={() => {
                                                    updateLayout('footer.y', defaultLayoutConfig.footer.y);
                                                    updateLayout('footer.preparedBy.x', defaultLayoutConfig.footer.preparedBy.x);
                                                    updateLayout('footer.approvedBy.x', defaultLayoutConfig.footer.approvedBy.x);
                                                }} className="text-[9px] font-bold text-muted-foreground hover:text-brand-500 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-muted/40 p-2 rounded-xl border border-border/50 shadow-sm space-y-1">
                                                <PDFControlField label="Vertical Y" path="footer.y" min={150} max={290} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Prepared X" path="footer.preparedBy.x" min={10} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Approved X" path="footer.approvedBy.x" min={100} max={200} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                        {/* Center: PDF Preview OR Pricelist (B2B Only) */}
                        {showPdfPreview || !isB2B ? (
                            <div ref={containerRef} className="flex-1 flex flex-col bg-background relative overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">PDF Layout Preview</h3>
                                            <p className="text-[10px] text-muted-foreground">{quote['Quote No.']} • {quote['Company Name'] || 'No Company'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-xs text-muted-foreground font-medium px-2">Real-time Preview</div>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 relative overflow-hidden p-6">
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
                            <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
                                <div className="flex flex-col bg-background border-b border-border">
                                    <div className="flex items-center justify-between px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 shadow-sm border border-emerald-500/20">
                                                <Package className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-foreground">Pricelist Reference</h3>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                                    {pricelist?.length || 0} catalog items available
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative group">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-brand-500 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="Search models, codes, brands..."
                                                    value={pricelistSearch}
                                                    onChange={(e) => setPricelistSearch(e.target.value)}
                                                    className="pl-9 pr-4 py-1.5 w-64 bg-muted/50 border border-border rounded-full text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-background text-foreground transition-all outline-none"
                                                />
                                            </div>
                                            <select
                                                value={brandFilter}
                                                onChange={(e) => setBrandFilter(e.target.value)}
                                                className="px-3 py-1.5 bg-muted/50 border border-border rounded-full text-xs font-medium text-foreground focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none cursor-pointer"
                                            >
                                                <option value="All" className="bg-card">All Brands</option>
                                                {pricelist ? [...new Set(pricelist.map(p => p.Brand).filter(Boolean))].sort().map(brand => (
                                                    <option key={brand} value={brand} className="bg-card">{brand}</option>
                                                )) : null}
                                            </select>
                                            <select
                                                value={categoryFilter}
                                                onChange={(e) => setCategoryFilter(e.target.value)}
                                                className="px-3 py-1.5 bg-muted/50 border border-border rounded-full text-xs font-medium text-foreground focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none cursor-pointer"
                                            >
                                                <option value="All" className="bg-card">All Categories</option>
                                                {pricelist ? [...new Set(pricelist.map(p => p.Category).filter(Boolean))].sort().map(cat => (
                                                    <option key={cat} value={cat} className="bg-card">{cat}</option>
                                                )) : null}
                                            </select>
                                            <div className="flex items-center bg-muted/50 border border-border rounded-full px-3 py-1 gap-2">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Price</span>
                                                <input
                                                    type="number"
                                                    placeholder="Min"
                                                    value={minPrice}
                                                    onChange={(e) => setMinPrice(e.target.value)}
                                                    className="w-16 bg-transparent text-xs border-none focus:ring-0 p-0 text-foreground placeholder:text-muted-foreground/50"
                                                />
                                                <span className="text-muted-foreground/50">-</span>
                                                <input
                                                    type="number"
                                                    placeholder="Max"
                                                    value={maxPrice}
                                                    onChange={(e) => setMaxPrice(e.target.value)}
                                                    className="w-16 bg-transparent text-xs border-none focus:ring-0 p-0 text-foreground placeholder:text-muted-foreground/50"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto relative">
                                    <table className="w-full text-sm border-separate border-spacing-0">
                                        <thead className="bg-muted/80 backdrop-blur-sm sticky top-0 z-30">
                                            <tr>
                                                {[
                                                    { label: 'Brand', key: 'Brand', align: 'left' },
                                                    { label: 'Category', key: 'Category', align: 'left' },
                                                    { label: 'Code', key: 'Code', align: 'left' },
                                                    { label: 'Product Details', key: 'Model', align: 'left' },
                                                    { label: 'Unit Price', key: 'End User Price', align: 'right' },
                                                    { label: 'Status', key: 'Status', align: 'center' }
                                                ].map((col) => (
                                                    <th
                                                        key={col.key}
                                                        onClick={() => handleSort(col.key)}
                                                        className={`px-4 py-3 text-${col.align} font-bold text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border cursor-pointer hover:bg-muted transition-colors group`}
                                                    >
                                                        <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                                                            {col.label}
                                                            <div className="flex flex-col">
                                                                {sortConfig.key === col.key ? (
                                                                    sortConfig.direction === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-brand-500" /> : <ChevronDown className="w-2.5 h-2.5 text-brand-500" />
                                                                ) : (
                                                                    <ArrowUpDown className="w-2.5 h-2.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </th>
                                                ))}
                                                <th className="px-5 py-3 text-center font-bold text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {(() => {
                                                const filtered = pricelist?.filter(item => {
                                                    const matchesSearch = !pricelistSearch || [item.Code, item.Brand, item.Model, item.Description, item.Category].some(val => val?.toLowerCase().includes(pricelistSearch.toLowerCase()));
                                                    const matchesBrand = brandFilter === 'All' || item.Brand === brandFilter;
                                                    const matchesCategory = categoryFilter === 'All' || item.Category === categoryFilter;

                                                    const price = parseSheetValue(item['End User Price']);
                                                    const matchesMinPrice = minPrice === '' || price >= parseFloat(minPrice);
                                                    const matchesMaxPrice = maxPrice === '' || price <= parseFloat(maxPrice);

                                                    return matchesSearch && matchesBrand && matchesCategory && matchesMinPrice && matchesMaxPrice;
                                                });

                                                const sorted = [...(filtered || [])].sort((a, b) => {
                                                    if (!sortConfig.key || !sortConfig.direction) return 0;

                                                    let valA = a[sortConfig.key];
                                                    let valB = b[sortConfig.key];

                                                    if (sortConfig.key === 'End User Price') {
                                                        valA = parseSheetValue(valA);
                                                        valB = parseSheetValue(valB);
                                                    }

                                                    if (valA === undefined || valA === null) return 1;
                                                    if (valB === undefined || valB === null) return -1;

                                                    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                                                    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                                                    return 0;
                                                });

                                                if (!sorted || sorted.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={7} className="px-4 py-20 text-center">
                                                                <div className="flex flex-col items-center gap-3">
                                                                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground/30">
                                                                        <Search className="w-8 h-8" />
                                                                    </div>
                                                                    <p className="text-muted-foreground font-medium">No items found matching your filters</p>
                                                                    <button onClick={() => { setPricelistSearch(''); setBrandFilter('All'); setCategoryFilter('All'); setMinPrice(''); setMaxPrice(''); }} className="text-brand-500 font-semibold text-xs hover:underline decoration-brand-500/30 underline-offset-4">Clear all filters</button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                return sorted.map((item, idx) => (
                                                    <tr key={item.Code || idx} className="group hover:bg-muted/50 transition-all duration-150">
                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-foreground text-xs font-bold border border-border group-hover:border-brand-500/30 transition-colors">
                                                                <Tag className="w-3 h-3 text-muted-foreground/60" />
                                                                {item.Brand}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase border border-emerald-500/20">
                                                                <Layers className="w-3 h-3 text-emerald-500/50" />
                                                                {item.Category || 'Other'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-muted-foreground/40 font-mono">#</span>
                                                                <span className="text-xs font-mono font-medium text-foreground bg-muted px-1.5 py-0.5 rounded border border-border">{item.Code}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-bold text-foreground group-hover:text-brand-500 transition-colors">{item.Model}</span>
                                                                    <button
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(item.Model || '');
                                                                            addToast('Model copied to clipboard', 'info');
                                                                        }}
                                                                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-brand-500 transition-all rounded"
                                                                        title="Copy Model"
                                                                    >
                                                                        <Copy className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                                <span className="text-[11px] text-muted-foreground font-medium leading-relaxed" title={item.Description}>
                                                                    {item.Description || 'No description available'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-sm font-black text-foreground tracking-tight">
                                                                    {parseSheetValue(item['End User Price']).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                                                </span>
                                                                <span className="text-[9px] text-muted-foreground font-bold uppercase">Unit Price</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${item.Status === 'Available' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                                                item.Status === 'Out of Stock' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                                                                    'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                                }`}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${item.Status === 'Available' ? 'bg-emerald-500 animate-pulse' :
                                                                    item.Status === 'Out of Stock' ? 'bg-rose-500' :
                                                                        'bg-amber-500'
                                                                    }`}></div>
                                                                {item.Status}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 text-center whitespace-nowrap">
                                                            <button
                                                                onClick={() => {
                                                                    const unitPrice = parseSheetValue(item['End User Price']);
                                                                    const newItem: LineItem = {
                                                                        id: `item-${Date.now()}-${Math.random()}`,
                                                                        no: 0,
                                                                        itemCode: item.Code || '',
                                                                        modelName: item.Model || '',
                                                                        description: item.Description || '',
                                                                        qty: 1,
                                                                        unitPrice: unitPrice,
                                                                        amount: unitPrice,
                                                                        commission: 0
                                                                    };

                                                                    setItems(prev => {
                                                                        const lastItem = prev[prev.length - 1];
                                                                        const newItems = [...prev];

                                                                        // If last item is empty, replace it
                                                                        if (prev.length === 1 && !lastItem.itemCode && !lastItem.modelName && !lastItem.description) {
                                                                            newItems[0] = { ...newItem, no: 1 };
                                                                        } else {
                                                                            newItems.push(newItem);
                                                                        }

                                                                        // Resequence numbers
                                                                        let currentNo = 1;
                                                                        return newItems.map(it => {
                                                                            if (it.itemCode || it.modelName || it.qty || it.unitPrice || it.description) {
                                                                                return { ...it, no: (parseFloat(String(it.qty)) || 0) > 0 ? currentNo++ : 0 };
                                                                            }
                                                                            return { ...it, no: 0 };
                                                                        });
                                                                    });

                                                                    addToast(`${item.Model} added to quotation`, 'success');
                                                                    setAddedItemId(item.Code || null);
                                                                    setTimeout(() => setAddedItemId(null), 1000);
                                                                }}
                                                                className={`p-2 rounded-lg transition-all transform active:scale-90 ${addedItemId === item.Code
                                                                    ? 'bg-emerald-500 text-white scale-110'
                                                                    : 'bg-brand-500/10 text-brand-500 hover:bg-brand-500 hover:text-white border border-brand-500/20 hover:border-brand-500 shadow-sm'
                                                                    }`}
                                                                title="Add to Quotation"
                                                            >
                                                                {addedItemId === item.Code ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Quotation Form Panel (Side-by-Side) */}
                    <div
                        className={`relative h-full bg-background shadow-xl transition-all duration-300 ease-in-out z-20 ${showRightPanel ? 'translate-x-0 opacity-100' : 'translate-x-[20px] opacity-0 overflow-hidden'
                            } ${showPdfPreview ? 'border-l-2 border-border flex-shrink-0' : 'flex-1 max-w-4xl mx-auto'
                            }`}
                        style={{ width: showRightPanel ? (showPdfPreview ? '500px' : 'auto') : '0px' }}
                    >
                        <div className={`h-full flex flex-col ${showPdfPreview ? 'w-[500px]' : 'w-full'}`}>
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-5 bg-brand-500 rounded-full"></div>
                                    <h3 className="text-sm font-bold text-foreground">Quotation Details</h3>
                                </div>
                                <button
                                    onClick={() => setShowRightPanel(false)}
                                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-all"
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
                                        <FormInput
                                            name="Company Name"
                                            label="Company Name"
                                            value={quote['Company Name'] || ''}
                                            onChange={(e) => handleCompanySelect(e.target.value)}
                                            list="company-list"
                                            datalistOptions={companyOptions}
                                            required
                                            placeholder="Type or select a company..."
                                        />
                                        <FormInput
                                            name="Contact Name"
                                            label="Contact Person"
                                            value={quote['Contact Name'] || ''}
                                            onChange={handleContactChange}
                                            list="contact-list"
                                            datalistOptions={contactOptions}
                                            placeholder="Type or select a contact..."
                                        />
                                        <FormTextarea name="Company Address" label="Address" value={quote['Company Address']} onChange={handleHeaderChange} rows={3} />
                                        <FormInput name="Contact Number" label="Tel" value={quote['Contact Number']} onChange={handleHeaderChange} />
                                        <FormInput name="Contact Email" label="Email" value={quote['Contact Email']} onChange={handleHeaderChange} />
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

                                    <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Line Items</h3>
                                        {itemsLoading ? <div className="text-center p-8"><Spinner /></div> : (
                                            <div className="space-y-4">
                                                {items.map((item) => {
                                                    const isDescriptionRow = item.no === 0;
                                                    return (
                                                        <div key={item.id} className="relative p-4 bg-muted/30 rounded-xl border border-border shadow-sm transition-all hover:border-brand-500/50 hover:shadow-md group">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(item.id)}
                                                                className="absolute top-3 right-3 text-muted-foreground/50 hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                                                                title="Remove Item"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>

                                                            {isDescriptionRow ? (
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 block">Note / Description</label>
                                                                        <div className="flex items-center gap-1 bg-muted p-0.5 rounded border border-border">
                                                                            <List className="w-2.5 h-2.5 text-muted-foreground/40 ml-1 mr-0.5" />
                                                                            {BULLET_TYPES.map(bt => (
                                                                                <button
                                                                                    key={bt.label}
                                                                                    type="button"
                                                                                    onClick={() => applyBullet(item.id, bt.char)}
                                                                                    className="px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground hover:bg-card hover:text-brand-500 rounded transition-all"
                                                                                    title={bt.label}
                                                                                >
                                                                                    {bt.label === 'None' ? 'None' : bt.char.trim()}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <textarea
                                                                        value={item.description}
                                                                        onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                                        className="w-full text-sm p-3 rounded-lg border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all bg-background text-foreground"
                                                                        rows={2}
                                                                        placeholder="Add clear note..."
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex flex-wrap gap-3 pr-8 mb-3">
                                                                        <div className="w-10">
                                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block text-center">No.</label>
                                                                            <div className="h-9 flex items-center justify-center bg-card rounded-lg border border-border font-mono text-sm font-semibold text-foreground shadow-sm">
                                                                                {item.no}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex-1 min-w-[140px]">
                                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Item Code</label>
                                                                            <PricelistCombobox item={item} onItemChange={handleItemChange} onPricelistItemSelect={handlePricelistItemSelect} />
                                                                        </div>

                                                                        <div className="flex-[1.5] min-w-[160px]">
                                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Model</label>
                                                                            <input
                                                                                type="text"
                                                                                value={item.modelName}
                                                                                onChange={e => handleItemChange(item.id, 'modelName', e.target.value)}
                                                                                className="w-full h-9 px-3 text-sm font-medium border border-border rounded-lg bg-background text-foreground focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-sm "
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-wrap gap-3 mb-3">
                                                                        <div className="w-20">
                                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Qty</label>
                                                                            <input type="number" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', e.target.value)} className="w-full h-9 px-2 text-center text-sm border border-border rounded-lg bg-background text-foreground focus:border-brand-500 focus:ring-brand-500/20 shadow-sm" />
                                                                        </div>
                                                                        <div className="w-28">
                                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Unit Price</label>
                                                                            <input type="number" step="0.01" value={item.unitPrice} onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value)} className="w-full h-9 px-2 text-right text-sm border border-border rounded-lg bg-background text-foreground focus:border-brand-500 focus:ring-brand-500/20 shadow-sm" />
                                                                        </div>
                                                                        <div className="w-24">
                                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Comm.</label>
                                                                            <input type="number" step="0.01" value={item.commission} onChange={e => handleItemChange(item.id, 'commission', e.target.value)} className="w-full h-9 px-2 text-right text-sm border border-border rounded-lg bg-background text-foreground focus:border-brand-500 focus:ring-brand-500/20 shadow-sm" />
                                                                        </div>
                                                                        <div className="flex-1 text-right pt-4">
                                                                            <div className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-0.5">Total Amount</div>
                                                                            {(() => {
                                                                                const currencySymbol = quote.Currency === 'KHR' ? '៛' : '$';
                                                                                return <div className="text-lg font-bold text-foreground">{currencySymbol}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                                            })()}
                                                                        </div>
                                                                    </div>

                                                                    <div className="pt-2 border-t border-border/60">
                                                                        <div className="flex items-center justify-between mb-1.5">
                                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/60 block flex items-center gap-2">
                                                                                Description / Spec
                                                                                <span className="text-[9px] normal-case font-normal bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full border border-border">Expanded View</span>
                                                                            </label>
                                                                            <div className="flex items-center gap-1 bg-muted p-0.5 rounded border border-border">
                                                                                <List className="w-2.5 h-2.5 text-muted-foreground/40 ml-1 mr-0.5" />
                                                                                {BULLET_TYPES.map(bt => (
                                                                                    <button
                                                                                        key={bt.label}
                                                                                        type="button"
                                                                                        onClick={() => applyBullet(item.id, bt.char)}
                                                                                        className="px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground hover:bg-card hover:text-brand-500 rounded transition-all"
                                                                                        title={bt.label}
                                                                                    >
                                                                                        {bt.label === 'None' ? 'None' : bt.char.trim()}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                        <textarea
                                                                            value={item.description}
                                                                            onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                                            className="w-full text-sm p-3 rounded-lg border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all bg-background text-foreground shadow-inner resize-y min-h-[80px]"
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
                                                    <button type="button" onClick={addItem} className="flex-1 py-2.5 rounded-lg border border-dashed border-brand-500/30 text-brand-500 bg-brand-500/5 hover:bg-brand-500/10 hover:border-brand-500 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                                                        <span>+ Add Product Line</span>
                                                    </button>
                                                    <button type="button" onClick={addDescriptionRow} className="flex-1 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground bg-muted hover:bg-muted/80 hover:border-muted-foreground/30 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                                                        <span>+ Add Note Block</span>
                                                    </button>
                                                </div>

                                                <div className="bg-muted/30 rounded-xl p-5 border border-border mt-6 space-y-3">
                                                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground font-medium">Sub Total</span><span className="text-foreground font-semibold">{formatCurrency(totals.subTotal)}</span></div>
                                                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground font-medium">Commission</span><span className="text-foreground font-semibold">{formatCurrency(totals.commission)}</span></div>
                                                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground font-medium">VAT (10%)</span><span className="text-foreground font-semibold">{formatCurrency(totals.vat)}</span></div>
                                                    <div className="flex justify-between items-center pt-3 border-t border-border mt-2">
                                                        <span className="text-base text-foreground font-extrabold uppercase tracking-wide">Grand Total</span>
                                                        <span className="text-xl text-brand-500 font-black">{formatCurrency(totals.grandTotal)}</span>
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
                    extraActions={successInfo.isWin ? (
                        <button
                            onClick={() => { setSuccessInfo(null); onBack(); }}
                            className="w-full h-10 rounded-xl font-semibold text-sm text-muted-foreground hover:bg-muted transition-all"
                        >
                            Later
                        </button>
                    ) : undefined}
                />
            )
            }
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
