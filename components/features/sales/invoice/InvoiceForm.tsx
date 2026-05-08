import React from 'react';
import { Invoice } from "../../../../types";
import { LineItem } from "./types";
import { FormSection, FormInput, FormSelect, FormTextarea } from "../../../common/FormControls";
import SearchableSelect from "../../../common/SearchableSelect";
import { ScrollArea } from "../../../ui/scroll-area";
import Spinner from "../../../common/Spinner";
import { Trash2, X, Upload, Plus } from 'lucide-react';
import { PricelistCombobox } from "./PricelistCombobox";

interface InvoiceFormProps {
    invoice: Partial<Invoice>;
    setInvoice: React.Dispatch<React.SetStateAction<Partial<Invoice>>>;
    items: LineItem[];
    setItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    handleSOSelect: (soNo: string) => void;
    soOptions: string[];
    handleCompanySelect: (companyName: string) => void;
    companyOptions: string[];
    removeItem: (id: string) => void;
    handleItemChange: (id: string, field: keyof Omit<LineItem, 'id' | 'amount' | 'no'>, value: string | number) => void;
    handlePricelistItemSelect: (item: LineItem, p: any) => void;
    addItem: () => void;
    totals: { subTotal: number; tax: number; grandTotal: number; };
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isUploading: boolean;
    showFormPanel: boolean;
    setShowFormPanel: (show: boolean) => void;
    STATUS_OPTIONS: Invoice['Status'][];
    TAXABLE_OPTIONS: string[];
    CURRENCY_OPTIONS: ('USD' | 'KHR')[];
    getCurrencySymbol: (currency?: 'USD' | 'KHR') => string;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
    invoice, setInvoice, items, setItems, handleInputChange, handleSOSelect, soOptions,
    handleCompanySelect, companyOptions, removeItem, handleItemChange, handlePricelistItemSelect,
    addItem, totals, fileInputRef, handleFileUpload, isUploading, showFormPanel, setShowFormPanel,
    STATUS_OPTIONS, TAXABLE_OPTIONS, CURRENCY_OPTIONS, getCurrencySymbol
}) => {
    return (
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
                                    <FormInput label="Invoice No." name="Inv No" value={invoice['Inv No']} onChange={handleInputChange} required />
                                    <FormInput label="Invoice Date" name="Inv Date" type="date" value={invoice['Inv Date']} onChange={handleInputChange} />
                                    <FormInput label="Due Date" name="Due Date" type="date" value={invoice['Due Date']} onChange={handleInputChange} />
                                    <SearchableSelect
                                        name="SO No"
                                        label="SO Reference"
                                        value={invoice['SO No'] || ''}
                                        options={soOptions}
                                        onChange={handleSOSelect}
                                        placeholder="Select SO"
                                    />
                                    <FormSelect label="Status" name="Status" value={invoice['Status']} options={STATUS_OPTIONS} onChange={handleInputChange} />
                                    <FormSelect label="Taxable" name="Taxable" value={invoice['Taxable']} options={TAXABLE_OPTIONS} onChange={handleInputChange} />
                                    <FormSelect label="Currency" name="Currency" value={invoice['Currency']} options={CURRENCY_OPTIONS} onChange={handleInputChange} />
                                </FormSection>

                                <FormSection title="Payment Details">
                                    <FormInput label="Deposit" name="Deposit" type="number" value={invoice['Deposit']} onChange={handleInputChange} />
                                    <FormInput label="Exchange Rate (៛)" name="Exchange Rate" type="number" value={invoice['Exchange Rate']} onChange={handleInputChange} />
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
                                    <FormInput label="Company Name (Khmer)" name="Company Name (Khmer)" value={invoice['Company Name (Khmer)']} onChange={handleInputChange} />
                                    <FormInput label="Contact Name" name="Contact Name" value={invoice['Contact Name']} onChange={handleInputChange} />
                                    <FormInput label="Phone Number" name="Phone Number" value={invoice['Phone Number']} onChange={handleInputChange} />
                                    <FormInput label="Email" name="Email" value={invoice['Email']} onChange={handleInputChange} />
                                    <FormInput label="Payment Term" name="Payment Term" value={invoice['Payment Term']} onChange={handleInputChange} />
                                    <FormInput label="Tin No" name="Tin No" value={invoice['Tin No']} onChange={handleInputChange} />
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
                                                    <div className="w-full">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Serial Numbers <span className="normal-case font-normal text-slate-300">(one per line)</span></label>
                                                        <textarea
                                                            value={item.serialNumber || ''}
                                                            onChange={e => handleItemChange(item.id, 'serialNumber', e.target.value)}
                                                            className="w-full text-xs p-2 font-mono rounded-lg border border-slate-200 bg-white resize-y min-h-[60px]"
                                                            rows={3}
                                                            placeholder={`SN001\nSN002\nSN003...`}
                                                        />
                                                        <div className="text-[9px] text-slate-400 mt-0.5">{(item.serialNumber || '').split('\n').filter(s => s.trim()).length} S/N entered</div>
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
    );
};
