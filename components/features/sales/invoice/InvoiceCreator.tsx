'use client';


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Invoice, SaleOrder } from "../../../../types";
import { useData } from "../../../../contexts/DataContext";
import { useAuth } from "../../../../contexts/AuthContext";
import { createRecord, updateRecord, uploadFile, generateInvNo } from "../../../../services/api";
import { autoPostInvoiceJournal, autoPostDepositReceiptJournal, normalizeBrand } from "../../../../services/accountingApi";
import { supabase } from "../../../../lib/supabase";
import { formatToSheetDate, formatToInputDate, calcDueDate } from "../../../../utils/time";
import PrintableInvoice from "../../../pdf/PrintableInvoice";
import SuccessModal from "../../../modals/SuccessModal";
import Spinner from "../../../common/Spinner";
import DocumentEditorContainer from "../../../layout/DocumentEditorContainer";
import { FileText, Download, PanelRight } from 'lucide-react';
import { generatePDF } from "../../../../lib/pdfClient";
import { useColumnWidths } from "@/hooks/useColumnWidths";
import { ColumnWidthPopover } from "../ColumnWidthPopover";
import { readFormDraft, useFormDraft } from "../../../../hooks/useFormDraft";
import { useToast } from "../../../../contexts/ToastContext";

interface InvoiceCreatorProps {
    onBack: () => void;
    existingInvoice: Invoice | null;
    initialData?: {
        action: string;
        soData?: SaleOrder;
        duplicateOf?: Invoice;
    };
}

import { LineItem } from "./types";
import { InvoicePreview } from "./InvoicePreview";
import { InvoiceForm } from "./InvoiceForm";



const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const STATUS_OPTIONS: Invoice['Status'][] = ['Draft', 'Processing', 'Completed', 'Cancel'];
const TAXABLE_OPTIONS = ['VAT', 'NON-VAT', 'Commercial Invoice'];
const CURRENCY_OPTIONS: ('USD' | 'KHR')[] = ['USD', 'KHR'];

const getCurrencySymbol = (currency?: 'USD' | 'KHR'): string => {
    switch (currency) {
        case 'USD': return '$';
        case 'KHR': return '៛';
        default: return '$';
    }
};

const InvoiceCreator: React.FC<InvoiceCreatorProps> = ({ onBack, existingInvoice, initialData }) => {
    const { invoices, setInvoices, companies, contacts, saleOrders, pricelist, refetchModule, setSerialNumbers } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successInfo, setSuccessInfo] = useState<{ invNo: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const draftKey = existingInvoice ? `inv-edit-${existingInvoice['Inv No']}` : 'inv-new';
    const draft = useRef(readFormDraft<{ invoice: Partial<Invoice & { [key: string]: any }>; items: LineItem[] }>(draftKey)).current;
    const hasDraft = useRef(!!draft);
    const submitted = useRef(false);
    const [hasDraftState, setHasDraftState] = useState(!!draft);
    const { save: saveDraft, clear: clearDraft } = useFormDraft(draftKey);
    const autoSavedFromSORef = useRef(false);

    const [items, setItems] = useState<LineItem[]>(() => draft?.items ?? [{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]);

    const [invoice, setInvoice] = useState<Partial<Invoice & { [key: string]: any }>>(() => draft?.invoice ?? {});

    const [showFormPanel, setShowFormPanel] = useState(true);
    const [signaturePadding, setSignaturePadding] = useState(0);
    const [labelPadding, setLabelPadding] = useState(200);
    const [hideKhmer, setHideKhmer] = useState(false);
    const [colWidths, setColWidths, resetColWidths] = useColumnWidths('invoice');

    // Next invoice number — fetched async from BOTH b2c+b2b tables so the
    // sequence is globally unique regardless of which mode the user is in.
    const [nextInvNo, setNextInvNo] = useState('');
    useEffect(() => {
        if (existingInvoice) return;
        const taxable: string = initialData?.soData?.['Bill Invoice'] || initialData?.duplicateOf?.['Taxable'] || 'VAT';
        generateInvNo(taxable).then(setNextInvNo).catch(() => {
            // Fallback: derive from current-mode cache if the DB query fails
            const year = new Date().getFullYear().toString();
            let prefix = `INV${year}-`;
            if (taxable === 'VAT') prefix = `TI${year}-`;
            else if (taxable === 'Commercial Invoice') prefix = `CI${year}-`;
            const filtered = (invoices || []).filter(i => (i as any)['Inv No']?.startsWith(prefix));
            const max = filtered.reduce((m, i) => {
                const n = parseInt((i as any)['Inv No'].slice(prefix.length), 10);
                return isNaN(n) ? m : Math.max(m, n);
            }, 1);
            setNextInvNo(`${prefix}${String(max + 1).padStart(5, '0')}`);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [existingInvoice, initialData]);

    useEffect(() => {
        if (hasDraft.current) return;
        if (existingInvoice) {
            const loadedInvDate = existingInvoice['Inv Date'] ? formatToInputDate(existingInvoice['Inv Date']) : getTodayDateString();
            // Backfill Due Date for older/edited invoices that have a Payment
            // Term with credit days but were saved before Due Date existed.
            const loadedDueDate = existingInvoice['Due Date']
                ? formatToInputDate(existingInvoice['Due Date'])
                : calcDueDate(loadedInvDate, existingInvoice['Payment Term']);
            setInvoice({
                ...existingInvoice,
                'Inv Date': loadedInvDate,
                'Due Date': loadedDueDate,
            });

            let fetchedItems = [];
            if (typeof existingInvoice.ItemsJSON === 'string') {
                try { fetchedItems = JSON.parse(existingInvoice.ItemsJSON); } catch { }
            } else {
                fetchedItems = existingInvoice.ItemsJSON || [];
            }
            if (fetchedItems.length > 0) setItems(fetchedItems);
        } else if (initialData?.soData) {
            const so = initialData.soData;
            const company = companies?.find(c => c['Company Name'] === so['Company Name']);
            const invDate = getTodayDateString();
            const dueDate = calcDueDate(invDate, so['Payment Term']);

            setInvoice({
                'Inv No': nextInvNo,
                'Inv Date': invDate,
                'SO No': so['SO No'],
                'Company Name': so['Company Name'],
                'Contact Name': so['Contact Name'],
                'Phone Number': so['Phone Number'],
                'Email': so.Email,
                'Amount': so['Total Amount'],
                'Taxable': so['Bill Invoice'] || 'NON-VAT',
                'Status': 'Processing',
                'Currency': so.Currency || 'USD',
                'Payment Term': so['Payment Term'],
                'Due Date': dueDate,
                'Company Address': company?.['Address (English)'] || '',
                'Tin No': company?.['Tin No'] || company?.['Patent'] || '',
            });

            let soItems = [];
            if (typeof so.ItemsJSON === 'string') {
                try { soItems = JSON.parse(so.ItemsJSON); } catch { }
            } else {
                soItems = so.ItemsJSON || [];
            }
            if (soItems.length > 0) {
                setItems(soItems.map((item: any) => ({
                    ...item,
                    id: item.id || `item-${Math.random()}`
                })));
            }
        } else if (initialData?.duplicateOf) {
            const src = initialData.duplicateOf;
            const invDate = getTodayDateString();
            const dueDate = calcDueDate(invDate, src['Payment Term']);

            const {
                'Inv No': _srcInvNo,
                'Created By': _srcCreatedBy,
                'Attachment': _srcAttachment,
                'created_at': _srcCreatedAt,
                'updated_at': _srcUpdatedAt,
                ...rest
            } = src;

            setInvoice({
                ...rest,
                'Inv No': nextInvNo,
                'Inv Date': invDate,
                'Due Date': dueDate,
                'Status': 'Draft',
            });

            let srcItems = [];
            if (typeof src.ItemsJSON === 'string') {
                try { srcItems = JSON.parse(src.ItemsJSON); } catch { }
            } else {
                srcItems = src.ItemsJSON || [];
            }
            if (srcItems.length > 0) {
                setItems(srcItems.map((item: any) => ({
                    ...item,
                    id: `item-${Math.random()}`
                })));
            }
        } else {
            setInvoice(prev => {
                if (Object.keys(prev).length > 0 && prev['Inv No']) return prev;
                return {
                    'Inv No': nextInvNo,
                    'Inv Date': getTodayDateString(),
                    'Status': 'Draft',
                    'Currency': 'USD',
                    'Taxable': 'VAT',
                };
            });
        }
    }, [existingInvoice, initialData, nextInvNo]);

    useEffect(() => {
        if (!invoice['Inv No']) return;
        if (submitted.current) return;
        saveDraft({ invoice, items });
        setHasDraftState(true);
    }, [invoice, items, saveDraft]);

    const totals = useMemo(() => {
        const subTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const isTaxable = invoice.Taxable === 'VAT';
        const tax = isTaxable ? subTotal * 0.1 : 0;
        const grandTotal = subTotal + tax;
        return { subTotal, tax, grandTotal };
    }, [items, invoice.Taxable]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setInvoice(prev => {
            const updated = { ...prev, [name]: value };
            // Recalculate Due Date whenever Inv Date or Payment Term changes
            if (name === 'Inv Date' || name === 'Payment Term') {
                const invDate = name === 'Inv Date' ? value : prev['Inv Date'];
                const paymentTerm = name === 'Payment Term' ? value : prev['Payment Term'];
                const dueDate = calcDueDate(invDate, paymentTerm);
                if (dueDate) updated['Due Date'] = dueDate;
            }
            return updated;
        });
        // When Taxable type changes on a new invoice, re-fetch the global next number
        // so the prefix (TI / INV / CI) stays unique across B2C and B2B.
        if (name === 'Taxable' && !existingInvoice) {
            generateInvNo(value)
                .then(newNo => setInvoice(prev => ({ ...prev, 'Inv No': newNo })))
                .catch(() => {/* keep current number if query fails */});
        }
    };

    const handleCompanySelect = (companyName: string) => {
        const company = companies?.find(c => c['Company Name'] === companyName);
        const contact = contacts?.find(c => c['Company Name'] === companyName);

        if (company) {
            setInvoice(prev => {
                const paymentTerm = company['Payment Term'] || prev['Payment Term'];
                const invDate = prev['Inv Date'];
                const dueDate = calcDueDate(invDate, paymentTerm);
                return {
                    ...prev,
                    'Company Name': companyName,
                    'Company Name (Khmer)': company['Company Name (Khmer)'] || '',
                    'Payment Term': paymentTerm,
                    'Company Address': company['Address (English)'] || '',
                    'Fax': company['Fax'] || prev['Fax'],
                    'Phone Number': company['Phone Number'] || (contact ? contact['Phone Number'] : prev['Phone Number']),
                    'Email': company['Email'] || (contact ? contact.Email : prev.Email),
                    'Contact Name': contact ? contact.Name : prev['Contact Name'],
                    'Tin No': company['Tin No'] || company['Patent'] || prev['Tin No'],
                    ...(dueDate ? { 'Due Date': dueDate } : {}),
                };
            });
        } else {
            setInvoice(prev => ({ ...prev, 'Company Name': companyName }));
        }
    };

    const handleSOSelect = (soNo: string) => {
        const so = saleOrders?.find(s => s['SO No'] === soNo);
        if (so) {
            setInvoice(prev => {
                const paymentTerm = so['Payment Term'] || prev['Payment Term'];
                const dueDate = calcDueDate(prev['Inv Date'], paymentTerm);
                return {
                    ...prev,
                    'SO No': soNo,
                    'Company Name': so['Company Name'] || prev['Company Name'],
                    'Contact Name': so['Contact Name'] || prev['Contact Name'],
                    'Phone Number': so['Phone Number'] || prev['Phone Number'],
                    'Email': so.Email || prev.Email,
                    'Taxable': so['Bill Invoice'] || 'NON-VAT',
                    'Currency': so.Currency || prev.Currency,
                    'Payment Term': paymentTerm,
                    'Company Address': companies?.find(c => c['Company Name'] === so['Company Name'])?.['Address (English)'] || prev['Company Address'],
                    ...(dueDate ? { 'Due Date': dueDate } : {}),
                };
            });

            let soItems = [];
            if (typeof so.ItemsJSON === 'string') {
                try { soItems = JSON.parse(so.ItemsJSON); } catch { }
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
            setInvoice(prev => ({ ...prev, 'SO No': soNo }));
        }
    };

    const handlePricelistItemSelect = (item: LineItem, p: any) => {
        setItems(prev => prev.map(i => i.id === item.id ? {
            ...i,
            itemCode: p['Code'] || p['Item Code'] || '',
            modelName: p.Model || '',
            description: p['Description'] || p.Specification || '',
            unitPrice: p['Selling Price (Include VAT)'] || 0,
            amount: (Number(p['Selling Price (Include VAT)']) || 0) * (Number(i.qty) || 0),
            brand: p.Brand || '',
        } : i));
    };

    const renumberItems = (list: LineItem[]): LineItem[] => {
        let num = 0;
        return list.map(item => {
            if (item.isPromotion) return { ...item, no: 0 };
            num++;
            return { ...item, no: num };
        });
    };

    const handleItemChange = (id: string, field: keyof Omit<LineItem, 'id' | 'amount' | 'no'>, value: string | number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const newItem = { ...item, [field]: value };
                if (!newItem.isPromotion) {
                    newItem.amount = (Number(newItem.qty) || 0) * (Number(newItem.unitPrice) || 0);
                }
                return newItem;
            }
            return item;
        }));
    };

    const handlePromoAmountChange = (id: string, value: string) => {
        const abs = Math.abs(parseFloat(value) || 0);
        setItems(prev => prev.map(item => item.id === id ? { ...item, amount: -abs } : item));
    };

    const addItem = () => {
        setItems(prev => renumberItems([...prev, { id: `item-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]));
    };

    const removeItem = (id: string) => {
        if (items.length === 1) return;
        setItems(prev => renumberItems(prev.filter(item => item.id !== id)));
    };

    const addPromoRow = () => {
        setItems(prev => [...prev, { id: `promo-${Date.now()}`, no: 0, itemCode: '', modelName: '', description: '', qty: 0, unitPrice: 0, amount: 0, isPromotion: true }]);
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
        if (!invoice['Inv No'] || !invoice['Company Name']) {
            addToast('Please fill in Invoice No. and Company Name', 'error');
            return;
        }

        setIsSubmitting(true);

        try {
            const toNum = (v: any) => {
                if (v === '' || v === null || v === undefined) return null;
                const n = Number(v);
                return isNaN(n) ? null : n;
            };

            const addMonths = (dateStr: string, months: number): string => {
                const d = new Date(dateStr + 'T00:00:00');
                d.setMonth(d.getMonth() + months);
                return d.toISOString().slice(0, 10);
            };

            const payload = {
                ...invoice,
                'SO No': invoice['SO No'] || null,
                'Inv Date': invoice['Inv Date'] ? formatToSheetDate(invoice['Inv Date']) : null,
                'Due Date': invoice['Due Date'] ? formatToSheetDate(invoice['Due Date']) : null,
                'Amount': totals.grandTotal,
                'Deposit': toNum(invoice['Deposit']),
                'Exchange Rate': toNum(invoice['Exchange Rate']),
                'ItemsJSON': items,
                'Created By': invoice['Created By'] || currentUser?.Name || '',
            };

            // ── When Invoice is issued (Draft → non-Draft): deduct inventory qty ──
            // Mirrors the deduction in DeliveryOrderCreator (DO Status === 'Delivered'),
            // but keyed off the Invoice's Draft → issued transition since not every
            // sale gets a Delivery Order. Only fires once, on the transition, so
            // re-saving an already-issued invoice doesn't deduct twice.
            const wasDraft = !existingInvoice || existingInvoice['Status'] === 'Draft';
            const isNowIssued = invoice['Status'] !== 'Draft';
            let deductedInventory = false;
            let syncedSerials = false;

            // Sum cashback/promo deductions (negative amounts) for 14400 DR line

            // Sum cashback/promo deductions (negative amounts) for 14400 DR line
            const cashbackTotal = items
                .filter(item => item.isPromotion)
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            if (existingInvoice) {
                await updateRecord('Invoices', existingInvoice['Inv No'], payload);
                setInvoices(current => current ? current.map(inv => inv['Inv No'] === invoice['Inv No'] ? (payload as unknown as Invoice) : inv) : [payload as unknown as Invoice]);
            } else {
                await createRecord('Invoices', payload);
                setInvoices(current => current ? [payload as unknown as Invoice, ...current] : [payload as unknown as Invoice]);

                // JE is posted below (line 632) with full COGS — do not post here.
            }

            if (wasDraft && isNowIssued) {
                // For each line item, find the matching in-stock inventory lot
                // (oldest first / FIFO) and deduct its qty. Prefer an exact match
                // on inventory.code, falling back to a fuzzy model_name match for
                // legacy rows. Also sync any captured serial number(s) into the
                // serial_numbers table, linked to the matched inventory row, so
                // warranty tracking stays in sync with what's sold. Non-fatal:
                // if nothing matches / nothing to sync, skip silently.
                const brandMap = new Map((pricelist ?? []).map(p => [p['Code'], p['Brand']]));
                const warrantyStart = invoice['Inv Date'] || getTodayDateString();
                const warrantyEnd = addMonths(warrantyStart, 12);

                const costItems: { brand: string; qty: number; unit_price: number }[] = [];
                const brandTotals: Record<string, number> = {};
                const conflictSerials: { serial: string; soNo: string }[] = [];

                try {
                    for (const item of items) {
                        if (item.isPromotion) continue;
                        const qty = Number(item.qty) || 0;
                        if (qty <= 0) continue;
                        const code  = item.itemCode?.trim();
                        const model = item.modelName?.trim();

                        let matchedInvId: string | null = null;
                        let matchedInvBrand: string | null = null;

                        if (code || model) {
                            let invRows: any[] | null = null;

                            if (code) {
                                const { data } = await supabase
                                    .from('inventory')
                                    .select('id, qty, unit_price, brand')
                                    .eq('status', 'In Stock')
                                    .gt('qty', 0)
                                    .eq('code', code)
                                    .order('created_at', { ascending: true })
                                    .limit(1);
                                invRows = data;
                            }

                            if ((!invRows || invRows.length === 0) && model) {
                                const { data } = await supabase
                                    .from('inventory')
                                    .select('id, qty, unit_price, brand')
                                    .eq('status', 'In Stock')
                                    .gt('qty', 0)
                                    .ilike('model_name', `%${model}%`)
                                    .order('created_at', { ascending: true })
                                    .limit(1);
                                invRows = data;
                            }

                            if (invRows && invRows.length > 0) {
                                const inv = invRows[0];
                                const newQty = Math.max(0, Number(inv.qty) - qty);
                                await supabase
                                    .from('inventory')
                                    .update({
                                        qty:    newQty,
                                        status: newQty <= 0 ? 'Out of Stock' : 'In Stock',
                                    })
                                    .eq('id', inv.id);
                                deductedInventory = true;
                                matchedInvId = inv.id;
                                matchedInvBrand = inv.brand?.trim() || null;

                                // Brand resolved with inventory fallback — used for BOTH COGS and revenue
                                const resolvedBrand = normalizeBrand((code && brandMap.get(code)) || inv.brand?.trim() || 'Other Accessories');
                                const unitCost = Number(inv.unit_price) || 0;
                                if (unitCost > 0) {
                                    costItems.push({ brand: resolvedBrand, qty, unit_price: unitCost });
                                }
                                // Accumulate revenue total under same brand as COGS
                                brandTotals[resolvedBrand] = (brandTotals[resolvedBrand] ?? 0) + (Number(item.amount) || 0);
                            } else {
                                // No inventory match — use pricelist brand only (no inventory fallback available)
                                const plBrand = normalizeBrand((code && brandMap.get(code)) || 'Other Accessories');
                                brandTotals[plBrand] = (brandTotals[plBrand] ?? 0) + (Number(item.amount) || 0);
                            }
                        } else {
                            // No code/model — fall through as Other Accessories revenue
                            brandTotals['Other Accessories'] = (brandTotals['Other Accessories'] ?? 0) + (Number(item.amount) || 0);
                        }

                        const serials = (item.serialNumber || '')
                            .split('\n')
                            .map(s => s.trim())
                            .filter(s => s.length > 0);

                        for (const sn of serials) {
                            const { data: existingSN } = await supabase
                                .from('serial_numbers')
                                .select('id, stock_status, so_no')
                                .eq('serial_number', sn)
                                .limit(1);

                            if (existingSN && existingSN.length > 0) {
                                const existingRow = existingSN[0];
                                const soNo = invoice['SO No'] || '';

                                // Already sold to a different SO — don't silently reassign
                                // the unit to this sale; flag it for the user instead.
                                if (existingRow.stock_status === 'Sold' && existingRow.so_no && existingRow.so_no !== soNo) {
                                    conflictSerials.push({ serial: sn, soNo: existingRow.so_no });
                                    continue;
                                }

                                // Row already exists (e.g. seeded at PO intake) — update it
                                // with this sale's customer/warranty info instead of skipping,
                                // so the lifecycle transitions from "in stock" to "sold".
                                const { data: updatedSN, error: updErr } = await supabase
                                    .from('serial_numbers')
                                    .update({
                                        brand: (code && brandMap.get(code)) || matchedInvBrand || '',
                                        model_name: item.modelName || '',
                                        description: item.description || '',
                                        inventory_id: matchedInvId,
                                        so_no: soNo,
                                        company_name: invoice['Company Name'] || '',
                                        contact_name: invoice['Contact Name'] || '',
                                        warranty_start_date: warrantyStart,
                                        warranty_period_months: 12,
                                        warranty_end_date: warrantyEnd,
                                        status: 'Active',
                                        stock_status: 'Sold',
                                    })
                                    .eq('id', existingRow.id)
                                    .select()
                                    .single();

                                if (!updErr && updatedSN) {
                                    setSerialNumbers(prev => prev ? prev.map(s => s.id === updatedSN.id ? updatedSN : s) : [updatedSN]);
                                    syncedSerials = true;
                                }
                                continue;
                            }

                            const { data: newSN, error: snErr } = await supabase
                                .from('serial_numbers')
                                .insert({
                                    serial_number: sn,
                                    brand: (code && brandMap.get(code)) || matchedInvBrand || '',
                                    model_name: item.modelName || '',
                                    description: item.description || '',
                                    inventory_id: matchedInvId,
                                    so_no: invoice['SO No'] || '',
                                    company_name: invoice['Company Name'] || '',
                                    contact_name: invoice['Contact Name'] || '',
                                    warranty_start_date: warrantyStart,
                                    warranty_period_months: 12,
                                    warranty_end_date: warrantyEnd,
                                    status: 'Active',
                                    stock_status: 'Sold',
                                    created_by: currentUser?.Name || '',
                                })
                                .select()
                                .single();

                            if (!snErr && newSN) {
                                setSerialNumbers(prev => prev ? [newSN, ...prev] : [newSN]);
                                syncedSerials = true;
                            }
                        }
                    }
                } catch (invErr: any) {
                    console.warn('[InvoiceCreator] inventory/serial sync failed:', invErr.message);
                }

                if (conflictSerials.length > 0) {
                    const list = conflictSerials.map(c => `${c.serial} (sold on ${c.soNo})`).join(', ');
                    addToast(`Skipped already-sold serial number(s): ${list}`, 'error');
                }

                // Auto-post deposit receipt JE first so COA 25000 gets its credit
                // before the invoice application line debits it.
                const depositAmt = toNum(invoice['Deposit']);
                if (depositAmt > 0.005) {
                    autoPostDepositReceiptJournal({
                        invNo:         invoice['Inv No']!,
                        depositAmount: depositAmt,
                        isVAT:         invoice['Taxable'] === 'VAT',
                        entryDate:     invoice['Inv Date'] || getTodayDateString(),
                        createdBy:     currentUser?.Name || 'system',
                    }).catch(err => console.warn('[InvoiceCreator] deposit receipt journal failed:', err));
                }

                // Auto-post invoice journal with COGS after inventory loop
                // (idempotent — safe for both new invoices and Draft → Issued updates)
                autoPostInvoiceJournal({
                    invNo:         invoice['Inv No']!,
                    entryDate:     invoice['Inv Date'] || getTodayDateString(),
                    grandTotal:    totals.grandTotal,
                    taxAmount:     totals.tax,
                    isVAT:         invoice['Taxable'] === 'VAT',
                    createdBy:     currentUser?.Name || 'system',
                    brandAmounts:  Object.entries(brandTotals).map(([brand, subtotal]) => ({ brand, subtotal })).filter(b => b.subtotal > 0.005),
                    cashbackTotal: cashbackTotal !== 0 ? cashbackTotal : undefined,
                    costItems:     costItems.length > 0 ? costItems : undefined,
                    depositAmount: depositAmt > 0.005 ? depositAmt : undefined,
                }).catch(err => console.warn('[InvoiceCreator] auto-post journal failed:', err));
            }

            refetchModule('Invoices');
            if (deductedInventory) refetchModule('Inventory');
            if (syncedSerials) refetchModule('Serial Numbers');

            submitted.current = true;
            clearDraft();
            setHasDraftState(false);
            setSuccessInfo({ invNo: invoice['Inv No'] });
        } catch (err: any) {
            addToast(err.message || 'Failed to save invoice', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Auto-save when navigated here via "Convert to Invoice" from a Sale Order.
    // Fires once after nextInvNo resolves and the form is fully populated.
    useEffect(() => {
        if (!initialData?.soData) return;
        if (!invoice['Inv No'] || !invoice['Company Name']) return;
        if (autoSavedFromSORef.current) return;
        autoSavedFromSORef.current = true;
        handleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoice['Inv No'], invoice['Company Name']]);

    const handleDownloadPDF = () => {
        const taxable = invoice['Taxable'] || 'NON-VAT';

        let pdfType: 'Tax Invoice' | 'Invoice' | 'Commercial Invoice';
        let filePrefix = 'Invoice';

        if (taxable === 'VAT') {
            pdfType = 'Tax Invoice';
            filePrefix = 'TaxInvoice';
        } else if (taxable === 'Commercial Invoice') {
            pdfType = 'Commercial Invoice';
            filePrefix = 'CommercialInvoice';
        } else {
            pdfType = 'Invoice';
            filePrefix = 'Invoice';
        }

        generatePDF({
            type: pdfType as any,
            headerData: {
                ...invoice,
                'Company Name': invoice['Company Name'],
                'Company Name (Khmer)': invoice['Company Name (Khmer)'] || companies?.find(c => c['Company Name'] === invoice['Company Name'])?.['Company Name (Khmer)'] || '',
                'Company Address': invoice['Company Address'] || companies?.find(c => c['Company Name'] === invoice['Company Name'])?.['Address (English)'] || '',
                'Contact Name': invoice['Contact Name'],
                'Phone Number': invoice['Phone Number'],
                'Email': invoice['Email'],
                'Payment Term': invoice['Payment Term'],
                'Tin No.': invoice['Tin No'],
                'Tin No': invoice['Tin No'],
                'SO No.': invoice['SO No'],
                'SO No': invoice['SO No'],
                'Inv Date': invoice['Inv Date'],
                'Inv No.': invoice['Inv No'],
                'Inv No': invoice['Inv No'],
                'Invoice No': invoice['Inv No'],
                'Due Date': invoice['Due Date'] || '',
                'Deposit': invoice['Deposit'] || 0,
                'Exchange Rate': invoice['Exchange Rate'] || '',
            },
            items: items.filter(item => item.no > 0 || item.isPromotion).map(item => ({
                no: item.no,
                itemCode: item.itemCode,
                modelName: item.modelName,
                description: item.description,
                qty: item.qty,
                unitPrice: item.unitPrice,
                amount: item.amount,
                isPromotion: item.isPromotion,
            })),
            totals: {
                subTotal: totals.subTotal,
                tax: totals.tax,
                grandTotal: totals.grandTotal
            },
            currency: (invoice.Currency as 'USD' | 'KHR') || 'USD',
            signaturePadding,
            labelPadding,
            hideKhmer,
            previewMode: false,
            filename: `${filePrefix}_${invoice['Inv No']}.pdf`,
            columnWidths: colWidths,
        });
    };

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() as string[] : [], [companies]);
    const soOptions = useMemo(() => saleOrders ? [...new Set(saleOrders.map(s => s['SO No']).filter(Boolean))].sort().reverse() as string[] : [], [saleOrders]);

    const printableProps = {
        headerData: {
            ...invoice,
            'Company Address': invoice['Company Address'] || companies?.find(c => c['Company Name'] === invoice['Company Name'])?.['Address (English)'] || '',
            'Company Name (Khmer)': invoice['Company Name (Khmer)'] || companies?.find(c => c['Company Name'] === invoice['Company Name'])?.['Company Name (Khmer)'] || '',
        },
        items,
        totals,
        currency: (invoice.Currency as 'USD' | 'KHR') || 'USD',
        signaturePadding,
        labelPadding,
        hideKhmer,
    };

    const headerLeft = (
        <div className="flex items-center gap-2 ml-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg border border-border text-sm font-bold text-muted-foreground">
                <FileText className="w-4 h-4" /> Invoice
            </div>
        </div>
    );

    const headerRight = (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border-r border-border pr-3 mr-1">
                <button
                    onClick={() => setShowFormPanel(!showFormPanel)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${showFormPanel ? 'bg-muted text-foreground shadow-inner' : 'bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-border shadow-sm'}`}
                    title="Toggle Form Panel"
                >
                    <PanelRight className="w-4 h-4" />
                    <span className="hidden lg:inline">{showFormPanel ? 'Hide Form' : 'Form'}</span>
                </button>
            </div>

            <div className="flex items-center gap-2">
                <ColumnWidthPopover
                    docType="invoice"
                    widths={colWidths}
                    onChange={setColWidths}
                    onReset={resetColWidths}
                />
                <button onClick={() => handleDownloadPDF()} className="flex items-center gap-2 px-6 py-2 text-sm font-bold bg-white text-brand-600 border border-brand-200 rounded-md hover:bg-brand-50 hover:border-brand-300 shadow-sm transition-all active:scale-95">
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
                title={existingInvoice ? `Edit Invoice: ${invoice['Inv No']}` : "New Invoice"}
                onBack={onBack}
                onSave={handleSave}
                isSubmitting={isSubmitting}
                leftActions={headerLeft}
                rightActions={headerRight}
                draftBadge={hasDraftState ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Unsaved draft
                    </span>
                ) : undefined}
            >
                <div className="screen-only h-full flex relative overflow-hidden">
                    {/* Center area: PDF Preview */}
                    <div className="flex-1 flex flex-col relative overflow-hidden">
                        <InvoicePreview
                            previewMode="invoice"
                            invoice={invoice}
                            items={items}
                            printableProps={printableProps}
                            signaturePadding={signaturePadding}
                            onSignaturePaddingChange={setSignaturePadding}
                            labelPadding={labelPadding}
                            onLabelPaddingChange={setLabelPadding}
                            hideKhmer={hideKhmer}
                            onHideKhmerChange={setHideKhmer}
                            columnWidths={colWidths}
                        />
                    </div>

                    {/* Right Panel: Form Sidebar */}
                    <InvoiceForm invoice={invoice} setInvoice={setInvoice} items={items} setItems={setItems} handleInputChange={handleInputChange} handleSOSelect={handleSOSelect} soOptions={soOptions} handleCompanySelect={handleCompanySelect} companyOptions={companyOptions} removeItem={removeItem} handleItemChange={handleItemChange} handlePricelistItemSelect={handlePricelistItemSelect} addItem={addItem} addPromoRow={addPromoRow} handlePromoAmountChange={handlePromoAmountChange} totals={totals} fileInputRef={fileInputRef} handleFileUpload={handleFileUpload} isUploading={isUploading} showFormPanel={showFormPanel} setShowFormPanel={setShowFormPanel} STATUS_OPTIONS={STATUS_OPTIONS} TAXABLE_OPTIONS={TAXABLE_OPTIONS} CURRENCY_OPTIONS={CURRENCY_OPTIONS} getCurrencySymbol={getCurrencySymbol} />
                </div>

                <div className="print-only">
                    <PrintableInvoice {...printableProps} />
                </div>

                {successInfo && (
                    <SuccessModal
                        isOpen={!!successInfo}
                        onClose={onBack}
                        title="Invoice Saved!"
                        message={`Invoice ${successInfo.invNo} has been saved successfully.`}
                        extraActions={undefined}
                    />
                )}
            </DocumentEditorContainer>

        </>
    );
};

export default InvoiceCreator;

