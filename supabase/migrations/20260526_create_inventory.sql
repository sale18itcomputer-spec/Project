-- ============================================================
-- Inventory table: receives items converted from Purchase Orders
-- Flow: Purchase Order → Inventory → Sale Order → Invoice
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id         UUID        REFERENCES purchase_orders(id) ON DELETE SET NULL,
    po_number     TEXT,
    vendor_id     UUID,
    vendor_name   TEXT,
    category      TEXT        DEFAULT 'General',
    code          TEXT,          -- maps to pricelist "Code" / item_number from PO
    brand         TEXT,
    model_name    TEXT,          -- short model / item name
    description   TEXT,          -- full description
    qty           NUMERIC     DEFAULT 0,
    unit_price    NUMERIC     DEFAULT 0,
    currency      TEXT        DEFAULT 'USD',
    status        TEXT        DEFAULT 'In Stock',  -- In Stock | Reserved | Out of Stock
    created_by    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_inventory_po_id     ON inventory(po_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status    ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_code      ON inventory(code);
CREATE INDEX IF NOT EXISTS idx_inventory_vendor_id ON inventory(vendor_id);

-- Row-level security (authenticated users can manage inventory)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inventory'
      AND policyname = 'Authenticated users can manage inventory'
  ) THEN
    CREATE POLICY "Authenticated users can manage inventory"
        ON inventory
        FOR ALL
        USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory;
CREATE TRIGGER trg_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE PROCEDURE update_inventory_updated_at();
