-- ============================================================
-- Extend purchase_order_items with brand & category columns
-- so rich metadata captured in the PO form flows through to Inventory
-- ============================================================

ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS brand    TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';
