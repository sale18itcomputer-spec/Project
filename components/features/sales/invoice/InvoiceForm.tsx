import React from 'react';
import { Invoice } from "../../../../types";
import { LineItem } from "./types";
import { FormSection, FormInput, FormSelect, FormTextarea } from "../../../common/FormControls";
import SearchableSelect from "../../../common/SearchableSelect";
import { ScrollArea } from "../../../ui/scroll-area";
import Spinner from "../../../common/Spinner";
import { Trash2, X, Upload, Plus } from 'lucide-react';
import { PricelistCombobox } from "./PricelistCombobox";
import { SerialNumberPicker } from "../../../common/SerialNumberPicker";

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
    addPromoRow: () => void;
    handlePromoAmountChange: (id: string, value: string) => void;
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
    /** Service invoice mode — swaps the SO reference for a Service Ticket link and service labels. */
    isService?: boolean;
    serviceTicketOptions?: string[];
    serviceTicketRef?: string;
    handleServiceTicketSelect?: (ticketNo: string) => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
    invoice, setInvoice, items, setItems, handleInputChange, handleSOSelect, soOptions,
    handleCompanySelect, companyOptions, removeItem, handleItemChange, handlePricelistItemSelect,
    addItem, addPromoRow, handlePromoAmountChange, totals, fileInputRef, handleFileUpload, isUploading, showFormPanel, setShowFormPanel,
    STATUS_OPTIONS, TAXABLE_OPTIONS, CURRENCY_OPTIONS, getCurrencySymbol,
    isService = false, serviceTicketOptions = [], serviceTicketRef = '', handleServiceTicketSelect
}) => {
    return (
                    <div className={`bg-card border-l border-border transition-all duration-300 ease-in-out flex flex-col flex-shrink-0 ${showFormPanel ? 'w-[500px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'}`}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
                            <div className="flex items-center gap-2">
                                <div className={`w-1 h-5 rounded-full ${isService ? 'bg-amber-500' : 'bg-brand-500'}`}></div>
                                <h3 className="text-sm font-bold text-foreground">{isService ? 'Service Invoice Details' : 'Document Information'}</h3>
                                {isService && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                        Service
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setShowFormPanel(false)}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-all"
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
                                    {isService ? (
                                        <SearchableSelect
                                            name="Service Ticket"
                                            label="Service Ticket"
                                            value={serviceTicketRef}
                                            options={serviceTicketOptions}
                                            onChange={v => handleServiceTicketSelect?.(v)}
                                            placeholder="Link a ticket (optional)"
                                        />
                                    ) : (
                                        <SearchableSelect
                                            name="SO No"
                                            label="SO Reference"
                                            value={invoice['SO No'] || ''}
                                            options={soOptions}
                                            onChange={handleSOSelect}
                                            placeholder="Select SO"
                                        />
                                    )}
                                    <FormSelect label="Status" name="Status" value={invoice['Status']} options={STATUS_OPTIONS} onChange={handleInputChange} />
                                    <FormSelect label="Taxable" name="Taxable" value={invoice['Taxable']} options={TAXABLE_OPTIONS} onChange={handleInputChange} />
                                    <FormSelect label="Currency" name="Currency" value={invoice['Currency']} options={CURRENCY_OPTIONS} onChange={handleInputChange} />
                                </FormSection>

                                <FormSection title="Payment Details">
                                    <FormInput
                                        label="Deposit" name="Deposit" type="number" value={invoice['Deposit']} onChange={handleInputChange}
                                        actionButton={
                                            <button
                                                type="button"
                                                onClick={() => setInvoice(prev => ({ ...prev, Deposit: Number((totals.subTotal * 0.2).toFixed(2)) }))}
                                                className="text-[10px] font-bold uppercase tracking-wide text-brand-600 hover:underline"
                                            >
                                                Set 20%
                                            </button>
                                        }
                                    />
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

                                <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">{isService ? 'Service & Parts' : 'Line Items'}</h3>
                                    <div className="space-y-4">
                                        {items.map((item) => {
                                            const isPromoRow = !!item.isPromotion;
                                            return (
                                            <div key={item.id} className={`relative p-4 rounded-xl border shadow-sm transition-all group ${isPromoRow ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60' : 'bg-muted/50 border-border hover:border-brand-400 hover:shadow-md'}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(item.id)}
                                                    className="absolute top-3 right-3 text-muted-foreground hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                                                >
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
                                                                <textarea value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                                    className="w-full text-sm p-3 rounded-lg border border-amber-500/30 bg-input text-foreground focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-none"
                                                                    rows={2}
                                                                    placeholder={"e.g. Buy 10-29pcs get cash back $40\nPeriod: 01st - 30th June 2026"} />
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div>
                                                                    <label className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Cashback Amount</label>
                                                                    <input type="number" min={0} step="0.01"
                                                                        value={Math.abs(item.amount)}
                                                                        onChange={e => handlePromoAmountChange(item.id, e.target.value)}
                                                                        className="w-32 h-9 px-3 text-right text-sm bg-input border border-amber-500/30 rounded-lg text-foreground focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20" />
                                                                </div>
                                                                <span className="text-xs font-semibold text-rose-500 pt-5">deducted from total</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                    <div className="flex flex-wrap gap-3 pr-8 mb-3">
                                                        <div className="w-10">
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block text-center">No.</label>
                                                            <div className="h-9 flex items-center justify-center bg-card rounded-lg border border-border font-mono text-sm font-semibold text-foreground shadow-sm">
                                                                {item.no}
                                                            </div>
                                                        </div>
                                                        {!isService && (
                                                            <div className="flex-1 min-w-[140px]">
                                                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Item Code</label>
                                                                <PricelistCombobox item={item} onItemChange={handleItemChange} onPricelistItemSelect={handlePricelistItemSelect} />
                                                            </div>
                                                        )}
                                                        <div className="flex-[1.5] min-w-[160px]">
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Model</label>
                                                            <input
                                                                type="text"
                                                                value={item.modelName}
                                                                onChange={e => handleItemChange(item.id, 'modelName', e.target.value)}
                                                                className="w-full h-9 px-3 text-sm font-medium border border-border rounded-lg bg-input text-foreground focus:border-brand-500 focus:ring-2 focus:ring-brand-200 transition-all shadow-sm "
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="mb-3">
                                                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Description / Spec</label>
                                                        <textarea value={item.description} onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} className="w-full text-sm p-3 rounded-lg border border-border transition-all bg-input text-foreground" rows={2} />
                                                    </div>

                                                    <div className="flex flex-wrap gap-3">
                                                        <div className="w-20">
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Qty</label>
                                                            <input type="number" value={item.qty} onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)} className="w-full h-9 px-2 text-center text-sm bg-input border border-border rounded-lg text-foreground" />
                                                        </div>
                                                        <div className="w-28">
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Unit Price</label>
                                                            <input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)} className="w-full h-9 px-3 text-right text-sm bg-input border border-border rounded-lg text-foreground" />
                                                        </div>
                                                        <div className="w-full">
                                                            <SerialNumberPicker
                                                                itemCode={item.itemCode}
                                                                modelName={item.modelName}
                                                                qty={Number(item.qty) || 0}
                                                                value={item.serialNumber || ''}
                                                                onChange={v => handleItemChange(item.id, 'serialNumber', v)}
                                                            />
                                                        </div>
                                                        <div className="flex-1 text-right pt-4">
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase">Total</div>
                                                            <div className="text-lg font-bold text-foreground">{getCurrencySymbol(invoice.Currency as any)}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                        </div>
                                                    </div>
                                                    </>
                                                )}
                                            </div>
                                            );
                                        })}

                                        <div className="flex gap-3">
                                        <button onClick={addItem} className="flex-1 py-2.5 rounded-lg border border-dashed border-brand-300 text-brand-600 bg-brand-50/50 hover:bg-brand-50 hover:border-brand-400 font-bold text-sm transition-all flex items-center justify-center gap-2">
                                            <Plus className="w-4 h-4" /> {isService ? 'Add Service / Part' : 'Add Item'}
                                        </button>
                                        {!isService && (
                                            <button type="button" onClick={addPromoRow} className="flex-1 py-2.5 rounded-lg border border-dashed border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                                                <span>+ Add Cashback</span>
                                            </button>
                                        )}
                                        </div>

                                        <div className="bg-muted/50 rounded-xl p-5 border border-border mt-6 space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground font-medium">Sub Total</span>
                                                <span className="text-foreground font-black">{getCurrencySymbol(invoice.Currency as any)}{totals.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground font-medium">Tax (VAT 10%)</span>
                                                <span className="text-foreground font-black">{getCurrencySymbol(invoice.Currency as any)}{totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-3 border-t border-border">
                                                <span className="text-xs text-foreground font-black uppercase tracking-wider">Grand Total</span>
                                                <span className="text-xl text-brand-600 font-black">{getCurrencySymbol(invoice.Currency as any)}{totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <FormSection title="Attachment">
                                    <div className="space-y-4">
                                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                        {isUploading ? (
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground p-4 rounded-xl bg-muted/50 border-2 border-dashed border-border">
                                                <Spinner size="sm" />
                                                <span className="font-bold">Uploading...</span>
                                            </div>
                                        ) : invoice['Attachment'] ? (
                                            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                                                <a href={invoice['Attachment']} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-500 hover:underline truncate max-w-[200px]">
                                                    View Uploaded File
                                                </a>
                                                <button type="button" onClick={() => setInvoice(prev => ({ ...prev, Attachment: '' }))} className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full text-center p-4 bg-muted/50 hover:bg-muted text-muted-foreground font-bold rounded-xl border-2 border-dashed border-border hover:border-border/80 transition-all flex flex-col items-center gap-2">
                                                <Upload className="w-5 h-5 text-muted-foreground" />
                                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Click to Upload File</span>
                                            </button>
                                        )}
                                    </div>
                                </FormSection>
                            </div>
                        </ScrollArea>
                    </div>
    );
};
