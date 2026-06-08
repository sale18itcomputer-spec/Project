'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ProductInquiry, InquiryItem } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { generateInquiryNo, saveProductInquiry } from '../../../services/api';
import { formatToInputDate } from '../../../utils/time';
import { Plus, Trash2, Save, Loader2, Search } from 'lucide-react';
import { FormSection, FormInput, FormTextarea, FormSelect } from '../../common/FormControls';
import SearchableSelect from '../../common/SearchableSelect';
import DocumentEditorContainer from '../../layout/DocumentEditorContainer';

const ITEM_STATUS_OPTIONS = ['Pending', 'In Stock', 'Available', 'Lead Time', 'Not Available'] as const;
const STOCK_TYPE_OPTIONS  = ['In-Stock', 'Lead Time'] as const;
const PRIORITY_OPTIONS    = ['Low', 'Normal', 'High', 'Urgent'] as const;
const STATUS_OPTIONS      = ['Draft', 'Pending', 'In Progress', 'Quoted', 'Cancelled'] as const;
const CURRENCY_OPTIONS    = ['USD', 'KHR'] as const;

const ITEM_STATUS_STYLES: Record<string, string> = {
  'Pending':       'text-amber-500',
  'In Stock':      'text-emerald-500',
  'Available':     'text-blue-500',
  'Lead Time':     'text-violet-500',
  'Not Available': 'text-rose-500',
};

const emptyItem = (): InquiryItem => ({
  line_number: 1,
  brand: '',
  model_name: '',
  specification: '',
  qty: 1,
  target_price: null,
  currency: 'USD',
  stock_type: 'In-Stock',
  item_status: 'Pending',
  actual_price: null,
  lead_time_days: null,
  vendor_name: '',
  item_notes: '',
});

interface InquiryCreatorProps {
  onBack: () => void;
  existingInquiry?: ProductInquiry | null;
  initialReadOnly?: boolean;
}

const InquiryCreator: React.FC<InquiryCreatorProps> = ({ onBack, existingInquiry, initialReadOnly = false }) => {
  const { fetchModule, setProductInquiries, companies, contacts } = useData();
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const { can } = usePermissions();

  const isAdmin = currentUser?.Role === 'Admin' || currentUser?.Role === 'Manager';
  const readOnly = initialReadOnly;

  const [formData, setFormData] = useState<Omit<ProductInquiry, 'items'>>({
    inquiry_no: '',
    inquiry_date: new Date().toISOString().split('T')[0],
    company_name: '',
    contact_name: '',
    responsible_by: currentUser?.Name ?? '',
    priority: 'Normal',
    status: 'Draft',
    remarks: '',
    procurement_notes: '',
    created_by: currentUser?.Name ?? '',
  });

  const [items, setItems] = useState<InquiryItem[]>([emptyItem()]);
  const [isSaving, setIsSaving] = useState(false);

  const companyOptions = useMemo(
    () => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() as string[] : [],
    [companies]
  );

  const contactOptions = useMemo(() => {
    if (!contacts) return [];
    const filtered = formData.company_name
      ? contacts.filter(c => c['Company Name'] === formData.company_name)
      : contacts;
    return [...new Set(filtered.map(c => c.Name).filter(Boolean))].sort() as string[];
  }, [contacts, formData.company_name]);

  useEffect(() => {
    fetchModule('Company List', 'Contact_List');
  }, [fetchModule]);

  useEffect(() => {
    if (existingInquiry) {
      const { items: existingItems, ...header } = existingInquiry;
      setFormData({
        ...header,
        inquiry_date: formatToInputDate(header.inquiry_date),
      });
      loadItems(existingInquiry.id!);
    } else {
      generateInquiryNo().then(no => setFormData(prev => ({ ...prev, inquiry_no: no })));
    }
  }, [existingInquiry]);

  const loadItems = async (inquiryId: string) => {
    const { data } = await import('../../../lib/supabase').then(m =>
      m.supabase.from('inquiry_items').select('*').eq('inquiry_id', inquiryId).order('line_number', { ascending: true })
    );
    if (data && data.length > 0) setItems(data);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: keyof InquiryItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    setItems(prev => [...prev, { ...emptyItem(), line_number: prev.length + 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, line_number: i + 1 })));
    }
  };

  const handleSave = async (overrideStatus?: ProductInquiry['status']) => {
    if (!formData.inquiry_date || !formData.company_name || !formData.responsible_by) {
      addToast('Please fill in Date, Company Name, and Responsible By.', 'error');
      return;
    }
    if (!items.some(i => i.model_name.trim())) {
      addToast('At least one item with a model name is required.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        status: overrideStatus ?? formData.status,
        created_by: formData.created_by || currentUser?.Name || '',
      };

      const saved = await saveProductInquiry(payload, items);

      const updated: ProductInquiry = { ...(payload as ProductInquiry), id: saved.id, inquiry_no: saved.inquiry_no };
      setProductInquiries(prev => {
        if (!prev) return [updated];
        const exists = prev.some(i => i.id === saved.id);
        if (exists) return prev.map(i => i.id === saved.id ? updated : i);
        return [updated, ...prev];
      });

      await fetchModule('Product Inquiries');
      addToast('Inquiry saved successfully!', 'success');
      onBack();
    } catch (err: any) {
      addToast(`Error saving inquiry: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmit = formData.status === 'Draft' || formData.status === 'Pending';

  const headerLeft = (
    <h2 className="text-xl font-bold flex items-center gap-2 truncate">
      <Search size={18} className="text-brand-500 shrink-0" />
      {existingInquiry ? `${existingInquiry.inquiry_no}` : 'New Product Inquiry'}
    </h2>
  );

  const headerRight = readOnly ? (
    <button onClick={onBack} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition">
      Close
    </button>
  ) : (
    <div className="flex items-center gap-2 min-w-max">
      <button
        onClick={() => handleSave('Draft')}
        disabled={isSaving}
        className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground transition disabled:opacity-50 flex items-center gap-2"
      >
        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Save as Draft
      </button>
      {canSubmit && (
        <button
          onClick={() => handleSave('Pending')}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-md"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
          Submit to Procurement
        </button>
      )}
      {isAdmin && (formData.status === 'Pending' || formData.status === 'In Progress') && (
        <button
          onClick={() => handleSave('Quoted')}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-md"
        >
          Mark as Quoted
        </button>
      )}
    </div>
  );

  return (
    <DocumentEditorContainer
      title=""
      onBack={onBack}
      onSave={() => handleSave()}
      isSubmitting={isSaving}
      saveButtonText="Save"
      leftActions={headerLeft}
      rightActions={headerRight}
    >
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">

        {/* Header fields */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left column */}
          <FormSection title="Inquiry Details">
            <FormInput
              name="inquiry_no"
              label="Inquiry No"
              value={formData.inquiry_no}
              onChange={handleInputChange}
              readOnly
            />
            <FormInput
              name="inquiry_date"
              label="Date"
              type="date"
              value={formData.inquiry_date}
              onChange={handleInputChange}
              readOnly={readOnly}
              required
            />
            <SearchableSelect
              name="company_name"
              label="Company Name"
              value={formData.company_name}
              onChange={val => setFormData(prev => ({ ...prev, company_name: val, contact_name: '' }))}
              options={companyOptions}
              required
              disabled={readOnly}
              placeholder="Search or type company..."
              allowCustomValue
            />
            <SearchableSelect
              name="contact_name"
              label="Contact Name"
              value={formData.contact_name}
              onChange={val => setFormData(prev => ({ ...prev, contact_name: val }))}
              options={contactOptions}
              disabled={readOnly}
              placeholder={formData.company_name ? 'Search or type contact...' : 'Select company first'}
              allowCustomValue
            />
            <FormInput
              name="responsible_by"
              label="Responsible By (Sales)"
              value={formData.responsible_by}
              onChange={handleInputChange}
              readOnly={readOnly}
              required
            />
            <FormSelect
              name="priority"
              label="Priority"
              value={formData.priority}
              onChange={handleInputChange}
              options={[...PRIORITY_OPTIONS]}
              disabled={readOnly}
            />
            <FormSelect
              name="status"
              label="Status"
              value={formData.status}
              onChange={handleInputChange}
              options={[...STATUS_OPTIONS]}
              disabled={readOnly || !can('product_inquiries', 'edit')}
            />
          </FormSection>

          {/* Right column */}
          <FormSection title="Notes">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">Remarks</label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={readOnly ? undefined : handleInputChange}
                rows={4}
                readOnly={readOnly}
                className={`block w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150 resize-y ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">Procurement Response / Notes</label>
              <textarea
                name="procurement_notes"
                value={formData.procurement_notes}
                onChange={(readOnly && !isAdmin) ? undefined : handleInputChange}
                rows={4}
                readOnly={readOnly && !isAdmin}
                className={`block w-full px-3.5 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 sm:text-sm transition-colors duration-150 resize-y ${(readOnly && !isAdmin) ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
          </FormSection>
        </div>

        {/* Line items */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-muted/30 px-4 py-3 border-b border-border flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2">
              <Search size={15} className="text-brand-500" />
              Requested Items
            </h3>
            {!readOnly && (
              <button onClick={addItem} className="text-sm font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1 transition">
                <Plus size={15} /> Add Item
              </button>
            )}
          </div>

          <div className="p-4 space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border border-border rounded-xl overflow-hidden bg-background shadow-sm">

                {/* Card header: line#, brand, model, qty, delete */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border">
                  <span className="text-xs font-bold w-5 h-5 rounded-full bg-brand-500/15 text-brand-600 flex items-center justify-center flex-shrink-0">
                    {item.line_number}
                  </span>
                  <input
                    className="w-28 bg-transparent text-sm font-semibold placeholder:text-muted-foreground/40 focus:outline-none border-b border-transparent focus:border-brand-500 py-0.5 transition disabled:opacity-60"
                    value={item.brand}
                    onChange={e => handleItemChange(index, 'brand', e.target.value)}
                    placeholder="Brand"
                    disabled={readOnly}
                  />
                  <span className="text-border">·</span>
                  <input
                    className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/40 focus:outline-none border-b border-transparent focus:border-brand-500 py-0.5 transition disabled:opacity-60"
                    value={item.model_name}
                    onChange={e => handleItemChange(index, 'model_name', e.target.value)}
                    placeholder="Model / Description"
                    disabled={readOnly}
                  />
                  <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                    <label className="text-xs text-muted-foreground font-medium">Qty</label>
                    <input
                      type="number"
                      min={1}
                      className="w-16 text-sm text-center bg-muted/50 border border-border rounded-lg px-2 py-0.5 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 disabled:opacity-60"
                      value={item.qty}
                      onChange={e => handleItemChange(index, 'qty', parseInt(e.target.value) || 1)}
                      disabled={readOnly}
                    />
                  </div>
                  {!readOnly && (
                    <button onClick={() => removeItem(index)} className="text-muted-foreground hover:text-rose-500 transition ml-1 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4 space-y-4">

                  {/* Specification — full width */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Specification</label>
                    <textarea
                      rows={2}
                      className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 resize-none placeholder:text-muted-foreground/40 transition disabled:opacity-60"
                      value={item.specification}
                      onChange={e => handleItemChange(index, 'specification', e.target.value)}
                      placeholder="Enter full specification details..."
                      disabled={readOnly}
                    />
                  </div>

                  {/* All pricing + procurement in one compact section */}
                  <div className="pt-3 border-t border-border/40 space-y-3">

                    {/* Row 1: Target Price | Currency || Stock Type | Item Status | Actual Price | Lead Days */}
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="w-36">
                        <label className="text-xs text-muted-foreground mb-1 block">Target Price</label>
                        <input
                          type="number" step="0.01"
                          className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition disabled:opacity-60"
                          value={item.target_price ?? ''}
                          onChange={e => handleItemChange(index, 'target_price', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="—"
                          disabled={readOnly}
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
                        <select
                          className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 transition disabled:opacity-60"
                          value={item.currency}
                          onChange={e => handleItemChange(index, 'currency', e.target.value)}
                          disabled={readOnly}
                        >
                          {CURRENCY_OPTIONS.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>

                      <div className="w-px self-stretch bg-border/60 mx-1" />

                      <div className="w-32">
                        <label className="text-xs text-amber-600/80 font-semibold mb-1 block">Stock Type</label>
                        <select
                          className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 transition disabled:opacity-60"
                          value={item.stock_type}
                          onChange={e => handleItemChange(index, 'stock_type', e.target.value)}
                          disabled={readOnly}
                        >
                          {STOCK_TYPE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="w-36">
                        <label className="text-xs text-amber-600/80 font-semibold mb-1 block">Item Status</label>
                        <select
                          className={`w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-brand-500 transition disabled:opacity-60 ${ITEM_STATUS_STYLES[item.item_status] ?? ''}`}
                          value={item.item_status}
                          onChange={e => handleItemChange(index, 'item_status', e.target.value)}
                          disabled={readOnly && !isAdmin}
                        >
                          {ITEM_STATUS_OPTIONS.map(s => <option key={s} className="text-foreground font-normal">{s}</option>)}
                        </select>
                      </div>
                      <div className="w-36">
                        <label className="text-xs text-amber-600/80 font-semibold mb-1 block">Actual Price</label>
                        <input
                          type="number" step="0.01"
                          className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition disabled:opacity-60"
                          value={item.actual_price ?? ''}
                          onChange={e => handleItemChange(index, 'actual_price', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="—"
                          disabled={readOnly && !isAdmin}
                        />
                      </div>
                      {(item.stock_type === 'Lead Time' || item.item_status === 'Lead Time') && (
                        <div className="w-28">
                          <label className="text-xs text-amber-600/80 font-semibold mb-1 block">Lead Days</label>
                          <input
                            type="number" min={0}
                            className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition disabled:opacity-60"
                            value={item.lead_time_days ?? ''}
                            onChange={e => handleItemChange(index, 'lead_time_days', e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="days"
                            disabled={readOnly && !isAdmin}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-[140px]">
                        <label className="text-xs text-amber-600/80 font-semibold mb-1 block">Vendor</label>
                        <input
                          className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition disabled:opacity-60"
                          value={item.vendor_name}
                          onChange={e => handleItemChange(index, 'vendor_name', e.target.value)}
                          placeholder="Vendor name"
                          disabled={readOnly && !isAdmin}
                        />
                      </div>
                    </div>

                    {/* Row 2: Notes full width */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                      <input
                        className="w-full bg-muted/30 border border-border/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition disabled:opacity-60"
                        value={item.item_notes}
                        onChange={e => handleItemChange(index, 'item_notes', e.target.value)}
                        placeholder="Notes"
                        disabled={readOnly}
                      />
                    </div>

                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pb-20" />
      </div>
    </DocumentEditorContainer>
  );
};

export default InquiryCreator;
