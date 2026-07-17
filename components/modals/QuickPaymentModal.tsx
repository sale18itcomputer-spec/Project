'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Wallet, X, FileText } from 'lucide-react';
import { Receipt } from '../../types';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useToast } from '../../contexts/ToastContext';
import { createRecord, updateRecord } from '../../services/api';
import { autoPostReceiptJournal } from '../../services/accountingApi';
import { supabase } from '../../lib/supabase';
import { SERVICE_REMARK_PREFIX } from '../../utils/serviceInvoice';
import { formatCurrencySmartly } from '../../utils/formatters';
import { formatToSheetDate } from '../../utils/time';
import { InvoiceAR } from '../../utils/collection';

const PAYMENT_METHOD_OPTIONS: NonNullable<Receipt['Payment Method']>[] = [
    'Cash', 'Bank Transfer', 'ABA', 'KHQR', 'Cheque', 'Other',
];

const getTodayDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * QuickPaymentModal — the ONLY surface in the app that creates Receipts.
 *
 * A Receipt is the artifact of a payment recorded against an Invoice. The
 * Receipts tab is now a read-only audit log; standalone receipt creation has
 * been removed. See utils/collection.ts for AR derivation rules.
 */
interface Props {
    ar: InvoiceAR;
    onClose: () => void;
}

const QuickPaymentModal: React.FC<Props> = ({ ar, onClose }) => {
    const { setReceipts, deliveryOrders, companies, setInvoices, setServiceTickets } = useData();
    const { currentUser } = useAuth();
    const { handleNavigation } = useNavigation();
    const { addToast } = useToast();

    const [isShowing, setIsShowing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const invoice = ar.invoice;
    const currency: 'USD' | 'KHR' = invoice.Currency === 'KHR' ? 'KHR' : 'USD';

    // ── Form state ────────────────────────────────────────────────────────────
    const [paymentMethod, setPaymentMethod] = useState<NonNullable<Receipt['Payment Method']>>('Cash');
    const [amountStr, setAmountStr] = useState<string>('');
    const [rvDate, setRvDate] = useState<string>(getTodayDateString());
    const [remark, setRemark] = useState<string>('');

    // Next RV No via the persistent document_sequences counter. Previously
    // computed from the client-side `receipts` array (B2C-only, stale) via
    // MAX+1 — that let a number already used in b2b_receipts get reissued
    // here (OR2026-00003 collided with an existing B2B cheque receipt).
    // next_document_seq is atomic and checked across both tables at seed
    // time, so it can't hand out an already-used number.
    const [nextRVNo, setNextRVNo] = useState('');
    useEffect(() => {
        const prefix = `OR${new Date().getFullYear()}-`;
        supabase.rpc('next_document_seq', { p_key: prefix }).then(({ data, error }) => {
            if (error || data == null) return; // leave blank — submit stays disabled
            setNextRVNo(`${prefix}${String(data).padStart(5, '0')}`);
        });
    }, []);

    const amount = useMemo(() => {
        const n = parseFloat(amountStr);
        return isFinite(n) ? n : 0;
    }, [amountStr]);

    const isPartial = amount > 0 && amount < ar.outstanding;
    const overpayment = amount > ar.outstanding;
    const isValid = amount > 0 && !overpayment && !!nextRVNo;

    // ── Animate in ────────────────────────────────────────────────────────────
    useEffect(() => {
        requestAnimationFrame(() => requestAnimationFrame(() => setIsShowing(true)));
    }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) handleClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
     
    }, [isSubmitting]);

    const handleClose = () => {
        setIsShowing(false);
        setTimeout(onClose, 200);
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid || isSubmitting) return;

        setIsSubmitting(true);

        // Find a matching DO for this invoice (optional, populates DO No field)
        const matchingDO = deliveryOrders?.find(d => d['Inv No'] === invoice['Inv No']);

        // Look up company info for Tin No / Address
        const company = companies?.find(c => c['Company Name'] === invoice['Company Name']);

        // ItemsJSON behavior:
        //  - Full payment of full balance: copy invoice items so the RV PDF shows
        //    a line-by-line breakdown matching what was paid for.
        //  - Partial payment: a single synthetic "Partial Payment" line whose
        //    amount = payment amount. This keeps the RV PDF totals consistent
        //    with the recorded Amount (otherwise totals would show the full
        //    invoice value even though only part was paid).
        let receiptItems: any[] = [];
        if (isPartial) {
            receiptItems = [{
                id: `pmt-${Date.now()}`,
                no: 1,
                itemCode: '',
                modelName: 'Partial Payment',
                description: `Payment toward Invoice ${invoice['Inv No']}`,
                qty: 1,
                unitPrice: amount,
                amount: amount,
            }];
        } else {
            try {
                const raw = invoice['ItemsJSON'];
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
                receiptItems = Array.isArray(parsed) ? parsed : [];
            } catch { /* ignore */ }
            // Defensive fallback: if invoice has no items, use one synthetic line
            // so the PDF totals stay consistent.
            if (receiptItems.length === 0) {
                receiptItems = [{
                    id: `pmt-${Date.now()}`,
                    no: 1,
                    itemCode: '',
                    modelName: 'Payment',
                    description: `Payment toward Invoice ${invoice['Inv No']}`,
                    qty: 1,
                    unitPrice: amount,
                    amount: amount,
                }];
            }
        }

        const payload: Partial<Receipt> = {
            'RV No': nextRVNo,
            'RV Date': formatToSheetDate(rvDate),
            'Inv No': invoice['Inv No'],
            'SO No': invoice['SO No'] || undefined,
            'DO No': matchingDO?.['DO No'] || undefined,
            'Company Name': invoice['Company Name'],
            'Company Address': invoice['Company Address'] || company?.['Address (English)'] || '',
            'Contact Name': invoice['Contact Name'],
            'Phone Number': invoice['Phone Number'] || '',
            'Email': invoice['Email'] || '',
            'Amount': amount,
            'Currency': currency,
            'Payment Method': paymentMethod,
            'Tax Type': invoice['Tax Type'] === 'VAT' || invoice['Taxable'] === 'VAT' ? 'VAT' : 'NON-VAT',
            'Status': 'Issued',
            'Payment Term': invoice['Payment Term'] || '',
            'Tin No': invoice['Tin No'] || company?.['Patent'] || '',
            'Prepared By': currentUser?.Name || '',
            'Prepared By Position': currentUser ? [
                currentUser.Role,
                [currentUser['Phone 1'], currentUser['Phone 2']].filter(Boolean).join(' | '),
                currentUser.Email,
            ].filter(Boolean).join(' | ') : '',
            'Approved By': '',
            'Approved By Position': '',
            'Remark': remark.trim(),
            'Created By': currentUser?.Name || '',
            'ItemsJSON': JSON.stringify(receiptItems),
        };

        // Optimistic update — prepend immediately so Collection AR shrinks in the UI
        const optimisticReceipt = payload as Receipt;
        setReceipts(prev => prev ? [optimisticReceipt, ...prev] : [optimisticReceipt]);

        try {
            const saved = await createRecord('Receipts', payload) as Receipt;
            // Replace optimistic with server record (in case server normalized fields)
            setReceipts(prev => prev
                ? prev.map(r => r['RV No'] === nextRVNo ? saved : r)
                : [saved]
            );

            // Auto-post journal entry: DR Bank / CR AR gross (VAT was declared by
            // the invoice JE; any deposit was already applied to AR by it too).
            autoPostReceiptJournal({
                rvNo: nextRVNo,
                entryDate: rvDate,
                amount,
                paymentMethod,
                createdBy: currentUser?.Name || 'system',
            }).catch(err => {
                console.warn('[QuickPaymentModal] auto-post failed:', err);
                addToast(`Receipt ${nextRVNo} saved, but its journal entry failed: ${err.message}`, 'error');
            });

            // Auto-complete: this payment settles the full balance, so flip the
            // invoice to Completed and, for a service invoice created from a
            // ticket, resolve the ticket too. Best-effort — a failure here must
            // not undo the recorded payment.
            if (!isPartial && invoice.Status !== 'Completed' && invoice.Status !== 'Cancel') {
                try {
                    await updateRecord('Invoices', invoice['Inv No'], { 'Status': 'Completed' });
                    setInvoices(prev => prev
                        ? prev.map(i => i['Inv No'] === invoice['Inv No'] ? { ...i, Status: 'Completed' as const } : i)
                        : prev
                    );
                    addToast(`Invoice ${invoice['Inv No']} marked Completed`, 'success');

                    const invRemark: string = (invoice as any)['Remark'] ?? '';
                    if (invRemark.startsWith(SERVICE_REMARK_PREFIX)) {
                        const ticketNo = invRemark.slice(SERVICE_REMARK_PREFIX.length).trim();
                        const ACTIVE_TICKET_STATUSES = ['Open', 'In Progress', 'Pending Parts'];
                        const { error: ticketErr } = await supabase
                            .from('service_tickets')
                            .update({ status: 'Resolved' })
                            .eq('ticket_no', ticketNo)
                            .in('status', ACTIVE_TICKET_STATUSES);
                        if (!ticketErr) {
                            setServiceTickets(prev => prev
                                ? prev.map(t => t.ticket_no === ticketNo && ACTIVE_TICKET_STATUSES.includes(t.status)
                                    ? { ...t, status: 'Resolved' as const }
                                    : t)
                                : prev
                            );
                            addToast(`Service ticket ${ticketNo} marked Resolved`, 'success');
                        }
                    }
                } catch (err: any) {
                    console.warn('[QuickPaymentModal] auto-complete failed:', err);
                    addToast(`Payment saved, but auto-completing the invoice failed: ${err.message}`, 'error');
                }
            }

            addToast(
                isPartial
                    ? `Partial payment recorded · ${nextRVNo}`
                    : `Payment recorded · ${nextRVNo}`,
                'success'
            );
            setIsShowing(false);
            setTimeout(() => {
                onClose();
                // Quick-link to the full RV view for printing/attachments
                handleNavigation({ view: 'receipts', action: 'view', id: nextRVNo });
            }, 200);
        } catch (err: any) {
            // Revert optimistic on failure
            setReceipts(prev => prev ? prev.filter(r => r['RV No'] !== nextRVNo) : null);
            addToast(`Failed to record payment: ${err.message}`, 'error');
            setIsSubmitting(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    const sym = currency === 'KHR' ? '៛' : '$';

    return createPortal(
        <div
            className={`fixed inset-0 z-[99999] flex justify-center items-center p-4 transition-opacity duration-200 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
            onClick={isSubmitting ? undefined : handleClose}
            aria-modal="true"
            role="dialog"
        >
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

            <form
                onSubmit={handleSubmit}
                className={`relative bg-card rounded-xl shadow-2xl w-full max-w-lg border border-border transform transition-all duration-200 ease-out ${isShowing ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted disabled:opacity-50"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="p-6">
                    <div className="flex items-start gap-3 mb-5">
                        <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-brand-500/10">
                            <Wallet className="h-5 w-5 text-brand-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Record Payment</h2>
                            <p className="text-xs text-muted-foreground">A Receipt will be created on submit</p>
                        </div>
                    </div>

                    {/* Invoice summary */}
                    <div className="bg-muted/40 border border-border rounded-lg p-3 mb-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="font-mono font-bold text-sm text-foreground">{invoice['Inv No']}</span>
                                </div>
                                <div className="text-sm font-medium text-foreground truncate mt-1">{invoice['Company Name']}</div>
                                <div className="text-xs text-muted-foreground">{invoice['Contact Name']}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Outstanding</div>
                                <div className="text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums">
                                    {formatCurrencySmartly(ar.outstanding, currency)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    of {formatCurrencySmartly(ar.invoiced, currency)} invoiced
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                                Payment Method <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value as any)}
                                disabled={isSubmitting}
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 transition"
                            >
                                {PAYMENT_METHOD_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                                Amount Received ({sym}) <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={amountStr}
                                onChange={e => setAmountStr(e.target.value)}
                                disabled={isSubmitting}
                                required
                                placeholder="0.00"
                                className={`w-full bg-background border rounded-md px-3 py-2 text-sm font-mono tabular-nums focus:ring-2 transition ${overpayment ? 'border-rose-500 focus:ring-rose-500' : 'border-border focus:ring-brand-500'}`}
                            />
                            <button
                                type="button"
                                onClick={() => setAmountStr(ar.outstanding.toFixed(2))}
                                disabled={isSubmitting}
                                className="mt-1 text-[11px] text-brand-600 hover:text-brand-700 hover:underline disabled:opacity-40 float-right"
                            >
                                Fill outstanding: {sym}{ar.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </button>
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                                Payment Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={rvDate}
                                onChange={e => setRvDate(e.target.value)}
                                disabled={isSubmitting}
                                required
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 transition"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                                Remark <span className="text-muted-foreground/40 normal-case font-normal">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={remark}
                                onChange={e => setRemark(e.target.value)}
                                disabled={isSubmitting}
                                placeholder="e.g. Bank Ref #12345, Cheque #00789..."
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 transition"
                            />
                        </div>
                    </div>

                    {/* Hints */}
                    <div className="mt-4 space-y-1.5">
                        {isPartial && (
                            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                                <span className="font-bold">Partial payment</span>
                                <span>· Remaining {formatCurrencySmartly(ar.outstanding - amount, currency)} will stay open in Collection.</span>
                            </div>
                        )}
                        {overpayment && (
                            <div className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2">
                                <span className="font-bold">Cannot overpay</span>
                                <span>· Amount cannot exceed Outstanding {formatCurrencySmartly(ar.outstanding, currency)}.</span>
                            </div>
                        )}
                        <div className="text-[11px] text-muted-foreground">
                            {nextRVNo
                                ? <>Receipt <span className="font-mono font-semibold text-foreground">{nextRVNo}</span> will be created with status <span className="font-semibold text-foreground">Issued</span>.</>
                                : 'Reserving the next receipt number…'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-6 py-4 bg-muted/30 border-t border-border rounded-b-xl">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!isValid || isSubmitting}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition shadow-sm"
                    >
                        {isSubmitting ? 'Recording...' : <>
                            <Wallet className="w-4 h-4" />
                            Record {isPartial ? 'Partial Payment' : 'Payment'}
                        </>}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
};

export default QuickPaymentModal;
