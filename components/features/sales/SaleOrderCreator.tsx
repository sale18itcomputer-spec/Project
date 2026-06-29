'use client';


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SaleOrder } from "../../../types";
import { useData } from "../../../contexts/DataContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useNavigation } from "../../../contexts/NavigationContext";
import { useB2B } from "../../../contexts/B2BContext";
import { createSaleOrderSheet, readQuotationSheetData, uploadFile } from "../../../services/api";
import { formatToInputDate } from "../../../utils/time";
import { FormSection, FormInput, FormSelect } from "../../common/FormControls";
import PrintableSaleOrder from "../../pdf/PrintableSaleOrder";
import PdfPreviewPane from "../../pdf/PdfPreviewPane";
import DocumentEditorContainer from "../../layout/DocumentEditorContainer";
import { Trash2, X, Upload, Download, ScrollText, Layout, List } from 'lucide-react';
import Spinner from "../../common/Spinner";
import SuccessModal from "../../modals/SuccessModal";
import { generatePDF } from "@/lib/pdfClient";
import { useToast } from "../../../contexts/ToastContext";
import SearchableSelect from "../../common/SearchableSelect";
import { ScrollArea } from "../../ui/scroll-area";
import { useColumnWidths } from "../../../hooks/useColumnWidths";
import { ColumnWidthPopover } from "./ColumnWidthPopover";
import { readFormDraft, useFormDraft } from "../../../hooks/useFormDraft";

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
    isPromotion?: boolean;
}

const BULLET_TYPES = [
    { label: 'None', char: '' },
    { label: 'Dot', char: '• ' },
    { label: 'Dash', char: '- ' }
];

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

const lineItemInputClasses = "w-full text-sm p-2 bg-input border border-border rounded-md focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-foreground placeholder:text-muted-foreground/50 transition hover:border-muted-foreground/40";

// ── Unified result type for the item picker dropdown ─────────────────────────
type PickerSource = 'pricelist' | 'inventory';
interface PickerResult {
    source: PickerSource;
    key: string;           // unique key for React
    code: string;
    model: string;
    brand: string;
    description: string;
    price: number | string;
    statusLabel: string;
    currency?: string;
    /** inventory qty — undefined when source is pricelist */
    qty?: number;
}

const PricelistCombobox: React.FC<{
    item: LineItem;
    onItemChange: (id: string, field: keyof Omit<LineItem, 'id' | 'amount' | 'no'>, value: string | number) => void;
    onPricelistItemSelect: (item: LineItem, pricelistItem: any) => void;
    disabled?: boolean;
}> = ({ item, onItemChange, onPricelistItemSelect, disabled = false }) => {
    const { pricelist, inventoryItems } = useData();
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

    // Build merged results: inventory first (priority), then pricelist
    const mergedResults = useMemo((): PickerResult[] => {
        if (!isOpen) return [];
        const query = (item.itemCode ?? '').toLowerCase().trim();

        // ── Inventory items ────────────────────────────────────────────────────
        const invResults: PickerResult[] = (inventoryItems ?? [])
            .filter(inv => {
                if ((inv.qty ?? 0) <= 0) return false; // hide zero-stock
                if (!query) return true;
                return (
                    (inv.code ?? '').toLowerCase().includes(query) ||
                    (inv.model_name ?? '').toLowerCase().includes(query) ||
                    (inv.brand ?? '').toLowerCase().includes(query) ||
                    (inv.description ?? '').toLowerCase().includes(query)
                );
            })
            .slice(0, 30)
            .map(inv => ({
                source: 'inventory' as PickerSource,
                key: `inv-${inv.id}`,
                code: inv.code ?? '',
                model: inv.model_name ?? '',
                brand: inv.brand ?? '',
                description: inv.description ?? '',
                price: inv.unit_price,
                statusLabel: `Qty: ${inv.qty}`,
                currency: inv.currency,
                qty: inv.qty,
            }));

        // ── Pricelist items ────────────────────────────────────────────────────
        const plResults: PickerResult[] = (pricelist ?? [])
            .filter(p => {
                if (!query) return true;
                return (
                    (p.Code ?? '').toLowerCase().includes(query) ||
                    (p.Model ?? '').toLowerCase().includes(query) ||
                    (p.Brand ?? '').toLowerCase().includes(query)
                );
            })
            .slice(0, 30)
            .map(p => ({
                source: 'pricelist' as PickerSource,
                key: `pl-${p.Code}`,
                code: p.Code ?? '',
                model: p.Model ?? '',
                brand: p.Brand ?? '',
                description: p.Description ?? '',
                price: p['End User Price'],
                statusLabel: p.Status ?? '',
                currency: p.Currency,
                qty: undefined,
            }));

        // Deduplicate: if inventory already covers a code, skip pricelist duplicate
        const invCodes = new Set(invResults.map(r => r.code.toLowerCase()));
        const dedupedPl = plResults.filter(r => !r.code || !invCodes.has(r.code.toLowerCase()));

        return [...invResults, ...dedupedPl].slice(0, 60);
    }, [pricelist, inventoryItems, item.itemCode, isOpen]);

    const handleBlur = () => {
        setTimeout(() => {
            if (!document.body.contains(wrapperRef.current)) return;
            setIsOpen(false);
            // Auto-fill on exact code match (pricelist fallback)
            const exactMatch = pricelist?.find(p => p.Code?.toLowerCase() === (item.itemCode || '').toLowerCase().trim());
            if (exactMatch && !item.modelName) {
                onPricelistItemSelect(item, exactMatch);
            }
        }, 200);
    };

    // Normalise a picker result → the shape expected by onPricelistItemSelect
    const handleSelect = (result: PickerResult) => {
        if (result.source === 'inventory') {
            // Map inventory fields to the same shape as a pricelist item
            onPricelistItemSelect(item, {
                Code: result.code,
                Model: result.model,
                Brand: result.brand,
                Description: result.description,
                'End User Price': result.price,
                Status: result.statusLabel,
                Currency: result.currency,
                // Extra metadata so the SO can record the inventory source
                _inventoryQty: result.qty,
            });
        } else {
            const pl = pricelist?.find(p => p.Code === result.code);
            if (pl) onPricelistItemSelect(item, pl);
        }
        setIsOpen(false);
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
                placeholder="Type to search inventory or pricelist…"
                autoComplete="off"
                disabled={disabled}
            />
            {isOpen && !disabled && mergedResults.length > 0 && (
                <div className="absolute z-[9999] w-[480px] mt-1 bg-card rounded-md shadow-lg border border-border">
                    <ScrollArea className="max-h-80">
                        {/* Section headers when both sources present */}
                        {mergedResults.some(r => r.source === 'inventory') && (
                            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 select-none">
                                📦 Inventory (In Stock)
                            </p>
                        )}
                        <ul>
                            {mergedResults.map((result, idx) => {
                                // Insert pricelist section header
                                const prevIsInv = idx > 0 && mergedResults[idx - 1].source === 'inventory';
                                const showPlHeader = result.source === 'pricelist' && (idx === 0 || prevIsInv);
                                return (
                                    <React.Fragment key={result.key}>
                                        {showPlHeader && (
                                            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 select-none border-t border-border mt-1">
                                                📋 Pricelist
                                            </p>
                                        )}
                                        <li>
                                            <button
                                                type="button"
                                                onMouseDown={e => { e.preventDefault(); handleSelect(result); }}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground
                                                    ${result.source === 'inventory' ? 'hover:bg-emerald-500/5' : ''}`}
                                            >
                                                <div className="flex justify-between w-full items-center">
                                                    <div className="truncate pr-4">
                                                        <p className="font-semibold text-foreground">{result.model}</p>
                                                        <p className="text-xs text-muted-foreground">{result.brand}{result.code ? ` — ${result.code}` : ''}</p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="font-semibold text-foreground">{result.price}</p>
                                                        <p className={`text-xs font-medium ${result.source === 'inventory' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                                            {result.statusLabel}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        </li>
                                    </React.Fragment>
                                );
                            })}
                        </ul>
                    </ScrollArea>
                </div>
            )}
        </div>
    );
};


const SaleOrderCreator: React.FC<SaleOrderCreatorProps> = ({ onBack, existingSaleOrder, initialData }) => {
    const { saleOrders, setSaleOrders, companies, contacts, quotations, pricelist, inventoryItems, refetchModule } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { handleNavigation } = useNavigation();
    const { isB2B } = useB2B();

    // ── Column layout ──────────────────────────────────────────────────────────
    const [colWidths, setColWidths, resetColWidths] = useColumnWidths('sale-order');

    const draftKey = existingSaleOrder ? `so-edit-${existingSaleOrder['SO No']}` : 'so-new';
    const draft = useRef(readFormDraft<{ saleOrder: Partial<SaleOrder & { [key: string]: any }>; items: LineItem[]; selectedSoftware: string[] }>(draftKey)).current;
    const hasDraft = useRef(!!draft);
    const [hasDraftState, setHasDraftState] = useState(!!draft);
    const { save: saveDraft, clear: clearDraft } = useFormDraft(draftKey);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successInfo, setSuccessInfo] = useState<{ soNo: string } | null>(null);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [items, setItems] = useState<LineItem[]>(() => draft?.items ?? [{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
    const [selectedSoftware, setSelectedSoftware] = useState<string[]>(() => draft?.selectedSoftware ?? []);

    const [showFormPanel, setShowFormPanel] = useState(true);
    const [signaturePadding, setSignaturePadding] = useState(0);
    const [labelPadding, setLabelPadding] = useState(200);

    const applyBullet = (itemId: string, bulletChar: string) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            const lines = (item.description || '').split('\n');
            const processedLines = lines.map(line => {
                let cleanLine = line;
                BULLET_TYPES.forEach(bt => {
                    if (bt.char && cleanLine.startsWith(bt.char)) {
                        cleanLine = cleanLine.substring(bt.char.length);
                    }
                });
                return bulletChar + cleanLine;
            });
            return { ...item, description: processedLines.join('\n') };
        }));
    };


    const isFromQuote = useMemo(() => !!existingSaleOrder?.['Quote No'], [existingSaleOrder]);

    const nextSaleOrderNumber = useMemo(() => {
        if (!saleOrders || saleOrders.length === 0) return 'SO-0000001';
        const maxNum = saleOrders.reduce((max, so) => {
            const numPartMatch = so['SO No'].match(/\d+$/);
            if (!numPartMatch) return max;
            const numPart = parseInt(numPartMatch[0], 10);
            return isNaN(numPart) ? max : Math.max(max, numPart);
        }, 0);
        return `SO-${String(maxNum + 1).padStart(7, '0')}`;
    }, [saleOrders]);

    const [saleOrder, setSaleOrder] = useState<Partial<SaleOrder & { [key: string]: any }>>(() => draft?.saleOrder ?? {});

    const fetchQuoteItems = React.useCallback(async (quoteId: string) => {
        setItemsLoading(true);
        try {
            const { items: fetchedItems } = await readQuotationSheetData(quoteId);
            if (fetchedItems && fetchedItems.length > 0) {
                const newItems: LineItem[] = fetchedItems.map((item: any, index: number) => {
                    const pricelistEntry = pricelist?.find(p => p.Code === item.itemCode);
                    const resolvedDescription = pricelistEntry
                        ? (pricelistEntry.Description || '')
                        : [(item.modelName || '').trim(), (item.description || '').trim()].filter(Boolean).join('\n');
                    return {
                        id: `item-${Date.now()}-${index}`,
                        no: item.no || index + 1,
                        itemCode: item.itemCode || '',
                        modelName: item.modelName || '',
                        description: resolvedDescription,
                        qty: item.qty || 1,
                        unitPrice: item.unitPrice || 0,
                        commission: 0,
                        amount: (item.qty || 1) * (item.unitPrice || 0),
                    };
                });
                setItems(newItems);
            }
        } catch (err: any) {
            addToast(`Failed to fetch items from quote: ${err.message}`, 'error');
            setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
        } finally {
            setItemsLoading(false);
        }
    }, [pricelist, addToast]);

    useEffect(() => {
        if (hasDraft.current) return;
        // If editing an existing SO, wait until companies/contacts have loaded before
        // initialising state. Without this guard the else-branch below fires while they
        // are still null, overwrites items with a default empty row, the auto-save
        // captures that bad state, and the draft then blocks the real items from loading.
        if (existingSaleOrder && (!companies || !contacts)) return;
        if (existingSaleOrder && companies && contacts) {
            const companyName = existingSaleOrder['Company Name'];
            const contactName = existingSaleOrder['Contact Name'];
            const company = companies.find(c => c['Company Name'] === companyName);
            const contact = contacts.find(c => c.Name === contactName && (!companyName || c['Company Name'] === companyName));

            const baseData = {
                ...existingSaleOrder,
                'SO No': existingSaleOrder['SO No'] || nextSaleOrderNumber,
                'SO Date': existingSaleOrder['SO Date'] ? formatToInputDate(existingSaleOrder['SO Date']) : getTodayDateString(),
                'Delivery Date': existingSaleOrder['Delivery Date'] ? formatToInputDate(existingSaleOrder['Delivery Date']) : getTodayDateString(),
                'Currency': (existingSaleOrder.Currency === 'KHR' ? 'KHR' : 'USD') as ('USD' | 'KHR'),
                'Company Address': existingSaleOrder['Company Address'] || company?.['Address (English)'] || '',
                'Payment Term': existingSaleOrder['Payment Term'] || company?.['Payment Term'] || '',
                'Phone Number': existingSaleOrder['Phone Number'] || contact?.['Tel (1)'] || '',
                'Email': existingSaleOrder.Email || contact?.Email || '',
                'Prepared By': existingSaleOrder['Prepared By'] || currentUser?.Name || '',
                'Prepared By Position': existingSaleOrder['Prepared By Position'] || (currentUser ? (
                    currentUser.Name?.toLowerCase().includes('sreyneang')
                        ? '017 594 524 | 010 345 994'
                        : [currentUser.Role, [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '), currentUser.Email].filter(Boolean).join(' | ')
                ) : ''),
                'Approved By': existingSaleOrder['Approved By'] || '',
                'Approved By Position': existingSaleOrder['Approved By Position'] || '',
            };

            if (!baseData['Bill Invoice']) {
                baseData['Bill Invoice'] = parseFloat(baseData.Tax || '0') > 0 ? 'VAT' : 'NON-VAT';
            }
            setSaleOrder(baseData);

            if (existingSaleOrder.ItemsJSON) {
                try {
                    const parsedItems = typeof existingSaleOrder.ItemsJSON === 'string'
                        ? JSON.parse(existingSaleOrder.ItemsJSON)
                        : existingSaleOrder.ItemsJSON;
                    if (Array.isArray(parsedItems)) {
                        setItems(parsedItems.map((item: any) => ({ ...item, id: item.id || `item-${Date.now()}-${Math.random()}` })));
                    }
                } catch (e) {
                    console.error("Failed to parse ItemsJSON", e);
                }
            } else if (existingSaleOrder['Quote No']) {
                fetchQuoteItems(existingSaleOrder['Quote No']);
            }
        } else {
            if (initialData?.ItemsJSON) {
                try {
                    const parsedItems = typeof initialData.ItemsJSON === 'string'
                        ? JSON.parse(initialData.ItemsJSON)
                        : initialData.ItemsJSON;
                    if (Array.isArray(parsedItems)) {
                        setItems(parsedItems.map((item: any) => ({ ...item, id: item.id || `item-${Date.now()}-${Math.random()}` })));
                    } else {
                        setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
                    }
                } catch (e) {
                    console.error("Failed to parse initial ItemsJSON", e);
                    setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
                }
            } else if (initialData?.['Quote No']) {
                fetchQuoteItems(initialData['Quote No']);
            } else {
                setItems([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]);
            }

            setSaleOrder({
                'SO No': nextSaleOrderNumber,
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
                'Prepared By': initialData?.['Prepared By'] || currentUser?.Name || '',
                'Prepared By Position': initialData?.['Prepared By Position'] || (currentUser ? (
                    currentUser.Name?.toLowerCase().includes('sreyneang')
                        ? '017 594 524 | 010 345 994'
                        : [currentUser.Role, [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '), currentUser.Email].filter(Boolean).join(' | ')
                ) : ''),
                'Approved By': initialData?.['Approved By'] || '',
                'Approved By Position': initialData?.['Approved By Position'] || '',
                'Remark': initialData?.Remark || '',
                'Terms and Conditions': initialData?.['Terms and Conditions'] || '',
                ...initialData
            });
        }
    }, [existingSaleOrder, nextSaleOrderNumber, currentUser, isFromQuote, pricelist, initialData, companies, contacts]);

    useEffect(() => {
        if (!existingSaleOrder && initialData) {
            const stored = sessionStorage.getItem('duplicate_sale_order_items');
            if (stored) {
                try {
                    const parsedItems = JSON.parse(stored);
                    if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                        setItems(parsedItems.map((item: any, idx: number) => ({ ...item, id: `item-dup-${Date.now()}-${idx}` })));
                    }
                } catch (e) {
                    console.error('Failed to parse duplicate sale order items', e);
                } finally {
                    sessionStorage.removeItem('duplicate_sale_order_items');
                }
            }
        }
    }, [existingSaleOrder, initialData]);

    useEffect(() => {
        if (hasDraft.current) return;
        if (existingSaleOrder && existingSaleOrder['Install Software']) {
            setSelectedSoftware(existingSaleOrder['Install Software'].split(',').map(s => s.trim()).filter(Boolean));
        } else if (!existingSaleOrder) {
            setSelectedSoftware([]);
        }
    }, [existingSaleOrder]);

    useEffect(() => {
        setSaleOrder(prev => ({ ...prev, 'Install Software': selectedSoftware.join(', ') }));
    }, [selectedSoftware]);

    useEffect(() => {
        if (!saleOrder['SO No']) return;
        saveDraft({ saleOrder, items, selectedSoftware });
        setHasDraftState(true);
    }, [saleOrder, items, selectedSoftware, saveDraft]);

    useEffect(() => {
        if (hasDraft.current) return;
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
                    const unitPrice = typeof pricelistItem['End User Price'] === 'number'
                        ? pricelistItem['End User Price']
                        : parseFloat(String(pricelistItem['End User Price']).replace(/[^0-9.]/g, '')) || 0;
                    return {
                        ...item,
                        itemCode: pricelistItem.Code,
                        modelName: pricelistItem.Model,
                        description: pricelistItem.Description || '',
                        unitPrice: unitPrice,
                        amount: (typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0) * (unitPrice + (parseFloat(String(item.commission)) || 0)),
                        commission: item.commission,
                    };
                }
                return item;
            });
            return newItems;
        });
    };

    const renumberItems = (list: LineItem[]) => {
        let n = 0;
        return list.map(item => item.isPromotion ? { ...item, no: 0 } : { ...item, no: ++n });
    };

    const handleItemChange = (id: string, field: keyof Omit<LineItem, 'id' | 'amount'>, value: string | number) => {
        setItems(currentItems => {
            const newItems = currentItems.map(item => {
                if (item.id === id) {
                    const updatedItem = { ...item, [field]: value } as any;
                    if (updatedItem.isPromotion) {
                        const q = parseFloat(String(updatedItem.qty)) || 0;
                        const p = parseFloat(String(updatedItem.unitPrice)) || 0;
                        updatedItem.amount = -(q * p);
                    } else {
                        const q = parseFloat(String(updatedItem.qty)) || 0;
                        const p = parseFloat(String(updatedItem.unitPrice)) || 0;
                        const c = parseFloat(String(updatedItem.commission)) || 0;
                        updatedItem.amount = q * (p + c);
                    }
                    return updatedItem;
                }
                return item;
            });
            return renumberItems(newItems);
        });
    };


    const addItem = () => {
        setItems(prev => renumberItems([...prev, { id: `item-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, commission: 0, amount: 0 }]));
    };

    const removeItem = (id: string) => {
        setItems(prev => renumberItems(prev.filter(item => item.id !== id)));
    };

    const addDescriptionRow = () => {
        setItems(prev => [...prev, { id: `item-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 0, unitPrice: 0, commission: 0, amount: 0 }]);
    };

    const addPromoRow = () => {
        setItems(prev => [...prev, { id: `promo-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 0, unitPrice: 0, commission: 0, amount: 0, isPromotion: true }]);
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
    };

    const handleCompanySelect = (companyName: string) => {
        const company = companies?.find(c => c['Company Name'] === companyName);
        setSaleOrder(prev => ({
            ...prev,
            'Company Name': companyName,
            'Company Address': company?.['Address (English)'] || '',
            'Contact Name': '',
            'Phone Number': '',
            'Email': '',
            'Quote No': '',
            'Payment Term': company?.['Payment Term'] || ''
        }));
    };

    const handleContactChange = (contactName: string) => {
        const contact = contacts?.find(c => c.Name === contactName);
        setSaleOrder(prev => ({
            ...prev,
            'Contact Name': contactName,
            ...(contact ? {
                'Phone Number': contact?.['Tel (1)'] || prev['Phone Number'] || '',
                'Email': contact?.Email || prev['Email'] || ''
            } : {})
        }));
    };

    const handleQuoteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const quoteId = e.target.value;
        const quote = quotations?.find(q => q['Quote No'] === quoteId);
        if (quote) {
            setSaleOrder(prev => ({
                ...prev,
                'Quote No': quoteId,
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
                Status: 'Pending'
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
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleRemoveFile = () => {
        setSaleOrder(prev => ({ ...prev, 'Attachment': '' }));
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const masterSheetData: SaleOrder = {
                'SO No': saleOrder['SO No'] || nextSaleOrderNumber,
                'SO Date': saleOrder['SO Date'] || null,
                'File': '',
                'Quote No': saleOrder['Quote No'] || null,
                'Company Name': saleOrder['Company Name'] || '',
                'Contact Name': saleOrder['Contact Name'] || '',
                'Phone Number': saleOrder['Phone Number'] || '',
                'Email': saleOrder.Email || '',
                'Tax': String(totals.tax),
                'Total Amount': String(totals.grandTotal),
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
            const payload = { ...masterSheetData, 'ItemsJSON': items };
            await createSaleOrderSheet(masterSheetData['SO No'], payload);
            refetchModule('Sale Orders');
            if (existingSaleOrder && existingSaleOrder['SO No']) {
                setSaleOrders(current => current ? current.map(so => so['SO No'] === masterSheetData['SO No'] ? masterSheetData : so) : [masterSheetData]);
            } else {
                setSaleOrders(current => current ? [masterSheetData, ...current] : [masterSheetData]);
            }
            clearDraft();
            setHasDraftState(false);
            setSuccessInfo({ soNo: masterSheetData['SO No'] });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewQuote = () => {
        if (saleOrder['Quote No']) {
            const quote = quotations?.find(q => q['Quote No'] === saleOrder['Quote No']);
            if (quote) {
                handleNavigation({ view: 'quotations', payload: { action: 'edit', data: quote } });
            } else {
                handleNavigation({ view: 'quotations', filter: saleOrder['Quote No'] });
            }
        } else {
            addToast('No linked quotation found for this order.', 'info');
        }
    };

    const handleConvertToInvoice = async () => {
        setIsSubmitting(true);
        try {
            setSaleOrder(prev => ({ ...prev, Status: 'Completed' as const }));
            const masterSheetData: SaleOrder = {
                'SO No': saleOrder['SO No'] || nextSaleOrderNumber,
                'SO Date': saleOrder['SO Date'] || null,
                'File': '',
                'Quote No': saleOrder['Quote No'] || null,
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
            const payload = { ...masterSheetData, 'ItemsJSON': items };
            await createSaleOrderSheet(masterSheetData['SO No'], payload);
            if (setSaleOrders) {
                setSaleOrders(prev => {
                    const base = prev ? prev.filter(so => so['SO No'] !== masterSheetData['SO No']) : [];
                    return [masterSheetData as any, ...base];
                });
            }
            handleNavigation({ view: 'invoices', payload: { action: 'create', soData: { ...masterSheetData, 'ItemsJSON': items } } });
            addToast('Sale Order marked as Completed and converted to Invoice.', 'success');
        } catch (err: any) {
            addToast('Error during conversion: ' + err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const contactOptions = useMemo(() => contacts?.filter(c => c['Company Name'] === saleOrder['Company Name']).map(c => c.Name) || [], [contacts, saleOrder]);
    const quoteOptions = useMemo(() => quotations?.filter(q => q['Company Name'] === saleOrder['Company Name']).map(q => q['Quote No']) || [], [quotations, saleOrder]);
    const currencySymbol = getCurrencySymbol(saleOrder.Currency);

    const formatCurrency = (value: number) => {
        if (typeof value !== 'number' || isNaN(value)) return `${currencySymbol}0.00`;
        return `${currencySymbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handleDownloadPDF = () => {
        generatePDF({
            type: 'Sale Order',
            headerData: {
                ...saleOrder,
                'Sale Order ID': saleOrder['SO No'],
                'Order Date': saleOrder['SO Date'],
                'Delivery Date': saleOrder['Delivery Date'],
                'Company Name': saleOrder['Company Name'],
                'Company Address': companies?.find(c => c['Company Name'] === saleOrder['Company Name'])?.['Address (English)'] || '',
                'Contact Person': saleOrder['Contact Name'],
                'Contact Tel': saleOrder['Phone Number'],
                'Email': saleOrder.Email,
                'Payment Term': saleOrder['Payment Term'],
                'Bill Invoice': saleOrder['Bill Invoice'],
                '_isB2B': isB2B,
            },
            items: items.filter(item => item.no > 0 || item.isPromotion).map(item => ({
                no: item.no, itemCode: item.itemCode, modelName: item.modelName,
                description: item.description, qty: item.qty, unitPrice: item.unitPrice,
                amount: item.amount, commission: item.commission, isPromotion: item.isPromotion,
            })),
            totals: { subTotal: totals.subTotal, tax: totals.tax, grandTotal: totals.grandTotal },
            currency: saleOrder.Currency || 'USD',
            signaturePadding,
            labelPadding,
            columnWidths: colWidths,
            previewMode: false,
            filename: `SaleOrder_${saleOrder['SO No']}.pdf`
        });
    };

    const printableProps = {
        headerData: {
            'Sale Order ID': saleOrder['SO No'],
            'Order Date': saleOrder['SO Date'],
            'Delivery Date': saleOrder['Delivery Date'],
            'Company Name': saleOrder['Company Name'],
            'Company Address': companies?.find(c => c['Company Name'] === saleOrder['Company Name'])?.['Address (English)'] || '',
            'Contact Person': saleOrder['Contact Name'],
            'Contact Tel': saleOrder['Phone Number'],
            'Email': saleOrder.Email,
            'Payment Term': saleOrder['Payment Term'],
            'Bill Invoice': saleOrder['Bill Invoice'],
            'Remark': saleOrder['Remark'],
            'Terms and Conditions': saleOrder['Terms and Conditions'],
            'Install Software': saleOrder['Install Software'],
            'Prepared By': saleOrder['Prepared By'],
            'Prepared By Position': saleOrder['Prepared By Position'],
            'Approved By': saleOrder['Approved By'],
            'Approved By Position': saleOrder['Approved By Position'],
            '_isB2B': isB2B,
        },
        items: items.map(item => ({
            id: item.id, no: item.no, itemCode: item.itemCode, modelName: item.modelName,
            description: item.description, qty: item.qty, unitPrice: item.unitPrice,
            amount: item.amount, commission: item.commission, isPromotion: item.isPromotion,
        })),
        totals: { subTotal: totals.subTotal, tax: totals.tax, grandTotal: totals.grandTotal },
        currency: (saleOrder.Currency || 'USD') as 'USD' | 'KHR',
    };

    const headerRight = (
        <div className="flex items-center gap-2">
            <button
                onClick={handleViewQuote}
                disabled={!saleOrder['Quote No']}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <ScrollText className="w-4 h-4" />
                <span className="hidden lg:inline text-xs">View Quote</span>
            </button>
            <button
                onClick={handleConvertToInvoice}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-all shadow-sm disabled:opacity-40"
            >
                <Layout className="w-4 h-4" />
                <span className="hidden lg:inline text-xs">Convert to Invoice</span>
            </button>
            <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-all shadow-sm"
            >
                <Download className="w-4 h-4" />
                <span className="hidden lg:inline text-xs">Download PDF</span>
            </button>
            <ColumnWidthPopover
                docType="sale-order"
                widths={colWidths}
                onChange={setColWidths}
                onReset={resetColWidths}
            />
            <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-sm shadow-brand-500/20 disabled:bg-muted min-w-[110px] justify-center"
            >
                {isSubmitting ? <Spinner size="sm" color="white" /> : 'Save SO'}
            </button>
        </div>
    );

    return (
        <>
            <DocumentEditorContainer
                title={existingSaleOrder ? `Edit Sale Order: ${saleOrder['SO No']}` : 'New Sale Order'}
                onBack={onBack}
                onSave={handleSave}
                isSubmitting={isSubmitting}
                rightActions={headerRight}
                draftBadge={hasDraftState ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Unsaved draft
                        <button
                            type="button"
                            title="Discard draft and reload"
                            className="ml-0.5 text-amber-500/70 hover:text-rose-500 transition-colors leading-none"
                            onClick={() => {
                                clearDraft();
                                setHasDraftState(false);
                                hasDraft.current = false;
                            }}
                        >✕</button>
                    </span>
                ) : undefined}
            >
                <div className="h-full flex overflow-hidden">
                    {/* PDF Preview — left side */}
                    <PdfPreviewPane
                        docLabel={`${saleOrder['SO No'] || ''} • ${saleOrder['Company Name'] || 'No Company Selected'}`}
                        signaturePadding={signaturePadding}
                        onSignaturePaddingChange={setSignaturePadding}
                        defaultSignaturePadding={0}
                        labelPadding={labelPadding}
                        onLabelPaddingChange={setLabelPadding}
                        defaultLabelPadding={200}
                        columnWidths={colWidths}
                        pdfOptions={{
                            type: 'Sale Order',
                            headerData: {
                                ...saleOrder,
                                'Sale Order ID': saleOrder['SO No'],
                                'Order Date': saleOrder['SO Date'],
                                'Delivery Date': saleOrder['Delivery Date'],
                                'Company Name': saleOrder['Company Name'],
                                'Company Address': companies?.find(c => c['Company Name'] === saleOrder['Company Name'])?.['Address (English)'] || '',
                                'Contact Person': saleOrder['Contact Name'],
                                'Contact Tel': saleOrder['Phone Number'],
                                'Email': saleOrder.Email,
                                'Payment Term': saleOrder['Payment Term'],
                                'Bill Invoice': saleOrder['Bill Invoice'],
                                '_isB2B': isB2B,
                            },
                            items: items.filter(i => i.no > 0 || i.isPromotion).map(item => ({
                                no: item.no, itemCode: item.itemCode, modelName: item.modelName,
                                description: item.description, qty: item.qty, unitPrice: item.unitPrice,
                                amount: item.amount, commission: item.commission, isPromotion: item.isPromotion,
                            })),
                            totals: { subTotal: totals.subTotal, tax: totals.tax, grandTotal: totals.grandTotal },
                            currency: (saleOrder.Currency || 'USD') as 'USD' | 'KHR',
                        }}
                    />

                    {/* Form Sidebar — right side */}
                    <div className={`bg-card border-l border-border transition-all duration-300 flex flex-col flex-shrink-0 ${showFormPanel ? 'w-[480px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'}`}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-5 bg-brand-500 rounded-full" />
                                <h3 className="text-sm font-bold text-foreground">Sale Order Information</h3>
                            </div>
                            <button onClick={() => setShowFormPanel(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <ScrollArea className="flex-1 px-5 py-4">
                            <div className="space-y-6">

                                <FormSection title="Order Information">
                                    <FormInput label="SO Number" name="SO No" value={saleOrder['SO No'] || ''} onChange={handleHeaderChange} />
                                    <FormInput label="SO Date" name="SO Date" type="date" value={saleOrder['SO Date'] || ''} onChange={handleHeaderChange} />
                                    <FormInput label="Delivery Date" name="Delivery Date" type="date" value={saleOrder['Delivery Date'] || ''} onChange={handleHeaderChange} />
                                    <FormSelect label="Status" name="Status" value={saleOrder.Status || 'Pending'} onChange={handleHeaderChange} options={STATUS_OPTIONS} />
                                    <FormSelect label="Bill Invoice" name="Bill Invoice" value={saleOrder['Bill Invoice'] || 'VAT'} onChange={handleHeaderChange} options={BILL_INVOICE_OPTIONS} />
                                    <FormSelect label="Currency" name="Currency" value={saleOrder.Currency || 'USD'} onChange={handleHeaderChange} options={CURRENCY_OPTIONS} />
                                    <FormInput label="Payment Term" name="Payment Term" value={saleOrder['Payment Term'] || ''} onChange={handleHeaderChange} />
                                </FormSection>

                                <FormSection title="Customer Information">
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Company</label>
                                        <SearchableSelect
                                            options={companyOptions}
                                            value={saleOrder['Company Name'] || ''}
                                            onChange={handleCompanySelect}
                                            placeholder="Search company..."
                                        />
                                    </div>
                                    <FormInput label="Company Address" name="Company Address" value={saleOrder['Company Address'] || ''} onChange={handleHeaderChange} />
                                    <div className="md:col-span-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Contact Person</label>
                                        <SearchableSelect
                                            options={contactOptions}
                                            value={saleOrder['Contact Name'] || ''}
                                            onChange={handleContactChange}
                                            disabled={!saleOrder['Company Name']}
                                            placeholder={saleOrder['Company Name'] ? 'Search or type contact...' : 'Select a company first'}
                                            allowCustomValue
                                        />
                                    </div>
                                    <FormInput label="Phone" name="Phone Number" value={saleOrder['Phone Number'] || ''} onChange={handleHeaderChange} />
                                    <FormInput label="Email" name="Email" type="email" value={saleOrder.Email || ''} onChange={handleHeaderChange} />
                                </FormSection>

                                <FormSection title="Quote Reference">
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Linked Quotation</label>
                                        <select
                                            name="Quote No"
                                            value={saleOrder['Quote No'] || ''}
                                            onChange={handleQuoteChange}
                                            disabled={isFromQuote}
                                            className="w-full text-sm p-2.5 bg-input border border-border rounded-md focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-foreground disabled:opacity-50"
                                        >
                                            <option value="">-- None --</option>
                                            {quoteOptions.map(q => <option key={q} value={q}>{q}</option>)}
                                        </select>
                                    </div>
                                </FormSection>

                                <FormSection title="Prepared By">
                                    <FormInput label="Name" name="Prepared By" value={saleOrder['Prepared By'] || ''} onChange={handleHeaderChange} />
                                    <FormInput label="Position / Contact" name="Prepared By Position" value={saleOrder['Prepared By Position'] || ''} onChange={handleHeaderChange} />
                                    <FormInput label="Approved By" name="Approved By" value={saleOrder['Approved By'] || ''} onChange={handleHeaderChange} />
                                    <FormInput label="Approved Position" name="Approved By Position" value={saleOrder['Approved By Position'] || ''} onChange={handleHeaderChange} />
                                </FormSection>

                                <FormSection title="Software Setup">
                                    <div className="md:col-span-2">
                                        <div className="flex gap-2 mb-3">
                                            <input
                                                type="text"
                                                placeholder="Add custom software..."
                                                className="flex-1 text-sm p-2 bg-input border border-border rounded-md focus:ring-1 focus:ring-brand-500 text-foreground"
                                                id="custom-software-input"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const input = document.getElementById('custom-software-input') as HTMLInputElement;
                                                    if (input && input.value.trim()) { handleAddSoftware(input.value.trim()); input.value = ''; }
                                                }}
                                                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-md text-sm font-semibold border border-border transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[...new Set([...SOFTWARE_OPTIONS, ...selectedSoftware])].sort().map(option => (
                                                <label key={option} className={`flex items-center gap-2 cursor-pointer p-2 rounded-md border transition-all ${selectedSoftware.includes(option) ? 'bg-brand-500/10 border-brand-500/30' : 'hover:bg-muted border-transparent hover:border-border'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSoftware.includes(option)}
                                                        onChange={(e) => { if (e.target.checked) { handleAddSoftware(option); } else { handleRemoveSoftware(option); } }}
                                                        className="rounded border-border text-brand-600 focus:ring-brand-500"
                                                    />
                                                    <span className={`text-sm ${selectedSoftware.includes(option) ? 'text-brand-500 font-medium' : 'text-foreground'}`}>{option}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </FormSection>

                                <FormSection title="Attachment">
                                    <div className="md:col-span-2">
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                        {isUploading ? (
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground p-4 rounded-xl bg-muted border-2 border-dashed border-border">
                                                <Spinner size="sm" /><span className="font-bold">Uploading...</span>
                                            </div>
                                        ) : saleOrder['Attachment'] ? (
                                            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                                <a href={saleOrder['Attachment']} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-500 hover:underline truncate max-w-[200px]">View Uploaded File</a>
                                                <button type="button" onClick={handleRemoveFile} className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full text-center p-4 bg-muted hover:bg-muted/80 text-muted-foreground font-bold rounded-xl border-2 border-dashed border-border hover:border-muted-foreground/40 transition-all flex flex-col items-center gap-2">
                                                <Upload className="w-5 h-5 text-muted-foreground/50" />
                                                <span className="text-[10px] uppercase tracking-widest">Click to Upload File</span>
                                            </button>
                                        )}
                                    </div>
                                </FormSection>

                                <div className="bg-card p-4 rounded-xl border border-border shadow-sm dark:shadow-none">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-4">Line Items</h3>
                                    {itemsLoading ? (
                                        <div className="text-center p-8"><Spinner /></div>
                                    ) : (
                                        <div className="space-y-4">
                                            {items.map((item) => {
                                                const isDescriptionRow = item.no === 0 && !item.isPromotion;
                                                const isPromoRow = !!item.isPromotion;
                                                return (
                                                    <div key={item.id} className={`relative p-4 rounded-xl border shadow-sm transition-all hover:shadow-md group ${isPromoRow ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60' : 'bg-muted/30 border-border hover:border-brand-500/50'}`}>
                                                        <button type="button" onClick={() => removeItem(item.id)} className="absolute top-3 right-3 text-muted-foreground/50 hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all z-10" title="Remove Item">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>

                                                        {isPromoRow ? (
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                                    <span className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400">Cashback / Promotion</span>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Promotion Terms</label>
                                                                        <textarea
                                                                            value={item.description}
                                                                            onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                                            className="w-full text-sm p-3 rounded-lg border border-amber-500/30 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all bg-input text-foreground placeholder:text-muted-foreground/50 resize-none"
                                                                            rows={2}
                                                                            placeholder={"e.g. Buy 10-29pcs get cash back $40\nPeriod: 01st - 30th June 2026"}
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center gap-3 flex-wrap">
                                                                        <div>
                                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Qty</label>
                                                                            <input
                                                                                type="number"
                                                                                step="1"
                                                                                min="1"
                                                                                value={item.qty || ''}
                                                                                onChange={e => handleItemChange(item.id, 'qty', e.target.value)}
                                                                                className="w-24 h-9 px-3 text-center text-sm border border-amber-500/30 rounded-lg bg-input text-amber-600 dark:text-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                                                                placeholder="0"
                                                                            />
                                                                        </div>
                                                                        <span className="text-muted-foreground/40 text-lg pt-5">×</span>
                                                                        <div>
                                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Per Unit ($)</label>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                min="0"
                                                                                value={item.unitPrice || ''}
                                                                                onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value)}
                                                                                className="w-32 h-9 px-3 text-right text-sm border border-amber-500/30 rounded-lg bg-input text-foreground focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                                                                placeholder="0.00"
                                                                            />
                                                                        </div>
                                                                        <span className="text-muted-foreground/40 text-lg pt-5">=</span>
                                                                        <div>
                                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Total Cashback</label>
                                                                            <div className="h-9 flex items-center px-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 font-semibold text-sm min-w-[100px] justify-end">
                                                                                ({Math.abs(item.amount).toFixed(2)})
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-xs font-semibold text-rose-500 pt-5">deducted from total</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : isDescriptionRow ? (
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Note / Description</label>
                                                                <textarea
                                                                    value={item.description}
                                                                    onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                                    className="w-full text-sm p-3 rounded-lg border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all bg-input text-foreground placeholder:text-muted-foreground/50 resize-none"
                                                                    rows={2}
                                                                    placeholder="Add clear note..."
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex flex-wrap gap-3 pr-8 mb-3">
                                                                    <div className="w-10">
                                                                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block text-center">No.</label>
                                                                        <div className="h-9 flex items-center justify-center bg-card rounded-lg border border-border font-mono text-sm font-semibold text-foreground">{item.no}</div>
                                                                    </div>
                                                                    <div className="flex-1 min-w-[140px]">
                                                                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Item Code</label>
                                                                        <PricelistCombobox item={item} onItemChange={handleItemChange} onPricelistItemSelect={handlePricelistItemSelect} />
                                                                    </div>
                                                                    <div className="flex-[1.5] min-w-[160px]">
                                                                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Model</label>
                                                                        <input type="text" value={item.modelName} onChange={e => handleItemChange(item.id, 'modelName', e.target.value)} className="w-full h-9 px-3 text-sm font-medium border border-border rounded-lg bg-input text-foreground focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 hover:border-muted-foreground/40 transition-all" />
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap gap-3 mb-3">
                                                                    <div className="w-20">
                                                                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Qty</label>
                                                                        <input type="number" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', e.target.value)} className="w-full h-9 px-2 text-center text-sm border border-border rounded-lg bg-input text-foreground focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 hover:border-muted-foreground/40 transition-colors" />
                                                                    </div>
                                                                    <div className="w-28">
                                                                        <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Unit Price</label>
                                                                        <input type="number" step="0.01" value={item.unitPrice} onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value)} className="w-full h-9 px-2 text-right text-sm border border-border rounded-lg bg-input text-foreground focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 hover:border-muted-foreground/40 transition-colors" />
                                                                    </div>
                                                                    <div className="flex-1 text-right pt-4">
                                                                        <div className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-0.5">Total Amount</div>
                                                                        {(() => {
                                                                            const sym = saleOrder.Currency === 'KHR' ? '៛' : '$';
                                                                            return <div className="text-lg font-bold text-foreground">{sym}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>;
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
                                                                                <button key={bt.label} type="button" onClick={() => applyBullet(item.id, bt.char)} className="px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground hover:bg-card hover:text-brand-500 rounded transition-all">
                                                                                    {bt.label === 'None' ? 'None' : bt.char.trim() || '∅'}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <textarea
                                                                        value={item.description}
                                                                        onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                                        className="w-full text-sm p-3 rounded-lg border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all bg-input text-foreground placeholder:text-muted-foreground/50 resize-y min-h-[80px]"
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
                                                <button type="button" onClick={addPromoRow} className="flex-1 py-2.5 rounded-lg border border-dashed border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                                                    <span>+ Add Cashback</span>
                                                </button>
                                            </div>

                                            <div className="bg-muted/30 rounded-xl p-5 border border-border mt-6 space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground font-medium">Sub Total</span>
                                                    <span className="text-foreground font-semibold">{formatCurrency(totals.subTotal)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground font-medium">Tax</span>
                                                    <span className="text-foreground font-semibold">{formatCurrency(totals.tax)}</span>
                                                </div>
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
                />
            )}


        </>
    );
};

export default SaleOrderCreator;
