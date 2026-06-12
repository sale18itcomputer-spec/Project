-- ============================================================
-- Extend purchase_order_items with model_name & serial_number columns
-- so PO line items capture the same Code/Model/Serial shape as
-- Inventory and the sales-document line items.
-- ============================================================

ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS model_name    TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS serial_number TEXT DEFAULT '';
