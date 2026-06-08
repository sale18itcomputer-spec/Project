'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PdiRecord, PdiItem } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { generatePdiNo, savePdiRecord } from '../../../services/api';
import { formatToInputDate } from '../../../utils/time';
import { Plus, Trash2 } from 'lucide-react';
import { FormSection, FormInput, FormSelect, FormTextarea } from '../../common/FormControls';
import SearchableSelect from '../../common/SearchableSelect';
import DocumentEditorContainer from '../../layout/DocumentEditorContainer';

const STATUS_OPTIONS    = ['Pending', 'In Progress', 'Completed', 'Failed'] as const;
const CONDITION_OPTIONS = ['New', 'Good', 'Fair', 'Poor', 'Damaged'] as const;
const TEST_OPTIONS      = ['Pass', 'Fail', 'N/A'] as const;

const emptyItem = (): PdiItem => ({
  line_number: 1,
  serial_number: '',
  brand: '',
  model_name: '',
  physical_condition: 'Pass',
  power_test: 'Pass',
  software_test: 'Pass',
  accessories_check: 'Pass',
  seal_applied: false,
  item_notes: '',
});

interface PdiCreatorProps {
  onBack: () => void;
  existingRecord?: PdiRecord | null;
  initialReadOnly?: boolean;
}

const PdiCreator: React.FC<PdiCreatorProps> = ({ onBack, existingRecord, initialReadOnly = false }) => {
  const { fetchModule, setPdiRecords, companies, contacts } = useData();
  const { currentUser } = useAuth();
  const { addToast } = useToast();

  const [formData, setFormData] = useState<Omit<PdiRecord, 'items'>>({
    pdi_no: '',
    pdi_date: new Date().toISOString().split('T')[0],
    status: 'Pending',
    so_no: '',
    company_name: '',
    contact_name: '',
    assigned_engineer: '',
    inspection_notes: '',
    software_installed: '',
    warranty_seal_applied: false,
    warranty_seal_number: '',
    seal_photo_url: '',
    overall_condition: 'New',
    created_by: currentUser?.Name ?? '',
  });
  const [items, setItems] = useState<PdiItem[]>([emptyItem()]);
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

  useEffect(() => { fetchModule('Company List', 'Contact_List'); }, [fetchModule]);

  useEffect(() => {
    if (existingRecord) {
      const { items: _items, ...header } = existingRecord as any;
      setFormData({ ...header, pdi_date: formatToInputDate(header.pdi_date) });
      loadItems(existingRecord.id!);
    } else {
      generatePdiNo().then(no => setFormData(prev => ({ ...prev, pdi_no: no })));
    }
  }, [existingRecord]);

  const loadItems = async (pdiId: string) => {
    const { data } = await import('../../../lib/supabase').then(m =>
      m.supabase.from('pdi_items').select('*').eq('pdi_id', pdiId).order('line_number', { ascending: true })
    );
    if (data && data.length > 0) setItems(data);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleItemChange = (index: number, field: keyof PdiItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems(prev => [...prev, { ...emptyItem(), line_number: prev.length + 1 }]);
  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, line_number: i + 1 })));
    }
  };

  const handleSave = async () => {
    if (!formData.pdi_date || !formData.company_name) {
      addToast('Please fill in Date and Company Name.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const result = await savePdiRecord(formData as PdiRecord, items);
      if (existingRecord?.id) {
        setPdiRecords(prev => prev
          ? prev.map(r => r.id === existingRecord.id ? { ...r, ...formData } : r)
          : prev
        );
        addToast('PDI record updated.', 'success');
      } else {
        const newRecord: PdiRecord = { ...formData, id: result.id, pdi_no: result.pdi_no } as PdiRecord;
        setPdiRecords(prev => prev ? [newRecord, ...prev] : [newRecord]);
        addToast('PDI record created.', 'success');
      }
      onBack();
    } catch (err: any) {
      addToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const title = existingRecord ? `PDI: ${existingRecord.pdi_no}` : 'New PDI Record';

  return (
    <DocumentEditorContainer
      title={title}
      subtitle={formData.company_name || undefined}
      onBack={onBack}
      onSave={handleSave}
      isSubmitting={isSaving}
      saveButtonText="Save PDI"
    >
      <div className="space-y-6">
        <FormSection title="PDI Information">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormInput name="pdi_no" label="PDI No" value={formData.pdi_no} onChange={handleChange} readOnly />
            <FormInput name="pdi_date" label="Date" type="date" value={formData.pdi_date} onChange={handleChange} required />
            <FormInput name="so_no" label="SO No" value={formData.so_no} onChange={handleChange} />
            <FormSelect name="status" label="Status" value={formData.status} onChange={handleChange} options={STATUS_OPTIONS as any} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect name="overall_condition" label="Overall Condition" value={formData.overall_condition} onChange={handleChange} options={CONDITION_OPTIONS as any} />
            <FormInput name="assigned_engineer" label="Assigned Engineer" value={formData.assigned_engineer} onChange={handleChange} />
          </div>
        </FormSection>

        <FormSection title="Customer">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-muted-foreground/60">Company Name</label>
              <SearchableSelect
                value={formData.company_name ?? ''}
                onChange={v => setFormData(prev => ({ ...prev, company_name: v, contact_name: prev.company_name !== v ? '' : prev.contact_name }))}
                options={companyOptions}
                placeholder="Search or type company..."
                allowCustomValue
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-muted-foreground/60">Contact Name</label>
              <SearchableSelect
                value={formData.contact_name ?? ''}
                onChange={v => setFormData(prev => ({ ...prev, contact_name: v }))}
                options={contactOptions}
                placeholder="Search or type contact..."
                allowCustomValue
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Inspection Details">
          <FormTextarea name="inspection_notes" label="Inspection Notes" value={formData.inspection_notes} onChange={handleChange} rows={2} />
          <FormTextarea name="software_installed" label="Software Installed" value={formData.software_installed} onChange={handleChange} rows={2} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="warranty_seal_applied" name="warranty_seal_applied" checked={!!formData.warranty_seal_applied} onChange={handleChange} className="w-4 h-4 rounded border-border" />
              <label htmlFor="warranty_seal_applied" className="text-sm font-medium">Warranty Seal Applied</label>
            </div>
            <FormInput name="warranty_seal_number" label="Seal Number" value={formData.warranty_seal_number} onChange={handleChange} />
            <FormInput name="seal_photo_url" label="Seal Photo URL" value={formData.seal_photo_url} onChange={handleChange} />
          </div>
        </FormSection>

        <FormSection title="Inspection Items">
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="bg-muted/40 rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded">#{index + 1}</span>
                  <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1}
                    className="p-1.5 text-muted-foreground hover:text-rose-500 disabled:opacity-30 transition rounded-full hover:bg-rose-500/10">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormInput label="Serial Number" value={item.serial_number} onChange={e => handleItemChange(index, 'serial_number', e.target.value)} name={`sn-${index}`} />
                  <FormInput label="Brand" value={item.brand} onChange={e => handleItemChange(index, 'brand', e.target.value)} name={`brand-${index}`} />
                  <FormInput label="Model" value={item.model_name} onChange={e => handleItemChange(index, 'model_name', e.target.value)} name={`model-${index}`} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground/60">Physical</label>
                    <select value={item.physical_condition} onChange={e => handleItemChange(index, 'physical_condition', e.target.value)} className="bg-muted border border-border rounded-lg p-2 text-sm">
                      {TEST_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground/60">Power</label>
                    <select value={item.power_test} onChange={e => handleItemChange(index, 'power_test', e.target.value)} className="bg-muted border border-border rounded-lg p-2 text-sm">
                      {TEST_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground/60">Software</label>
                    <select value={item.software_test} onChange={e => handleItemChange(index, 'software_test', e.target.value)} className="bg-muted border border-border rounded-lg p-2 text-sm">
                      {TEST_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground/60">Accessories</label>
                    <select value={item.accessories_check} onChange={e => handleItemChange(index, 'accessories_check', e.target.value)} className="bg-muted border border-border rounded-lg p-2 text-sm">
                      {TEST_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id={`seal-${index}`} checked={!!item.seal_applied} onChange={e => handleItemChange(index, 'seal_applied', e.target.checked)} className="w-4 h-4 rounded border-border" />
                    <label htmlFor={`seal-${index}`} className="text-sm">Seal</label>
                  </div>
                </div>
                <FormInput label="Item Notes" value={item.item_notes} onChange={e => handleItemChange(index, 'item_notes', e.target.value)} name={`notes-${index}`} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-3 flex items-center gap-2 text-sm text-brand-500 hover:text-brand-400 font-semibold transition"
          >
            <Plus size={16} /> Add Item
          </button>
        </FormSection>
      </div>
    </DocumentEditorContainer>
  );
};

export default PdiCreator;
