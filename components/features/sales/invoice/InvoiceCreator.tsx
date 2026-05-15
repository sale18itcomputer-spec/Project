'use client';


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Invoice, SaleOrder } from "../../../../types";
import { useData } from "../../../../contexts/DataContext";
import { useAuth } from "../../../../contexts/AuthContext";
import { createRecord, updateRecord, uploadFile } from "../../../../services/api";
import { formatToSheetDate, formatToInputDate } from "../../../../utils/time";
import { FormSection, FormInput, FormSelect, FormTextarea } from "../../../common/FormControls";
import PrintableInvoice from "../../../pdf/PrintableInvoice";
import SuccessModal from "../../../modals/SuccessModal";
import Spinner from "../../../common/Spinner";
import DocumentEditorContainer from "../../../layout/DocumentEditorContainer";
import { Trash2, X, Upload, FileText, Download, PanelRight, Plus } from 'lucide-react';
import { generatePDF } from "../../../../lib/pdfClient";
import { useToast } from "../../../../contexts/ToastContext";
import SearchableSelect from "../../../common/SearchableSelect";
import { ScrollArea } from "../../../ui/scroll-area";

interface InvoiceCreatorProps {
    onBack: () => void;
    existingInvoice: Invoice | null;
    initialData?: {
        action: string;
        soData?: SaleOrder;
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

// Parse credit days from Payment Term strings like "Net 30", "30 Days", "60", "Net 45 Days", etc.
function parseCreditDays(paymentTerm?: string): number {
    if (!paymentTerm) return 0;
    const match = paymentTerm.replace(/,/g, '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

// Returns YYYY-MM-DD due date string, or '' if not calculable
function calcDueDate(invDate?: string, paymentTerm?: string): string {
    const days = parseCreditDays(paymentTerm);
    if (!invDate || days <= 0) return '';
    const d = new Date(invDate + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

const getCurrencySymbol = (currency?: 'USD' | 'KHR'): string => {
    switch (currency) {
        case 'USD': return '$';
        case 'KHR': return '៛';
        default: return '$';
    }
};

const InvoiceCreator: React.FC<InvoiceCreatorProps> = ({ onBack, existingInvoice, initialData }) => {
    const { invoices, setInvoices, companies, contacts, saleOrders, refetchModule } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successInfo, setSuccessInfo] = useState<{ invNo: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [items, setItems] = useState<LineItem[]>([{ id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]);

    const [invoice, setInvoice] = useState<Partial<Invoice & { [key: string]: any }>>({});

    const [showFormPanel, setShowFormPanel] = useState(true);
    const [signaturePadding, setSignaturePadding] = useState(0);
    const [labelPadding, setLabelPadding] = useState(200);

    const getNextInvNo = (taxableType: string, allInvoices: any[]) => {
        const year = new Date().getFullYear().toString();
        let prefix = `INV${year}-`;
        if (taxableType === 'VAT') prefix = `TI${year}-`;
        else if (taxableType === 'Commercial Invoice') prefix = `CI${year}-`;

        const thisYearInvoices = (allInvoices || []).filter(inv => inv['Inv No']?.startsWith(prefix));
        if (thisYearInvoices.length === 0) return `${prefix}00002`;

        const maxNum = thisYearInvoices.reduce((max, inv) => {
            const numPart = parseInt(inv['Inv No'].slice(prefix.length), 10);
            return isNaN(numPart) ? max : Math.max(max, numPart);
        }, 1);

        return `${prefix}${String(maxNum + 1).padStart(5, '0')}`;
    };

    // Improved next invoice number logic
    const calculatedNextInvNo = useMemo(() => {
        const initialTaxable = initialData?.soData?.['Bill Invoice'] || 'VAT';
        return getNextInvNo(initialTaxable, invoices || []);
    }, [invoices, initialData]);

    useEffect(() => {
        if (existingInvoice) {
            setInvoice({
                ...existingInvoice,
                'Inv Date': existingInvoice['Inv Date'] ? formatToInputDate(existingInvoice['Inv Date']) : getTodayDateString(),
                'Due Date': existingInvoice['Due Date'] ? formatToInputDate(existingInvoice['Due Date']) : '',
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

            setInvoice({
                'Inv No': calculatedNextInvNo,
                'Inv Date': getTodayDateString(),
                'SO No': so['SO No'],
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
        } else {
            setInvoice(prev => {
                if (Object.keys(prev).length > 0 && prev['Inv No']) return prev;
                return {
                    'Inv No': calculatedNextInvNo,
                    'Inv Date': getTodayDateString(),
                    'Status': 'Draft',
                    'Currency': 'USD',
                    'Taxable': 'VAT',
                };
            });
        }
    }, [existingInvoice, initialData, calculatedNextInvNo]);

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
            if (name === 'Taxable' && !existingInvoice) {
                updated['Inv No'] = getNextInvNo(value, invoices || []);
            }
            return updated;
        });
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
            setInvoice(prev => ({
                ...prev,
                'SO No': soNo,
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

            if (existingInvoice) {
                await updateRecord('Invoices', existingInvoice['Inv No'], payload);
                setInvoices(current => current ? current.map(inv => inv['Inv No'] === invoice['Inv No'] ? (payload as unknown as Invoice) : inv) : [payload as unknown as Invoice]);
            } else {
                await createRecord('Invoices', payload);
                setInvoices(current => current ? [payload as unknown as Invoice, ...current] : [payload as unknown as Invoice]);
            }
            refetchModule('Invoices');

            setSuccessInfo({ invNo: invoice['Inv No'] });
        } catch (err: any) {
            addToast(err.message || 'Failed to save invoice', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };



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
            items: items.filter(item => item.no > 0).map(item => ({
                no: item.no,
                itemCode: item.itemCode,
                modelName: item.modelName,
                description: item.description,
                qty: item.qty,
                unitPrice: item.unitPrice,
                amount: item.amount
            })),
            totals: {
                subTotal: totals.subTotal,
                tax: totals.tax,
                grandTotal: totals.grandTotal
            },
            currency: (invoice.Currency as 'USD' | 'KHR') || 'USD',
            signaturePadding,
            labelPadding,
            previewMode: false,
            filename: `${filePrefix}_${invoice['Inv No']}.pdf`
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
    };

    const headerLeft = (
        <div className="flex items-center gap-2 ml-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200 text-sm font-bold text-slate-600">
                <FileText className="w-4 h-4" /> Invoice
            </div>
        </div>
    );

    const headerRight = (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-3 mr-1">
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
                        />
                    </div>

                    {/* Right Panel: Form Sidebar */}
                    <InvoiceForm invoice={invoice} setInvoice={setInvoice} items={items} setItems={setItems} handleInputChange={handleInputChange} handleSOSelect={handleSOSelect} soOptions={soOptions} handleCompanySelect={handleCompanySelect} companyOptions={companyOptions} removeItem={removeItem} handleItemChange={handleItemChange} handlePricelistItemSelect={handlePricelistItemSelect} addItem={addItem} totals={totals} fileInputRef={fileInputRef} handleFileUpload={handleFileUpload} isUploading={isUploading} showFormPanel={showFormPanel} setShowFormPanel={setShowFormPanel} STATUS_OPTIONS={STATUS_OPTIONS} TAXABLE_OPTIONS={TAXABLE_OPTIONS} CURRENCY_OPTIONS={CURRENCY_OPTIONS} getCurrencySymbol={getCurrencySymbol} />
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

