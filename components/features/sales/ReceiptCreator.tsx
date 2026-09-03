'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Receipt, Invoice, DeliveryOrder, SaleOrder } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { createRecord, updateRecord, uploadFile } from '../../../services/api';
import { formatToSheetDate, formatToInputDate } from '../../../utils/time';
import { friendlyDbError } from '../../../utils/formatters';
import { FormSection, FormInput, FormSelect, FormTextarea } from '../../common/FormControls';
import SearchableSelect from '../../common/SearchableSelect';
import { ScrollArea } from '../../ui/scroll-area';
import SuccessModal from '../../modals/SuccessModal';
import Spinner from '../../common/Spinner';
import DocumentEditorContainer from '../../layout/DocumentEditorContainer';
import { Trash2, X, Upload, Plus, Download, PanelRight } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { generatePDF } from '@/lib/pdfClient';
import { useColumnWidths } from '@/hooks/useColumnWidths';
import { ColumnWidthPopover } from './ColumnWidthPopover';
import { readFormDraft, useFormDraft } from '../../../hooks/useFormDraft';
import { usePeriodLock } from '../../../hooks/usePeriodLock';
import PdfPreviewPane from '../../pdf/PdfPreviewPane';
import { checkPermission, resolvePermissions } from '../../../utils/permissions';

const RV_STATUS_OPTIONS: Receipt['Status'][] = ['Draft', 'Issued', 'Cancelled'];
const CURRENCY_OPTIONS: ('USD' | 'KHR')[] = ['USD', 'KHR'];
const PAYMENT_METHOD_OPTIONS = ['Cash', 'Bank Transfer', 'Cheque', 'ABA', 'KHQR', 'Other'];
const TAX_TYPE_OPTIONS = ['VAT', 'NON-VAT'];

const getTodayDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName: string;
    description: string;
    qty: number | string;
    unitPrice: number | string;
    amount: number;
    serialNumber?: string;
    isPromotion?: boolean;
}

interface Props {
    onBack: () => void;
    existingReceipt?: Receipt | null;
    initialData?: {
        action?: string;
        invoiceData?: Invoice;
        doData?: DeliveryOrder;
        soData?: SaleOrder;
    };
}

const getCurrencySymbol = (currency?: 'USD' | 'KHR') => currency === 'KHR' ? '៛' : '$';

const ReceiptCreator: React.FC<Props> = ({ onBack, existingReceipt, initialData }) => {
    const { receipts, setReceipts, invoices, deliveryOrders, saleOrders, companies, contacts, refetchModule } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successInfo, setSuccessInfo] = useState<{ rvNo: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showFormPanel, setShowFormPanel] = useState(true);
    const [signaturePadding, setSignaturePadding] = useState(0);
    const [labelPadding, setLabelPadding] = useState(200);
    const [colWidths, setColWidths, resetColWidths] = useColumnWidths('receipt');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const draftKey = existingReceipt ? `rv-edit-${existingReceipt['RV No']}` : 'rv-new';
    const draft = useRef(readFormDraft<{ doc: Partial<Receipt>; items: LineItem[] }>(draftKey)).current;
    const hasDraft = useRef(!!draft);
    const submitted = useRef(false);
    const [hasDraftState, setHasDraftState] = useState(!!draft);
    const { save: saveDraft, clear: clearDraft } = useFormDraft(draftKey);

    // Receipts are immutable artifacts of payment events. ReceiptCreator is now
    // only reachable in VIEW mode (open an existing receipt for printing/PDF).
    // Standalone creation has been removed — record payments via Collection.
    //
    // CONTENT-EDIT: an issued receipt's *presentation* (customer info, refs,
    // prepared-by, remarks) can be edited to tidy it before sending — but never
    // the amount or anything that feeds the payment journal entry (RV No/Date,
    // Invoice Reference, Currency, Payment Method, Status, and the line items).
    // Those stay locked, and the save re-asserts them from the original, so a
    // content edit can never move money. Gated on the receipts.edit permission
    // (Admin/Finance by default).
    const isIssued = !!existingReceipt;
    const canEditContent = useMemo(
        () => checkPermission(resolvePermissions(currentUser), 'receipts', 'edit'),
        [currentUser],
    );
    const [editing, setEditing] = useState(false);
    const [hideHeader, setHideHeader] = useState(false);
    const [hideVatTin, setHideVatTin] = useState(false);
    // Whole-form lock when viewing an issued receipt and NOT in edit mode.
    const isReadOnly = isIssued && !editing;
    // Monetary/identity fields: locked even while editing.
    const monLock = editing ? 'pointer-events-none opacity-60' : '';
    useEffect(() => {
        if (!existingReceipt && !initialData) {
            addToast('Receipts can only be created by recording a payment in Collection.', 'info');
            onBack();
        }
     
    }, []);

    const [items, setItems] = useState<LineItem[]>(() => (!existingReceipt && draft?.items) ? draft.items : [
        { id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 }
    ]);
    const [doc, setDoc] = useState<Partial<Receipt>>(() => (!existingReceipt && draft?.doc) ? draft.doc : {});

    // Auto-generate RV No
    const calculatedNextRVNo = useMemo(() => {
        const year = new Date().getFullYear().toString();
        const prefix = `OR${year}-`;
        const thisYear = (receipts || []).filter(r => r['RV No']?.startsWith(prefix));
        if (thisYear.length === 0) return `${prefix}00001`;
        const maxNum = thisYear.reduce((max, r) => {
            const n = parseInt(r['RV No'].slice(prefix.length), 10);
            return isNaN(n) ? max : Math.max(max, n);
        }, 0);
        return `${prefix}${String(maxNum + 1).padStart(5, '0')}`;
    }, [receipts]);

    // Totals — when a specific invoice is linked, derive VAT from the invoice's
    // Taxable field (authoritative) rather than the stored receipt Tax Type,
    // which can be wrong on existing records.
    const totals = useMemo(() => {
        const subTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const linkedInv = invoices?.find(i => i['Inv No'] === doc['Inv No']);
        const isTaxable = linkedInv
            ? (linkedInv['Taxable'] === 'VAT' || linkedInv['Taxable'] === 'Yes')
            : doc['Tax Type'] === 'VAT';
        const tax = isTaxable ? subTotal * 0.1 : 0;
        const grandTotal = subTotal + tax;
        return { subTotal, tax, grandTotal };
    }, [items, doc['Tax Type'], doc['Inv No'], invoices]);

    // Correct stored Tax Type when linked invoice says otherwise (e.g. old
    // receipts saved with Tax Type='VAT' on a NON-VAT invoice).
    useEffect(() => {
        if (!existingReceipt || !invoices || !doc['Inv No']) return;
        const linkedInv = invoices.find(i => i['Inv No'] === doc['Inv No']);
        if (!linkedInv) return;
        const invoiceIsVAT = linkedInv['Taxable'] === 'VAT' || linkedInv['Taxable'] === 'Yes';
        const storedIsVAT = doc['Tax Type'] === 'VAT';
        if (storedIsVAT !== invoiceIsVAT) {
            setDoc(prev => ({ ...prev, 'Tax Type': invoiceIsVAT ? 'VAT' : 'NON-VAT' }));
        }
    }, [existingReceipt, invoices, doc['Inv No']]);

    // Initialise
    useEffect(() => {
        if (!existingReceipt && hasDraft.current) return;
        if (existingReceipt) {
            setDoc({
                ...existingReceipt,
                'RV Date': existingReceipt['RV Date'] ? formatToInputDate(existingReceipt['RV Date']) : getTodayDateString(),
            });
            let fetchedItems: LineItem[] = [];
            try {
                fetchedItems = typeof existingReceipt.ItemsJSON === 'string'
                    ? JSON.parse(existingReceipt.ItemsJSON) : existingReceipt.ItemsJSON || [];
            } catch { }
            if (fetchedItems.length > 0) setItems(fetchedItems);
        } else {
            const inv = initialData?.invoiceData;
            const doDoc = initialData?.doData;
            const so = initialData?.soData;
            const source = inv || doDoc || so;
            const company = source ? companies?.find(c => c['Company Name'] === source['Company Name']) : null;

            setDoc(prev => {
                if (Object.keys(prev).length > 0 && prev['RV No']) return prev;
                return {
                    'RV No': calculatedNextRVNo,
                    'RV Date': getTodayDateString(),
                    'Inv No': inv?.['Inv No'] || doDoc?.['Inv No'] || '',
                    'SO No': inv?.['SO No'] || doDoc?.['SO No'] || so?.['SO No'] || '',
                    'DO No': doDoc?.['DO No'] || '',
                    'Company Name': source?.['Company Name'] || '',
                    'Company Address': company?.['Address (English)'] || '',
                    'Contact Name': source?.['Contact Name'] || '',
                    'Phone Number': source?.['Phone Number'] || '',
                    'Email': source?.['Email'] || (source as any)?.Email || '',
                    'Amount': inv ? Number(inv['Amount']) : 0,
                    'Currency': source?.['Currency'] || 'USD',
                    'Tax Type': (inv as any)?.Taxable === 'Yes' || (inv as any)?.Taxable === 'VAT' ? 'VAT' : 'NON-VAT',
                    'Status': 'Draft',
                    'Payment Term': source?.['Payment Term'] || '',
                    'Tin No': company?.['Patent'] || '',
                    'Prepared By': currentUser?.Name || '',
                    'Prepared By Position': currentUser ? [
                        currentUser.Role,
                        [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '),
                        currentUser.Email,
                    ].filter(Boolean).join(' | ') : '',
                    'Approved By': '',
                    'Approved By Position': '',
                };
            });

            // Copy items from source
            let srcItems: any[] = [];
            try {
                const raw = (source as any)?.ItemsJSON;
                srcItems = typeof raw === 'string' ? JSON.parse(raw) : raw || [];
            } catch { }
            if (srcItems.length > 0) {
                setItems(srcItems.map((item: any, idx: number) => ({
                    id: item.id || `item-${Date.now()}-${idx}`,
                    no: item.no ?? idx + 1,
                    itemCode: item.itemCode || '',
                    modelName: item.modelName || '',
                    description: item.description || '',
                    qty: item.qty ?? 1,
                    unitPrice: item.unitPrice ?? 0,
                    amount: item.amount ?? 0,
                })));
            }
        }
    }, [existingReceipt, initialData, calculatedNextRVNo]);

    useEffect(() => {
        if (existingReceipt) return;
        if (!doc['RV No']) return;
        if (submitted.current) return;
        saveDraft({ doc, items });
        setHasDraftState(true);
    }, [doc, items, saveDraft, existingReceipt]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setDoc(prev => ({ ...prev, [name]: value }));
    };

    const handleCompanySelect = (companyName: string) => {
        const company = companies?.find(c => c['Company Name'] === companyName);
        const contact = contacts?.find(c => c['Company Name'] === companyName);
        setDoc(prev => ({
            ...prev,
            'Company Name': companyName,
            'Company Address': company?.['Address (English)'] || prev['Company Address'],
            'Contact Name': contact?.Name || prev['Contact Name'],
            'Phone Number': company?.['Phone Number'] || contact?.['Tel (1)'] || prev['Phone Number'],
            'Email': company?.Email || contact?.Email || prev['Email'],
            'Payment Term': company?.['Payment Term'] || prev['Payment Term'],
            'Tin No': company?.['Patent'] || prev['Tin No'],
        }));
    };

    const handleInvoiceSelect = (invNo: string) => {
        const inv = invoices?.find(i => i['Inv No'] === invNo);
        if (!inv) { setDoc(prev => ({ ...prev, 'Inv No': invNo })); return; }
        const company = companies?.find(c => c['Company Name'] === inv['Company Name']);
        setDoc(prev => ({
            ...prev,
            'Inv No': invNo,
            'SO No': inv['SO No'] || prev['SO No'],
            'Company Name': inv['Company Name'] || prev['Company Name'],
            'Company Address': company?.['Address (English)'] || prev['Company Address'],
            'Contact Name': inv['Contact Name'] || prev['Contact Name'],
            'Phone Number': inv['Phone Number'] || prev['Phone Number'],
            'Email': (inv as any)?.Email || prev['Email'],
            'Amount': Number(inv['Amount']) || prev['Amount'],
            'Currency': inv['Currency'] || prev['Currency'],
            'Tax Type': inv['Taxable'] === 'Yes' || inv['Taxable'] === 'VAT' ? 'VAT' : 'NON-VAT',
            'Payment Term': inv['Payment Term'] || prev['Payment Term'],
            'Tin No': inv['Tin No'] || company?.['Patent'] || prev['Tin No'],
        }));
        let invItems: any[] = [];
        try { invItems = typeof inv.ItemsJSON === 'string' ? JSON.parse(inv.ItemsJSON) : inv.ItemsJSON || []; } catch { }
        if (invItems.length > 0) {
            setItems(invItems.map((item: any, idx: number) => ({
                id: item.id || `item-${Date.now()}-${idx}`,
                no: item.no ?? idx + 1,
                itemCode: item.itemCode || '',
                modelName: item.modelName || '',
                description: item.description || '',
                qty: item.qty ?? 1,
                unitPrice: item.unitPrice ?? 0,
                amount: item.amount ?? 0,
            })));
        }
        addToast(`Loaded info from ${invNo}`, 'success');
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
            if (item.id !== id) return item;
            const updated = { ...item, [field]: value };
            if (!updated.isPromotion) {
                updated.amount = (Number(updated.qty) || 0) * (Number(updated.unitPrice) || 0);
            }
            return updated;
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
        setItems(prev => renumberItems(prev.filter(i => i.id !== id)));
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
            setDoc(prev => ({ ...prev, File: url }));
            addToast('File uploaded successfully', 'success');
        } catch (err: any) {
            addToast(`Upload failed: ${err.message}`, 'error');
        } finally { setIsUploading(false); }
    };

    const { lockError } = usePeriodLock();

    const handleSave = async () => {
        if (!doc['RV No'] || !doc['Company Name']) {
            addToast('Please fill in RV No. and Company Name', 'error');
            return;
        }
        const rvLockMsg = lockError(doc['RV Date']);
        if (rvLockMsg) { addToast(rvLockMsg, 'error'); return; }
        setIsSubmitting(true);
        try {
            const payload = {
                ...doc,
                'RV Date': doc['RV Date'] ? formatToSheetDate(doc['RV Date']) : null,
                'Amount': totals.grandTotal,
                'ItemsJSON': items,
                'Created By': doc['Created By'] || currentUser?.Name || '',
                updated_at: new Date().toISOString(),
            };

            if (existingReceipt) {
                await updateRecord('Receipts', existingReceipt['RV No'], payload);
                setReceipts(cur => cur
                    ? cur.map(r => r['RV No'] === doc['RV No'] ? (payload as Receipt) : r)
                    : [payload as Receipt]
                );
            } else {
                await createRecord('Receipts', payload);
                setReceipts(cur => cur ? [payload as Receipt, ...cur] : [payload as Receipt]);
            }
            refetchModule('Receipts');
            submitted.current = true;
            clearDraft();
            setHasDraftState(false);
            setSuccessInfo({ rvNo: doc['RV No']! });
        } catch (err: any) {
            addToast(friendlyDbError(err, 'receipt number') || 'Failed to save Receipt', 'error');
        } finally { setIsSubmitting(false); }
    };

    const handleDownloadPDF = () => {
        generatePDF({
            type: 'Receipt',
            headerData: { ...doc },
            items: items.filter(i => Number(i.no) > 0 || i.isPromotion).map(item => ({
                no: item.no,
                itemCode: item.itemCode,
                modelName: item.modelName,
                description: item.description,
                qty: item.qty,
                unitPrice: item.unitPrice,
                amount: item.amount,
                isPromotion: item.isPromotion,
            })),
            totals,
            currency: (doc['Currency'] as 'USD' | 'KHR') || 'USD',
            signaturePadding,
            hideHeader,
            hideVatTin,
            previewMode: false,
            filename: `Receipt_${doc['RV No']}.pdf`,
        });
    };

    // Save a CONTENT-ONLY edit of an issued receipt. Monetary/identity fields and
    // the line items are re-asserted from the original record, so the amount and
    // the payment journal entry are never touched — no reversal, no reprice.
    // Skips the client period-lock check on purpose: content edits are permitted
    // even in a locked month (the DB guard exempts amount-unchanged updates).
    const handleSaveContent = async () => {
        if (!existingReceipt) return;
        if (!doc['Company Name']) { addToast('Company Name is required', 'error'); return; }
        setIsSubmitting(true);
        try {
            const payload: any = {
                ...doc,
                // Re-assert everything that affects money / the JE from the original.
                'RV No':          existingReceipt['RV No'],
                'RV Date':        existingReceipt['RV Date'],
                'Inv No':         existingReceipt['Inv No'],
                'Currency':       existingReceipt['Currency'],
                'Payment Method': existingReceipt['Payment Method'],
                'Status':         existingReceipt['Status'],
                'Amount':         existingReceipt['Amount'],
                'ItemsJSON':      existingReceipt['ItemsJSON'],
                updated_at:       new Date().toISOString(),
            };
            await updateRecord('Receipts', existingReceipt['RV No'], payload);
            setReceipts(cur => cur
                ? cur.map(r => r['RV No'] === existingReceipt['RV No'] ? ({ ...r, ...payload } as Receipt) : r)
                : cur
            );
            refetchModule('Receipts');
            addToast('Receipt updated', 'success');
            setEditing(false);
        } catch (err: any) {
            addToast(friendlyDbError(err, 'receipt') || 'Failed to update receipt', 'error');
        } finally { setIsSubmitting(false); }
    };

    // Snapshot the presentation fields on entering edit mode so Cancel reverts.
    const preEditDoc = useRef<Partial<Receipt> | null>(null);
    const startEdit = () => { preEditDoc.current = { ...doc }; setEditing(true); };
    const cancelEdit = () => { if (preEditDoc.current) setDoc(preEditDoc.current); setEditing(false); };

    const invoiceOptions = useMemo(
        () => (invoices || []).map(i => i['Inv No']).filter(Boolean).sort().reverse(),
        [invoices]
    );
    const companyOptions = useMemo(
        () => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() as string[] : [],
        [companies]
    );

    const headerRight = (
        <div className="flex items-center gap-3">
            <button
                onClick={() => setShowFormPanel(p => !p)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all border ${showFormPanel ? 'bg-muted text-foreground border-border' : 'bg-card text-muted-foreground border-border hover:bg-accent'}`}
            >
                <PanelRight className="w-4 h-4" />
                <span className="hidden lg:inline">{showFormPanel ? 'Hide Form' : 'Form'}</span>
            </button>
            <ColumnWidthPopover
                docType="receipt"
                widths={colWidths}
                onChange={setColWidths}
                onReset={resetColWidths}
            />
            <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-card text-primary border border-primary/30 rounded-md hover:bg-primary/10 shadow-sm transition-all"
            >
                <Download className="w-4 h-4" /> Download PDF
            </button>
            {/* Issued receipt: Edit content (gated) / Save-Cancel while editing */}
            {isIssued && !editing && canEditContent && (
                <button
                    onClick={startEdit}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-card text-foreground border border-border rounded-md hover:bg-accent shadow-sm transition-all"
                >
                    Edit Content
                </button>
            )}
            {isIssued && editing && (
                <>
                    <button
                        onClick={cancelEdit}
                        disabled={isSubmitting}
                        className="px-5 py-2 text-sm font-bold bg-card text-muted-foreground border border-border rounded-md hover:bg-accent transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveContent}
                        disabled={isSubmitting}
                        className="bg-primary hover:brightness-110 text-primary-foreground font-bold py-2 px-6 rounded-md transition shadow-md text-sm disabled:opacity-50 min-w-[120px] flex items-center justify-center"
                    >
                        {isSubmitting ? <Spinner size="sm" color="current" /> : 'Save Changes'}
                    </button>
                </>
            )}
            {!isIssued && (
                <button
                    onClick={handleSave}
                    disabled={isSubmitting}
                    className="bg-primary hover:brightness-110 text-primary-foreground font-bold py-2 px-6 rounded-md transition shadow-md text-sm disabled:opacity-50 min-w-[120px] flex items-center justify-center"
                >
                    {isSubmitting ? <Spinner size="sm" color="current" /> : 'Save Receipt'}
                </button>
            )}
        </div>
    );

    return (
        <>
            <DocumentEditorContainer
                title={isIssued ? `Receipt: ${doc['RV No']}` : 'New Receipt'}
                subtitle={isIssued ? (editing ? 'Editing content · amount locked' : 'Issued payment record') : undefined}
                onBack={onBack}
                onSave={handleSave}
                isSubmitting={isSubmitting}
                rightActions={headerRight}
                draftBadge={!isIssued && hasDraftState ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Unsaved draft
                    </span>
                ) : undefined}
            >
                <div className="h-full flex overflow-hidden">
                    {/* PDF Preview */}
                    <PdfPreviewPane
                        docLabel={`${doc['RV No'] || ''} • ${doc['Company Name'] || 'No Company Selected'}`}
                        signaturePadding={signaturePadding}
                        onSignaturePaddingChange={setSignaturePadding}
                        labelPadding={labelPadding}
                        onLabelPaddingChange={setLabelPadding}
                        columnWidths={colWidths}
                        hideHeader={hideHeader}
                        onHideHeaderChange={setHideHeader}
                        hideVatTin={hideVatTin}
                        onHideVatTinChange={setHideVatTin}
                        pdfOptions={{
                            type: 'Receipt',
                            headerData: { ...doc },
                            items: items.filter(i => Number(i.no) > 0 || i.isPromotion).map(i => ({
                                no: i.no, itemCode: i.itemCode, modelName: i.modelName,
                                description: i.description, qty: i.qty,
                                unitPrice: i.unitPrice, amount: i.amount,
                                isPromotion: i.isPromotion,
                            })),
                            totals,
                            currency: (doc['Currency'] as 'USD' | 'KHR') || 'USD',
                            hideHeader,
                            hideVatTin,
                        }}
                    />

                    {/* Form Sidebar */}
                    <div className={`bg-card border-l border-border transition-all duration-300 flex flex-col flex-shrink-0 ${showFormPanel ? 'w-[480px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'}`}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-5 bg-primary rounded-full" />
                                <h3 className="text-sm font-bold text-foreground">Receipt Information</h3>
                            </div>
                            <button onClick={() => setShowFormPanel(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md"><X className="w-4 h-4" /></button>
                        </div>

                        {isIssued && !editing && (
                            <div className="px-5 py-2.5 bg-emerald-500/5 border-b border-emerald-200/40 text-xs text-emerald-700">
                                Issued · The amount and payment are locked.{canEditContent ? ' Use “Edit Content” to adjust customer-facing details (name, address, refs, remarks) before sending.' : ' Content editing requires the receipts “edit” permission.'}
                            </div>
                        )}
                        {isIssued && editing && (
                            <div className="px-5 py-2.5 bg-amber-500/5 border-b border-amber-200/40 text-xs text-amber-700">
                                Editing content · Amount, RV No/Date, Invoice Reference, Currency, Payment Method, Status and line items stay locked — only presentation fields save.
                            </div>
                        )}

                        <ScrollArea className="flex-1 px-5 py-4">
                            <div className={`space-y-6 ${isReadOnly ? 'pointer-events-none select-none' : ''}`}>
                                <FormSection title="Header Details">
                                    <div className={monLock}>
                                        <FormInput label="RV No." name="RV No" value={doc['RV No']} onChange={handleInputChange} required />
                                        <FormInput label="RV Date" name="RV Date" type="date" value={doc['RV Date']} onChange={handleInputChange} />
                                        <SearchableSelect
                                            name="Inv No" label="Invoice Reference"
                                            value={doc['Inv No'] || ''} options={invoiceOptions}
                                            onChange={handleInvoiceSelect} placeholder="Select Invoice"
                                        />
                                    </div>
                                    <FormInput label="DO Reference" name="DO No" value={doc['DO No']} onChange={handleInputChange} />
                                    <FormInput label="SO Reference" name="SO No" value={doc['SO No']} onChange={handleInputChange} />
                                    <div className={monLock}>
                                        <FormSelect label="Status" name="Status" value={doc['Status']} options={RV_STATUS_OPTIONS} onChange={handleInputChange} />
                                    </div>
                                    <FormSelect label="Tax Type" name="Tax Type" value={doc['Tax Type']} options={TAX_TYPE_OPTIONS} onChange={handleInputChange} />
                                    <div className={monLock}>
                                        <FormSelect label="Currency" name="Currency" value={doc['Currency']} options={CURRENCY_OPTIONS} onChange={handleInputChange} />
                                        <FormSelect label="Payment Method" name="Payment Method" value={doc['Payment Method']} options={PAYMENT_METHOD_OPTIONS} onChange={handleInputChange} />
                                    </div>
                                    <FormInput label="Payment Term" name="Payment Term" value={doc['Payment Term']} onChange={handleInputChange} />
                                </FormSection>

                                <FormSection title="Preparation Info">
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormInput label="Prepared By" name="Prepared By" value={doc['Prepared By']} onChange={handleInputChange} />
                                        <FormInput label="Position" name="Prepared By Position" value={doc['Prepared By Position']} onChange={handleInputChange} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormInput label="Approved By" name="Approved By" value={doc['Approved By']} onChange={handleInputChange} />
                                        <FormInput label="Position" name="Approved By Position" value={doc['Approved By Position']} onChange={handleInputChange} />
                                    </div>
                                </FormSection>

                                <FormSection title="Customer Details">
                                    <SearchableSelect
                                        name="Company Name" label="Company Name"
                                        value={doc['Company Name'] || ''} options={companyOptions}
                                        onChange={handleCompanySelect} placeholder="Select Company" required
                                    />
                                    <FormInput label="Contact Name" name="Contact Name" value={doc['Contact Name']} onChange={handleInputChange} />
                                    <FormInput label="Phone Number" name="Phone Number" value={doc['Phone Number']} onChange={handleInputChange} />
                                    <FormInput label="Email" name="Email" value={doc['Email']} onChange={handleInputChange} />
                                    <FormInput label="TIN No." name="Tin No" value={doc['Tin No']} onChange={handleInputChange} />
                                    <FormTextarea label="Company Address" name="Company Address" value={doc['Company Address']} onChange={handleInputChange} rows={3} />
                                </FormSection>

                                {/* Line Items with pricing — LOCKED while editing an issued receipt
                                    (qty/price/add/remove all move the amount, which must never change
                                    on a content edit). */}
                                <div className={`bg-background p-4 rounded-xl border border-border shadow-sm ${monLock}`}>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Line Items{editing ? ' · locked' : ''}</h3>
                                    <div className="space-y-3">
                                        {items.map(item => {
                                            const isPromoRow = !!item.isPromotion;
                                            return (
                                            <div key={item.id} className={`relative p-4 rounded-xl border group transition-all ${isPromoRow ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60' : 'bg-muted/50 border-border hover:border-primary/50'}`}>
                                                <button onClick={() => removeItem(item.id)}
                                                    className="absolute top-3 right-3 text-muted-foreground/70 hover:text-destructive p-1.5 rounded-full hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                {isPromoRow ? (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                            <span className="text-[11px] font-bold uppercase text-amber-600">Cashback / Promotion</span>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-1 block">Promotion Terms</label>
                                                                <textarea value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                                    className="w-full text-sm p-3 rounded-lg border border-amber-500/30 bg-background" rows={2}
                                                                    placeholder="e.g. Buy 10-29pcs get cash back $40&#10;Period: 01st - 30th June 2026" />
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div>
                                                                    <label className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-1 block">Cashback Amount</label>
                                                                    <input type="number" min={0} step="0.01"
                                                                        value={Math.abs(item.amount)}
                                                                        onChange={e => handlePromoAmountChange(item.id, e.target.value)}
                                                                        className="w-32 h-9 px-3 text-right text-sm bg-background border border-amber-500/30 rounded-lg" />
                                                                </div>
                                                                <span className="text-xs font-semibold text-rose-500 pt-5">deducted from total</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                    <div className="flex gap-3 pr-8 mb-3">
                                                        <div className="w-10 flex flex-col items-center justify-center">
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-1 block text-center">No.</label>
                                                            <div className="h-9 w-full flex items-center justify-center bg-background rounded-lg border border-border font-mono text-sm font-semibold text-muted-foreground">{item.no}</div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-1 block">Item Code</label>
                                                            <input type="text" value={item.itemCode} onChange={e => handleItemChange(item.id, 'itemCode', e.target.value)}
                                                                className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-ring transition-all" />
                                                        </div>
                                                        <div className="flex-[1.5]">
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-1 block">Model</label>
                                                            <input type="text" value={item.modelName} onChange={e => handleItemChange(item.id, 'modelName', e.target.value)}
                                                                className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-ring transition-all" />
                                                        </div>
                                                    </div>
                                                    <div className="mb-3">
                                                        <label className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-1 block">Description</label>
                                                        <textarea value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                            className="w-full text-sm p-3 rounded-lg border border-border bg-background" rows={2} />
                                                    </div>
                                                    <div className="flex flex-wrap gap-3">
                                                        <div className="w-20">
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-1 block">Qty</label>
                                                            <input type="number" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', e.target.value)}
                                                                className="w-full h-9 px-2 text-center text-sm bg-background border border-border rounded-lg" />
                                                        </div>
                                                        <div className="w-32">
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-1 block">Unit Price</label>
                                                            <input type="number" value={item.unitPrice} onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value)}
                                                                className="w-full h-9 px-3 text-right text-sm bg-background border border-border rounded-lg" />
                                                        </div>
                                                        <div className="w-full">
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-1 block">Serial Numbers <span className="normal-case font-normal text-muted-foreground/70">(one per line)</span></label>
                                                            <textarea
                                                                value={item.serialNumber || ''}
                                                                onChange={e => handleItemChange(item.id, 'serialNumber', e.target.value)}
                                                                className="w-full text-xs p-2 font-mono rounded-lg border border-border bg-background resize-y min-h-[60px]"
                                                                rows={3}
                                                                placeholder={`SN001\nSN002\nSN003...`}
                                                            />
                                                            <div className="text-[9px] text-muted-foreground/70 mt-0.5">{(item.serialNumber || '').split('\n').filter((s: string) => s.trim()).length} S/N entered</div>
                                                        </div>
                                                        <div className="flex-1 text-right pt-4">
                                                            <div className="text-[10px] font-bold text-muted-foreground/70 uppercase">Total</div>
                                                            <div className="text-lg font-bold text-foreground">
                                                                {getCurrencySymbol(doc['Currency'] as any)}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    </>
                                                )}
                                            </div>
                                            );
                                        })}
                                        <div className="flex gap-3">
                                        <button onClick={addItem}
                                            className="flex-1 py-2.5 rounded-lg border border-dashed border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 font-bold text-sm flex items-center justify-center gap-2">
                                            <Plus className="w-4 h-4" /> Add Item
                                        </button>
                                        <button type="button" onClick={addPromoRow}
                                            className="flex-1 py-2.5 rounded-lg border border-dashed border-amber-500/40 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500 font-semibold text-sm flex items-center justify-center gap-2 transition-all">
                                            <span>+ Add Cashback</span>
                                        </button>
                                        </div>

                                        {/* Totals */}
                                        <div className="bg-muted/50 rounded-xl p-5 border border-border mt-4 space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground font-medium">Sub Total</span>
                                                <span className="font-bold text-foreground">{getCurrencySymbol(doc['Currency'] as any)}{totals.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground font-medium">VAT (10%)</span>
                                                <span className="font-bold text-foreground">{getCurrencySymbol(doc['Currency'] as any)}{totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between pt-3 border-t border-border">
                                                <span className="text-xs font-black uppercase tracking-wider text-foreground">Grand Total</span>
                                                <span className="text-xl font-black text-primary">{getCurrencySymbol(doc['Currency'] as any)}{totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <FormSection title="Remarks">
                                    <FormTextarea label="Remark" name="Remark" value={doc['Remark']} onChange={handleInputChange} rows={3} />
                                    <FormTextarea label="Terms and Conditions" name="Terms and Conditions" value={doc['Terms and Conditions']} onChange={handleInputChange} rows={3} />
                                </FormSection>

                                <FormSection title="Attachment">
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                    {isUploading ? (
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground p-4 rounded-xl bg-muted/50 border-2 border-dashed border-border">
                                            <Spinner size="sm" /><span className="font-bold">Uploading...</span>
                                        </div>
                                    ) : doc['File'] ? (
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                                            <a href={doc['File']} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-700 hover:underline truncate max-w-[200px]">View Uploaded File</a>
                                            <button onClick={() => setDoc(prev => ({ ...prev, File: '' }))} className="p-1.5 text-muted-foreground/70 hover:text-rose-600 hover:bg-rose-100 rounded-full"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => fileInputRef.current?.click()}
                                            className="w-full text-center p-4 bg-muted/50 hover:bg-muted text-muted-foreground font-bold rounded-xl border-2 border-dashed border-border flex flex-col items-center gap-2">
                                            <Upload className="w-5 h-5 text-muted-foreground/70" />
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Click to Upload File</span>
                                        </button>
                                    )}
                                </FormSection>
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DocumentEditorContainer>

            {successInfo && (
                <SuccessModal
                    isOpen={!!successInfo}
                    onClose={onBack}
                    title="Receipt Saved!"
                    message={`${successInfo.rvNo} has been saved successfully.`}
                />
            )}
        </>
    );
};

export default ReceiptCreator;
