'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Bill, BillLine, BillVendor, ChartOfAccount, PurchaseOrder } from '../../../types';
import {
    fetchBills, createBill, updateBill, deleteBill,
    postBill, unpostBill, markBillPaid, getNextBillNumber,
} from '../../../services/billsApi';
import { fetchBillVendors } from '../../../services/billVendorsApi';
import { readRecords } from '../../../services/api';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { PlusCircle, Trash2, X, Check, ChevronDown, ChevronRight, Receipt, Download, AlertTriangle } from 'lucide-react';
import { exportBills } from '../../../utils/exportAccountingXlsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BILL_BRAND_INVENTORY: Record<string, string> = {
    'ASUS':              '12100',
    'MSI':               '12300',
    'Lenovo':            '12700',
    'ASUS Accessories':  '12100',
    'MSI Accessories':   '12300',
    'Lenovo Accessories':'12700',
};
const getBillInventoryAccount = (brand?: string) =>
    BILL_BRAND_INVENTORY[brand?.trim() ?? ''] ?? '12600';

const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getTodayISO = () => new Date().toISOString().split('T')[0];

const STATUS_BADGE: Record<string, string> = {
    draft:  'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
    posted: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    paid:   'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
};

const TYPE_BADGE: Record<string, string> = {
    vendor: 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
    inter:  'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700',
};

const PAYMENT_METHODS = ['Cash', 'ABA', 'Bank Transfer', 'KHQR', 'Cheque', 'Other'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftLine {
    key: string;
    description: string;
    account_number: string;
    qty: string;
    unit_price: string;
    amount: string;
}

interface Props {
    accounts: ChartOfAccount[];
}

const emptyHeader = (): Omit<Bill, 'id' | 'lines' | 'created_at' | 'updated_at'> => ({
    bill_number: '',
    bill_type: 'inter',
    vendor_name: '',
    po_reference: '',
    vendor_reference: '',
    bill_date: getTodayISO(),
    due_date: '',
    description: '',
    status: 'draft',
    total_amount: 0,
    notes: '',
});

const emptyLine = (): DraftLine => ({
    key: Math.random().toString(36).slice(2),
    description: '',
    account_number: '',
    qty: '1',
    unit_price: '',
    amount: '0.00',
});

// ── Pay modal ─────────────────────────────────────────────────────────────────

const PayModal: React.FC<{
    bill: Bill;
    onConfirm: (params: { paymentDate: string; paymentMethod: string; paymentReference: string }) => void;
    onClose: () => void;
}> = ({ bill, onConfirm, onClose }) => {
    const [date, setDate]   = useState(getTodayISO());
    const [method, setMethod] = useState('ABA');
    const [ref, setRef]     = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-base font-semibold text-foreground mb-4">Mark as Paid — {bill.bill_number}</h3>
                <p className="text-sm text-muted-foreground mb-4">Amount: <strong className="text-foreground">${fmt(bill.total_amount)}</strong></p>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Method</label>
                        <select value={method} onChange={e => setMethod(e.target.value)}
                            className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600">
                            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Reference (optional)</label>
                        <input type="text" value={ref} onChange={e => setRef(e.target.value)} placeholder="Transaction ID / Cheque no."
                            className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                    </div>
                </div>
                <div className="flex gap-2 mt-5 justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/50">Cancel</button>
                    <button onClick={() => onConfirm({ paymentDate: date, paymentMethod: method, paymentReference: ref })}
                        className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium">Confirm Payment</button>
                </div>
            </div>
        </div>
    );
};

// ── Bill form modal ───────────────────────────────────────────────────────────

const BillFormModal: React.FC<{
    bill: Bill | null;
    accounts: ChartOfAccount[];
    purchaseOrders: PurchaseOrder[];
    billVendors: BillVendor[];
    onSave: (header: Omit<Bill, 'id' | 'lines' | 'created_at' | 'updated_at'>, lines: Omit<BillLine, 'id' | 'bill_id' | 'created_at'>[]) => void;
    onClose: () => void;
    nextNumber: string;
}> = ({ bill, accounts, purchaseOrders, billVendors, onSave, onClose, nextNumber }) => {
    const [header, setHeader] = useState<Omit<Bill, 'id' | 'lines' | 'created_at' | 'updated_at'>>(
        bill ? {
            bill_number: bill.bill_number,
            bill_type: bill.bill_type,
            vendor_name: bill.vendor_name ?? '',
            po_reference: bill.po_reference ?? '',
            bill_date: bill.bill_date,
            due_date: bill.due_date ?? '',
            description: bill.description,
            status: bill.status,
            total_amount: bill.total_amount,
            journal_entry_id: bill.journal_entry_id,
            payment_journal_id: bill.payment_journal_id,
            notes: bill.notes ?? '',
        } : { ...emptyHeader(), bill_number: nextNumber }
    );

    const [lines, setLines] = useState<DraftLine[]>(() => {
        if (bill?.lines?.length) {
            return bill.lines.map(l => ({
                key: l.id ?? Math.random().toString(36).slice(2),
                description: l.description ?? '',
                account_number: l.account_number,
                qty: String(l.qty),
                unit_price: String(l.unit_price),
                amount: String(l.amount),
            }));
        }
        return [emptyLine()];
    });

    const billLineAccounts = useMemo(() => {
        const base = accounts
            .filter(a => ['Expense', 'Other Expense', 'Cost of Goods Sold', 'Other Current Asset', 'Fixed Asset'].includes(a.account_type))
            .sort((a, b) => a.account_number.localeCompare(b.account_number));
        // Always expose 70200 Purchase Discount for vendor bills (it's income, not expense)
        const disc = accounts.find(a => a.account_number === '70200');
        return disc && !base.some(a => a.account_number === '70200') ? [...base, disc] : base;
    }, [accounts]);

    const updateLine = (key: string, field: keyof DraftLine, value: string) => {
        setLines(prev => prev.map(l => {
            if (l.key !== key) return l;
            const updated = { ...l, [field]: value };
            if (field === 'qty' || field === 'unit_price') {
                const qty = parseFloat(field === 'qty' ? value : updated.qty) || 0;
                const up  = parseFloat(field === 'unit_price' ? value : updated.unit_price) || 0;
                updated.amount = (qty * up).toFixed(2);
            }
            return updated;
        }));
    };

    const discountAmt = lines.filter(l => l.account_number === '70200').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const grossAmt    = lines.filter(l => l.account_number !== '70200').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const netAmt      = grossAmt - discountAmt;

    const handleSave = () => {
        if (!header.bill_date) return;
        // Each line needs an account and a non-negative amount. $0 is allowed for
        // free/bundled items (e.g. a case included free with a laptop on the PO) —
        // the overall bill just has to net to a positive payable.
        if (!lines.every(l => l.account_number && parseFloat(l.amount) >= 0)) {
            alert('Each line needs an account and an amount of 0 or more.');
            return;
        }
        if (netAmt <= 0) {
            alert('The bill must net to a positive amount payable.');
            return;
        }
        const mappedLines = lines.map(l => ({
            description: l.description,
            account_number: l.account_number,
            qty: parseFloat(l.qty) || 1,
            unit_price: parseFloat(l.unit_price) || parseFloat(l.amount) || 0,
            amount: parseFloat(l.amount),
        }));
        onSave({ ...header, due_date: header.due_date || null, total_amount: netAmt }, mappedLines);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <h3 className="text-base font-semibold text-foreground">
                        {bill ? `Edit Bill — ${bill.bill_number}` : 'New Bill'}
                    </h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Type + number */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
                            <select value={header.bill_type}
                                onChange={e => setHeader(h => ({ ...h, bill_type: e.target.value as 'vendor' | 'inter' }))}
                                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600">
                                <option value="vendor">Vendor Bill (PO)</option>
                                <option value="inter">Inter-Bill (Utility / NSSF)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Bill #</label>
                            <input type="text" value={header.bill_number} readOnly
                                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-muted text-muted-foreground" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Bill Date</label>
                            <input type="date" value={header.bill_date}
                                onChange={e => setHeader(h => ({ ...h, bill_date: e.target.value }))}
                                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                        </div>
                    </div>

                    {/* Vendor reference */}
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Vendor Ref / Voucher No. <span className="text-muted-foreground/50 font-normal">(from vendor's document)</span>
                        </label>
                        <input
                            type="text"
                            value={header.vendor_reference ?? ''}
                            onChange={e => setHeader(h => ({ ...h, vendor_reference: e.target.value }))}
                            placeholder="e.g. INV-2026-0123, VCH-00456"
                            className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                        />
                    </div>

                    {/* Vendor / PO ref */}
                    <div className="grid grid-cols-3 gap-3">
                        {header.bill_type === 'vendor' ? (
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">PO Reference</label>
                                <select
                                    value={header.po_reference ?? ''}
                                    onChange={e => {
                                        const val = e.target.value;
                                        const po  = purchaseOrders.find(p => p.po_number === val);
                                        setHeader(h => ({
                                            ...h,
                                            po_reference: val,
                                            vendor_name: po?.vendor_name ?? h.vendor_name,
                                        }));
                                        if (po?.id && val) {
                                            (async () => {
                                                const { data: poItems } = await supabase
                                                    .from('purchase_order_items')
                                                    .select('*')
                                                    .eq('po_id', po.id)
                                                    .order('line_number');
                                                if (poItems?.length) {
                                                    setLines(poItems.map((item: any) => ({
                                                        key: Math.random().toString(36).slice(2),
                                                        description: item.description || item.model_name || item.item_number || '',
                                                        account_number: item.is_promotion
                                                            ? '70200'
                                                            : getBillInventoryAccount(item.brand),
                                                        qty:        String(item.qty ?? 1),
                                                        unit_price: item.is_promotion
                                                            ? String(Math.abs(Number(item.unit_price ?? 0)))
                                                            : String(item.unit_price ?? 0),
                                                        amount: item.is_promotion
                                                            ? String(Math.abs(Number(item.total ?? 0)))
                                                            : String(Math.max(0, Number(item.total ?? ((item.qty ?? 1) * (item.unit_price ?? 0))))),
                                                    })));
                                                }
                                            })();
                                        } else if (!val) {
                                            setLines([emptyLine()]);
                                        }
                                    }}
                                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                                >
                                    <option value="">— Select PO —</option>
                                    {purchaseOrders
                                        .filter(p => p.status !== 'Cancelled')
                                        .sort((a, b) => b.po_number.localeCompare(a.po_number))
                                        .map(po => (
                                            <option key={po.po_number} value={po.po_number}>
                                                {po.po_number}{po.vendor_name ? ` — ${po.vendor_name}` : ''}{po.status ? ` (${po.status})` : ''}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                        ) : null}
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Vendor / Issuer</label>
                            <input
                                type="text"
                                list={header.bill_type === 'inter' && billVendors.length > 0 ? 'inter-bill-vendors' : undefined}
                                value={header.vendor_name ?? ''}
                                onChange={e => setHeader(h => ({ ...h, vendor_name: e.target.value }))}
                                placeholder={header.bill_type === 'vendor' ? 'Auto-filled from PO' : 'Search vendor list or type manually…'}
                                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600"
                            />
                            {header.bill_type === 'inter' && billVendors.length > 0 && (
                                <datalist id="inter-bill-vendors">
                                    {billVendors.filter(v => v.status === 'Active').map(v => (
                                        <option key={v.id} value={v.vendor_name} />
                                    ))}
                                </datalist>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date</label>
                            <input type="date" value={header.due_date ?? ''}
                                onChange={e => setHeader(h => ({ ...h, due_date: e.target.value }))}
                                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                        <input type="text" value={header.description}
                            onChange={e => setHeader(h => ({ ...h, description: e.target.value }))}
                            placeholder="Brief description of this bill"
                            className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                    </div>

                    {/* Lines */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bill Lines</label>
                            <button onClick={() => setLines(l => [...l, emptyLine()])}
                                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                                <PlusCircle size={13} /> Add Line
                            </button>
                        </div>
                        <div className="border border-border rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 border-b border-border">
                                    <tr>
                                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[30%]">Description</th>
                                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[30%]">Account</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[10%]">Qty</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[15%]">Unit Price</th>
                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[12%]">Amount</th>
                                        <th className="w-8" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map(l => (
                                        <tr key={l.key} className="border-t border-border/50">
                                            <td className="px-3 py-1.5">
                                                <input type="text" value={l.description}
                                                    onChange={e => updateLine(l.key, 'description', e.target.value)}
                                                    placeholder="Line detail"
                                                    className="w-full h-8 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600" />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <select value={l.account_number}
                                                    onChange={e => updateLine(l.key, 'account_number', e.target.value)}
                                                    className={`w-full h-8 px-2 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 ${l.account_number === '12600' ? 'border-amber-400 dark:border-amber-500' : 'border-border'}`}>
                                                    <option value="">— Select account —</option>
                                                    {billLineAccounts.map(a => (
                                                        <option key={a.account_number} value={a.account_number}>
                                                            {a.account_number} · {a.account_name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {l.account_number === '12600' && (
                                                    <div className="flex items-center gap-1 mt-0.5 text-amber-600 dark:text-amber-400">
                                                        <AlertTriangle size={10} />
                                                        <span className="text-[10px]">Fallback — verify brand (ASUS→12100, MSI→12300, Lenovo→12700)</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input type="number" value={l.qty} min="0"
                                                    onChange={e => updateLine(l.key, 'qty', e.target.value)}
                                                    className="w-full h-8 px-2 text-xs rounded border border-border bg-background text-right focus:outline-none focus:ring-1 focus:ring-brand-600" />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input type="number" value={l.unit_price} min="0" step="0.01"
                                                    onChange={e => updateLine(l.key, 'unit_price', e.target.value)}
                                                    className="w-full h-8 px-2 text-xs rounded border border-border bg-background text-right focus:outline-none focus:ring-1 focus:ring-brand-600" />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input type="number" value={l.amount} min="0" step="0.01"
                                                    onChange={e => updateLine(l.key, 'amount', e.target.value)}
                                                    className="w-full h-8 px-2 text-xs rounded border border-border bg-background text-right focus:outline-none focus:ring-1 focus:ring-brand-600" />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                {lines.length > 1 && (
                                                    <button onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))}
                                                        className="text-muted-foreground hover:text-red-500">
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-border bg-muted/20">
                                    {discountAmt > 0.005 && (
                                        <>
                                            <tr>
                                                <td colSpan={4} className="px-3 py-1.5 text-xs text-right text-muted-foreground">Gross Cost</td>
                                                <td className="px-3 py-1.5 text-sm text-foreground text-right tabular-nums">${fmt(grossAmt)}</td>
                                                <td />
                                            </tr>
                                            <tr>
                                                <td colSpan={4} className="px-3 py-1.5 text-xs text-right text-green-600 dark:text-green-400">Purchase Discount (70200)</td>
                                                <td className="px-3 py-1.5 text-sm text-green-600 dark:text-green-400 text-right tabular-nums">−${fmt(discountAmt)}</td>
                                                <td />
                                            </tr>
                                        </>
                                    )}
                                    <tr>
                                        <td colSpan={4} className="px-3 py-2.5 text-xs font-semibold text-right text-muted-foreground uppercase tracking-wide">Net Payable</td>
                                        <td className="px-3 py-2.5 text-sm font-bold text-foreground text-right tabular-nums">${fmt(netAmt)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                        <textarea value={header.notes ?? ''} rows={2}
                            onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))}
                            placeholder="Internal notes (optional)"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 resize-none" />
                    </div>
                </div>

                <div className="flex gap-2 justify-end px-5 py-4 border-t border-border">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/50">Cancel</button>
                    <button onClick={handleSave} className="px-5 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 font-medium flex items-center gap-1.5">
                        <Check size={14} /> Save Bill
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

const BillsTab: React.FC<Props> = ({ accounts }) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { can } = usePermissions();
    const canEdit = can('accounting', 'edit');

    const [bills, setBills] = useState<Bill[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [billVendors, setBillVendors] = useState<BillVendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<'all' | 'vendor' | 'inter'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted' | 'paid'>('all');
    const [billSearch, setBillSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [formBill, setFormBill] = useState<Bill | null | 'new'>('new' as never);
    const [showForm, setShowForm] = useState(false);
    const [nextNumber, setNextNumber] = useState('BILL-0001');
    const [payTarget, setPayTarget] = useState<Bill | null>(null);
    const [busy, setBusy] = useState<Record<string, boolean>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [data, pos, bvs] = await Promise.all([
                fetchBills(),
                readRecords<PurchaseOrder>('Purchase Orders'),
                fetchBillVendors(),
            ]);
            setBills(data);
            setPurchaseOrders(pos);
            setBillVendors(bvs);
        } catch (e: unknown) {
            addToast((e as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { load(); }, [load]);

    const openNew = async () => {
        const n = await getNextBillNumber();
        setNextNumber(n);
        setFormBill(null);
        setShowForm(true);
    };

    const openEdit = (bill: Bill) => {
        setFormBill(bill);
        setShowForm(true);
    };

    const handleSave = async (
        header: Omit<Bill, 'id' | 'lines' | 'created_at' | 'updated_at'>,
        lines: Omit<BillLine, 'id' | 'bill_id' | 'created_at'>[],
    ) => {
        try {
            if (formBill && (formBill as Bill).id) {
                const updated = await updateBill((formBill as Bill).id!, header, lines);
                setBills(prev => prev.map(b => b.id === updated.id ? updated : b));
                addToast('Bill updated.', 'success');
            } else {
                const created = await createBill(header, lines);
                setBills(prev => [created, ...prev]);
                addToast('Bill created.', 'success');
            }
            setShowForm(false);
        } catch (e: unknown) {
            addToast((e as Error).message, 'error');
        }
    };

    const handleDelete = async (bill: Bill) => {
        if (!confirm(`Delete ${bill.bill_number}? This cannot be undone.`)) return;
        setBusy(b => ({ ...b, [bill.id!]: true }));
        try {
            await deleteBill(bill.id!);
            setBills(prev => prev.filter(b => b.id !== bill.id));
            addToast('Bill deleted.', 'success');
        } catch (e: unknown) {
            addToast((e as Error).message, 'error');
        } finally {
            setBusy(b => ({ ...b, [bill.id!]: false }));
        }
    };

    const handlePost = async (bill: Bill) => {
        if (bill.bill_type === 'vendor') {
            const fallback = (bill.lines ?? []).filter(l => l.account_number === '12600');
            if (fallback.length > 0) {
                const ok = confirm(
                    `⚠ ${bill.bill_number} has ${fallback.length} line(s) mapped to 12600 · Other Accessories.\n\n` +
                    `This is the fallback used when no brand is recognised. If any line contains ASUS, MSI or Lenovo items, edit the bill and correct the account first:\n` +
                    `  ASUS → 12100\n  MSI → 12300\n  Lenovo → 12700\n\nPost anyway?`
                );
                if (!ok) return;
            }
        }
        setBusy(b => ({ ...b, [bill.id!]: true }));
        try {
            const updated = await postBill(bill.id!, currentUser?.Email ?? 'system');
            setBills(prev => [updated, ...prev.filter(b => b.id !== updated.id)]);
            addToast(`${bill.bill_number} posted — JE created.`, 'success');
        } catch (e: unknown) {
            addToast((e as Error).message, 'error');
        } finally {
            setBusy(b => ({ ...b, [bill.id!]: false }));
        }
    };

    const handleUnpost = async (bill: Bill) => {
        setBusy(b => ({ ...b, [bill.id!]: true }));
        try {
            const updated = await unpostBill(bill.id!);
            setBills(prev => prev.map(b => b.id === updated.id ? updated : b));
            addToast(`${bill.bill_number} unposted.`, 'success');
        } catch (e: unknown) {
            addToast((e as Error).message, 'error');
        } finally {
            setBusy(b => ({ ...b, [bill.id!]: false }));
        }
    };

    const handlePay = async (params: { paymentDate: string; paymentMethod: string; paymentReference: string }) => {
        if (!payTarget?.id) return;
        setBusy(b => ({ ...b, [payTarget.id!]: true }));
        try {
            const updated = await markBillPaid(payTarget.id, { ...params, createdBy: currentUser?.Email ?? 'system' });
            setBills(prev => prev.map(b => b.id === updated.id ? updated : b));
            addToast(`${payTarget.bill_number} marked paid — payment JE created.`, 'success');
            setPayTarget(null);
        } catch (e: unknown) {
            addToast((e as Error).message, 'error');
        } finally {
            setBusy(b => ({ ...b, [payTarget.id!]: false }));
        }
    };

    const filtered = useMemo(() => {
        let base = bills;
        if (typeFilter !== 'all') base = base.filter(b => b.bill_type === typeFilter);
        if (statusFilter !== 'all') base = base.filter(b => b.status === statusFilter);
        if (billSearch.trim()) {
            const q = billSearch.toLowerCase();
            base = base.filter(b =>
                b.bill_number.toLowerCase().includes(q) ||
                (b.vendor_name ?? '').toLowerCase().includes(q) ||
                (b.po_reference ?? '').toLowerCase().includes(q) ||
                b.description.toLowerCase().includes(q)
            );
        }
        return base;
    }, [bills, typeFilter, statusFilter, billSearch]);

    const totals = useMemo(() => ({
        draft:  bills.filter(b => b.status === 'draft').reduce((s, b) => s + b.total_amount, 0),
        posted: bills.filter(b => b.status === 'posted').reduce((s, b) => s + b.total_amount, 0),
        paid:   bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.total_amount, 0),
    }), [bills]);

    const FilterChip = ({ label, value, active, onClick }: {
        label: string; value: string; active: boolean; onClick: () => void;
    }) => (
        <button onClick={onClick} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            active
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
        }`}>
            {label}
        </button>
    );

    return (
        <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Pending (Draft)', value: totals.draft, color: 'text-muted-foreground' },
                    { label: 'Awaiting Payment', value: totals.posted, color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Paid', value: totals.paid, color: 'text-green-600 dark:text-green-400' },
                ].map(card => (
                    <div key={card.label} className="bg-card border border-border rounded-xl px-4 py-3">
                        <p className="text-xs text-muted-foreground mb-0.5">{card.label}</p>
                        <p className={`text-xl font-bold tabular-nums ${card.color}`}>${fmt(card.value)}</p>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1.5">
                    {(['all', 'vendor', 'inter'] as const).map(t => (
                        <FilterChip key={t} label={t === 'all' ? 'All Types' : t === 'vendor' ? 'Vendor' : 'Inter-Bill'}
                            value={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} />
                    ))}
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                <div className="flex gap-1.5">
                    {(['all', 'draft', 'posted', 'paid'] as const).map(s => (
                        <FilterChip key={s} label={s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                            value={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
                    ))}
                </div>
                <div className="relative ml-auto">
                    <input type="text" value={billSearch} onChange={e => setBillSearch(e.target.value)}
                        placeholder="Search bills…"
                        className="h-8 pl-8 pr-7 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 w-48" />
                    <svg className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    {billSearch && (
                        <button onClick={() => setBillSearch('')} className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => exportBills(filtered, new Date().toISOString().slice(0, 10))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 shrink-0"
                >
                    <Download size={13} /> Export
                </button>
                {canEdit && (
                    <button onClick={openNew}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 shrink-0">
                        <PlusCircle size={14} /> New Bill
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                {loading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">Loading bills…</div>
                ) : filtered.length === 0 ? (
                    <div className="py-12 text-center">
                        <Receipt size={32} className="mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No bills found.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-muted/30 border-b border-border">
                            <tr>
                                <th className="w-6" />
                                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bill #</th>
                                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor Ref</th>
                                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor / Issuer</th>
                                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due</th>
                                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                                <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(bill => (
                                <React.Fragment key={bill.id}>
                                    <tr className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                                        <td className="pl-3">
                                            <button onClick={() => setExpandedId(id => id === bill.id ? null : bill.id!)}
                                                className="text-muted-foreground hover:text-foreground">
                                                {expandedId === bill.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-foreground">{bill.bill_number}</td>
                                        <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                                            {bill.vendor_reference || <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${TYPE_BADGE[bill.bill_type]}`}>
                                                {bill.bill_type === 'vendor' ? 'Vendor' : 'Inter'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-sm text-foreground">
                                            {bill.vendor_name || <span className="text-muted-foreground italic">—</span>}
                                            {bill.po_reference && (
                                                <span className="ml-1.5 text-xs text-muted-foreground">({bill.po_reference})</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">{bill.bill_date}</td>
                                        <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">{bill.due_date || '—'}</td>
                                        <td className="px-3 py-2.5 text-sm font-semibold text-foreground tabular-nums text-right">${fmt(bill.total_amount)}</td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${STATUS_BADGE[bill.status]}`}>
                                                {bill.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 justify-end">
                                                {canEdit && bill.status === 'draft' && (
                                                    <>
                                                        <button onClick={() => openEdit(bill)}
                                                            className="px-2 py-0.5 rounded text-xs font-medium text-muted-foreground bg-muted/50 border border-border hover:bg-muted">
                                                            Edit
                                                        </button>
                                                        <button onClick={() => handlePost(bill)} disabled={busy[bill.id!]}
                                                            className="px-2 py-0.5 rounded text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700 disabled:opacity-50">
                                                            Post
                                                        </button>
                                                        <button onClick={() => handleDelete(bill)} disabled={busy[bill.id!]}
                                                            className="text-muted-foreground hover:text-red-500 disabled:opacity-50">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </>
                                                )}
                                                {canEdit && bill.status === 'posted' && (
                                                    <>
                                                        <button onClick={() => handleUnpost(bill)} disabled={busy[bill.id!]}
                                                            className="px-2 py-0.5 rounded text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700 disabled:opacity-50">
                                                            Unpost
                                                        </button>
                                                        <button onClick={() => setPayTarget(bill)} disabled={busy[bill.id!]}
                                                            className="px-2 py-0.5 rounded text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700 disabled:opacity-50">
                                                            Mark Paid
                                                        </button>
                                                    </>
                                                )}
                                                {bill.status === 'paid' && (
                                                    <span className="text-xs text-muted-foreground italic">{bill.payment_date}</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded lines */}
                                    {expandedId === bill.id && (
                                        <tr className="border-t border-dashed border-border/40 bg-muted/10">
                                            <td colSpan={9} className="px-6 py-3">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bill Lines</p>
                                                        <div className="space-y-1">
                                                            {(bill.lines ?? []).map((l, i) => (
                                                                <div key={l.id ?? i} className="flex justify-between text-xs text-foreground">
                                                                    <span className="text-muted-foreground">{l.account_number} · {l.description || bill.description}</span>
                                                                    <span className="tabular-nums font-medium">${fmt(l.amount)}</span>
                                                                </div>
                                                            ))}
                                                            {(bill.lines?.length ?? 0) === 0 && (
                                                                <p className="text-xs text-muted-foreground italic">No lines loaded.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5 text-xs">
                                                        {bill.journal_entry_id && (
                                                            <p className="text-muted-foreground">Bill JE: <span className="text-foreground font-mono">{bill.journal_entry_id.slice(0, 8)}…</span></p>
                                                        )}
                                                        {bill.payment_journal_id && (
                                                            <p className="text-muted-foreground">Payment JE: <span className="text-foreground font-mono">{bill.payment_journal_id.slice(0, 8)}…</span></p>
                                                        )}
                                                        {bill.payment_method && (
                                                            <p className="text-muted-foreground">Paid via: <span className="text-foreground">{bill.payment_method} {bill.payment_reference ? `· ${bill.payment_reference}` : ''}</span></p>
                                                        )}
                                                        {bill.notes && (
                                                            <p className="text-muted-foreground">Notes: <span className="text-foreground">{bill.notes}</span></p>
                                                        )}
                                                        {bill.po_reference && (
                                                            <p className="text-muted-foreground">PO Ref: <span className="text-foreground">{bill.po_reference}</span></p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modals */}
            {showForm && (
                <BillFormModal
                    bill={formBill as Bill | null}
                    accounts={accounts}
                    purchaseOrders={purchaseOrders}
                    billVendors={billVendors}
                    onSave={handleSave}
                    onClose={() => setShowForm(false)}
                    nextNumber={nextNumber}
                />
            )}
            {payTarget && (
                <PayModal
                    bill={payTarget}
                    onConfirm={handlePay}
                    onClose={() => setPayTarget(null)}
                />
            )}
        </div>
    );
};

export default BillsTab;
