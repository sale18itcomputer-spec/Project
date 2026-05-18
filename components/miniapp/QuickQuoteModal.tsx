import React, { useState, useMemo } from 'react';
import { useB2BData } from '@/hooks/useB2BData';
import { createQuotationSheet } from '@/services/b2bDb';
import { useToast } from '@/contexts/ToastContext';
import { Loader2, Plus, X, Search, Check } from 'lucide-react';
import { Quotation, PricelistItem } from '@/types';
import { haptic } from '@/lib/miniapp/telegramShare';
import { parseSheetValue, formatCurrencySmartly } from '@/utils/formatters';
import { useAuth } from '@/contexts/AuthContext';

export default function QuickQuoteModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (q: Quotation) => void }) {
    const { quotations, companies, pricelist } = useB2BData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [searchItem, setSearchItem] = useState('');
    const [selectedItems, setSelectedItems] = useState<Array<{ item: PricelistItem; qty: number }>>([]);

    const filteredPricelist = useMemo(() => {
        if (!pricelist) return [];
        if (!searchItem) return pricelist.slice(0, 20);
        const q = searchItem.toLowerCase();
        return pricelist.filter(p => 
            p.Code?.toLowerCase().includes(q) || 
            p.Model?.toLowerCase().includes(q) || 
            p.Brand?.toLowerCase().includes(q)
        ).slice(0, 20);
    }, [pricelist, searchItem]);

    const nextQuoteNo = useMemo(() => {
        if (!quotations || quotations.length === 0) return 'Q-0000001';
        const max = quotations.reduce((m, q) => {
            const match = q['Quote No']?.match(/Q-(\d+)/);
            return match ? Math.max(m, parseInt(match[1], 10)) : m;
        }, 0);
        return `Q-${String(max + 1).padStart(7, '0')}`;
    }, [quotations]);

    const handleAddItem = (p: PricelistItem) => {
        haptic('light');
        setSelectedItems(prev => {
            const exists = prev.find(i => i.item.Code === p.Code);
            if (exists) {
                return prev.map(i => i.item.Code === p.Code ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, { item: p, qty: 1 }];
        });
        setSearchItem('');
    };

    const handleQtyChange = (code: string, delta: number) => {
        haptic('light');
        setSelectedItems(prev => prev.map(i => {
            if (i.item.Code === code) {
                const newQty = Math.max(0, i.qty + delta);
                return { ...i, qty: newQty };
            }
            return i;
        }).filter(i => i.qty > 0));
    };

    const handleSave = async () => {
        if (!companyName.trim()) return addToast('Please enter a customer name', 'error');
        if (selectedItems.length === 0) return addToast('Please add at least one item', 'error');

        setIsSubmitting(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const validity = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];

            let subTotal = 0;
            const itemsJSON = selectedItems.map((si, idx) => {
                const up = parseSheetValue(si.item['End User Price']);
                const amt = up * si.qty;
                subTotal += amt;
                return {
                    id: `item-${idx}`,
                    no: idx + 1,
                    itemCode: si.item.Code,
                    modelName: si.item.Model,
                    description: si.item.Description || '',
                    qty: si.qty,
                    unitPrice: up,
                    amount: amt,
                    commission: 0,
                };
            });

            const vat = subTotal * 0.1;
            const grandTotal = subTotal + vat;

            const company = companies?.find(c => c['Company Name']?.toLowerCase() === companyName.toLowerCase());

            const newQ: Quotation = {
                'Quote No': nextQuoteNo,
                'Quote Date': today,
                'Validity Date': validity,
                'Company Name': company ? company['Company Name'] : companyName,
                'Company Address': company?.['Address (English)'] || '',
                'Contact Name': '',
                'Contact Number': '',
                'Contact Email': '',
                'Amount': grandTotal.toString(),
                'CM': '0',
                'Status': 'Open',
                'Reason': '',
                'Payment Term': company?.['Payment Term'] || '',
                'Stock Status': 'Available',
                'Created By': currentUser?.Name || 'Mini App',
                'Currency': 'USD',
                'Prepared By': currentUser?.Name || 'Mini App',
                'Prepared By Position': '',
                'Approved By': '',
                'Approved By Position': '',
                'Remark': 'Created via Quick Quote',
                'Terms and Conditions': '',
                'Tax Type': 'VAT',
                'File': '',
            };

            await createQuotationSheet(nextQuoteNo, { ...newQ, ItemsJSON: JSON.stringify(itemsJSON) }, false);
            
            addToast('Quotation created successfully!', 'success');
            onCreated(newQ);
            onClose();
            setCompanyName('');
            setSelectedItems([]);
            haptic('medium');
        } catch (err: any) {
            addToast(`Error: ${err.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const total = selectedItems.reduce((sum, i) => sum + (parseSheetValue(i.item['End User Price']) * i.qty), 0) * 1.1;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full sm:w-[500px] h-[90vh] sm:h-[80vh] bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                    <h3 className="font-bold text-foreground">Quick Quote</h3>
                    <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-muted/80 text-muted-foreground"><X size={18} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
                    {/* Customer */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Customer Name</label>
                        <input 
                            type="text" 
                            value={companyName} 
                            onChange={e => setCompanyName(e.target.value)}
                            placeholder="Enter customer or company name..."
                            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            list="companies-list"
                        />
                        <datalist id="companies-list">
                            {companies?.map(c => <option key={c['Company Name']} value={c['Company Name']} />)}
                        </datalist>
                    </div>

                    {/* Selected Items */}
                    {selectedItems.length > 0 && (
                        <div className="bg-brand-500/5 rounded-xl border border-brand-500/20 p-3 flex flex-col gap-2">
                            {selectedItems.map(si => (
                                <div key={si.item.Code} className="flex items-center justify-between bg-card p-2 rounded-lg border border-border shadow-sm">
                                    <div className="min-w-0 flex-1 pr-2">
                                        <p className="text-xs font-bold truncate text-foreground">{si.item.Model}</p>
                                        <p className="text-[10px] text-muted-foreground">{si.item.Code} • ${parseSheetValue(si.item['End User Price'])}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={() => handleQtyChange(si.item.Code, -1)} className="w-7 h-7 flex items-center justify-center rounded-md bg-muted text-foreground font-bold">-</button>
                                        <span className="text-sm font-bold w-4 text-center">{si.qty}</span>
                                        <button onClick={() => handleQtyChange(si.item.Code, 1)} className="w-7 h-7 flex items-center justify-center rounded-md bg-muted text-foreground font-bold">+</button>
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-between items-center px-1 pt-1 mt-1 border-t border-brand-500/10">
                                <span className="text-xs font-bold text-muted-foreground">Total (incl. VAT)</span>
                                <span className="text-sm font-black text-brand-600">{formatCurrencySmartly(total, 'USD')}</span>
                            </div>
                        </div>
                    )}

                    {/* Add Item */}
                    <div className="flex-1 flex flex-col min-h-[200px]">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Add Items</label>
                        <div className="relative mb-2 shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <input 
                                type="text"
                                value={searchItem}
                                onChange={e => setSearchItem(e.target.value)}
                                placeholder="Search pricelist..."
                                className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto bg-muted/30 rounded-xl border border-border">
                            {filteredPricelist.map(p => (
                                <button 
                                    key={p.Code} 
                                    onClick={() => handleAddItem(p)}
                                    className="w-full text-left p-3 border-b border-border hover:bg-muted transition-colors flex justify-between items-center"
                                >
                                    <div className="min-w-0 flex-1 pr-3">
                                        <p className="text-xs font-bold text-foreground truncate">{p.Model}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">{p.Code} • {p.Brand}</p>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-2">
                                        <span className="text-xs font-bold text-brand-600">${parseSheetValue(p['End User Price'])}</span>
                                        <Plus size={14} className="text-muted-foreground" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-card shrink-0">
                    <button 
                        onClick={handleSave}
                        disabled={isSubmitting || selectedItems.length === 0 || !companyName}
                        className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-brand-500/25"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Create Quote</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
