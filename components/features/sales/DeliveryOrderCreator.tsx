'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DeliveryOrder, Invoice, SaleOrder } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { createRecord, updateRecord, uploadFile } from '../../../services/api';
import { formatToSheetDate, formatToInputDate } from '../../../utils/time';
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
import PrintableDO from '../../pdf/PrintableDO';
import PdfPreviewPane from '../../pdf/PdfPreviewPane';

const DO_STATUS_OPTIONS: DeliveryOrder['Status'][] = ['Pending', 'Delivered', 'Cancelled'];
const CURRENCY_OPTIONS: ('USD' | 'KHR')[] = ['USD', 'KHR'];

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
    serialNumber?: string;
}

interface Props {
    onBack: () => void;
    existingDO?: DeliveryOrder | null;
    initialData?: {
        action?: string;
        invoiceData?: Invoice;
        soData?: SaleOrder;
    };
}

const DeliveryOrderCreator: React.FC<Props> = ({ onBack, existingDO, initialData }) => {
    const { deliveryOrders, setDeliveryOrders, invoices, saleOrders, companies, contacts, refetchModule } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successInfo, setSuccessInfo] = useState<{ doNo: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showFormPanel, setShowFormPanel] = useState(true);
    const [signaturePadding, setSignaturePadding] = useState(160);
    const [labelPadding, setLabelPadding] = useState(200);
    const [colWidths, setColWidths, resetColWidths] = useColumnWidths('delivery-order');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [items, setItems] = useState<LineItem[]>([
        { id: `item-${Date.now()}`, no: 1, itemCode: '', modelName: '', description: '', qty: 1 }
    ]);
    const [doc, setDoc] = useState<Partial<DeliveryOrder>>({});

    // Auto-generate DO No
    const calculatedNextDONo = useMemo(() => {
        const year = new Date().getFullYear().toString();
        const prefix = `DN${year}-`;
        const thisYear = (deliveryOrders || []).filter(d => d['DO No']?.startsWith(prefix));
        if (thisYear.length === 0) return `${prefix}00002`;
        const maxNum = thisYear.reduce((max, d) => {
            const n = parseInt(d['DO No'].slice(prefix.length), 10);
            return isNaN(n) ? max : Math.max(max, n);
        }, 1);
        return `${prefix}${String(maxNum + 1).padStart(5, '0')}`;
    }, [deliveryOrders]);

    // Initialise form
    useEffect(() => {
        if (existingDO) {
            setDoc({
                ...existingDO,
                'DO Date': existingDO['DO Date'] ? formatToInputDate(existingDO['DO Date']) : getTodayDateString(),
                'Delivery Date': existingDO['Delivery Date'] ? formatToInputDate(existingDO['Delivery Date']) : '',
            });
            let fetchedItems: LineItem[] = [];
            try {
                fetchedItems = typeof existingDO.ItemsJSON === 'string'
                    ? JSON.parse(existingDO.ItemsJSON) : existingDO.ItemsJSON || [];
            } catch { }
            if (fetchedItems.length > 0) setItems(fetchedItems);
        } else {
            // Prefill from Invoice or SO if provided
            const inv = initialData?.invoiceData;
            const so = initialData?.soData;
            const source = inv || so;
            const company = source ? companies?.find(c => c['Company Name'] === source['Company Name']) : null;

            setDoc(prev => {
                if (Object.keys(prev).length > 0 && prev['DO No']) return prev;
                return {
                    'DO No': calculatedNextDONo,
                    'DO Date': getTodayDateString(),
                    'Inv No': inv?.['Inv No'] || '',
                    'SO No': inv?.['SO No'] || so?.['SO No'] || '',
                    'Company Name': source?.['Company Name'] || '',
                    'Company Address': company?.['Address (English)'] || '',
                    'Contact Name': source?.['Contact Name'] || '',
                    'Phone Number': source?.['Phone Number'] || '',
                    'Email': source?.['Email'] || (source as any)?.Email || '',
                    'Currency': source?.['Currency'] || 'USD',
                    'Status': 'Pending',
                    'Payment Term': source?.['Payment Term'] || '',
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

            // Copy items from invoice/SO if available
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
                })));
            }
        }
    }, [existingDO, initialData, calculatedNextDONo]);

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
            'Tin No': company?.['Tin No.'] || company?.['VAT TIN'] || prev['Tin No'] || '',
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
            'Email': inv['Email'] || (inv as any)?.Email || prev['Email'],
            'Currency': inv['Currency'] || prev['Currency'],
            'Payment Term': inv['Payment Term'] || prev['Payment Term'],
            'Tin No': company?.['Tin No.'] || company?.['VAT TIN'] || (inv as any)?.['Tin No.'] || prev['Tin No'] || '',
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
            })));
        }
        addToast(`Loaded info from ${invNo}`, 'success');
    };

    const handleItemChange = (id: string, field: keyof Omit<LineItem, 'id' | 'no'>, value: string | number) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const addItem = () => {
        const nextNo = items.length > 0 ? Math.max(...items.map(i => i.no)) + 1 : 1;
        setItems(prev => [...prev, { id: `item-${Date.now()}`, no: nextNo, itemCode: '', modelName: '', description: '', qty: 1 }]);
    };

    const removeItem = (id: string) => {
        if (items.length === 1) return;
        setItems(prev => prev.filter(i => i.id !== id));
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

    const handleSave = async () => {
        if (!doc['DO No'] || !doc['Company Name']) {
            addToast('Please fill in DO No. and Company Name', 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            // Validate FK references — nullify if not found in DB to avoid FK constraint violations
            const validInvNo = (invoices || []).some(i => i['Inv No'] === doc['Inv No']) ? doc['Inv No'] : null;
            const validSoNo = (saleOrders || []).some(s => s['SO No'] === doc['SO No']) ? doc['SO No'] : null;

            const payload = {
                ...doc,
                'Inv No': validInvNo,
                'SO No': validSoNo,
                'DO Date': doc['DO Date'] ? formatToSheetDate(doc['DO Date']) : null,
                'Delivery Date': doc['Delivery Date'] ? formatToSheetDate(doc['Delivery Date']) : null,
                'ItemsJSON': items,
                'Created By': doc['Created By'] || currentUser?.Name || '',
                updated_at: new Date().toISOString(),
            };

            if (existingDO) {
                await updateRecord('Delivery Orders', existingDO['DO No'], payload);
                setDeliveryOrders(cur => cur
                    ? cur.map(d => d['DO No'] === doc['DO No'] ? (payload as DeliveryOrder) : d)
                    : [payload as DeliveryOrder]
                );
            } else {
                await createRecord('Delivery Orders', payload);
                setDeliveryOrders(cur => cur ? [payload as DeliveryOrder, ...cur] : [payload as DeliveryOrder]);
            }
            refetchModule('Delivery Orders');
            setSuccessInfo({ doNo: doc['DO No']! });
        } catch (err: any) {
            addToast(err.message || 'Failed to save Delivery Order', 'error');
        } finally { setIsSubmitting(false); }
    };

    const handleDownloadPDF = () => {
        generatePDF({
            type: 'Delivery Order',
            headerData: {
                ...doc,
                'DO No': doc['DO No'],
                'DO Date': doc['DO Date'],
                'Inv No': doc['Inv No'],
                'SO No': doc['SO No'],
                'Company Name': doc['Company Name'],
                'Company Address': doc['Company Address'],
                'Contact Name': doc['Contact Name'],
                'Phone Number': doc['Phone Number'],
                'Tin No': doc['Tin No'] || '',
                'Tin No.': doc['Tin No'] || '',
            },
            items: items.map(item => ({
                no: item.no,
                itemCode: item.itemCode,
                modelName: item.modelName,
                description: item.description,
                qty: item.qty,
                serialNumber: item.serialNumber || '',
                unitPrice: 0,
                amount: 0,
            })),
            totals: { subTotal: 0, tax: 0, grandTotal: 0 },
            currency: (doc['Currency'] as 'USD' | 'KHR') || 'USD',
            signaturePadding,
            previewMode: false,
            filename: `DO_${doc['DO No']}.pdf`,
        });
    };

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
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all border ${showFormPanel ? 'bg-slate-100 text-slate-900 border-slate-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title="Toggle Form Panel"
            >
                <PanelRight className="w-4 h-4" />
                <span className="hidden lg:inline">{showFormPanel ? 'Hide Form' : 'Form'}</span>
            </button>
            <ColumnWidthPopover
                docType="delivery-order"
                widths={colWidths}
                onChange={setColWidths}
                onReset={resetColWidths}
            />
            <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-white text-brand-600 border border-brand-200 rounded-md hover:bg-brand-50 shadow-sm transition-all"
            >
                <Download className="w-4 h-4" /> Download PDF
            </button>
            <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-6 rounded-md transition shadow-md text-sm disabled:opacity-50 min-w-[120px] flex items-center justify-center"
            >
                {isSubmitting ? <Spinner size="sm" color="white" /> : 'Save DO'}
            </button>
        </div>
    );

    return (
        <>
            <DocumentEditorContainer
                title={existingDO ? `Edit DO: ${doc['DO No']}` : 'New Delivery Order'}
                onBack={onBack}
                onSave={handleSave}
                isSubmitting={isSubmitting}
                rightActions={headerRight}
            >
                <div className="h-full flex overflow-hidden">
                    {/* PDF Preview */}
                    <PdfPreviewPane
                        docLabel={`${doc['DO No'] || ''} • ${doc['Company Name'] || 'No Company Selected'}`}
                        signaturePadding={signaturePadding}
                        onSignaturePaddingChange={setSignaturePadding}
                        defaultSignaturePadding={160}
                        labelPadding={labelPadding}
                        onLabelPaddingChange={undefined}
                        columnWidths={colWidths}
                        pdfOptions={{
                            type: 'Delivery Order',
                            headerData: {
                                ...doc,
                                'Company Address': doc['Company Address'] || '',
                            },
                            items: items.map(i => ({
                                no: i.no, itemCode: i.itemCode, modelName: i.modelName,
                                description: i.description, qty: i.qty,
                                serialNumber: i.serialNumber || '',
                                unitPrice: 0, amount: 0,
                            })),
                            totals: { subTotal: 0, tax: 0, grandTotal: 0 },
                            currency: (doc['Currency'] as 'USD' | 'KHR') || 'USD',
                        }}
                    />

                    {/* Form Sidebar */}
                    <div className={`bg-white border-l border-gray-200 transition-all duration-300 flex flex-col flex-shrink-0 ${showFormPanel ? 'w-[480px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'}`}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-5 bg-brand-500 rounded-full" />
                                <h3 className="text-sm font-bold text-gray-800">Delivery Order Information</h3>
                            </div>
                            <button onClick={() => setShowFormPanel(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <ScrollArea className="flex-1 px-5 py-4">
                            <div className="space-y-6">
                                <FormSection title="Header Details">
                                    <FormInput label="DO No." name="DO No" value={doc['DO No']} onChange={handleInputChange} required />
                                    <FormInput label="DO Date" name="DO Date" type="date" value={doc['DO Date']} onChange={handleInputChange} />
                                    <SearchableSelect
                                        name="Inv No" label="Invoice Reference"
                                        value={doc['Inv No'] || ''} options={invoiceOptions}
                                        onChange={handleInvoiceSelect} placeholder="Select Invoice"
                                    />
                                    <FormInput label="SO Reference" name="SO No" value={doc['SO No']} onChange={handleInputChange} />
                                    <FormSelect label="Status" name="Status" value={doc['Status']} options={DO_STATUS_OPTIONS} onChange={handleInputChange} />
                                    <FormSelect label="Currency" name="Currency" value={doc['Currency']} options={CURRENCY_OPTIONS} onChange={handleInputChange} />
                                    <FormInput label="Delivery Date" name="Delivery Date" type="date" value={doc['Delivery Date']} onChange={handleInputChange} />
                                    <FormInput label="Payment Term" name="Payment Term" value={doc['Payment Term']} onChange={handleInputChange} />
                                </FormSection>

                                <FormSection title="Signature Info">
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormInput label="Receiver's Name" name="Prepared By" value={doc['Prepared By']} onChange={handleInputChange} />
                                        <FormInput label="Position" name="Prepared By Position" value={doc['Prepared By Position']} onChange={handleInputChange} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormInput label="Deliverer's Name" name="Approved By" value={doc['Approved By']} onChange={handleInputChange} />
                                        <FormInput label="Position" name="Approved By Position" value={doc['Approved By Position']} onChange={handleInputChange} />
                                    </div>
                                </FormSection>

                                <FormSection title="Customer Details">
                                    <SearchableSelect
                                        name="Company Name" label="Company Name"
                                        value={doc['Company Name'] || ''} options={companyOptions}
                                        onChange={handleCompanySelect} placeholder="Select Company" required
                                    />
                                    <FormInput label="VAT TIN" name="Tin No" value={doc['Tin No'] || ''} onChange={handleInputChange} />
                                    <FormInput label="Contact Name" name="Contact Name" value={doc['Contact Name']} onChange={handleInputChange} />
                                    <FormInput label="Phone Number" name="Phone Number" value={doc['Phone Number']} onChange={handleInputChange} />
                                    <FormInput label="Email" name="Email" value={doc['Email']} onChange={handleInputChange} />
                                    <FormTextarea label="Company Address" name="Company Address" value={doc['Company Address']} onChange={handleInputChange} rows={3} />
                                </FormSection>

                                {/* Line Items — no price */}
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Line Items</h3>
                                    <div className="space-y-3">
                                        {items.map(item => (
                                            <div key={item.id} className="relative p-4 bg-slate-50 rounded-xl border border-slate-200 group hover:border-brand-300 transition-all">
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <div className="flex gap-3 pr-8 mb-3">
                                                    <div className="w-10 flex flex-col items-center justify-center">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">No.</label>
                                                        <div className="h-9 w-full flex items-center justify-center bg-white rounded-lg border border-slate-200 font-mono text-sm font-semibold text-slate-600">
                                                            {item.no}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Item Code</label>
                                                        <input type="text" value={item.itemCode} onChange={e => handleItemChange(item.id, 'itemCode', e.target.value)}
                                                            className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-200 transition-all" />
                                                    </div>
                                                    <div className="flex-[1.5]">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Model</label>
                                                        <input type="text" value={item.modelName} onChange={e => handleItemChange(item.id, 'modelName', e.target.value)}
                                                            className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-200 transition-all" />
                                                    </div>
                                                </div>
                                                <div className="mb-3">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Description</label>
                                                    <textarea value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                        className="w-full text-sm p-3 rounded-lg border border-slate-200 bg-white" rows={2} />
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="w-24">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Qty</label>
                                                        <input type="number" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', e.target.value)}
                                                            className="w-full h-9 px-2 text-center text-sm bg-white border border-slate-200 rounded-lg" />
                                                    </div>
                                                    <div className="w-full">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Serial Numbers <span className="normal-case font-normal text-slate-300">(one per line)</span></label>
                                                        <textarea
                                                            value={item.serialNumber || ''}
                                                            onChange={e => handleItemChange(item.id, 'serialNumber', e.target.value)}
                                                            className="w-full text-xs p-2 font-mono rounded-lg border border-slate-200 bg-white resize-y min-h-[60px]"
                                                            rows={3}
                                                            placeholder={`SN001\nSN002\nSN003...`}
                                                        />
                                                        <div className="text-[9px] text-slate-400 mt-0.5">{(item.serialNumber || '').split('\n').filter((s: string) => s.trim()).length} S/N entered</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button onClick={addItem}
                                            className="w-full py-2.5 rounded-lg border border-dashed border-brand-300 text-brand-600 bg-brand-50/50 hover:bg-brand-50 font-bold text-sm flex items-center justify-center gap-2">
                                            <Plus className="w-4 h-4" /> Add Item
                                        </button>
                                    </div>
                                </div>

                                <FormSection title="Remarks">
                                    <FormTextarea label="Remark" name="Remark" value={doc['Remark']} onChange={handleInputChange} rows={3} />
                                    <FormTextarea label="Terms and Conditions" name="Terms and Conditions" value={doc['Terms and Conditions']} onChange={handleInputChange} rows={3} />
                                </FormSection>

                                <FormSection title="Attachment">
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                    {isUploading ? (
                                        <div className="flex items-center gap-3 text-sm text-slate-600 p-4 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200">
                                            <Spinner size="sm" /><span className="font-bold">Uploading...</span>
                                        </div>
                                    ) : doc['File'] ? (
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                                            <a href={doc['File']} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-700 hover:underline truncate max-w-[200px]">View Uploaded File</a>
                                            <button onClick={() => setDoc(prev => ({ ...prev, File: '' }))} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-full transition-colors"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => fileInputRef.current?.click()}
                                            className="w-full text-center p-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center gap-2">
                                            <Upload className="w-5 h-5 text-slate-400" />
                                            <span className="text-[10px] uppercase tracking-widest text-slate-400">Click to Upload File</span>
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
                    title="Delivery Order Saved!"
                    message={`${successInfo.doNo} has been saved successfully.`}
                />
            )}
        </>
    );
};

export default DeliveryOrderCreator;
