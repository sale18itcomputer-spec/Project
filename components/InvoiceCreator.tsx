
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Invoice, Company, Contact, SaleOrder } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { createRecord, updateRecord, uploadFile } from '../services/api';
import { formatToSheetDate, formatToInputDate } from '../utils/time';
import { FormSection, FormInput, FormSelect, FormTextarea } from './FormControls';
import PrintableInvoice from './PrintableInvoice';
import PrintableDO from './PrintableDO';
import SuccessModal from './SuccessModal';
import Spinner from './Spinner';
import DocumentEditorContainer from './DocumentEditorContainer';
import { Trash2, X, Upload, Printer, FileText } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import SearchableSelect from './SearchableSelect';

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
    description: string;
    qty: number | string;
    unitPrice: number | string;
    amount: number;
}

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

    const [items, setItems] = useState<LineItem[]>([{ id: `item-${Date.now()}`, no: 1, itemCode: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]);
    const [invoice, setInvoice] = useState<Partial<Invoice & { [key: string]: any }>>({});

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

    const handleItemChange = (id: string, field: keyof LineItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'qty' || field === 'unitPrice') {
                    updatedItem.amount = (Number(updatedItem.qty) || 0) * (Number(updatedItem.unitPrice) || 0);
                }
                return updatedItem;
            }
            return item;
        }));
    };

    const addItem = () => {
        const nextNo = items.length > 0 ? Math.max(...items.map(i => i.no)) + 1 : 1;
        setItems(prev => [...prev, { id: `item-${Date.now()}`, no: nextNo, itemCode: '', description: '', qty: 1, unitPrice: 0, amount: 0 }]);
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
        setTimeout(() => {
            window.print();
        }, 100);
    };

    const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() : [], [companies]);
    const soOptions = useMemo(() => saleOrders ? [...new Set(saleOrders.map(s => s['SO No.']).filter(Boolean))].sort().reverse() : [], [saleOrders]);

    const printableProps = {
        headerData: {
            ...invoice,
            'Company Address': invoice['Company Address'] || companies?.find(c => c['Company Name'] === invoice['Company Name'])?.['Address (English)'] || '',
        },
        items,
        totals,
        currency: (invoice.Currency as 'USD' | 'KHR') || 'USD',
    };

    return (
        <>
            <DocumentEditorContainer
                title={existingInvoice ? `Edit Invoice: ${invoice['Inv No.']}` : "New Invoice & DO"}
                onBack={onBack}
                leftActions={
                    <div className="flex items-center gap-2 ml-4">
                        <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                            <button
                                onClick={() => setPreviewMode('invoice')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${previewMode === 'invoice' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <FileText className="w-4 h-4" /> Invoice
                            </button>
                            <button
                                onClick={() => setPreviewMode('do')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${previewMode === 'do' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Printer className="w-4 h-4" /> Delivery Order
                            </button>
                        </div>
                    </div>
                }
                rightActions={
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handlePrint(previewMode)}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 font-bold py-2 px-4 rounded-md hover:bg-slate-50 transition shadow-sm text-sm disabled:opacity-50"
                        >
                            <Printer className="w-4 h-4" /> Print {previewMode === 'invoice' ? 'Invoice' : 'DO'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-6 rounded-md transition shadow-md text-sm disabled:opacity-50"
                        >
                            {isSubmitting ? <Spinner size="sm" color="white" /> : 'Save Invoice'}
                        </button>
                    </div>
                }
            >
                <div className="screen-only h-full flex flex-col">
                    <div className="flex flex-col lg:flex-row gap-8 h-full overflow-hidden p-6">
                        {/* Form Section */}
                        <div className="flex-1 overflow-y-auto pr-4 space-y-6 custom-scrollbar">
                            {error && (
                                <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-md">
                                    <p className="text-sm text-rose-700">{error}</p>
                                </div>
                            )}

                            <FormSection title="Invoice Information">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormInput label="Invoice No." name="Inv No." value={invoice['Inv No.']} onChange={handleInputChange} placeholder="INV-20250001" required />
                                    <FormInput label="Invoice Date" name="Inv Date" type="date" value={invoice['Inv Date']} onChange={handleInputChange} />
                                    <div className="flex flex-col gap-1.5">
                                        <SearchableSelect
                                            label="SO Reference"
                                            value={invoice['SO No.'] || ''}
                                            options={soOptions}
                                            onChange={handleSOSelect}
                                            placeholder="Select SO"
                                        />
                                    </div>
                                    <FormSelect label="Status" name="Status" value={invoice['Status']} options={STATUS_OPTIONS} onChange={handleInputChange} />
                                    <FormSelect label="Taxable (VAT 10%)" name="Taxable" value={invoice['Taxable']} options={TAXABLE_OPTIONS} onChange={handleInputChange} />
                                    <FormSelect label="Currency" name="Currency" value={invoice['Currency']} options={CURRENCY_OPTIONS} onChange={handleInputChange} />
                                </div>
                            </FormSection>

                            <FormSection title="Customer Details">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-1 md:col-span-2">
                                        <SearchableSelect
                                            label="Company Name"
                                            value={invoice['Company Name'] || ''}
                                            options={companyOptions}
                                            onChange={handleCompanySelect}
                                            placeholder="Select Company"
                                            required
                                        />
                                    </div>
                                    <FormInput label="Contact Name" name="Contact Name" value={invoice['Contact Name']} onChange={handleInputChange} />
                                    <FormInput label="Phone Number" name="Phone Number" value={invoice['Phone Number']} onChange={handleInputChange} />
                                    <FormInput label="Email" name="Email" value={invoice['Email']} onChange={handleInputChange} />
                                    <FormInput label="Payment Term" name="Payment Term" value={invoice['Payment Term']} onChange={handleInputChange} />
                                    <FormInput label="Tin No." name="Tin No." value={invoice['Tin No.']} onChange={handleInputChange} />
                                    <div className="col-span-1 md:col-span-2">
                                        <FormTextarea label="Company Address" name="Company Address" value={invoice['Company Address']} onChange={handleInputChange} />
                                    </div>
                                </div>
                            </FormSection>

                            <FormSection title="Line Items">
                                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-3 py-2 font-semibold text-slate-700 w-12">No</th>
                                                <th className="px-3 py-2 font-semibold text-slate-700 w-32">Code</th>
                                                <th className="px-3 py-2 font-semibold text-slate-700">Description</th>
                                                <th className="px-3 py-2 font-semibold text-slate-700 w-20">Qty</th>
                                                <th className="px-3 py-2 font-semibold text-slate-700 w-32">Price</th>
                                                <th className="px-3 py-2 font-semibold text-slate-700 w-32">Total</th>
                                                <th className="px-3 py-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {items.map((item, index) => (
                                                <tr key={item.id}>
                                                    <td className="px-3 py-2">
                                                        <input type="number" value={item.no} onChange={(e) => handleItemChange(item.id, 'no', parseInt(e.target.value) || 0)} className="w-full p-1 border-none focus:ring-0 text-center" />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input value={item.itemCode} onChange={(e) => handleItemChange(item.id, 'itemCode', e.target.value)} className="w-full p-1 border rounded" />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <textarea value={item.description} onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} className="w-full p-1 border rounded resize-none" rows={1} />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input type="number" value={item.qty} onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)} className="w-full p-1 border rounded text-center" />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)} className="w-full p-1 border rounded text-right" />
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {getCurrencySymbol(invoice.Currency as any)} {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <button onClick={addItem} className="mt-4 text-brand-600 font-semibold text-sm hover:underline">+ Add Line Item</button>
                            </FormSection>

                            <FormSection title="Attachment">
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Attach File</label>
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                    {isUploading ? (
                                        <div className="flex items-center gap-3 text-sm text-slate-600 p-3 rounded-lg bg-slate-100 border border-slate-200">
                                            <Spinner size="sm" />
                                            <span>Uploading...</span>
                                        </div>
                                    ) : invoice['Attachment'] ? (
                                        <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                                            <a href={invoice['Attachment']} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 hover:underline truncate max-w-xs sm:max-w-md">
                                                View Uploaded File
                                            </a>
                                            <button type="button" onClick={() => setInvoice(prev => ({ ...prev, Attachment: '' }))} className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-100 rounded-full transition-colors ml-2 flex-shrink-0">
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
                        </div>

                        {/* Preview Section */}
                        <div className="hidden lg:block w-[450px] xl:w-[600px] h-full overflow-y-auto bg-slate-100 rounded-xl p-8 border border-slate-200 custom-scrollbar">
                            {previewMode === 'invoice' ? (
                                <PrintableInvoice {...printableProps} />
                            ) : (
                                <PrintableDO {...printableProps} />
                            )}
                        </div>
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
        </>
    );
};

export default InvoiceCreator;
