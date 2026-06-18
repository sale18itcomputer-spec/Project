'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PosCartItem, PosSessionForm, PosPaymentMethod, PricelistItem } from '../../types';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { generatePosInvNo, generatePosRvNo, createRecord, getSetting } from '../../services/api';
import { autoPostInvoiceJournal } from '../../services/accountingApi';
import { supabase } from '../../lib/supabase';
import { formatDisplayDate } from '../../utils/time';
import PosReceiptModal, { CompletedSale } from './PosReceiptModal';
import PosSalesModal from './PosSalesModal';
import {
  ShoppingBag, ShoppingCart, RotateCcw, Search, Loader2,
  Banknote, CreditCard, QrCode, ArrowLeftRight, ChevronDown, ChevronUp,
} from 'lucide-react';

const PAYMENT_METHODS: PosPaymentMethod[] = ['Cash', 'ABA', 'KHQR', 'Card', 'Bank Transfer'];

const PAYMENT_ICONS: Record<PosPaymentMethod, React.ReactNode> = {
  Cash:            <Banknote size={14} />,
  ABA:             <CreditCard size={14} />,
  KHQR:            <QrCode size={14} />,
  Card:            <CreditCard size={14} />,
  'Bank Transfer': <ArrowLeftRight size={14} />,
};

const PosTerminal: React.FC = () => {
  const { pricelist, invoices, setInvoices, setReceipts } = useData();
  const { currentUser } = useAuth();
  const { addToast } = useToast();

  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<PosSessionForm>({
    invNo: '', rvNo: '', invDate: new Date().toISOString().split('T')[0],
    taxType: 'NON-VAT', currency: 'USD', exchangeRate: 4100,
    companyName: 'Walk-In Customer', contactName: '', phoneNumber: '',
    paymentMethod: 'Cash', amountTendered: 0, notes: '', createdBy: currentUser?.Name ?? '',
  });

  // Load POS settings on mount
  useEffect(() => {
    Promise.all([
      getSetting('pos_default_tax_type'),
      getSetting('pos_default_currency'),
      getSetting('pos_exchange_rate'),
    ]).then(([taxType, currency, rate]) => {
      setSession(prev => ({
        ...prev,
        taxType: taxType ?? 'NON-VAT',
        currency: currency ?? 'USD',
        exchangeRate: Number(rate) || 4100,
        createdBy: currentUser?.Name ?? '',
      }));
    }).catch(() => { /* silently ignore, defaults are fine */ });
  }, [currentUser]);

  // Derived totals
  const subTotal = cart.reduce((sum, i) => sum + i.amount, 0);
  const taxAmount = session.taxType === 'VAT' ? subTotal * 0.1 : 0;
  const grandTotal = subTotal + taxAmount;
  const changeAmount = session.paymentMethod === 'Cash'
    ? Math.max(0, (session.amountTendered || 0) - grandTotal)
    : 0;

  const today = new Date().toISOString().split('T')[0];
  const todaySaleCount = (invoices ?? []).filter(
    inv => inv['Inv No']?.startsWith(`POS-${new Date().getFullYear()}-`) &&
      inv['Inv Date']?.startsWith(today)
  ).length;

  // Categories from pricelist
  const categories = useMemo(() => {
    const cats = [...new Set((pricelist ?? [])
      .filter(p => p.Status !== 'Discontinued')
      .map(p => p.Category)
      .filter(Boolean)
    )].sort();
    return ['All', ...cats];
  }, [pricelist]);

  // Filtered product list
  const filteredProducts = useMemo(() => {
    let products = (pricelist ?? []).filter(p => p.Status !== 'Discontinued');
    if (activeCategory !== 'All') products = products.filter(p => p.Category === activeCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = products.filter(p =>
        p.Code?.toLowerCase().includes(q) ||
        p.Brand?.toLowerCase().includes(q) ||
        p.Model?.toLowerCase().includes(q) ||
        p.Description?.toLowerCase().includes(q)
      );
    }
    return products;
  }, [pricelist, activeCategory, searchQuery]);

  // Cart actions
  const addToCart = (item: PricelistItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.itemCode === item.Code);
      if (existing) {
        return prev.map(c => c.itemCode === item.Code
          ? { ...c, qty: c.qty + 1, amount: (c.qty + 1) * c.unitPrice }
          : c
        );
      }
      const unitPrice = Number(item['End User Price']) || 0;
      return [...prev, {
        id: crypto.randomUUID(),
        itemCode: item.Code,
        modelName: item.Model,
        description: item.Description || '',
        brand: item.Brand || '',
        qty: 1,
        unitPrice,
        amount: unitPrice,
        serialNumber: '',
      }];
    });
  };

  const updateQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i.id !== id));
    } else {
      setCart(prev => prev.map(i => i.id === id ? { ...i, qty: newQty, amount: newQty * i.unitPrice } : i));
    }
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const commitPriceEdit = (id: string) => {
    const val = parseFloat(editingPriceVal);
    if (!isNaN(val) && val >= 0) {
      setCart(prev => prev.map(i => i.id === id ? { ...i, unitPrice: val, amount: i.qty * val } : i));
    }
    setEditingPriceId(null);
  };

  const handleResetSale = () => {
    setCart([]);
    setSession(prev => ({ ...prev, amountTendered: 0, contactName: '', phoneNumber: '' }));
    setShowCustomer(false);
    searchRef.current?.focus();
  };

  const handleReceiptClose = () => {
    setShowReceiptModal(false);
    setCompletedSale(null);
    handleResetSale();
  };

  // ── Charge / sale completion ─────────────────────────────────────────────────
  const handleCharge = async () => {
    if (cart.length === 0) return;
    if (session.paymentMethod === 'Cash' && session.amountTendered < grandTotal) {
      addToast('Amount tendered is less than the total.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const invNo = await generatePosInvNo();
      const rvNo  = await generatePosRvNo();

      const customerName = session.contactName || session.companyName || 'Walk-In Customer';
      const invoicePayload = {
        'Inv No':       invNo,
        'Inv Date':     today,
        'SO No':        null,
        'Company Name': customerName,
        'Contact Name': session.contactName || '',
        'Phone Number': session.phoneNumber || '',
        'Amount':       grandTotal,
        'Taxable':      session.taxType === 'VAT' ? 'Yes' : 'No',
        'Tax Type':     session.taxType,
        'Status':       'Completed',
        'Currency':     session.currency,
        'Created By':   session.createdBy,
        'ItemsJSON':    cart.map((item, i) => ({
          id: item.id, no: i + 1,
          itemCode: item.itemCode, modelName: item.modelName,
          description: item.description, qty: item.qty,
          unitPrice: item.unitPrice, amount: item.amount,
          serialNumber: item.serialNumber || '',
        })),
      };

      await createRecord('Invoices', invoicePayload);
      setInvoices(prev => prev ? [invoicePayload as any, ...prev] : [invoicePayload as any]);

      const receiptPayload = {
        'RV No':          rvNo,
        'RV Date':        today,
        'Inv No':         invNo,
        'SO No':          null,
        'Company Name':   customerName,
        'Contact Name':   session.contactName || '',
        'Phone Number':   session.phoneNumber || '',
        'Amount':         grandTotal,
        'Currency':       session.currency,
        'Payment Method': session.paymentMethod,
        'Tax Type':       session.taxType,
        'Status':         'Issued',
        'Created By':     session.createdBy,
        'ItemsJSON':      invoicePayload['ItemsJSON'],
      };

      await createRecord('Receipts', receiptPayload);
      setReceipts(prev => prev ? [receiptPayload as any, ...prev] : [receiptPayload as any]);

      // Non-fatal: inventory deduction + COGS + revenue journal
      const cartSnapshot = [...cart];
      ;(async () => {
        const brandMap = new Map((pricelist ?? []).map(p => [p['Code'], p['Brand']]));
        const brandTotals: Record<string, number> = {};
        const costItems: { brand: string; qty: number; unit_price: number; cogs_account?: string; inventory_account?: string }[] = [];

        for (const item of cartSnapshot) {
          const brand = (item.itemCode && brandMap.get(item.itemCode)) || item.brand || 'Other Accessories';
          brandTotals[brand] = (brandTotals[brand] ?? 0) + item.amount;

          // Inventory lookup + deduction
          let invRows: any[] | null = null;
          if (item.itemCode) {
            const { data } = await supabase
              .from('inventory')
              .select('id, qty, unit_price, brand, cogs_account, inventory_account')
              .eq('status', 'In Stock')
              .gt('qty', 0)
              .eq('code', item.itemCode)
              .order('created_at', { ascending: true })
              .limit(1);
            invRows = data;
          }
          if ((!invRows || invRows.length === 0) && item.modelName) {
            const { data } = await supabase
              .from('inventory')
              .select('id, qty, unit_price, brand, cogs_account, inventory_account')
              .eq('status', 'In Stock')
              .gt('qty', 0)
              .ilike('model_name', `%${item.modelName}%`)
              .order('created_at', { ascending: true })
              .limit(1);
            invRows = data;
          }
          if (invRows && invRows.length > 0) {
            const inv = invRows[0];
            const newQty = Math.max(0, Number(inv.qty) - item.qty);
            await supabase
              .from('inventory')
              .update({ qty: newQty, status: newQty <= 0 ? 'Out of Stock' : 'In Stock' })
              .eq('id', inv.id);
            const unitCost = Number(inv.unit_price) || 0;
            if (unitCost > 0) {
              costItems.push({
                brand,
                qty:               item.qty,
                unit_price:        unitCost,
                cogs_account:      inv.cogs_account      || undefined,
                inventory_account: inv.inventory_account || undefined,
              });
            }
          }
        }

        const brandAmounts = Object.entries(brandTotals)
          .map(([b, subtotal]) => ({ brand: b, subtotal }))
          .filter(b => b.subtotal > 0.005);

        await autoPostInvoiceJournal({
          invNo,
          entryDate:   today,
          grandTotal,
          taxAmount,
          isVAT:       session.taxType === 'VAT',
          createdBy:   session.createdBy,
          brandAmounts: brandAmounts.length > 0 ? brandAmounts : undefined,
          costItems:   costItems.length > 0 ? costItems : undefined,
        });
      })().catch(err => console.warn('[POS] inventory/journal post failed:', err));

      setCompletedSale({ invNo, rvNo, grandTotal, changeAmount, items: [...cart] });
      setShowReceiptModal(true);

    } catch (err: any) {
      addToast(`Sale failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const isChargeDisabled = cart.length === 0 || isProcessing ||
    (session.paymentMethod === 'Cash' && (session.amountTendered || 0) < grandTotal && grandTotal > 0);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header bar */}
      <div className="flex-shrink-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingBag className="text-brand-500" size={22} />
          <div>
            <h1 className="text-lg font-black text-foreground leading-tight">POS Terminal</h1>
            <p className="text-xs text-muted-foreground">{formatDisplayDate(today)} · Cashier: {currentUser?.Name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSalesHistory(true)}
            className="text-xs bg-brand-500/10 text-brand-500 font-bold px-3 py-1.5 rounded-full hover:bg-brand-500/20 transition cursor-pointer"
          >
            {todaySaleCount} {todaySaleCount === 1 ? 'sale' : 'sales'} today
          </button>
          <button
            onClick={handleResetSale}
            disabled={cart.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition disabled:opacity-30"
          >
            <RotateCcw size={14} /> Clear
          </button>
        </div>
      </div>

      {/* Main split panel */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANEL: Product search + grid ── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
          {/* Search */}
          <div className="flex-shrink-0 p-3 border-b border-border">
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search products by code, brand, model..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-muted border-transparent text-sm rounded-lg focus:ring-2 focus:ring-brand-500 pl-10 pr-4 py-2.5 transition"
                autoFocus
              />
              <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex-shrink-0 flex gap-1 overflow-x-auto px-3 py-2 border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition ${
                  activeCategory === cat
                    ? 'bg-brand-600 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground/40 gap-2">
                <Search size={32} className="opacity-30" />
                <p className="text-sm">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredProducts.map(item => (
                  <div
                    key={item.Code}
                    onClick={() => addToCart(item)}
                    className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-brand-500 hover:shadow-md transition group select-none"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">{item.Brand}</div>
                    <div className="text-sm font-bold text-foreground leading-tight line-clamp-2 mb-2">{item.Model}</div>
                    <div className="text-base font-black text-brand-500">
                      ${Number(item['End User Price']).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 truncate">{item.Category}</div>
                    <button
                      onClick={e => { e.stopPropagation(); addToCart(item); }}
                      className="mt-2 w-full py-1.5 rounded-lg bg-brand-600/10 text-brand-600 hover:bg-brand-600 hover:text-white text-xs font-bold transition group-hover:bg-brand-600 group-hover:text-white"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: Cart + Checkout ── */}
        <div className="w-[380px] shrink-0 flex flex-col overflow-hidden bg-card">
          {/* Cart header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-bold text-sm">
              Cart
              {cart.length > 0 && (
                <span className="ml-2 bg-brand-500/10 text-brand-500 text-xs font-bold px-2 py-0.5 rounded-full">
                  {cart.length} {cart.length === 1 ? 'item' : 'items'}
                </span>
              )}
            </h2>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 gap-3">
                <ShoppingCart size={48} className="opacity-20" />
                <p className="text-sm">Add products to start a sale</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="bg-muted/40 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{item.modelName || item.itemCode}</div>
                      {item.brand && <div className="text-[10px] text-muted-foreground">{item.brand}</div>}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-muted-foreground/50 hover:text-rose-500 transition text-xs font-bold px-1"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    {/* Qty controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        className="w-6 h-6 rounded-full bg-background border border-border text-sm font-bold hover:bg-rose-100 hover:text-rose-500 transition flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-sm font-bold">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        className="w-6 h-6 rounded-full bg-background border border-border text-sm font-bold hover:bg-brand-100 hover:text-brand-500 transition flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>

                    {/* Unit price (inline editable) */}
                    {editingPriceId === item.id ? (
                      <input
                        type="number"
                        autoFocus
                        className="w-20 text-right text-sm font-semibold bg-background border border-brand-500 rounded px-1 py-0.5"
                        value={editingPriceVal}
                        onChange={e => setEditingPriceVal(e.target.value)}
                        onBlur={() => commitPriceEdit(item.id)}
                        onKeyDown={e => { if (e.key === 'Enter') commitPriceEdit(item.id); if (e.key === 'Escape') setEditingPriceId(null); }}
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingPriceId(item.id); setEditingPriceVal(String(item.unitPrice)); }}
                        className="text-xs text-muted-foreground hover:text-foreground transition"
                        title="Click to edit price"
                      >
                        ${item.unitPrice.toFixed(2)} ea
                      </button>
                    )}

                    {/* Line total */}
                    <div className="text-sm font-bold text-right">${item.amount.toFixed(2)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checkout section */}
          <div className="flex-shrink-0 border-t border-border p-4 space-y-3">
            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>${subTotal.toFixed(2)}</span>
              </div>
              {session.taxType === 'VAT' && (
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT (10%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-base border-t border-border pt-1 mt-1">
                <span>Total</span>
                <span className="text-brand-500">${grandTotal.toFixed(2)}</span>
              </div>
              {session.currency === 'KHR' && grandTotal > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>≈ KHR</span>
                  <span>៛{(grandTotal * session.exchangeRate).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Customer section (collapsible) */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCustomer(p => !p)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
              >
                <span>
                  {session.companyName && session.companyName !== 'Walk-In Customer'
                    ? session.companyName
                    : session.contactName
                      ? session.contactName
                      : 'Walk-In Customer'}
                  {session.phoneNumber ? ` · ${session.phoneNumber}` : ''}
                </span>
                {showCustomer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showCustomer && (
                <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Name</label>
                    <input
                      type="text"
                      value={session.contactName}
                      onChange={e => setSession(p => ({ ...p, contactName: e.target.value }))}
                      placeholder="Customer name (optional)"
                      className="bg-muted text-sm rounded-lg px-3 py-2 border border-border w-full focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Phone</label>
                    <input
                      type="tel"
                      value={session.phoneNumber}
                      onChange={e => setSession(p => ({ ...p, phoneNumber: e.target.value }))}
                      placeholder="Phone number (optional)"
                      className="bg-muted text-sm rounded-lg px-3 py-2 border border-border w-full focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tax type + Currency toggles */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => setSession(p => ({ ...p, taxType: 'NON-VAT' }))}
                  className={`flex-1 py-1.5 text-xs font-bold transition ${session.taxType === 'NON-VAT' ? 'bg-brand-600 text-white' : 'bg-muted text-muted-foreground'}`}
                >
                  NON-VAT
                </button>
                <button
                  onClick={() => setSession(p => ({ ...p, taxType: 'VAT' }))}
                  className={`flex-1 py-1.5 text-xs font-bold transition ${session.taxType === 'VAT' ? 'bg-brand-600 text-white' : 'bg-muted text-muted-foreground'}`}
                >
                  VAT
                </button>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => setSession(p => ({ ...p, currency: 'USD' }))}
                  className={`flex-1 py-1.5 text-xs font-bold transition ${session.currency === 'USD' ? 'bg-brand-600 text-white' : 'bg-muted text-muted-foreground'}`}
                >
                  USD
                </button>
                <button
                  onClick={() => setSession(p => ({ ...p, currency: 'KHR' }))}
                  className={`flex-1 py-1.5 text-xs font-bold transition ${session.currency === 'KHR' ? 'bg-brand-600 text-white' : 'bg-muted text-muted-foreground'}`}
                >
                  KHR
                </button>
              </div>
            </div>
            {session.currency === 'KHR' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground shrink-0">Rate ៛:</label>
                <input
                  type="number"
                  value={session.exchangeRate}
                  onChange={e => setSession(p => ({ ...p, exchangeRate: Number(e.target.value) || 4100 }))}
                  className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs"
                />
              </div>
            )}

            {/* Payment method tabs */}
            <div className="flex gap-1 flex-wrap">
              {PAYMENT_METHODS.map(method => (
                <button
                  key={method}
                  onClick={() => setSession(p => ({ ...p, paymentMethod: method }))}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                    session.paymentMethod === method
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {PAYMENT_ICONS[method]} {method}
                </button>
              ))}
            </div>

            {/* Cash tender section */}
            {session.paymentMethod === 'Cash' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Amount Tendered</label>
                <input
                  type="number"
                  value={session.amountTendered || ''}
                  onChange={e => setSession(p => ({ ...p, amountTendered: parseFloat(e.target.value) || 0 }))}
                  className="w-full text-xl font-bold text-center bg-muted border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  placeholder="0.00"
                />
                {(session.amountTendered || 0) > 0 && (
                  <div className={`text-center py-2 rounded-lg font-bold text-lg ${changeAmount >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    Change: ${changeAmount.toFixed(2)}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 5, 10, 20, 50, 100, 'Exact', 'Clear'].map(v => (
                    <button
                      key={String(v)}
                      onClick={() => {
                        if (v === 'Exact') setSession(p => ({ ...p, amountTendered: grandTotal }));
                        else if (v === 'Clear') setSession(p => ({ ...p, amountTendered: 0 }));
                        else setSession(p => ({ ...p, amountTendered: (p.amountTendered || 0) + Number(v) }));
                      }}
                      className="py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-semibold transition border border-border"
                    >
                      {v === 'Exact' ? 'Exact' : v === 'Clear' ? 'Clear' : `+$${v}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Charge button */}
            <button
              onClick={handleCharge}
              disabled={isChargeDisabled}
              className="w-full py-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-lg transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <ShoppingBag size={20} />}
              {isProcessing ? 'Processing...' : `Charge $${grandTotal.toFixed(2)}`}
            </button>
            {session.currency === 'KHR' && grandTotal > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                ≈ ៛{(grandTotal * session.exchangeRate).toLocaleString()} KHR
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Receipt modal */}
      <PosReceiptModal
        isOpen={showReceiptModal}
        onClose={handleReceiptClose}
        sale={completedSale}
        session={session}
        taxAmount={taxAmount}
        subTotal={subTotal}
      />

      {/* Sales history modal */}
      <PosSalesModal
        isOpen={showSalesHistory}
        onClose={() => setShowSalesHistory(false)}
      />
    </div>
  );
};

export default PosTerminal;
