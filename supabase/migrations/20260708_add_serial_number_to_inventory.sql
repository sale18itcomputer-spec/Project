-- Migration: Add serial_number to inventory
-- Lets each inventory stock line record its device serial number(s),
-- editable directly from the Inventory item form.

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS serial_number text;
