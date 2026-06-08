-- ── product_inquiries (header) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_inquiries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_no        text UNIQUE NOT NULL,           -- e.g. INQ-2026-0001
  inquiry_date      date NOT NULL DEFAULT CURRENT_DATE,
  company_name      text NOT NULL DEFAULT '',
  contact_name      text NOT NULL DEFAULT '',
  responsible_by    text NOT NULL DEFAULT '',       -- sales person who raised it
  priority          text NOT NULL DEFAULT 'Normal', -- 'Low' | 'Normal' | 'High' | 'Urgent'
  status            text NOT NULL DEFAULT 'Draft',  -- 'Draft' | 'Pending' | 'In Progress' | 'Quoted' | 'Cancelled'
  remarks           text NOT NULL DEFAULT '',
  procurement_notes text NOT NULL DEFAULT '',       -- procurement officer's response notes
  created_by        text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── inquiry_items (line items) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiry_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id       uuid NOT NULL REFERENCES product_inquiries(id) ON DELETE CASCADE,
  line_number      integer NOT NULL,
  brand            text NOT NULL DEFAULT '',
  model_name       text NOT NULL DEFAULT '',
  specification    text NOT NULL DEFAULT '',
  qty              integer NOT NULL DEFAULT 1,
  target_price     numeric(12,2),                   -- optional, NULL means no target
  currency         text NOT NULL DEFAULT 'USD',
  stock_type       text NOT NULL DEFAULT 'In-Stock', -- 'In-Stock' | 'Lead Time'
  item_status      text NOT NULL DEFAULT 'Pending',  -- 'Pending' | 'In Stock' | 'Available' | 'Lead Time' | 'Not Available'
  actual_price     numeric(12,2),                   -- filled by procurement
  lead_time_days   integer,                         -- filled by procurement if lead time
  vendor_name      text NOT NULL DEFAULT '',        -- filled by procurement
  item_notes       text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_inquiries_status ON product_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_product_inquiries_responsible ON product_inquiries(responsible_by);
CREATE INDEX IF NOT EXISTS idx_inquiry_items_inquiry_id ON inquiry_items(inquiry_id);

-- updated_at trigger (reuse pattern from existing tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_product_inquiries ON product_inquiries;
CREATE TRIGGER set_updated_at_product_inquiries
  BEFORE UPDATE ON product_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_inquiry_items ON inquiry_items;
CREATE TRIGGER set_updated_at_inquiry_items
  BEFORE UPDATE ON inquiry_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (match existing tables — enable but allow all for authenticated users)
ALTER TABLE product_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON product_inquiries;
CREATE POLICY "Allow all for authenticated" ON product_inquiries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON inquiry_items;
CREATE POLICY "Allow all for authenticated" ON inquiry_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
