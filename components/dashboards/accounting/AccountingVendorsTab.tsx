'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BillVendor } from '../../../types';
import {
    fetchBillVendors, createBillVendor, updateBillVendor, deleteBillVendor,
} from '../../../services/billVendorsApi';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { usePermissions } from '../../../hooks/usePermissions';
import {
    PlusCircle, Search, Building2, X, Edit2, Trash2,
    Phone, Mail, MapPin, CreditCard, Tag, Landmark, FileText,
    CheckCircle2, AlertCircle, ChevronDown, Download,
} from 'lucide-react';
import { exportBillVendors } from '../../../utils/exportAccountingXlsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const VENDOR_TYPES = ['Utility', 'Government', 'Insurance', 'Rental', 'Subscription', 'Logistics', 'Other'] as const;
const PAYMENT_TERMS = ['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 60'];

const EMPTY_FORM: Omit<BillVendor, 'id' | 'created_at' | 'updated_at'> = {
    vendor_name: '',
    vendor_type: 'Utility',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    tax_id: '',
    account_number: '',
    payment_terms: 'Due on Receipt',
    default_expense_account: '',
    bank_name: '',
    bank_account: '',
    notes: '',
    status: 'Active',
};

const TYPE_COLOR: Record<string, string> = {
    Utility:      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700',
    Government:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700',
    Insurance:    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700',
    Rental:       'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700',
    Subscription: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700',
    Logistics:    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700',
    Other:        'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
};

// ── Sub-components ────────────────────────────────────────────────────────────

const TypeBadge = ({ type }: { type: string }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${TYPE_COLOR[type] ?? TYPE_COLOR['Other']}`}>
        {type}
    </span>
);

const StatusBadge = ({ status }: { status: string }) => (
    status === 'Active'
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700">
            <CheckCircle2 size={10} /> Active
          </span>
        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600">
            <AlertCircle size={10} /> Inactive
          </span>
);

// ── Vendor Form (create / edit) ───────────────────────────────────────────────

interface FormProps {
    initial?: BillVendor | null;
    onSave: (v: Omit<BillVendor, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    onClose: () => void;
    saving: boolean;
}

const VendorForm: React.FC<FormProps> = ({ initial, onSave, onClose, saving }) => {
    const [form, setForm] = useState<Omit<BillVendor, 'id' | 'created_at' | 'updated_at'>>(
        initial
            ? { ...EMPTY_FORM, ...initial }
            : { ...EMPTY_FORM },
    );

    const set = (k: keyof typeof form, v: string) =>
        setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.vendor_name.trim()) return;
        onSave(form);
    };

    const inputCls = 'w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-50';
    const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-brand-600/10">
                            <Building2 size={16} className="text-brand-600" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-foreground">
                                {initial ? 'Edit Vendor' : 'New Bill Vendor'}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                For inter-bills: utilities, NSSF, insurance, rent, etc.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    {/* ── Section 1: Identity ─────────────────────────────── */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Identity</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className={labelCls}>Vendor / Issuer Name <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={form.vendor_name}
                                    onChange={e => set('vendor_name', e.target.value)}
                                    placeholder="e.g. NSSF Cambodia, EdC, Smart Axiata"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Vendor Type <span className="text-rose-500">*</span></label>
                                <div className="relative">
                                    <select
                                        value={form.vendor_type}
                                        onChange={e => set('vendor_type', e.target.value)}
                                        className={`${inputCls} appearance-none pr-8`}
                                    >
                                        {VENDOR_TYPES.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Status</label>
                                <div className="relative">
                                    <select
                                        value={form.status}
                                        onChange={e => set('status', e.target.value as 'Active' | 'Inactive')}
                                        className={`${inputCls} appearance-none pr-8`}
                                    >
                                        <option>Active</option>
                                        <option>Inactive</option>
                                    </select>
                                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Tax ID / TIN</label>
                                <input
                                    type="text"
                                    value={form.tax_id}
                                    onChange={e => set('tax_id', e.target.value)}
                                    placeholder="e.g. K001-123456789"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Our Account No. (with vendor)</label>
                                <input
                                    type="text"
                                    value={form.account_number}
                                    onChange={e => set('account_number', e.target.value)}
                                    placeholder="e.g. 1234-5678"
                                    className={inputCls}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Section 2: Contact ──────────────────────────────── */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Contact</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Contact Person</label>
                                <input
                                    type="text"
                                    value={form.contact_person}
                                    onChange={e => set('contact_person', e.target.value)}
                                    placeholder="Full name"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Phone</label>
                                <input
                                    type="text"
                                    value={form.phone}
                                    onChange={e => set('phone', e.target.value)}
                                    placeholder="+855 23 000 000"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Email</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => set('email', e.target.value)}
                                    placeholder="billing@vendor.com"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Payment Terms</label>
                                <div className="relative">
                                    <select
                                        value={form.payment_terms}
                                        onChange={e => set('payment_terms', e.target.value)}
                                        className={`${inputCls} appearance-none pr-8`}
                                    >
                                        {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className={labelCls}>Address</label>
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={e => set('address', e.target.value)}
                                    placeholder="Street, district, city"
                                    className={inputCls}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Section 3: Accounting ───────────────────────────── */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Accounting</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Default Expense Account (GL #)</label>
                                <input
                                    type="text"
                                    value={form.default_expense_account}
                                    onChange={e => set('default_expense_account', e.target.value)}
                                    placeholder="e.g. 65100"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Bank Name</label>
                                <input
                                    type="text"
                                    value={form.bank_name}
                                    onChange={e => set('bank_name', e.target.value)}
                                    placeholder="e.g. ABA Bank"
                                    className={inputCls}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className={labelCls}>Bank Account No.</label>
                                <input
                                    type="text"
                                    value={form.bank_account}
                                    onChange={e => set('bank_account', e.target.value)}
                                    placeholder="Account number"
                                    className={inputCls}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Section 4: Notes ────────────────────────────────── */}
                    <div>
                        <label className={labelCls}>Notes / Remarks</label>
                        <textarea
                            value={form.notes}
                            onChange={e => set('notes', e.target.value)}
                            rows={3}
                            placeholder="Any additional information about this vendor..."
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-600 resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 h-9 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !form.vendor_name.trim()}
                            className="px-5 h-9 text-sm font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Vendor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Detail Panel ──────────────────────────────────────────────────────────────

const DetailRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => {
    if (!value) return null;
    return (
        <div className="flex items-start gap-3">
            <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium text-foreground break-words">{value}</p>
            </div>
        </div>
    );
};

// ── Main Tab ──────────────────────────────────────────────────────────────────

const AccountingVendorsTab: React.FC = () => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { can } = usePermissions();

    const canCreate = can('accounting', 'create');
    const canEdit   = can('accounting', 'edit');
    const canDelete = can('accounting', 'delete');

    const [vendors, setVendors]     = useState<BillVendor[]>([]);
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);
    const [deleting, setDeleting]   = useState<string | null>(null);

    const [showForm, setShowForm]   = useState(false);
    const [editing, setEditing]     = useState<BillVendor | null>(null);
    const [selected, setSelected]   = useState<BillVendor | null>(null);

    const [search, setSearch]       = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

    // ── Load ──────────────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            setVendors(await fetchBillVendors());
        } catch (e: any) {
            addToast(`Failed to load vendors: ${e.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { load(); }, [load]);

    // ── Filter ────────────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = vendors;
        if (typeFilter !== 'All') list = list.filter(v => v.vendor_type === typeFilter);
        if (statusFilter !== 'All') list = list.filter(v => v.status === statusFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(v =>
                v.vendor_name.toLowerCase().includes(q) ||
                v.contact_person.toLowerCase().includes(q) ||
                v.vendor_type.toLowerCase().includes(q) ||
                v.tax_id.toLowerCase().includes(q),
            );
        }
        return list;
    }, [vendors, search, typeFilter, statusFilter]);

    // ── Stats ─────────────────────────────────────────────────────────────────
    const stats = useMemo(() => ({
        total:    vendors.length,
        active:   vendors.filter(v => v.status === 'Active').length,
        byType:   VENDOR_TYPES.map(t => ({ type: t, count: vendors.filter(v => v.vendor_type === t).length })).filter(x => x.count > 0),
    }), [vendors]);

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async (data: Omit<BillVendor, 'id' | 'created_at' | 'updated_at'>) => {
        setSaving(true);
        try {
            if (editing?.id) {
                const updated = await updateBillVendor(editing.id, data);
                setVendors(v => v.map(x => x.id === editing.id ? updated : x));
                if (selected?.id === editing.id) setSelected(updated);
                addToast('Vendor updated.', 'success');
            } else {
                const created = await createBillVendor({ ...data, created_by: currentUser?.Email ?? 'admin' });
                setVendors(v => [...v, created].sort((a, b) => a.vendor_name.localeCompare(b.vendor_name)));
                addToast('Vendor created.', 'success');
            }
            setShowForm(false);
            setEditing(null);
        } catch (e: any) {
            addToast(`Save failed: ${e.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDelete = async (v: BillVendor) => {
        if (!v.id) return;
        if (!confirm(`Delete "${v.vendor_name}"? This cannot be undone.`)) return;
        setDeleting(v.id);
        try {
            await deleteBillVendor(v.id);
            setVendors(vs => vs.filter(x => x.id !== v.id));
            if (selected?.id === v.id) setSelected(null);
            addToast('Vendor deleted.', 'success');
        } catch (e: any) {
            addToast(`Delete failed: ${e.message}`, 'error');
        } finally {
            setDeleting(null);
        }
    };

    const openCreate = () => { setEditing(null); setShowForm(true); };
    const openEdit   = (v: BillVendor) => { setEditing(v); setShowForm(true); };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* ── Stats Row ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total</p>
                    <p className="text-2xl font-black text-foreground mt-1">{stats.total}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Active</p>
                    <p className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</p>
                </div>
                {stats.byType.slice(0, 2).map(({ type, count }) => (
                    <div key={type} className="bg-card border border-border rounded-xl p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{type}</p>
                        <p className="text-2xl font-black text-foreground mt-1">{count}</p>
                    </div>
                ))}
            </div>

            {/* ── Toolbar ────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative flex-1 min-w-0">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by name, contact, type, TIN…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-600/40"
                    />
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                    {/* Type filter */}
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none"
                    >
                        <option value="All">All Types</option>
                        {VENDOR_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    {/* Status filter */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none"
                    >
                        <option value="All">All Status</option>
                        <option>Active</option>
                        <option>Inactive</option>
                    </select>
                    <button
                        onClick={() => exportBillVendors(filtered, new Date().toISOString().slice(0, 10))}
                        className="flex items-center gap-1.5 px-3 h-9 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
                    >
                        <Download size={13} /> Export
                    </button>
                    {canCreate && (
                        <button
                            onClick={openCreate}
                            className="flex items-center gap-1.5 px-4 h-9 text-sm font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition"
                        >
                            <PlusCircle size={14} /> New Vendor
                        </button>
                    )}
                </div>
            </div>

            {/* ── Main layout: table + detail panel ──────────────────────── */}
            <div className={`flex gap-4 ${selected ? 'items-start' : ''}`}>

                {/* ── Vendor Table ─────────────────────────────────────────── */}
                <div className="flex-1 min-w-0 bg-card border border-border rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="py-20 text-center text-sm text-muted-foreground">Loading vendors…</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground">
                            <Building2 size={36} className="opacity-30" />
                            <p className="text-sm">
                                {vendors.length === 0 ? 'No vendors yet. Click "New Vendor" to add one.' : 'No vendors match the current filters.'}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 border-b border-border">
                                <tr>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Vendor</th>
                                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Type</th>
                                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Contact</th>
                                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Default GL</th>
                                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                                    <th className="w-20 px-3 py-2.5" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered.map(v => (
                                    <tr
                                        key={v.id}
                                        onClick={() => setSelected(s => s?.id === v.id ? null : v)}
                                        className={`cursor-pointer transition-colors hover:bg-muted/40 ${selected?.id === v.id ? 'bg-brand-600/5 dark:bg-brand-600/10' : ''}`}
                                    >
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-foreground leading-tight">{v.vendor_name}</p>
                                            {v.account_number && (
                                                <p className="text-xs text-muted-foreground mt-0.5">Acct: {v.account_number}</p>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 hidden md:table-cell">
                                            <TypeBadge type={v.vendor_type} />
                                        </td>
                                        <td className="px-3 py-3 hidden lg:table-cell">
                                            <div className="text-sm text-muted-foreground space-y-0.5">
                                                {v.contact_person && <p>{v.contact_person}</p>}
                                                {v.phone && <p>{v.phone}</p>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 hidden lg:table-cell">
                                            <span className="text-xs font-mono text-muted-foreground">
                                                {v.default_expense_account || '—'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <StatusBadge status={v.status} />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => openEdit(v)}
                                                        className="p-1.5 rounded-md text-muted-foreground hover:text-brand-600 hover:bg-brand-600/10 transition"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDelete(v)}
                                                        disabled={deleting === v.id}
                                                        className="p-1.5 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-600/10 transition disabled:opacity-40"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Detail Panel ──────────────────────────────────────────── */}
                {selected && (
                    <div className="w-72 shrink-0 bg-card border border-border rounded-xl overflow-hidden">
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                            <div className="flex items-center gap-2 min-w-0">
                                <Building2 size={14} className="text-brand-600 shrink-0" />
                                <span className="text-sm font-semibold text-foreground truncate">{selected.vendor_name}</span>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground shrink-0 ml-2">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="p-4 space-y-5">
                            {/* Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <TypeBadge type={selected.vendor_type} />
                                <StatusBadge status={selected.status} />
                            </div>

                            {/* Contact */}
                            <div className="space-y-3">
                                <DetailRow icon={<Phone size={13} />}    label="Phone"          value={selected.phone} />
                                <DetailRow icon={<Mail size={13} />}     label="Email"          value={selected.email} />
                                <DetailRow icon={<MapPin size={13} />}   label="Address"        value={selected.address} />
                                <DetailRow icon={<Tag size={13} />}      label="Contact Person" value={selected.contact_person} />
                            </div>

                            {/* Accounting */}
                            <div className="pt-3 border-t border-border space-y-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Accounting</p>
                                <DetailRow icon={<FileText size={13} />}  label="Tax ID / TIN"            value={selected.tax_id} />
                                <DetailRow icon={<CreditCard size={13} />} label="Our Account No."         value={selected.account_number} />
                                <DetailRow icon={<Landmark size={13} />}  label="Default Expense GL"      value={selected.default_expense_account} />
                                <DetailRow icon={<Landmark size={13} />}  label="Payment Terms"           value={selected.payment_terms} />
                            </div>

                            {/* Bank */}
                            {(selected.bank_name || selected.bank_account) && (
                                <div className="pt-3 border-t border-border space-y-3">
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Banking</p>
                                    <DetailRow icon={<Landmark size={13} />}  label="Bank Name"    value={selected.bank_name} />
                                    <DetailRow icon={<CreditCard size={13} />} label="Bank Account" value={selected.bank_account} />
                                </div>
                            )}

                            {/* Notes */}
                            {selected.notes && (
                                <div className="pt-3 border-t border-border">
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Notes</p>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{selected.notes}</p>
                                </div>
                            )}

                            {/* Actions */}
                            {(canEdit || canDelete) && (
                                <div className="pt-3 border-t border-border flex gap-2">
                                    {canEdit && (
                                        <button
                                            onClick={() => openEdit(selected)}
                                            className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-brand-600 hover:border-brand-600 transition"
                                        >
                                            <Edit2 size={12} /> Edit
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => handleDelete(selected)}
                                            disabled={deleting === selected.id}
                                            className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-rose-600 hover:border-rose-500 transition disabled:opacity-40"
                                        >
                                            <Trash2 size={12} /> Delete
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Form Modal ──────────────────────────────────────────────── */}
            {showForm && (
                <VendorForm
                    initial={editing}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditing(null); }}
                    saving={saving}
                />
            )}
        </div>
    );
};

export default AccountingVendorsTab;
