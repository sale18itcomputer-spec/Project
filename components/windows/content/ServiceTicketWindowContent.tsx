'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ServiceTicket } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { generateTicketNo, updateRecord } from '@/services/api';
import { formatToInputDate } from '@/utils/time';
import { supabase } from '@/lib/supabase';
import { FormSection, FormInput, FormSelect, FormTextarea } from '@/components/common/FormControls';
import SearchableSelect from '@/components/common/SearchableSelect';
import { Check, Loader2, Pencil, FileText } from 'lucide-react';
import InvoiceWindowContent from '@/components/windows/content/InvoiceWindowContent';

const TICKET_TYPE_OPTIONS  = ['Warranty Claim', 'Out-of-Warranty Repair', 'Preventive Maintenance', 'Software Issue', 'Hardware Issue', 'Return (RMA)', 'Other'] as const;
const PRIORITY_OPTIONS     = ['Low', 'Normal', 'High', 'Critical'] as const;
const STATUS_OPTIONS       = ['Open', 'In Progress', 'Pending Parts', 'Resolved', 'Closed', 'Cancelled'] as const;
const WARRANTY_OPTIONS     = ['Under Warranty', 'Out of Warranty', 'Unknown'] as const;
const CURRENCY_OPTIONS     = ['USD', 'KHR'] as const;

interface ServiceTicketWindowContentProps {
    windowId: string;
    ticketId: string | null;
    initialReadOnly?: boolean;
}

const ServiceTicketWindowContent: React.FC<ServiceTicketWindowContentProps> = ({
    windowId,
    ticketId,
    initialReadOnly = false,
}) => {
    const { fetchModule, serviceTickets, setServiceTickets, companies, contacts, serialNumbers } = useData();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { closeWindow, updateWindow, openWindow } = useWindowManager();

    const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
    const [isSaving, setIsSaving] = useState(false);

    const isEditMode = !!ticketId;
    const existingTicket = useMemo(() => ticketId ? serviceTickets?.find(t => t.id === ticketId) ?? null : null, [serviceTickets, ticketId]);

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

    const soldSerials = useMemo(
        () => serialNumbers?.filter(s => s.stock_status === 'Sold') ?? [],
        [serialNumbers]
    );
    const serialOptions = useMemo(
        () => [...new Set(soldSerials.map(s => s.serial_number).filter(Boolean))].sort(),
        [soldSerials]
    );

    useEffect(() => {
        fetchModule('Company List', 'Contact_List', 'Serial Numbers');
    }, [fetchModule]);

    useEffect(() => {
        if (isEditMode && existingTicket) {
            setFormData({
                ...existingTicket,
                ticket_date: formatToInputDate(existingTicket.ticket_date),
                received_date: formatToInputDate(existingTicket.received_date ?? undefined),
                estimated_completion_date: formatToInputDate(existingTicket.estimated_completion_date ?? undefined),
                actual_completion_date: formatToInputDate(existingTicket.actual_completion_date ?? undefined),
            });
        } else if (!isEditMode) {
            generateTicketNo().then(no => setFormData(prev => ({ ...prev, ticket_no: no })));
        }
    }, [existingTicket, isEditMode]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleCancelClick = useCallback(() => {
        if (isEditMode && existingTicket) {
            setFormData({
                ...existingTicket,
                ticket_date: formatToInputDate(existingTicket.ticket_date),
                received_date: formatToInputDate(existingTicket.received_date ?? undefined),
                estimated_completion_date: formatToInputDate(existingTicket.estimated_completion_date ?? undefined),
                actual_completion_date: formatToInputDate(existingTicket.actual_completion_date ?? undefined),
            });
            setIsReadOnly(true);
        } else {
            closeWindow(windowId);
        }
    }, [isEditMode, existingTicket, windowId, closeWindow]);

    const computeWarrantyStatus = useCallback((end?: string | null): ServiceTicket['warranty_status'] => {
        if (!end) return 'Unknown';
        return new Date(end) >= new Date() ? 'Under Warranty' : 'Out of Warranty';
    }, []);

    const handleSerialSelect = useCallback((sn: string) => {
        const match = soldSerials.find(s => s.serial_number === sn);
        if (!match) {
            setFormData(prev => ({ ...prev, serial_number: sn }));
            return;
        }
        const contactPhone = contacts?.find(
            c => c.Name === match.contact_name && c['Company Name'] === match.company_name
        )?.['Tel (1)'] ?? '';
        setFormData(prev => ({
            ...prev,
            serial_number: sn,
            brand: match.brand,
            model_name: match.model_name,
            company_name: match.company_name || prev.company_name,
            contact_name: match.contact_name || prev.contact_name,
            contact_phone: contactPhone || prev.contact_phone,
            warranty_status: computeWarrantyStatus(match.warranty_end_date),
        }));
    }, [soldSerials, contacts, computeWarrantyStatus]);

    const handleSave = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
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
                    ? prev.map(t => t.id === existingTicket.id ? { ...t, ...formData } as ServiceTicket : t)
                    : prev
                );
                addToast('Ticket updated.', 'success');
            } else {
                const payload = { ...formData, created_by: currentUser?.Name ?? '' };
                const { data, error } = await supabase.from('service_tickets').insert([payload]).select().single();
                if (error) throw new Error(error.message);
                setServiceTickets(prev => prev ? [data, ...prev] : [data]);
                addToast('Ticket created.', 'success');
            }
            closeWindow(windowId);
        } catch (err: any) {
            addToast(`Failed to save: ${err.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }, [formData, existingTicket, setServiceTickets, addToast, closeWindow, windowId, currentUser]);

    const handleCreateInvoice = useCallback(() => {
        const invWindowId = `invoice-new-from-ticket-${windowId}`;
        openWindow({
            id: invWindowId,
            title: `New Invoice — ${formData.ticket_no}`,
            content: (
                <InvoiceWindowContent
                    windowId={invWindowId}
                    invNo={null}
                    initialData={{ action: 'create', ticketData: formData as ServiceTicket }}
                />
            ),
            noPadding: true,
            initialWidth: 1200,
            initialHeight: 820,
            minWidth: 900,
            minHeight: 600,
        });
    }, [windowId, formData, openWindow]);

    // Dynamic title & footer
    useEffect(() => {
        const title = isEditMode
            ? (isReadOnly ? `Ticket: ${formData.ticket_no}` : `Editing Ticket: ${formData.ticket_no}`)
            : 'New Service Ticket';

        const footer = isReadOnly ? (
            <div className="flex justify-between items-center w-full">
                <button type="button" onClick={() => closeWindow(windowId)} className="font-semibold py-2 px-4 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-sm">Close</button>
                <div className="flex items-center gap-2">
                    {isEditMode && (
                        <button type="button" onClick={handleCreateInvoice} className="flex items-center gap-1.5 text-sm font-semibold py-2 px-4 rounded-lg border border-brand-500/40 text-brand-500 hover:bg-brand-500/10 transition">
                            <FileText size={15} /> Create Invoice
                        </button>
                    )}
                    <button type="button" onClick={() => setIsReadOnly(false)} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-sm">
                        <Pencil size={16} /> Edit
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex justify-end gap-3 w-full">
                <button type="button" onClick={handleCancelClick} className="bg-card hover:bg-muted text-foreground font-semibold py-2 px-4 rounded-md border border-border transition text-sm">Cancel</button>
                <button type="submit" form={`service-ticket-window-form-${windowId}`} disabled={isSaving} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md flex items-center text-sm disabled:opacity-50">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                    {isEditMode ? 'Save Changes' : 'Save Ticket'}
                </button>
            </div>
        );
        updateWindow(windowId, { title, footer });
    }, [windowId, isEditMode, isReadOnly, isSaving, formData.ticket_no, updateWindow, closeWindow, handleCancelClick, handleCreateInvoice]);

    return (
        <form id={`service-ticket-window-form-${windowId}`} onSubmit={handleSave} className="space-y-6 max-h-full overflow-y-auto p-1 pr-2 custom-scrollbar">
            <FormSection title="Ticket Information">
                <div className="grid grid-cols-2 @md:grid-cols-4 gap-4">
                    <FormInput name="ticket_no" label="Ticket No" value={formData.ticket_no} onChange={handleChange} readOnly />
                    <FormInput name="ticket_date" label="Date" type="date" value={formData.ticket_date} onChange={handleChange} readOnly={isReadOnly} required />
                    <FormSelect name="ticket_type" label="Type" value={formData.ticket_type} onChange={handleChange} options={TICKET_TYPE_OPTIONS as unknown as string[]} disabled={isReadOnly} />
                    <FormSelect name="priority" label="Priority" value={formData.priority} onChange={handleChange} options={PRIORITY_OPTIONS as unknown as string[]} disabled={isReadOnly} />
                </div>
                <div className="grid grid-cols-2 @md:grid-cols-4 gap-4">
                    <FormSelect name="status" label="Status" value={formData.status} onChange={handleChange} options={STATUS_OPTIONS as unknown as string[]} disabled={isReadOnly} />
                    <FormSelect name="warranty_status" label="Warranty" value={formData.warranty_status} onChange={handleChange} options={WARRANTY_OPTIONS as unknown as string[]} disabled={isReadOnly} />
                    <FormInput name="assigned_engineer" label="Assigned Engineer" value={formData.assigned_engineer} onChange={handleChange} readOnly={isReadOnly} />
                    <FormInput name="received_date" label="Received Date" type="date" value={formData.received_date ?? ''} onChange={handleChange} readOnly={isReadOnly} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <FormInput name="estimated_completion_date" label="Est. Completion" type="date" value={formData.estimated_completion_date ?? ''} onChange={handleChange} readOnly={isReadOnly} />
                    <FormInput name="actual_completion_date" label="Actual Completion" type="date" value={formData.actual_completion_date ?? ''} onChange={handleChange} readOnly={isReadOnly} />
                </div>
            </FormSection>

            <FormSection title="Customer">
                <div className="grid grid-cols-1 @md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-muted-foreground/60">Company Name</label>
                        <SearchableSelect
                            value={formData.company_name ?? ''}
                            onChange={v => setFormData(prev => ({ ...prev, company_name: v, contact_name: prev.company_name !== v ? '' : prev.contact_name }))}
                            options={companyOptions}
                            placeholder="Search or type company..."
                            allowCustomValue
                            disabled={isReadOnly}
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
                            disabled={isReadOnly}
                        />
                    </div>
                    <FormInput name="contact_phone" label="Contact Phone" value={formData.contact_phone} onChange={handleChange} readOnly={isReadOnly} />
                </div>
            </FormSection>

            <FormSection title="Device Information">
                <div className="grid grid-cols-1 @md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-muted-foreground/60">Serial Number</label>
                        <SearchableSelect
                            value={formData.serial_number ?? ''}
                            onChange={handleSerialSelect}
                            options={serialOptions}
                            placeholder="Search sold serials or type..."
                            allowCustomValue
                            disabled={isReadOnly}
                        />
                    </div>
                    <FormInput name="brand" label="Brand" value={formData.brand} onChange={handleChange} readOnly={isReadOnly} />
                    <FormInput name="model_name" label="Model" value={formData.model_name} onChange={handleChange} readOnly={isReadOnly} />
                </div>
                <FormTextarea name="problem_description" label="Problem Description" value={formData.problem_description} onChange={handleChange} rows={3} readOnly={isReadOnly} />
            </FormSection>

            <FormSection title="Resolution">
                <div className="grid grid-cols-2 gap-4">
                    <FormInput name="repair_cost" label="Repair Cost" type="number" value={formData.repair_cost ?? ''} onChange={handleChange} readOnly={isReadOnly} />
                    <FormSelect name="currency" label="Currency" value={formData.currency} onChange={handleChange} options={CURRENCY_OPTIONS as unknown as string[]} disabled={isReadOnly} />
                </div>
                <FormTextarea name="resolution_notes" label="Resolution Notes" value={formData.resolution_notes} onChange={handleChange} rows={3} readOnly={isReadOnly} />
                <FormTextarea name="internal_notes" label="Internal Notes" value={formData.internal_notes} onChange={handleChange} rows={2} readOnly={isReadOnly} />
            </FormSection>
        </form>
    );
};

export default ServiceTicketWindowContent;
