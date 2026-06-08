-- ── serial_numbers ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS serial_numbers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number         text UNIQUE NOT NULL,
  brand                 text NOT NULL DEFAULT '',
  model_name            text NOT NULL DEFAULT '',
  description           text NOT NULL DEFAULT '',
  inventory_id          uuid REFERENCES inventory(id) ON DELETE SET NULL,
  so_no                 text NOT NULL DEFAULT '',
  company_name          text NOT NULL DEFAULT '',
  contact_name          text NOT NULL DEFAULT '',
  warranty_start_date   date,
  warranty_end_date     date,
  warranty_period_months integer DEFAULT 12,
  status                text NOT NULL DEFAULT 'Active',
  notes                 text NOT NULL DEFAULT '',
  created_by            text NOT NULL DEFAULT '',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── service_tickets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_tickets (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no                 text UNIQUE NOT NULL,
  ticket_date               date NOT NULL DEFAULT CURRENT_DATE,
  ticket_type               text NOT NULL DEFAULT 'Other',
  priority                  text NOT NULL DEFAULT 'Normal',
  status                    text NOT NULL DEFAULT 'Open',
  company_name              text NOT NULL DEFAULT '',
  contact_name              text NOT NULL DEFAULT '',
  contact_phone             text NOT NULL DEFAULT '',
  serial_number             text NOT NULL DEFAULT '',
  brand                     text NOT NULL DEFAULT '',
  model_name                text NOT NULL DEFAULT '',
  problem_description       text NOT NULL DEFAULT '',
  assigned_engineer         text NOT NULL DEFAULT '',
  received_date             date,
  estimated_completion_date date,
  actual_completion_date    date,
  resolution_notes          text NOT NULL DEFAULT '',
  internal_notes            text NOT NULL DEFAULT '',
  warranty_status           text NOT NULL DEFAULT 'Unknown',
  repair_cost               numeric(12,2),
  currency                  text NOT NULL DEFAULT 'USD',
  created_by                text NOT NULL DEFAULT '',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ── pdi_records ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pdi_records (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_no                text UNIQUE NOT NULL,
  pdi_date              date NOT NULL DEFAULT CURRENT_DATE,
  status                text NOT NULL DEFAULT 'Pending',
  so_no                 text NOT NULL DEFAULT '',
  company_name          text NOT NULL DEFAULT '',
  contact_name          text NOT NULL DEFAULT '',
  assigned_engineer     text NOT NULL DEFAULT '',
  inspection_notes      text NOT NULL DEFAULT '',
  software_installed    text NOT NULL DEFAULT '',
  warranty_seal_applied boolean NOT NULL DEFAULT false,
  warranty_seal_number  text NOT NULL DEFAULT '',
  seal_photo_url        text NOT NULL DEFAULT '',
  overall_condition     text NOT NULL DEFAULT 'New',
  created_by            text NOT NULL DEFAULT '',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── pdi_items ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pdi_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id               uuid NOT NULL REFERENCES pdi_records(id) ON DELETE CASCADE,
  line_number          integer NOT NULL,
  serial_number        text NOT NULL DEFAULT '',
  brand                text NOT NULL DEFAULT '',
  model_name           text NOT NULL DEFAULT '',
  physical_condition   text NOT NULL DEFAULT 'Pass',
  power_test           text NOT NULL DEFAULT 'Pass',
  software_test        text NOT NULL DEFAULT 'Pass',
  accessories_check    text NOT NULL DEFAULT 'Pass',
  seal_applied         boolean NOT NULL DEFAULT false,
  item_notes           text NOT NULL DEFAULT '',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ── spare_parts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spare_parts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_no       text UNIQUE NOT NULL,
  part_name     text NOT NULL DEFAULT '',
  brand         text NOT NULL DEFAULT '',
  model_name    text NOT NULL DEFAULT '',
  category      text NOT NULL DEFAULT 'Spare Part',
  qty           integer NOT NULL DEFAULT 0,
  unit          text NOT NULL DEFAULT 'pcs',
  unit_cost     numeric(12,2) DEFAULT 0,
  currency      text NOT NULL DEFAULT 'USD',
  supplier_name text NOT NULL DEFAULT '',
  location      text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'In Stock',
  min_qty       integer NOT NULL DEFAULT 1,
  remarks       text NOT NULL DEFAULT '',
  created_by    text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_serial_numbers_so_no         ON serial_numbers(so_no);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_company       ON serial_numbers(company_name);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_status        ON serial_numbers(status);
CREATE INDEX IF NOT EXISTS idx_service_tickets_status       ON service_tickets(status);
CREATE INDEX IF NOT EXISTS idx_service_tickets_serial       ON service_tickets(serial_number);
CREATE INDEX IF NOT EXISTS idx_service_tickets_engineer     ON service_tickets(assigned_engineer);
CREATE INDEX IF NOT EXISTS idx_pdi_records_status           ON pdi_records(status);
CREATE INDEX IF NOT EXISTS idx_pdi_records_so_no            ON pdi_records(so_no);
CREATE INDEX IF NOT EXISTS idx_pdi_items_pdi_id             ON pdi_items(pdi_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_status           ON spare_parts(status);
CREATE INDEX IF NOT EXISTS idx_spare_parts_category         ON spare_parts(category);

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_serial_numbers    ON serial_numbers;
CREATE TRIGGER set_updated_at_serial_numbers
  BEFORE UPDATE ON serial_numbers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_service_tickets   ON service_tickets;
CREATE TRIGGER set_updated_at_service_tickets
  BEFORE UPDATE ON service_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_pdi_records       ON pdi_records;
CREATE TRIGGER set_updated_at_pdi_records
  BEFORE UPDATE ON pdi_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_pdi_items         ON pdi_items;
CREATE TRIGGER set_updated_at_pdi_items
  BEFORE UPDATE ON pdi_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_spare_parts       ON spare_parts;
CREATE TRIGGER set_updated_at_spare_parts
  BEFORE UPDATE ON spare_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE serial_numbers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdi_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdi_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON serial_numbers;
CREATE POLICY "Allow all for authenticated" ON serial_numbers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON service_tickets;
CREATE POLICY "Allow all for authenticated" ON service_tickets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON pdi_records;
CREATE POLICY "Allow all for authenticated" ON pdi_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON pdi_items;
CREATE POLICY "Allow all for authenticated" ON pdi_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON spare_parts;
CREATE POLICY "Allow all for authenticated" ON spare_parts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
