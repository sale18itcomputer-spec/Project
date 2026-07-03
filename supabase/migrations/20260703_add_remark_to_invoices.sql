-- Migration: Add "Remark" column to invoices and b2b_invoices
-- Required for service invoices created from service tickets.
-- The InvoiceCreator sets Remark = 'Service Ticket: <ticket_no>' when
-- creating an invoice from a ticket, and ServiceInvoiceDashboard
-- filters on this prefix to separate service invoices from sales invoices.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS "Remark" text;

ALTER TABLE public.b2b_invoices
  ADD COLUMN IF NOT EXISTS "Remark" text;
