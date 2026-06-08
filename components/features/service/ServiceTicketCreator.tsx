'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ServiceTicket } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { generateTicketNo, updateRecord } from '../../../services/api';
import { formatToInputDate } from '../../../utils/time';
import { FormSection, FormInput, FormSelect, FormTextarea } from '../../common/FormControls';
import SearchableSelect from '../../common/SearchableSelect';
import DocumentEditorContainer from '../../layout/DocumentEditorContainer';

const TICKET_TYPE_OPTIONS  = ['Warranty Claim', 'Out-of-Warranty Repair', 'Preventive Maintenance', 'Software Issue', 'Hardware Issue', 'Return (RMA)', 'Other'] as const;
const PRIORITY_OPTIONS     = ['Low', 'Normal', 'High', 'Critical'] as const;
const STATUS_OPTIONS       = ['Open', 'In Progress', 'Pending Parts', 'Resolved', 'Closed', 'Cancelled'] as const;
const WARRANTY_OPTIONS     = ['Under Warranty', 'Out of Warranty', 'Unknown'] as const;
const CURRENCY_OPTIONS     = ['USD', 'KHR'] as const;

interface ServiceTicketCreatorProps {
  onBack: () => void;
  existingTicket?: ServiceTicket | null;
  initialReadOnly?: boolean;
}

const ServiceTicketCreator: React.FC<ServiceTicketCreatorProps> = ({ onBack, existingTicket, initialReadOnly = false }) => {
  const { fetchModule, setServiceTickets, companies, contacts } = useData();
  const { currentUser } = useAuth();
  const { addToast } = useToast();

  const [formData, setFormData] = useState<Partial<ServiceTicket>>({
    ticket_no: '',
    ticket_date: new Date().toISOString().split('T')[0],
    ticket_type: 'Other',
    priority: 'Normal',
    status: 'Open',
    company_name: '',
    contact_name: '',
    contact_phone: '',
    serial_number: '',
    brand: '',
    model_name: '',
    problem_description: '',
    assigned_engineer: '',
    warranty_status: 'Unknown',
    currency: 'USD',
    resolution_notes: '',
    internal_notes: '',
    created_by: currentUser?.Name ?? '',
  });
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
    if (existingTicket) {
      setFormData({
        ...existingTicket,
        ticket_date: formatToInputDate(existingTicket.ticket_date),
        received_date: formatToInputDate(existingTicket.received_date),
        estimated_completion_date: formatToInputDate(existingTicket.estimated_completion_date),
        actual_completion_date: formatToInputDate(existingTicket.actual_completion_date),
      });
    } else {
      generateTicketNo().then(no => setFormData(prev => ({ ...prev, ticket_no: no })));
    }
  }, [existingTicket]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.ticket_date || !formData.company_name) {
      addToast('Please fill in Date and Company Name.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      if (existingTicket?.id) {
        const { id: _id, created_at: _ca, ...rest } = formData as any;
        await updateRecord('Service Tickets', existingTicket.id, rest);
        setServiceTickets(prev => prev
          ? prev.map(t => t.id === existingTicket.id ? { ...t, ...formData } : t)
          : prev
        );
        addToast('Ticket updated.', 'success');
      } else {
        const payload = { ...formData, created_by: currentUser?.Name ?? '' };
        const { data, error } = await import('../../../lib/supabase').then(m =>
          m.supabase.from('service_tickets').insert([payload]).select().single()
        );
        if (error) throw new Error(error.message);
        setServiceTickets(prev => prev ? [data, ...prev] : [data]);
        addToast('Ticket created.', 'success');
      }
      onBack();
    } catch (err: any) {
      addToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const title = existingTicket
    ? `Ticket: ${existingTicket.ticket_no}`
    : 'New Service Ticket';

  return (
    <DocumentEditorContainer
      title={title}
      subtitle={formData.company_name || undefined}
      onBack={onBack}
      onSave={handleSave}
      isSubmitting={isSaving}
      saveButtonText="Save Ticket"
    >
      <div className="space-y-6">
        <FormSection title="Ticket Information">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormInput name="ticket_no" label="Ticket No" value={formData.ticket_no} onChange={handleChange} readOnly />
            <FormInput name="ticket_date" label="Date" type="date" value={formData.ticket_date} onChange={handleChange} required />
            <FormSelect name="ticket_type" label="Type" value={formData.ticket_type} onChange={handleChange} options={TICKET_TYPE_OPTIONS as any} />
            <FormSelect name="priority" label="Priority" value={formData.priority} onChange={handleChange} options={PRIORITY_OPTIONS as any} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormSelect name="status" label="Status" value={formData.status} onChange={handleChange} options={STATUS_OPTIONS as any} />
            <FormSelect name="warranty_status" label="Warranty" value={formData.warranty_status} onChange={handleChange} options={WARRANTY_OPTIONS as any} />
            <FormInput name="assigned_engineer" label="Assigned Engineer" value={formData.assigned_engineer} onChange={handleChange} />
            <FormInput name="received_date" label="Received Date" type="date" value={formData.received_date ?? ''} onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput name="estimated_completion_date" label="Est. Completion" type="date" value={formData.estimated_completion_date ?? ''} onChange={handleChange} />
            <FormInput name="actual_completion_date" label="Actual Completion" type="date" value={formData.actual_completion_date ?? ''} onChange={handleChange} />
          </div>
        </FormSection>

        <FormSection title="Customer">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <FormInput name="contact_phone" label="Contact Phone" value={formData.contact_phone} onChange={handleChange} />
          </div>
        </FormSection>

        <FormSection title="Device Information">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormInput name="serial_number" label="Serial Number" value={formData.serial_number} onChange={handleChange} />
            <FormInput name="brand" label="Brand" value={formData.brand} onChange={handleChange} />
            <FormInput name="model_name" label="Model" value={formData.model_name} onChange={handleChange} />
          </div>
          <FormTextarea name="problem_description" label="Problem Description" value={formData.problem_description} onChange={handleChange} rows={3} />
        </FormSection>

        <FormSection title="Resolution">
          <div className="grid grid-cols-2 gap-4">
            <FormInput name="repair_cost" label="Repair Cost" type="number" value={formData.repair_cost ?? ''} onChange={handleChange} />
            <FormSelect name="currency" label="Currency" value={formData.currency} onChange={handleChange} options={CURRENCY_OPTIONS as any} />
          </div>
          <FormTextarea name="resolution_notes" label="Resolution Notes" value={formData.resolution_notes} onChange={handleChange} rows={3} />
          <FormTextarea name="internal_notes" label="Internal Notes" value={formData.internal_notes} onChange={handleChange} rows={2} />
        </FormSection>
      </div>
    </DocumentEditorContainer>
  );
};

export default ServiceTicketCreator;
