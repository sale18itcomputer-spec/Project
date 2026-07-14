-- Captures the real vendor-stated warranty at purchase time instead of it
-- being guessed/hardcoded (always "12 months") much later at sale time —
-- see services/inventoryApi.ts and InvoiceCreator.tsx/DeliveryOrderCreator.tsx
-- for how this now flows through to serial_numbers.warranty_period_months
-- without being clobbered by the old hardcoded fallback.

ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS warranty_months integer DEFAULT NULL;
ALTER TABLE inventory           ADD COLUMN IF NOT EXISTS warranty_months integer DEFAULT NULL;
