'use client';


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Invoice, SaleOrder } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { useAuth } from "../../../contexts/AuthContext";
import { createRecord, updateRecord, uploadFile, getSetting, saveSetting } from "../../../services/api";
import { formatToSheetDate, formatToInputDate } from "../../../utils/time";
import { FormSection, FormInput, FormSelect, FormTextarea } from "../../common/FormControls";
import PrintableInvoice from "../../pdf/PrintableInvoice";
import PrintableDO from "../../pdf/PrintableDO";
import SuccessModal from "../../modals/SuccessModal";
import Spinner from "../../common/Spinner";
import DocumentEditorContainer from "../../layout/DocumentEditorContainer";
import { Trash2, X, Upload, Printer, FileText, Download, SlidersHorizontal, PanelRight, Save, RotateCcw, ImageIcon, Type, Ruler, ScrollText, Layout, Plus } from 'lucide-react';
import { PDFLayoutConfig, defaultLayoutConfig, generatePDF } from "../../pdf/pdfGenerator";
import { useToast } from "../../../contexts/ToastContext";
import SearchableSelect from "../../common/SearchableSelect";
import { ScrollArea } from "../../ui/scroll-area";
import PDFControlField from "../../pdf/PDFControlField";
import PDFConfigModal from "../../modals/PDFConfigModal";

interface InvoiceCreatorProps {
    onBack: () => void;
    existingInvoice: Invoice | null;
    initialData?: {
        action: string;
        soData?: SaleOrder;
    };
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
}

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
            p['Item Code']?.toLowerCase().includes(query) ||
            p.Model?.toLowerCase().includes(query) ||
            p.Brand?.toLowerCase().includes(query)
        ).slice(0, 50);
    }, [pricelist, item.itemCode, isOpen]);

    const handleBlur = () => {
        setTimeout(() => {
            if (!document.body.contains(wrapperRef.current)) return;
            setIsOpen(false);
        }, 200);
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <input
                type="text"
                value={item.itemCode || ''}
                autoComplete="off"
                onFocus={() => setIsOpen(true)}
                onBlur={handleBlur}
                onChange={(e) => onItemChange(item.id, 'itemCode', e.target.value)}
                placeholder="Search..."
                className={lineItemInputClasses}
                disabled={disabled}
            />
            {isOpen && filteredPricelist.length > 0 && (
                <div className="absolute z-50 w-[400px] mt-1 bg-white border border-gray-200 rounded-md shadow-xl max-h-[300px] overflow-y-auto overflow-x-hidden">
                    {filteredPricelist.map((p, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-brand-50 transition-colors border-b border-gray-50 last:border-0 group"
                            onClick={() => {
                                onPricelistItemSelect(item, p);
                                setIsOpen(false);
                            }}
                        >
                            <div className="font-bold text-gray-900 group-hover:text-brand-700 truncate">{p['Item Code']}</div>
                            <div className="text-xs text-gray-500 grid grid-cols-2 gap-2 mt-1">
                                <span className="truncate">Model: {p.Model}</span>
                                <span className="text-right font-semibold text-brand-600">${Number(p['Selling Price (Include VAT)']).toLocaleString()}</span>
                            </div>
                            {p.Brand && <div className="text-[10px] text-gray-400 mt-0.5">Brand: {p.Brand}</div>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const STATUS_OPTIONS: Invoice['Status'][] = ['Draft', 'Processing', 'Completed', 'Cancel'];
const TAXABLE_OPTIONS = ['VAT', 'NON-VAT'];
const CURRENCY_OPTIONS: ('USD' | 'KHR')[] = ['USD', 'KHR'];

const getCurrencySymbol = (currency?: 'USD' | 'KHR'): string => {
    switch (currency) {
        case 'USD': return '$';
        case 'KHR': return '៛';
        default: return '$';
    }
};

const InvoiceCreator: React.FC<InvoiceCreatorProps> = ({ onBack, existingInvoice, initialData }) => {
    const { invoices, setInvoices, companies, contacts, saleOrders } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successInfo, setSuccessInfo] = useState<{ invNo: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [previewMode, setPreviewMode] = useState<'invoice' | 'do'>('invoice');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [items, setItems] = useState<LineItem[]>([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]);

    const [invoice, setInvoice] = useState<Partial<Invoice & { [key: string]: any }>>({});

    // PDF Configuration State
    const [pdfLayout, setPdfLayout] = useState<PDFLayoutConfig>(defaultLayoutConfig);
    const [showPdfConfig, setShowPdfConfig] = useState(false);
    const [showLayoutControls, setShowLayoutControls] = useState(false);
    const [showFormPanel, setShowFormPanel] = useState(true);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'header' | 'table' | 'footer'>('header');
    const [hoveredPath, setHoveredPath] = useState<string | null>(null);

    const updateLayout = (path: string, value: any) => {
        setPdfLayout(prev => {
            const next = { ...prev };
            const keys = path.split('.');
            let current: any = next;
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] = { ...current[keys[i]] };
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
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

    const nextInvoiceNumber = useMemo(() => {
        if (!invoices || invoices.length === 0) return 'INV-20250001';

        const maxNum = invoices.reduce((max, inv) => {
            const numPartMatch = inv['Inv No.'].match(/\d+$/);
            if (!numPartMatch) return max;
            const numPart = parseInt(numPartMatch[0], 10);
            return isNaN(numPart) ? max : Math.max(max, numPart);
        }, 0);

        return `INV-${String(maxNum + 1).padStart(8, '4').replace(/^4+/, (m) => '2025'.slice(0, Math.max(0, 4 - (m.length - 4))) + '0'.repeat(Math.max(0, m.length - 4)))}`;
        // Simpler: Just get the date part if we want, or sequential
    }, [invoices]);

    // Improved next invoice number logic
    const calculatedNextInvNo = useMemo(() => {
        if (!invoices || invoices.length === 0) return 'INV-250001';
        const year = new Date().getFullYear().toString().slice(-2);
        const prefix = `INV-${year}`;

        const thisYearInvoices = invoices.filter(inv => inv['Inv No.'].startsWith(prefix));
        if (thisYearInvoices.length === 0) return `${prefix}0001`;

        const maxNum = thisYearInvoices.reduce((max, inv) => {
            const numPart = parseInt(inv['Inv No.'].slice(prefix.length), 10);
            return isNaN(numPart) ? max : Math.max(max, numPart);
        }, 0);

        return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
    }, [invoices]);

    useEffect(() => {
        if (existingInvoice) {
            setInvoice({
                ...existingInvoice,
                'Inv Date': existingInvoice['Inv Date'] ? formatToInputDate(existingInvoice['Inv Date']) : getTodayDateString(),
            });

            let fetchedItems = [];
            if (typeof existingInvoice.ItemsJSON === 'string') {
                try { fetchedItems = JSON.parse(existingInvoice.ItemsJSON); } catch (e) { }
            } else {
                fetchedItems = existingInvoice.ItemsJSON || [];
            }
            if (fetchedItems.length > 0) setItems(fetchedItems);
        } else if (initialData?.soData) {
            const so = initialData.soData;
            const company = companies?.find(c => c['Company Name'] === so['Company Name']);

            setInvoice({
                'Inv No.': calculatedNextInvNo,
                'Inv Date': getTodayDateString(),
                'SO No.': so['SO No.'],
                'Company Name': so['Company Name'],
                'Contact Name': so['Contact Name'],
                'Phone Number': so['Phone Number'],
                'Email': so.Email,
                'Amount': so['Total Amount'],
                'Taxable': so['Bill Invoice'] || 'NON-VAT',
                'Status': 'Draft',
                'Currency': so.Currency || 'USD',
                'Payment Term': so['Payment Term'],
                'Company Address': company?.['Address (English)'] || '',
                'Tin No.': company?.['Tin No.'] || company?.['Patent'] || '',
                'Prepared By': currentUser?.Name || 'SREYNEANG MON (Mrs)',
                'Prepared By Position': currentUser ? [
                    currentUser.Role,
                    [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '),
                    currentUser.Email
                ].filter(Boolean).join(' | ') : 'Senior Corporate Sales | 017 594 524 | 010 345 994 | sreyneang@limperialtech.com',
                'Approved By': '',
                'Approved By Position': '',
            });

            let soItems = [];
            if (typeof so.ItemsJSON === 'string') {
                try { soItems = JSON.parse(so.ItemsJSON); } catch (e) { }
            } else {
                soItems = so.ItemsJSON || [];
            }
            if (soItems.length > 0) {
                setItems(soItems.map((item: any) => ({
                    ...item,
                    id: item.id || `item-${Math.random()}`
                })));
            }
        } else {
            setInvoice({
                'Inv No.': calculatedNextInvNo,
                'Inv Date': getTodayDateString(),
                'Status': 'Draft',
                'Currency': 'USD',
                'Taxable': 'VAT',
                'Prepared By': currentUser?.Name || 'SREYNEANG MON (Mrs)',
                'Prepared By Position': currentUser ? [
                    currentUser.Role,
                    [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '),
                    currentUser.Email
                ].filter(Boolean).join(' | ') : 'Senior Corporate Sales | 017 594 524 | 010 345 994 | sreyneang@limperialtech.com',
                'Approved By': '',
                'Approved By Position': '',
            });
        }
    }, [existingInvoice, initialData, calculatedNextInvNo, companies]);

    const totals = useMemo(() => {
        const subTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const isTaxable = invoice.Taxable === 'VAT';
        const tax = isTaxable ? subTotal * 0.1 : 0;
        const grandTotal = subTotal + tax;
        return { subTotal, tax, grandTotal };
    }, [items, invoice.Taxable]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setInvoice(prev => ({ ...prev, [name]: value }));
    };

    const handleCompanySelect = (companyName: string) => {
        const company = companies?.find(c => c['Company Name'] === companyName);
        const contact = contacts?.find(c => c['Company Name'] === companyName);

        if (company) {
            setInvoice(prev => ({
                ...prev,
                'Company Name': companyName,
                'Payment Term': company['Payment Term'] || prev['Payment Term'],
                'Company Address': company['Address (English)'] || '',
                'Fax': company['Fax'] || prev['Fax'],
                'Phone Number': company['Phone Number'] || (contact ? contact['Phone Number'] : prev['Phone Number']),
                'Email': company['Email'] || (contact ? contact.Email : prev.Email),
                'Contact Name': contact ? contact.Name : prev['Contact Name'],
                'Tin No.': company['Tin No.'] || company['Patent'] || prev['Tin No.'],
            }));
        } else {
            setInvoice(prev => ({ ...prev, 'Company Name': companyName }));
        }
    };

    const handleSOSelect = (soNo: string) => {
        const so = saleOrders?.find(s => s['SO No.'] === soNo);
        if (so) {
            setInvoice(prev => ({
                ...prev,
                'SO No.': soNo,
                'Company Name': so['Company Name'] || prev['Company Name'],
                'Contact Name': so['Contact Name'] || prev['Contact Name'],
                'Phone Number': so['Phone Number'] || prev['Phone Number'],
                'Email': so.Email || prev.Email,
                'Taxable': so['Bill Invoice'] || 'NON-VAT',
                'Currency': so.Currency || prev.Currency,
                'Payment Term': so['Payment Term'] || prev['Payment Term'],
                'Company Address': companies?.find(c => c['Company Name'] === so['Company Name'])?.['Address (English)'] || prev['Company Address']
            }));

            let soItems = [];
            if (typeof so.ItemsJSON === 'string') {
                try { soItems = JSON.parse(so.ItemsJSON); } catch (e) { }
            } else {
                soItems = so.ItemsJSON || [];
            }
            if (soItems.length > 0) {
                setItems(soItems.map((item: any) => ({
                    ...item,
                    id: item.id || `item-${Math.random()}`
                })));
            }
            addToast(`Loaded information from SO ${soNo}`, 'success');
        } else {
            setInvoice(prev => ({ ...prev, 'SO No.': soNo }));
        }
    };

    const handlePricelistItemSelect = (item: LineItem, p: any) => {
        setItems(prev => prev.map(i => i.id === item.id ? {
            ...i,
            itemCode: p['Item Code'] || '',
            modelName: p.Model || '',
            description: p.Specification || '',
            unitPrice: p['Selling Price (Include VAT)'] || 0,
            amount: (Number(p['Selling Price (Include VAT)']) || 0) * (Number(i.qty) || 0)
        } : i));
    };

    const handleItemChange = (id: string, field: keyof Omit<LineItem, 'id' | 'amount' | 'no'>, value: string | number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const newItem = { ...item, [field]: value };
                newItem.amount = (Number(newItem.qty) || 0) * (Number(newItem.unitPrice) || 0);
                return newItem;
            }
            return item;
        }));
    };

    const addItem = () => {
        const nextNo = items.length > 0 ? Math.max(...items.map(i => i.no)) + 1 : 1;
        setItems(prev => [...prev, { id: `item-${Date.now()}`, no: nextNo, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]);
    };

    const removeItem = (id: string) => {
        if (items.length === 1) return;
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { url } = await uploadFile(file);
            setInvoice(prev => ({ ...prev, Attachment: url }));
            addToast('File uploaded successfully', 'success');
        } catch (err: any) {
            addToast(`Upload failed: ${err.message}`, 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        if (!invoice['Inv No.'] || !invoice['Company Name']) {
            setError('Please fill in Invoice No. and Company Name');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const payload = {
                ...invoice,
                'Inv Date': invoice['Inv Date'] ? formatToSheetDate(invoice['Inv Date']) : null,
                'Amount': String(totals.grandTotal),
                'ItemsJSON': items,
                'Created By': invoice['Created By'] || currentUser?.Name || '',
            };

            if (existingInvoice) {
                await updateRecord('Invoices', existingInvoice['Inv No.'], payload);
                setInvoices(current => current ? current.map(inv => inv['Inv No.'] === invoice['Inv No.'] ? (payload as Invoice) : inv) : [payload as Invoice]);
            } else {
                await createRecord('Invoices', payload);
                setInvoices(current => current ? [payload as Invoice, ...current] : [payload as Invoice]);
            }

            setSuccessInfo({ invNo: invoice['Inv No.'] });
        } catch (err: any) {
            setError(err.message || 'Failed to save invoice');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrint = (mode: 'invoice' | 'do') => {
        setPreviewMode(mode);
        // Removed window.print logic as per instruction
    };

    // PDF Generation Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!invoice['Company Name']) return;

            try {
                const isDO = previewMode === 'do';
                const url = await generatePDF({
                    type: isDO ? 'Delivery Order' : 'Invoice',
                    title: isDO ? 'Delivery Order' : 'Invoice',
                    headerData: {
                        ...invoice,
                        'Company Name': invoice['Company Name'],
                        'Company Address': invoice['Company Address'] || companies?.find(c => c['Company Name'] === invoice['Company Name'])?.['Address (English)'] || '',
                        'Contact Name': invoice['Contact Name'],
                        'Phone Number': invoice['Phone Number'],
                        'Email': invoice['Email'],
                        'Payment Term': invoice['Payment Term'],
                        'Tin No.': invoice['Tin No.'],
                        'SO No': invoice['SO No.'],
                        'Date': invoice['Inv Date'],
                        'Invoice No': invoice['Inv No.'],
                        'DO No': invoice['Inv No.'] ? invoice['Inv No.'].replace('INV', 'DO') : '',
                        'Prepared By': invoice['Prepared By'],
                        'Prepared By Position': invoice['Prepared By Position'],
                        'Approved By': invoice['Approved By'],
                        'Approved By Position': invoice['Approved By Position'],
                    },
                    items: items.filter(item => item.no > 0).map(item => ({
                        no: item.no,
                        itemCode: item.itemCode,
                        modelName: item.modelName,
                        description: item.description,
                        qty: item.qty,
                        unitPrice: isDO ? 0 : item.unitPrice,
                        amount: isDO ? 0 : item.amount
                    })),
                    totals: {
                        subTotal: isDO ? 0 : totals.subTotal,
                        tax: isDO ? 0 : totals.tax,
                        grandTotal: isDO ? 0 : totals.grandTotal
                    },
                    currency: (invoice.Currency as 'USD' | 'KHR') || 'USD',
                    layout: pdfLayout,
                    previewMode: true,
                    filename: `${isDO ? 'DO' : 'Invoice'}_preview.pdf`
                });

                if (typeof url === 'string') {
                    setPdfPreviewUrl(url);
                }
            } catch (error) {
                console.error('PDF generation error:', error);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [invoice, items, totals, pdfLayout, previewMode, companies]);

    const handleDownloadPDF = (mode: 'invoice' | 'do') => {
        const isDO = mode === 'do';
        generatePDF({
            type: isDO ? 'Delivery Order' : 'Invoice',
            title: isDO ? 'Delivery Order' : 'Invoice',
            headerData: {
                ...invoice,
                'Company Name': invoice['Company Name'],
                'Company Address': invoice['Company Address'] || companies?.find(c => c['Company Name'] === invoice['Company Name'])?.['Address (English)'] || '',
                'Contact Name': invoice['Contact Name'],
                'Phone Number': invoice['Phone Number'],
                'Email': invoice['Email'],
                'Payment Term': invoice['Payment Term'],
                'Tin No.': invoice['Tin No.'],
                'SO No': invoice['SO No.'],
                'Date': invoice['Inv Date'],
                'Invoice No': invoice['Inv No.'],
                'DO No': invoice['Inv No.'] ? invoice['Inv No.'].replace('INV', 'DO') : '',
                'Prepared By': invoice['Prepared By'],
                'Prepared By Position': invoice['Prepared By Position'],
                'Approved By': invoice['Approved By'],
                'Approved By Position': invoice['Approved By Position'],
            },
            items: items.filter(item => item.no > 0).map(item => ({
                no: item.no,
                itemCode: item.itemCode,
                modelName: item.modelName,
                description: item.description,
                qty: item.qty,
                unitPrice: isDO ? 0 : item.unitPrice,
                amount: isDO ? 0 : item.amount
            })),
            totals: {
                subTotal: isDO ? 0 : totals.subTotal,
                tax: isDO ? 0 : totals.tax,
                grandTotal: isDO ? 0 : totals.grandTotal
            },
            currency: (invoice.Currency as 'USD' | 'KHR') || 'USD',
            layout: pdfLayout,
            previewMode: false,
            filename: `${isDO ? 'DO' : 'Invoice'}_${invoice['Inv No.']}.pdf`
        });
    };

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const soOptions = useMemo(() => saleOrders ? [...new Set(saleOrders.map(s => s['SO No.']).filter(Boolean))].sort().reverse() : [], [saleOrders]);

    const printableProps = {
        headerData: {
            ...invoice,
            'Company Address': invoice['Company Address'] || companies?.find(c => c['Company Name'] === invoice['Company Name'])?.['Address (English)'] || '',
            'Prepared By': invoice['Prepared By'],
            'Prepared By Position': invoice['Prepared By Position'],
            'Approved By': invoice['Approved By'],
            'Approved By Position': invoice['Approved By Position'],
        },
        items,
        totals,
        currency: (invoice.Currency as 'USD' | 'KHR') || 'USD',
    };

    const headerLeft = (
        <div className="flex items-center gap-2 ml-4">
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 shadow-sm">
                <button
                    onClick={() => setPreviewMode('invoice')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${previewMode === 'invoice' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <FileText className="w-4 h-4" /> Invoice
                </button>
                <button
                    onClick={() => setPreviewMode('do')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${previewMode === 'do' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Printer className="w-4 h-4" /> Delivery Order
                </button>
            </div>
        </div>
    );

    const headerRight = (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-3 mr-1">
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
                <button onClick={() => handleDownloadPDF(previewMode)} className="flex items-center gap-2 px-6 py-2 text-sm font-bold bg-white text-brand-600 border border-brand-200 rounded-md hover:bg-brand-50 hover:border-brand-300 shadow-sm transition-all active:scale-95">
                    <Download className="w-4 h-4" />
                    Download PDF
                </button>
            </div>

            <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-6 rounded-md transition shadow-md text-sm disabled:opacity-50 min-w-[120px] flex items-center justify-center"
            >
                {isSubmitting ? <Spinner size="sm" color="white" /> : 'Save Invoice'}
            </button>
        </div>
    );

    return (
        <>
            <DocumentEditorContainer
                title={existingInvoice ? `Edit Invoice: ${invoice['Inv No.']}` : "New Invoice & DO"}
                onBack={onBack}
                onSave={handleSave}
                isSubmitting={isSubmitting}
                leftActions={headerLeft}
                rightActions={headerRight}
            >
                <div className="screen-only h-full flex relative overflow-hidden">
                    {/* Center area: PDF Layout + Preview */}
                    <div className="flex-1 flex flex-col relative overflow-hidden">
                        {/* Top: Collapsible Layout Controls */}
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
                                <div className="border-l border-gray-200">
                                    <button
                                        onClick={handleSaveLayout}
                                        className="h-full px-6 text-sm font-bold text-gray-700 hover:bg-brand-50 hover:text-brand-600 flex items-center gap-2 transition-all active:scale-95 group"
                                    >
                                        <Save className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                        Save Layout
                                    </button>
                                </div>
                                <div className="border-l border-gray-200 flex items-center px-4 bg-gray-50/50">
                                    <button
                                        onClick={() => setShowPdfConfig(true)}
                                        className="px-3 py-1.5 text-[10px] font-bold text-gray-500 bg-white hover:bg-gray-100 rounded-md border border-gray-200 transition-colors uppercase tracking-wider"
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
                                                <h3 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1.5"><ScrollText className="w-3.5 h-3.5" /> Info Header</h3>
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-xs font-bold text-purple-700 uppercase flex items-center gap-1.5"><ScrollText className="w-3.5 h-3.5" /> Terms & Signature</h3>
                                                <button onClick={() => {
                                                    updateLayout('terms.spacingBefore', defaultLayoutConfig.terms.spacingBefore);
                                                    updateLayout('footer.y', defaultLayoutConfig.footer.y);
                                                    updateLayout('footer.preparedBy.x', defaultLayoutConfig.footer.preparedBy.x);
                                                    updateLayout('footer.middlePosition.x', defaultLayoutConfig.footer.middlePosition?.x || 105);
                                                    updateLayout('footer.approvedBy.x', defaultLayoutConfig.footer.approvedBy.x);
                                                }} className="text-[9px] font-bold text-gray-400 hover:text-purple-600 flex items-center gap-1 group">
                                                    <RotateCcw className="w-2.5 h-2.5 group-hover:rotate-[-45deg] transition-transform" /> Default
                                                </button>
                                            </div>
                                            <div className="bg-purple-50/50 p-2 rounded-xl border border-purple-100 shadow-sm space-y-1">
                                                <PDFControlField label="Terms Spacing" path="terms.spacingBefore" min={0} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Vertical Y" path="footer.y" min={150} max={290} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Prepared X" path="footer.preparedBy.x" min={10} max={100} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Middle X (DO)" path="footer.middlePosition.x" min={50} max={150} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Approved X" path="footer.approvedBy.x" min={100} max={200} layout={pdfLayout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                        {/* Center: PDF Preview */}
                        <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-800">{previewMode === 'do' ? 'Delivery Order' : 'Invoice'} Preview</h3>
                                        <p className="text-[10px] text-gray-500">{invoice['Inv No.']} • {invoice['Company Name'] || 'No Company Selected'}</p>
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
                                        <span>Generating {previewMode === 'do' ? 'DO' : 'Invoice'} Preview...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Form Sidebar */}
                    <div className={`bg-white border-l border-gray-200 transition-all duration-300 ease-in-out flex flex-col flex-shrink-0 ${showFormPanel ? 'w-[500px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'}`}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                                <h3 className="text-sm font-bold text-gray-800">Document Information</h3>
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
                                <FormSection title="Header Details">
                                    <FormInput label="Invoice No." name="Inv No." value={invoice['Inv No.']} onChange={handleInputChange} required />
                                    <FormInput label="Invoice Date" name="Inv Date" type="date" value={invoice['Inv Date']} onChange={handleInputChange} />
                                    <SearchableSelect
                                        name="SO No."
                                        label="SO Reference"
                                        value={invoice['SO No.'] || ''}
                                        options={soOptions}
                                        onChange={handleSOSelect}
                                        placeholder="Select SO"
                                    />
                                    <FormSelect label="Status" name="Status" value={invoice['Status']} options={STATUS_OPTIONS} onChange={handleInputChange} />
                                    <FormSelect label="Taxable" name="Taxable" value={invoice['Taxable']} options={TAXABLE_OPTIONS} onChange={handleInputChange} />
                                    <FormSelect label="Currency" name="Currency" value={invoice['Currency']} options={CURRENCY_OPTIONS} onChange={handleInputChange} />
                                </FormSection>

                                <FormSection title="Preparation Info">
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormInput label="Prepared By" name="Prepared By" value={invoice['Prepared By']} onChange={handleInputChange} />
                                        <FormInput label="Position" name="Prepared By Position" value={invoice['Prepared By Position']} onChange={handleInputChange} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormInput label="Approved By" name="Approved By" value={invoice['Approved By']} onChange={handleInputChange} />
                                        <FormInput label="Position" name="Approved By Position" value={invoice['Approved By Position']} onChange={handleInputChange} />
                                    </div>
                                </FormSection>

                                <FormSection title="Customer Details">
                                    <SearchableSelect
                                        name="Company Name"
                                        label="Company Name"
                                        value={invoice['Company Name'] || ''}
                                        options={companyOptions}
                                        onChange={handleCompanySelect}
                                        placeholder="Select Company"
                                        required
                                    />
                                    <FormInput label="Contact Name" name="Contact Name" value={invoice['Contact Name']} onChange={handleInputChange} />
                                    <FormInput label="Phone Number" name="Phone Number" value={invoice['Phone Number']} onChange={handleInputChange} />
                                    <FormInput label="Email" name="Email" value={invoice['Email']} onChange={handleInputChange} />
                                    <FormInput label="Payment Term" name="Payment Term" value={invoice['Payment Term']} onChange={handleInputChange} />
                                    <FormInput label="Tin No." name="Tin No." value={invoice['Tin No.']} onChange={handleInputChange} />
                                    <FormTextarea label="Company Address" name="Company Address" value={invoice['Company Address']} onChange={handleInputChange} rows={3} />
                                </FormSection>

                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Line Items</h3>
                                    <div className="space-y-4">
                                        {items.map((item) => (
                                            <div key={item.id} className="relative p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-blue-400 hover:shadow-md group">
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(item.id)}
                                                    className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all z-10"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>

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

                                                <div className="mb-3">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Description / Spec</label>
                                                    <textarea value={item.description} onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} className="w-full text-sm p-3 rounded-lg border border-slate-200 transition-all bg-white" rows={2} />
                                                </div>

                                                <div className="flex flex-wrap gap-3">
                                                    <div className="w-20">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Qty</label>
                                                        <input type="number" value={item.qty} onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)} className="w-full h-9 px-2 text-center text-sm bg-white border border-slate-200 rounded-lg" />
                                                    </div>
                                                    <div className="w-28">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Unit Price</label>
                                                        <input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)} className="w-full h-9 px-3 text-right text-sm bg-white border border-slate-200 rounded-lg" />
                                                    </div>
                                                    <div className="flex-1 text-right pt-4">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Total</div>
                                                        <div className="text-lg font-bold text-slate-700">{getCurrencySymbol(invoice.Currency as any)}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <button onClick={addItem} className="w-full py-2.5 rounded-lg border border-dashed border-blue-300 text-blue-600 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 font-bold text-sm transition-all flex items-center justify-center gap-2">
                                            <Plus className="w-4 h-4" /> Add Item
                                        </button>

                                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mt-6 space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500 font-medium">Sub Total</span>
                                                <span className="text-slate-700 font-black">{getCurrencySymbol(invoice.Currency as any)}{totals.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500 font-medium">Tax (VAT 10%)</span>
                                                <span className="text-slate-700 font-black">{getCurrencySymbol(invoice.Currency as any)}{totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-3 border-t border-slate-300">
                                                <span className="text-xs text-slate-800 font-black uppercase tracking-wider">Grand Total</span>
                                                <span className="text-xl text-blue-700 font-black">{getCurrencySymbol(invoice.Currency as any)}{totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <FormSection title="Attachment">
                                    <div className="space-y-4">
                                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                        {isUploading ? (
                                            <div className="flex items-center gap-3 text-sm text-slate-600 p-4 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200">
                                                <Spinner size="sm" />
                                                <span className="font-bold">Uploading...</span>
                                            </div>
                                        ) : invoice['Attachment'] ? (
                                            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-100 shadow-sm">
                                                <a href={invoice['Attachment']} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-700 hover:underline truncate max-w-[200px]">
                                                    View Uploaded File
                                                </a>
                                                <button type="button" onClick={() => setInvoice(prev => ({ ...prev, Attachment: '' }))} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-full transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full text-center p-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-300 transition-all flex flex-col items-center gap-2">
                                                <Upload className="w-5 h-5 text-slate-400" />
                                                <span className="text-[10px] uppercase tracking-widest text-slate-400">Click to Upload File</span>
                                            </button>
                                        )}
                                    </div>
                                </FormSection>
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <div className="print-only">
                    {previewMode === 'invoice' ? (
                        <PrintableInvoice {...printableProps} />
                    ) : (
                        <PrintableDO {...printableProps} />
                    )}
                </div>

                {successInfo && (
                    <SuccessModal
                        isOpen={!!successInfo}
                        onClose={onBack}
                        title="Invoice Saved!"
                        message={`Invoice ${successInfo.invNo} has been saved successfully.`}
                        extraActions={
                            <button
                                onClick={() => handlePrint('invoice')}
                                className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition"
                            >
                                <Printer size={20} /> Print Invoice
                            </button>
                        }
                    />
                )}
            </DocumentEditorContainer>

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

export default InvoiceCreator;

