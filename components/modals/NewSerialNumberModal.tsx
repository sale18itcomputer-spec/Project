'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SerialNumber } from '../../types';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { FormSection, FormInput, FormTextarea } from '../common/FormControls';
import { Check, Pencil, Trash2 } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import ResizableModal from './ResizableModal';
import SearchableSelect from '../common/SearchableSelect';

const STATUS_OPTIONS = ['Active', 'In Service', 'Returned', 'Written Off', 'Retired'] as const;

interface NewSerialNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingSN?: SerialNumber | null;
  initialReadOnly?: boolean;
}

const NewSerialNumberModal: React.FC<NewSerialNumberModalProps> = ({ isOpen, onClose, existingSN, initialReadOnly = false }) => {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const { setSerialNumbers, companies, contacts, fetchModule } = useData();

  const [formData, setFormData] = useState<Partial<SerialNumber>>({});
  const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isEditMode = !!existingSN;

  const companyOptions = companies
    ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() as string[]
    : [];
  const contactOptions = formData.company_name && contacts
    ? [...new Set(contacts.filter(c => c['Company Name'] === formData.company_name).map(c => c.Name).filter(Boolean))].sort() as string[]
    : contacts ? [...new Set(contacts.map(c => c.Name).filter(Boolean))].sort() as string[] : [];

  useEffect(() => { if (isOpen) fetchModule('Company List', 'Contact_List'); }, [isOpen, fetchModule]);

  useEffect(() => {
    if (isOpen) {
      setIsReadOnly(initialReadOnly);
      if (isEditMode && existingSN) {
        setFormData(existingSN);
      } else {
        setFormData({
          status: 'Active',
          warranty_period_months: 12,
          created_by: currentUser?.Name || '',
        });
      }
    }
  }, [isOpen, existingSN, isEditMode, initialReadOnly, currentUser]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serial_number) { addToast('Serial number is required.', 'error'); return; }
    setIsSaving(true);
    try {
      if (isEditMode && existingSN?.id) {
        const { id: _id, created_at: _ca, ...rest } = formData as any;
        const { data, error } = await supabase.from('serial_numbers').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', existingSN.id).select().single();
        if (error) throw new Error(error.message);
        setSerialNumbers(prev => prev ? prev.map(s => s.id === existingSN.id ? data : s) : prev);
        addToast('Serial number updated!', 'success');
      } else {
        const { data, error } = await supabase.from('serial_numbers').insert([{ ...formData, created_by: currentUser?.Name || '' }]).select().single();
        if (error) throw new Error(error.message);
        setSerialNumbers(prev => prev ? [data, ...prev] : [data]);
        addToast('Serial number added!', 'success');
      }
      onClose();
    } catch (err: any) {
      addToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingSN?.id) return;
    setDeleteConfirmOpen(false);
    try {
      await supabase.from('serial_numbers').delete().eq('id', existingSN.id);
      setSerialNumbers(prev => prev ? prev.filter(s => s.id !== existingSN.id) : prev);
      addToast('Serial number deleted!', 'success');
      onClose();
    } catch (err: any) {
      addToast(`Failed to delete: ${err.message}`, 'error');
    }
  };

  const title = isEditMode
    ? (isReadOnly ? `Serial: ${existingSN.serial_number}` : `Editing: ${existingSN.serial_number}`)
    : 'Add Serial Number';

  const footer = (
    <div className="flex justify-between items-center w-full">
      {isReadOnly ? (
        <>
          <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex items-center gap-2 text-rose-500 hover:bg-rose-500/10 py-2 px-4 rounded-lg transition-colors">
            <Trash2 size={16} /> Delete
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="py-2 px-4 border rounded-lg text-sm">Close</button>
            <button type="button" onClick={() => setIsReadOnly(false)} className="bg-brand-600 text-white py-2 px-4 rounded-lg flex items-center gap-2 text-sm">
              <Pencil size={16} /> Edit
            </button>
          </div>
        </>
      ) : (
        <div className="flex justify-end gap-3 w-full">
          <button type="button" onClick={onClose} className="py-2 px-4 border rounded-lg text-sm">Cancel</button>
          <button type="submit" form="serial-number-form" disabled={isSaving} className="bg-brand-600 text-white py-2 px-4 rounded-lg flex items-center gap-2 text-sm disabled:opacity-60">
            <Check size={16} /> {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <ResizableModal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
        <form id="serial-number-form" onSubmit={handleSubmit} className="space-y-6">
          <FormSection title="Serial Number Details">
            <FormInput name="serial_number" label="Serial Number" value={formData.serial_number} onChange={handleChange} required readOnly={isReadOnly} />
            <div className="grid grid-cols-2 gap-4">
              <FormInput name="brand" label="Brand" value={formData.brand} onChange={handleChange} readOnly={isReadOnly} />
              <FormInput name="model_name" label="Model" value={formData.model_name} onChange={handleChange} readOnly={isReadOnly} />
            </div>
            <FormTextarea name="description" label="Description" value={formData.description} onChange={handleChange} readOnly={isReadOnly} />
          </FormSection>

          <FormSection title="Customer & Sale">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-muted-foreground/60">Company Name</label>
              {isReadOnly
                ? <span className="text-sm py-1">{formData.company_name || '—'}</span>
                : <SearchableSelect value={formData.company_name ?? ''} onChange={v => setFormData(p => ({ ...p, company_name: v }))} options={companyOptions} placeholder="Select company..." allowCustomValue />
              }
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-muted-foreground/60">Contact Name</label>
              {isReadOnly
                ? <span className="text-sm py-1">{formData.contact_name || '—'}</span>
                : <SearchableSelect value={formData.contact_name ?? ''} onChange={v => setFormData(p => ({ ...p, contact_name: v }))} options={contactOptions} placeholder="Select contact..." allowCustomValue />
              }
            </div>
            <FormInput name="so_no" label="SO No" value={formData.so_no} onChange={handleChange} readOnly={isReadOnly} />
          </FormSection>

          <FormSection title="Warranty">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <FormInput name="warranty_start_date" label="Start Date" type="date" value={formData.warranty_start_date ?? ''} onChange={handleChange} readOnly={isReadOnly} />
              <FormInput name="warranty_end_date" label="End Date" type="date" value={formData.warranty_end_date ?? ''} onChange={handleChange} readOnly={isReadOnly} />
              <FormInput name="warranty_period_months" label="Period (months)" type="number" value={formData.warranty_period_months ?? 12} onChange={handleChange} readOnly={isReadOnly} />
            </div>
          </FormSection>

          <FormSection title="Status & Notes">
            {isReadOnly ? (
              <span className="text-sm py-1">{formData.status}</span>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground/60">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="bg-muted border border-border rounded-lg p-2.5 text-sm">
                  {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            )}
            <FormTextarea name="notes" label="Notes" value={formData.notes} onChange={handleChange} readOnly={isReadOnly} />
          </FormSection>
        </form>
      </ResizableModal>
      <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDelete} title="Delete Serial Number" variant="danger">
        Are you sure you want to delete serial number "{existingSN?.serial_number}"?
      </ConfirmationModal>
    </>
  );
};

export default NewSerialNumberModal;
