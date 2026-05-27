-- ============================================================================
-- B2B Mirror Tables — extend B2B isolation to the full sales/CRM workflow
-- ============================================================================
-- Existing b2b_companies, b2b_pipelines, b2b_quotations already exist.
-- This migration adds B2B counterparts for the remaining sales + CRM entities
-- so the B2B/B2C data sets stay fully separated (no row leakage, no shared PKs).
--
-- Tables shared between B2B and B2C (NOT mirrored):
--   - vendors, vendor_pricelist, purchase_orders   (procurement, internal)
--   - users, user_passcodes, app_settings          (auth, system)
--
-- Run in Supabase SQL Editor. Idempotent: safe to re-run.
-- ============================================================================

-- ============================================================================
-- 1. b2b_contacts  (mirror of contacts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.b2b_contacts (
  "Customer ID"         text PRIMARY KEY,
  "Created Date"        timestamp with time zone DEFAULT now(),
  "Company Name"        text,
  "Name"                text,
  "Name (Khmer)"        text,
  "Role"                text,
  "Department"          text,
  "Tel (1)"             text,
  "Tel (2)"             text,
  "Email"               text,
  "Address (English)"   text,
  "Address (Khmer)"     text,
  "Created By"          text,
  "Remarks"             text
);
ALTER TABLE public.b2b_contacts REPLICA IDENTITY FULL;
ALTER TABLE public.b2b_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.b2b_contacts;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.b2b_contacts;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.b2b_contacts;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.b2b_contacts;
CREATE POLICY "Enable read access for all users"   ON public.b2b_contacts FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.b2b_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.b2b_contacts FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.b2b_contacts FOR DELETE USING (true);

-- ============================================================================
-- 2. b2b_contact_logs  (mirror of contact_logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.b2b_contact_logs (
  "Log ID"           text PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "Type"             text,
  "Company Name"     text,
  "Contact Name"     text,
  "Position"         text,
  "Phone Number"     text,
  "Email"            text,
  "Responsible By"   text,
  "Contact Date"     timestamp with time zone DEFAULT now(),
  "Counter"          text,
  "Remarks"          text
);
ALTER TABLE public.b2b_contact_logs REPLICA IDENTITY FULL;
ALTER TABLE public.b2b_contact_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.b2b_contact_logs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.b2b_contact_logs;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.b2b_contact_logs;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.b2b_contact_logs;
CREATE POLICY "Enable read access for all users"   ON public.b2b_contact_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.b2b_contact_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.b2b_contact_logs FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.b2b_contact_logs FOR DELETE USING (true);

-- ============================================================================
-- 3. b2b_meeting_logs  (mirror of meeting_logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.b2b_meeting_logs (
  "Meeting ID"     text PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "Type"           text,
  "Pipeline_ID"    text,
  "Company Name"   text,
  "Participants"   text,
  "Responsible By" text,
  "Meeting Date"   timestamp with time zone,
  "Start Time"     text,
  "End Time"       text,
  "Status"         text,
  "Remarks"        text
);
ALTER TABLE public.b2b_meeting_logs REPLICA IDENTITY FULL;
ALTER TABLE public.b2b_meeting_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.b2b_meeting_logs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.b2b_meeting_logs;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.b2b_meeting_logs;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.b2b_meeting_logs;
CREATE POLICY "Enable read access for all users"   ON public.b2b_meeting_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.b2b_meeting_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.b2b_meeting_logs FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.b2b_meeting_logs FOR DELETE USING (true);

-- ============================================================================
-- 4. b2b_site_survey_logs  (mirror of site_survey_logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.b2b_site_survey_logs (
  "Site ID"             text PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "Location"            text,
  "Responsible By"      text,
  "Date"                timestamp with time zone,
  "Start Time"          text,
  "End Time"            text,
  "Remark"              text,
  "Next Action (If Any)" text
);
ALTER TABLE public.b2b_site_survey_logs REPLICA IDENTITY FULL;
ALTER TABLE public.b2b_site_survey_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.b2b_site_survey_logs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.b2b_site_survey_logs;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.b2b_site_survey_logs;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.b2b_site_survey_logs;
CREATE POLICY "Enable read access for all users"   ON public.b2b_site_survey_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.b2b_site_survey_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.b2b_site_survey_logs FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.b2b_site_survey_logs FOR DELETE USING (true);

-- ============================================================================
-- 5. b2b_sale_orders  (mirror of sale_orders)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.b2b_sale_orders (
  "SO No"                  text PRIMARY KEY,
  "SO Date"                timestamp with time zone DEFAULT now(),
  "File"                   text,
  "Quote No"               text,
  "Company Name"           text,
  "Contact Name"           text,
  "Phone Number"           text,
  "Email"                  text,
  "Tax"                    numeric,
  "Total Amount"           numeric,
  "Commission"             numeric,
  "Status"                 text DEFAULT 'Pending',
  "Delivery Date"          timestamp with time zone,
  "Payment Term"           text,
  "Bill Invoice"           text,
  "Install Software"       text,
  "Created By"             text,
  "Currency"               text DEFAULT 'USD',
  "Attachment"             text,
  "Company Address"        text,
  "Prepared By"            text,
  "Approved By"            text,
  "Prepared By Position"   text,
  "Approved By Position"   text,
  "Remark"                 text,
  "Terms and Conditions"   text,
  "ItemsJSON"              jsonb,
  "created_at"             timestamp with time zone DEFAULT now(),
  "updated_at"             timestamp with time zone DEFAULT now()
);
ALTER TABLE public.b2b_sale_orders REPLICA IDENTITY FULL;
ALTER TABLE public.b2b_sale_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.b2b_sale_orders;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.b2b_sale_orders;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.b2b_sale_orders;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.b2b_sale_orders;
CREATE POLICY "Enable read access for all users"   ON public.b2b_sale_orders FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.b2b_sale_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.b2b_sale_orders FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.b2b_sale_orders FOR DELETE USING (true);

-- ============================================================================
-- 6. b2b_invoices  (mirror of invoices)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.b2b_invoices (
  "Inv No"                 text PRIMARY KEY,
  "Inv Date"               timestamp with time zone DEFAULT now(),
  "Due Date"               timestamp with time zone,
  "File"                   text,
  "SO No"                  text,
  "Company Name"           text,
  "Company Name (Khmer)"   text,
  "Contact Name"           text,
  "Phone Number"           text,
  "Email"                  text,
  "Amount"                 numeric,
  "Taxable"                text,
  "Tax Type"               text DEFAULT 'VAT',
  "Status"                 text DEFAULT 'Draft',
  "Created By"             text,
  "Currency"               text DEFAULT 'USD',
  "Attachment"             text,
  "Company Address"        text,
  "Payment Term"           text,
  "Tin No"                 text,
  "Deposit"                numeric DEFAULT 0,
  "Exchange Rate"          text,
  "Prepared By"            text,
  "Approved By"            text,
  "Prepared By Position"   text,
  "Approved By Position"   text,
  "ItemsJSON"              jsonb,
  "created_at"             timestamp with time zone DEFAULT now(),
  "updated_at"             timestamp with time zone DEFAULT now()
);
ALTER TABLE public.b2b_invoices REPLICA IDENTITY FULL;
ALTER TABLE public.b2b_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.b2b_invoices;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.b2b_invoices;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.b2b_invoices;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.b2b_invoices;
CREATE POLICY "Enable read access for all users"   ON public.b2b_invoices FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.b2b_invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.b2b_invoices FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.b2b_invoices FOR DELETE USING (true);

-- ============================================================================
-- 7. b2b_delivery_orders  (mirror of delivery_orders)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.b2b_delivery_orders (
  "DO No"                  text PRIMARY KEY,
  "DO Date"                timestamp with time zone DEFAULT now(),
  "Inv No"                 text,
  "SO No"                  text,
  "Company Name"           text,
  "Company Address"        text,
  "Contact Name"           text,
  "Phone Number"           text,
  "Email"                  text,
  "Currency"               text,
  "Status"                 text DEFAULT 'Pending',
  "Payment Term"           text,
  "Delivery Date"          timestamp with time zone,
  "Prepared By"            text,
  "Approved By"            text,
  "Prepared By Position"   text,
  "Approved By Position"   text,
  "Remark"                 text,
  "Terms and Conditions"   text,
  "File"                   text,
  "Created By"             text,
  "ItemsJSON"              jsonb,
  "created_at"             timestamp with time zone DEFAULT now(),
  "updated_at"             timestamp with time zone DEFAULT now()
);
ALTER TABLE public.b2b_delivery_orders REPLICA IDENTITY FULL;
ALTER TABLE public.b2b_delivery_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.b2b_delivery_orders;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.b2b_delivery_orders;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.b2b_delivery_orders;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.b2b_delivery_orders;
CREATE POLICY "Enable read access for all users"   ON public.b2b_delivery_orders FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.b2b_delivery_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.b2b_delivery_orders FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.b2b_delivery_orders FOR DELETE USING (true);

-- ============================================================================
-- 8. b2b_receipts  (mirror of receipts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.b2b_receipts (
  "RV No"                  text PRIMARY KEY,
  "RV Date"                timestamp with time zone DEFAULT now(),
  "Inv No"                 text,
  "SO No"                  text,
  "DO No"                  text,
  "Company Name"           text,
  "Company Address"        text,
  "Contact Name"           text,
  "Phone Number"           text,
  "Email"                  text,
  "Amount"                 numeric,
  "Currency"               text,
  "Payment Method"         text,
  "Tax Type"               text,
  "Status"                 text DEFAULT 'Draft',
  "Payment Term"           text,
  "Tin No"                 text,
  "Prepared By"            text,
  "Approved By"            text,
  "Prepared By Position"   text,
  "Approved By Position"   text,
  "Remark"                 text,
  "Terms and Conditions"   text,
  "File"                   text,
  "Created By"             text,
  "ItemsJSON"              jsonb,
  "created_at"             timestamp with time zone DEFAULT now(),
  "updated_at"             timestamp with time zone DEFAULT now()
);
ALTER TABLE public.b2b_receipts REPLICA IDENTITY FULL;
ALTER TABLE public.b2b_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.b2b_receipts;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.b2b_receipts;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.b2b_receipts;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.b2b_receipts;
CREATE POLICY "Enable read access for all users"   ON public.b2b_receipts FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.b2b_receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.b2b_receipts FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.b2b_receipts FOR DELETE USING (true);

-- ============================================================================
-- 9. b2b_pricelist  (mirror of pricelist; separate wholesale pricing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.b2b_pricelist (
  "Code"            text PRIMARY KEY,
  "Brand"           text,
  "Model"           text,
  "Description"     text,
  "End User Price"  numeric,
  "Dealer Price"    numeric,
  "Sheet Name"      text,
  "Promotion"       text,
  "Category"        text,
  "Status"          text,
  "Currency"        text
);
ALTER TABLE public.b2b_pricelist REPLICA IDENTITY FULL;
ALTER TABLE public.b2b_pricelist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.b2b_pricelist;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.b2b_pricelist;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.b2b_pricelist;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.b2b_pricelist;
CREATE POLICY "Enable read access for all users"   ON public.b2b_pricelist FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.b2b_pricelist FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.b2b_pricelist FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.b2b_pricelist FOR DELETE USING (true);

-- ============================================================================
-- Indexes for the new tables (matches B2C indexing patterns)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_b2b_contacts_company        ON public.b2b_contacts("Company Name");
CREATE INDEX IF NOT EXISTS idx_b2b_contact_logs_company    ON public.b2b_contact_logs("Company Name");
CREATE INDEX IF NOT EXISTS idx_b2b_meeting_logs_company    ON public.b2b_meeting_logs("Company Name");
CREATE INDEX IF NOT EXISTS idx_b2b_sale_orders_company     ON public.b2b_sale_orders("Company Name");
CREATE INDEX IF NOT EXISTS idx_b2b_sale_orders_status      ON public.b2b_sale_orders("Status");
CREATE INDEX IF NOT EXISTS idx_b2b_invoices_company        ON public.b2b_invoices("Company Name");
CREATE INDEX IF NOT EXISTS idx_b2b_invoices_status         ON public.b2b_invoices("Status");
CREATE INDEX IF NOT EXISTS idx_b2b_invoices_so             ON public.b2b_invoices("SO No");
CREATE INDEX IF NOT EXISTS idx_b2b_delivery_orders_company ON public.b2b_delivery_orders("Company Name");
CREATE INDEX IF NOT EXISTS idx_b2b_delivery_orders_inv     ON public.b2b_delivery_orders("Inv No");
CREATE INDEX IF NOT EXISTS idx_b2b_receipts_company        ON public.b2b_receipts("Company Name");
CREATE INDEX IF NOT EXISTS idx_b2b_receipts_inv            ON public.b2b_receipts("Inv No");
CREATE INDEX IF NOT EXISTS idx_b2b_pricelist_brand         ON public.b2b_pricelist("Brand");
CREATE INDEX IF NOT EXISTS idx_b2b_pricelist_status        ON public.b2b_pricelist("Status");

-- ============================================================================
-- updated_at trigger function (reused if it already exists in the project)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_b2b_sale_orders_updated_at      ON public.b2b_sale_orders;
DROP TRIGGER IF EXISTS trg_b2b_invoices_updated_at         ON public.b2b_invoices;
DROP TRIGGER IF EXISTS trg_b2b_delivery_orders_updated_at  ON public.b2b_delivery_orders;
DROP TRIGGER IF EXISTS trg_b2b_receipts_updated_at         ON public.b2b_receipts;

CREATE TRIGGER trg_b2b_sale_orders_updated_at     BEFORE UPDATE ON public.b2b_sale_orders     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_b2b_invoices_updated_at        BEFORE UPDATE ON public.b2b_invoices        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_b2b_delivery_orders_updated_at BEFORE UPDATE ON public.b2b_delivery_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_b2b_receipts_updated_at        BEFORE UPDATE ON public.b2b_receipts        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Enable realtime for the new tables
-- ============================================================================
-- Wrapped in DO blocks because ALTER PUBLICATION ADD TABLE errors when the
-- table is already in the publication. The block catches and ignores that.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_contacts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_contact_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_meeting_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_site_survey_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_sale_orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_invoices;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_delivery_orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_receipts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_pricelist;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- Verification — should return 12 rows (9 new + 3 pre-existing b2b_*)
-- ============================================================================
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename LIKE 'b2b_%'
ORDER BY tablename;
