-- 20260918_inventory_no_negative_price.sql
--
-- Guard against phantom "inventory" rows created from discount/promo lines.
--
-- A negative unit_price on a purchase-order line always represents a discount
-- or promo adjustment (e.g. "Sales Discount"), never a physical unit received.
-- This bit PO-2026-036: a PO-item's `is_promotion` flag got silently flipped to
-- false by a client-side bug (the item-loader re-derived is_promotion from
-- line_number instead of trusting the stored column), so on PO completion the
-- -$200 Sales Discount line converted into a real inventory row.
--
-- The application layer is now fixed (loadPOItems trusts the column; the
-- PO->Inventory conversion filters unit_price < 0 independently of
-- is_promotion), but this constraint is the backstop: no code path, present or
-- future, can ever write a negative-priced row into `inventory` again — the
-- write fails loudly instead of silently creating phantom stock.
--
-- Idempotent: safe to re-run.

ALTER TABLE inventory DROP CONSTRAINT IF EXISTS chk_inventory_unit_price_nonneg;
ALTER TABLE inventory ADD CONSTRAINT chk_inventory_unit_price_nonneg
    CHECK (unit_price >= 0);
