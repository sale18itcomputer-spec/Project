'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Ticket, X, FileText, ShieldAlert } from 'lucide-react';
import { Receipt } from '../../types';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createRecord, updateRecord } from '../../services/api';
import { completeSettledInvoice, fetchCreditApplied, getCreditMemoArCredit } from '../../services/creditMemoApi';
import { supabase } from '../../lib/supabase';
import { formatCurrencySmartly } from '../../utils/formatters';
import { formatToSheetDate } from '../../utils/time';
import { InvoiceAR } from '../../utils/collection';
import { CREDIT_MEMO_METHOD, creditsForInvoice, openCreditMemos } from '../../utils/creditMemo';
import { Z } from '../../lib/zIndex';

const getTodayDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * ApplyCreditModal — settle an invoice with a customer's credit memo instead of cash.
 *
 * A credit memo is a negative invoice whose journal entry already credited AR, so applying it
 * moves no money and posts NO journal entry: the application is a Receipt with
 * Payment Method = 'Credit Memo' and credit_memo_no pointing at the memo. See utils/creditMemo.ts.
 *
 * Before saving, the memo's AR credit in the GL is checked: a memo whose entry never credited AR
 * would otherwise shrink the balance here while the books still show the customer owing it.
 */
interface Props {
    ar: InvoiceAR;
    onClose: () => void;
}

const ApplyCreditModal: React.FC<Props> = ({ ar, onClose }) => {
    const { invoices, receipts, setReceipts, deliveryOrders, companies, setInvoices, setServiceTickets } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();

    const [isShowing, setIsShowing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const invoice = ar.invoice;
    const currency: 'USD' | 'KHR' = invoice.Currency === 'KHR' ? 'KHR' : 'USD';
    const sym = currency === 'KHR' ? '៛' : '$';

    // Credits this customer can spend on this invoice (same company + currency, credit left).
    const credits = useMemo(
        () => creditsForInvoice(invoice, openCreditMemos(invoices, receipts)),
        [invoice, invoices, receipts],
    );

    const [memoNo, setMemoNo] = useState<string>(credits[0]?.memo['Inv No'] ?? '');
    const selected = credits.find(c => c.memo['Inv No'] === memoNo) ?? null;
    const maxApply = selected ? round2(Math.min(ar.outstanding, selected.remaining)) : 0;

    const [amountStr, setAmountStr] = useState<string>(maxApply > 0 ? maxApply.toFixed(2) : '');
    const [rvDate, setRvDate] = useState<string>(getTodayDateString());
    const [remark, setRemark] = useState<string>('');

    // Re-default the amount whenever a different memo is picked.
    useEffect(() => {
        setAmountStr(maxApply > 0 ? maxApply.toFixed(2) : '');
    }, [memoNo]);

    // GL check: how much AR credit the memo's own journal entry holds.
    const [arCredit, setArCredit] = useState<number | null>(null);
    const [arCreditError, setArCreditError] = useState<string>('');
    useEffect(() => {
        if (!memoNo) return;
        let alive = true;
        setArCredit(null);
        setArCreditError('');
        getCreditMemoArCredit(memoNo)
            .then(v => { if (alive) setArCredit(v); })
            .catch(e => { if (alive) setArCreditError(e.message); });
        return () => { alive = false; };
    }, [memoNo]);

    const [nextRVNo, setNextRVNo] = useState('');
    useEffect(() => {
        const prefix = `OR${new Date().getFullYear()}-`;
        supabase.rpc('next_document_seq', { p_key: prefix }).then(({ data, error }) => {
            if (error || data == null) return;
            setNextRVNo(`${prefix}${String(data).padStart(5, '0')}`);
        });
    }, []);

    const amount = useMemo(() => {
        const n = parseFloat(amountStr);
        return isFinite(n) ? round2(n) : 0;
    }, [amountStr]);

    const overApply = amount > maxApply + 0.005;
    const isPartial = amount > 0 && amount < ar.outstanding - 0.005;
    // The memo's AR credit must cover everything applied so far plus this application.
    const glShort = !!selected && arCredit !== null && arCredit + 0.005 < selected.applied + amount;
    const isValid = !!selected && amount > 0.005 && !overApply && !!nextRVNo && arCredit !== null && !glShort;

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid || isSubmitting || !selected) return;
        setIsSubmitting(true);

        try {
            // Re-read the memo's applications from the database: the client cache can be stale
            // and two people must not be able to spend the same credit twice.
            const appliedNow = await fetchCreditApplied(memoNo);
            if (round2(appliedNow + amount) > round2(selected.total) + 0.005) {
                addToast(
                    `Credit memo ${memoNo} only has ${formatCurrencySmartly(round2(selected.total - appliedNow), currency)} left — someone else applied part of it. Reopen this dialog.`,
                    'error',
                );
                setIsSubmitting(false);
                return;
            }
        } catch (err: any) {
            addToast(err.message, 'error');
            setIsSubmitting(false);
            return;
        }

        const matchingDO = deliveryOrders?.find(d => d['Inv No'] === invoice['Inv No']);
        const company = companies?.find(c => c['Company Name'] === invoice['Company Name']);

        const receiptItems = [{
            id: `credit-${Date.now()}`,
            no: 1,
            itemCode: '',
            modelName: 'Credit Memo Applied',
            description: `Credit memo ${memoNo} applied to Invoice ${invoice['Inv No']}`,
            qty: 1,
            unitPrice: amount,
            amount,
        }];

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
            'Payment Method': CREDIT_MEMO_METHOD,
            'credit_memo_no': memoNo,
            'Tax Type': invoice['Taxable'] === 'Commercial Invoice' ? 'Commercial Invoice' : (invoice['Taxable'] ? invoice['Taxable'] === 'VAT' || invoice['Taxable'] === 'Yes' : invoice['Tax Type'] === 'VAT') ? 'VAT' : 'NON-VAT',
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
            'Remark': [`Credit memo ${memoNo} applied`, remark.trim()].filter(Boolean).join(' — '),
            'Created By': currentUser?.Name || '',
            'ItemsJSON': JSON.stringify(receiptItems),
        };

        const optimisticReceipt = payload as Receipt;
        setReceipts(prev => prev ? [optimisticReceipt, ...prev] : [optimisticReceipt]);

        try {
            const saved = await createRecord('Receipts', payload) as Receipt;
            setReceipts(prev => prev
                ? prev.map(r => r['RV No'] === nextRVNo ? saved : r)
                : [saved]
            );

            // No journal entry on purpose: the credit memo's own entry already credited AR.

            if (!isPartial) {
                const done = await completeSettledInvoice(invoice, {
                    setInvoices,
                    setServiceTickets,
                    updateInvoiceStatus: invNo => updateRecord('Invoices', invNo, { 'Status': 'Completed' }).then(() => undefined),
                });
                if (done.completed) addToast(`Invoice ${invoice['Inv No']} marked Completed`, 'success');
                if (done.ticketNo) addToast(`Service ticket ${done.ticketNo} marked Resolved`, 'success');
                if (done.error) {
                    console.warn('[ApplyCreditModal] auto-complete failed:', done.error);
                    addToast(`Credit applied, but auto-completing the invoice failed: ${done.error}`, 'error');
                }
            }

            addToast(
                `${formatCurrencySmartly(amount, currency)} of credit memo ${memoNo} applied to ${invoice['Inv No']} · ${nextRVNo}`,
                'success',
            );
            setIsShowing(false);
            setTimeout(onClose, 200);
        } catch (err: any) {
            setReceipts(prev => prev ? prev.filter(r => r['RV No'] !== nextRVNo) : null);
            addToast(`Failed to apply credit: ${err.message}`, 'error');
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div
            style={{ zIndex: Z.MODAL }}
            className={`fixed inset-0 flex justify-center items-center p-4 transition-opacity duration-200 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
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
                    aria-label="Close"
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted disabled:opacity-50"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="p-6">
                    <div className="flex items-start gap-3 mb-5">
                        <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-brand-500/10">
                            <Ticket className="h-5 w-5 text-brand-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Apply Credit Memo</h2>
                            <p className="text-xs text-muted-foreground">Settles the invoice with the customer&apos;s credit — no cash moves</p>
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

                    {credits.length === 0 ? (
                        <div className="text-sm text-muted-foreground bg-muted/40 border border-border rounded-md px-3 py-3">
                            This customer has no unused credit memo in {currency}.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                                    Credit Memo <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={memoNo}
                                    onChange={e => setMemoNo(e.target.value)}
                                    disabled={isSubmitting}
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 transition"
                                >
                                    {credits.map(c => (
                                        <option key={c.memo['Inv No']} value={c.memo['Inv No']}>
                                            {c.memo['Inv No']} · {formatCurrencySmartly(c.remaining, currency)} available
                                            {c.applied > 0 ? ` (of ${formatCurrencySmartly(c.total, currency)})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                                    Amount to Apply ({sym}) <span className="text-rose-500">*</span>
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
                                    className={`w-full bg-background border rounded-md px-3 py-2 text-sm font-mono tabular-nums focus:ring-2 transition ${overApply ? 'border-rose-500 focus:ring-rose-500' : 'border-border focus:ring-brand-500'}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setAmountStr(maxApply.toFixed(2))}
                                    disabled={isSubmitting || maxApply <= 0}
                                    className="mt-1 text-[11px] text-brand-600 hover:text-brand-700 hover:underline disabled:opacity-40 float-right"
                                >
                                    Fill max: {sym}{maxApply.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </button>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                                    Date <span className="text-rose-500">*</span>
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
                                    placeholder="e.g. Agreed with customer on 3 Nov"
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 transition"
                                />
                            </div>
                        </div>
                    )}

                    {/* Hints */}
                    <div className="mt-4 space-y-1.5">
                        {overApply && (
                            <div className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2">
                                <span className="font-bold">Too much</span>
                                <span>· At most {formatCurrencySmartly(maxApply, currency)} (the lower of the outstanding balance and the credit left).</span>
                            </div>
                        )}
                        {glShort && (
                            <div className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2">
                                <ShieldAlert className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                <span>
                                    <span className="font-bold">Blocked</span> · The ledger holds only {formatCurrencySmartly(Math.max(0, (arCredit ?? 0) - (selected?.applied ?? 0)), currency)} of AR credit
                                    for {memoNo}. Applying more would leave the books showing the customer still owing it. Fix the memo&apos;s journal entry first.
                                </span>
                            </div>
                        )}
                        {arCreditError && (
                            <div className="text-xs text-rose-700 dark:text-rose-400">{arCreditError}</div>
                        )}
                        {isPartial && !overApply && !glShort && (
                            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                                <span className="font-bold">Partial</span>
                                <span>· Remaining {formatCurrencySmartly(ar.outstanding - amount, currency)} stays open in Collection.</span>
                            </div>
                        )}
                        <div className="text-[11px] text-muted-foreground">
                            {nextRVNo
                                ? <>Receipt <span className="font-mono font-semibold text-foreground">{nextRVNo}</span> (method <span className="font-semibold text-foreground">Credit Memo</span>) will be created. No journal entry is posted.</>
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
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-primary-foreground bg-primary hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition shadow-sm"
                    >
                        {isSubmitting ? 'Applying...' : <>
                            <Ticket className="w-4 h-4" />
                            Apply {isPartial ? 'Partial Credit' : 'Credit'}
                        </>}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
};

export default ApplyCreditModal;
