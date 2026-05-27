-- ============================================================================
-- B2B Inventory Table — mirror of public.inventory
-- NOTE: As of the B2B_TABLE_MAP refactor, inventory is now SHARED between
-- B2B and B2C (same as purchase_orders/vendors). This file is kept for
-- reference only. Do NOT run unless you intentionally want isolated B2B stock
-- AND have updated B2B_TABLE_MAP in api.ts and b2bDb.ts to re-enable it.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.b2b_inventory (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id         UUID        REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    po_number     TEXT,
    vendor_id     UUID,
    vendor_name   TEXT,
    category      TEXT        DEFAULT 'General',
    code          TEXT,
    brand         TEXT,
    model_name    TEXT,
    description   TEXT,
    qty           NUMERIC     DEFAULT 0,
    unit_price    NUMERIC     DEFAULT 0,
    currency      TEXT        DEFAULT 'USD',
    status        TEXT        DEFAULT 'In Stock',   -- In Stock | Reserved | Out of Stock
    created_by    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (mirrors B2C inventory)
CREATE INDEX IF NOT EXISTS idx_b2b_inventory_po_id     ON public.b2b_inventory(po_id);
CREATE INDEX IF NOT EXISTS idx_b2b_inventory_status    ON public.b2b_inventory(status);
CREATE INDEX IF NOT EXISTS idx_b2b_inventory_code      ON public.b2b_inventory(code);
CREATE INDEX IF NOT EXISTS idx_b2b_inventory_vendor_id ON public.b2b_inventory(vendor_id);

-- Realtime needs REPLICA IDENTITY FULL so UPDATE/DELETE events carry the old row
ALTER TABLE public.b2b_inventory REPLICA IDENTITY FULL;

-- Row-level security
ALTER TABLE public.b2b_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users"   ON public.b2b_inventory;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.b2b_inventory;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.b2b_inventory;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.b2b_inventory;

CREATE POLICY "Enable read access for all users"   ON public.b2b_inventory FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.b2b_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.b2b_inventory FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.b2b_inventory FOR DELETE USING (true);

-- Auto-update updated_at (reuses the shared set_updated_at() function from
-- create_b2b_mirror_tables.sql; ensure that migration ran first).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_b2b_inventory_updated_at ON public.b2b_inventory;
CREATE TRIGGER trg_b2b_inventory_updated_at
    BEFORE UPDATE ON public.b2b_inventory
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_inventory;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verification
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'b2b_inventory';
