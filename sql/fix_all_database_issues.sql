-- ============================================================
-- LIMPERIAL — COMPLETE DATABASE FIX
-- Run this entire script in Supabase SQL Editor once.
-- Safe to re-run (all operations are idempotent).
-- ============================================================

-- ── 1. FIX PRIMARY KEY COLUMN NAMES (dot-suffix mismatch) ────────────────────
-- The schema was created with "Pipeline No." but all app code uses "Pipeline No"
-- Same issue on quotations ("Quote No.") and sale_orders ("SO No.")

-- Pipelines: rename "Pipeline No." → "Pipeline No"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipelines' AND column_name = 'Pipeline No.'
  ) THEN
    ALTER TABLE public.pipelines RENAME COLUMN "Pipeline No." TO "Pipeline No";
  END IF;
END $$;

-- Quotations: rename "Quote No." → "Quote No"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'Quote No.'
  ) THEN
    ALTER TABLE public.quotations RENAME COLUMN "Quote No." TO "Quote No";
  END IF;
END $$;

-- Sale Orders: rename "SO No." → "SO No"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_orders' AND column_name = 'SO No.'
  ) THEN
    ALTER TABLE public.sale_orders RENAME COLUMN "SO No." TO "SO No";
  END IF;
END $$;

-- Invoices: rename "Inv No." → "Inv No" (if created with dot)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'Inv No.'
  ) THEN
    ALTER TABLE public.invoices RENAME COLUMN "Inv No." TO "Inv No";
  END IF;
END $$;

-- Pipelines: rename other dot-suffix columns that exist in old schemas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pipelines' AND column_name = 'Quote No.') THEN
    ALTER TABLE public.pipelines RENAME COLUMN "Quote No." TO "Quote No";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pipelines' AND column_name = 'Invoice No.') THEN
    ALTER TABLE public.pipelines RENAME COLUMN "Invoice No." TO "Invoice No";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pipelines' AND column_name = 'SO No.') THEN
    ALTER TABLE public.pipelines RENAME COLUMN "SO No." TO "SO No";
  END IF;
END $$;


-- ── 2. ENSURE ALL REQUIRED COLUMNS EXIST ─────────────────────────────────────

-- quotations: add missing columns that app writes
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS "Quote Date"           timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "Validity Date"        timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "Company Address"      text,
  ADD COLUMN IF NOT EXISTS "Contact Email"        text,
  ADD COLUMN IF NOT EXISTS "Tax Type"             text DEFAULT 'VAT',
  ADD COLUMN IF NOT EXISTS "Prepared By Position" text,
  ADD COLUMN IF NOT EXISTS "Approved By Position" text,
  ADD COLUMN IF NOT EXISTS "ItemsJSON"            jsonb,
  ADD COLUMN IF NOT EXISTS "created_at"           timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at"           timestamp with time zone DEFAULT now();

-- sale_orders: add missing columns
ALTER TABLE public.sale_orders
  ADD COLUMN IF NOT EXISTS "Company Address"      text,
  ADD COLUMN IF NOT EXISTS "Prepared By"          text,
  ADD COLUMN IF NOT EXISTS "Approved By"          text,
  ADD COLUMN IF NOT EXISTS "Prepared By Position" text,
  ADD COLUMN IF NOT EXISTS "Approved By Position" text,
  ADD COLUMN IF NOT EXISTS "Remark"               text,
  ADD COLUMN IF NOT EXISTS "Terms and Conditions" text,
  ADD COLUMN IF NOT EXISTS "ItemsJSON"            jsonb,
  ADD COLUMN IF NOT EXISTS "created_at"           timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at"           timestamp with time zone DEFAULT now();

-- invoices: ensure it exists and has full schema
CREATE TABLE IF NOT EXISTS public.invoices (
  "Inv No"                text PRIMARY KEY,
  "Inv Date"              timestamp with time zone DEFAULT now(),
  "Due Date"              timestamp with time zone,
  "File"                  text,
  "SO No"                 text,
  "Company Name"          text,
  "Company Name (Khmer)"  text,
  "Contact Name"          text,
  "Phone Number"          text,
  "Email"                 text,
  "Amount"                numeric,
  "Taxable"               text,
  "Tax Type"              text DEFAULT 'VAT',
  "Status"                text DEFAULT 'Draft',
  "Created By"            text,
  "Currency"              text DEFAULT 'USD',
  "Attachment"            text,
  "Company Address"       text,
  "Payment Term"          text,
  "Tin No"                text,
  "Deposit"               numeric DEFAULT 0,
  "Exchange Rate"         text,
  "Prepared By"           text,
  "Approved By"           text,
  "Prepared By Position"  text,
  "Approved By Position"  text,
  "ItemsJSON"             jsonb,
  "created_at"            timestamp with time zone DEFAULT now(),
  "updated_at"            timestamp with time zone DEFAULT now()
);

-- delivery_orders: ensure it exists
CREATE TABLE IF NOT EXISTS public.delivery_orders (
  "DO No"                 text PRIMARY KEY,
  "DO Date"               timestamp with time zone DEFAULT now(),
  "Inv No"                text,
  "SO No"                 text,
  "Company Name"          text,
  "Company Address"       text,
  "Contact Name"          text,
  "Phone Number"          text,
  "Email"                 text,
  "Currency"              text DEFAULT 'USD',
  "Status"                text DEFAULT 'Pending',
  "Payment Term"          text,
  "Delivery Date"         timestamp with time zone,
  "Prepared By"           text,
  "Approved By"           text,
  "Prepared By Position"  text,
  "Approved By Position"  text,
  "Remark"                text,
  "Terms and Conditions"  text,
  "File"                  text,
  "Created By"            text,
  "ItemsJSON"             jsonb,
  "created_at"            timestamp with time zone DEFAULT now(),
  "updated_at"            timestamp with time zone DEFAULT now()
);

-- receipts: ensure it exists
CREATE TABLE IF NOT EXISTS public.receipts (
  "RV No"                 text PRIMARY KEY,
  "RV Date"               timestamp with time zone DEFAULT now(),
  "Inv No"                text,
  "SO No"                 text,
  "DO No"                 text,
  "Company Name"          text,
  "Company Address"       text,
  "Contact Name"          text,
  "Phone Number"          text,
  "Email"                 text,
  "Amount"                numeric,
  "Currency"              text DEFAULT 'USD',
  "Payment Method"        text,
  "Tax Type"              text,
  "Status"                text DEFAULT 'Draft',
  "Payment Term"          text,
  "Tin No"                text,
  "Prepared By"           text,
  "Approved By"           text,
  "Prepared By Position"  text,
  "Approved By Position"  text,
  "Remark"                text,
  "Terms and Conditions"  text,
  "File"                  text,
  "Created By"            text,
  "ItemsJSON"             jsonb,
  "created_at"            timestamp with time zone DEFAULT now(),
  "updated_at"            timestamp with time zone DEFAULT now()
);

-- vendors
CREATE TABLE IF NOT EXISTS public.vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name     text NOT NULL,
  category        text,
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  website         text,
  payment_terms   text,
  tax_id          text,
  status          text DEFAULT 'Active',
  remarks         text,
  created_by      text,
  created_at      timestamp with time zone DEFAULT now(),
  updated_at      timestamp with time zone DEFAULT now()
);

-- vendor_pricelist
CREATE TABLE IF NOT EXISTS public.vendor_pricelist (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  brand           text,
  model_name      text,
  specification   text,
  dealer_price    numeric DEFAULT 0,
  user_price      numeric DEFAULT 0,
  promotion       text,
  currency        text DEFAULT 'USD',
  status          text DEFAULT 'Available',
  remarks         text,
  created_by      text,
  created_at      timestamp with time zone DEFAULT now(),
  updated_at      timestamp with time zone DEFAULT now()
);

-- purchase_orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number             text UNIQUE NOT NULL,
  order_date            date,
  delivery_date         date,
  payment_term          text,
  vendor_id             uuid REFERENCES public.vendors(id),
  vendor_name           text,
  vendor_address        text,
  vendor_contact        text,
  vendor_phone          text,
  vendor_email          text,
  ship_to_address       text,
  ordered_by_name       text,
  ordered_by_phone      text,
  sub_total             numeric DEFAULT 0,
  vat_amount            numeric DEFAULT 0,
  grand_total           numeric DEFAULT 0,
  currency              text DEFAULT 'USD',
  tax_type              text DEFAULT 'VAT',
  status                text DEFAULT 'Draft',
  prepared_by           text,
  approved_by           text,
  prepared_by_position  text,
  approved_by_position  text,
  remarks               text,
  created_by            text,
  items                 jsonb,
  created_at            timestamp with time zone DEFAULT now(),
  updated_at            timestamp with time zone DEFAULT now()
);

-- app_settings (used by getSetting/saveSetting)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  value       jsonb,
  updated_at  timestamp with time zone DEFAULT now()
);


-- ── 3. ENABLE ROW LEVEL SECURITY + OPEN POLICIES ─────────────────────────────
-- Enable RLS on all tables (safe to run even if already enabled)
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'pipelines','companies','contacts','contact_logs','meeting_logs',
    'site_survey_logs','quotations','sale_orders','pricelist','users',
    'invoices','delivery_orders','receipts','vendors','vendor_pricelist',
    'purchase_orders','app_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- Drop existing policies if any, then create fresh open policies for all tables
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'pipelines','companies','contacts','contact_logs','meeting_logs',
    'site_survey_logs','quotations','sale_orders','pricelist','users',
    'invoices','delivery_orders','receipts','vendors','vendor_pricelist',
    'purchase_orders','app_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_select" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_insert" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_update" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_delete" ON public.%I', tbl);
    EXECUTE format('CREATE POLICY "allow_all_select" ON public.%I FOR SELECT USING (true)', tbl);
    EXECUTE format('CREATE POLICY "allow_all_insert" ON public.%I FOR INSERT WITH CHECK (true)', tbl);
    EXECUTE format('CREATE POLICY "allow_all_update" ON public.%I FOR UPDATE USING (true)', tbl);
    EXECUTE format('CREATE POLICY "allow_all_delete" ON public.%I FOR DELETE USING (true)', tbl);
  END LOOP;
END $$;


-- ── 4. ENABLE REPLICA IDENTITY FULL (required for realtime DELETE events) ────
-- Without FULL, DELETE events in realtime payloads have empty `old` records,
-- so the app cannot match which row was deleted.
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'pipelines','companies','contacts','contact_logs','meeting_logs',
    'site_survey_logs','quotations','sale_orders','pricelist',
    'invoices','delivery_orders','receipts','vendors','vendor_pricelist',
    'purchase_orders'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
  END LOOP;
END $$;


-- ── 5. ADD ALL TABLES TO REALTIME PUBLICATION ─────────────────────────────────
-- This is the single source of truth — all 15 data tables included.
-- Each ALTER is wrapped so it won't fail if the table is already in the publication.
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'pipelines','companies','contacts','contact_logs','meeting_logs',
    'site_survey_logs','quotations','sale_orders','pricelist',
    'invoices','delivery_orders','receipts','vendors','vendor_pricelist',
    'purchase_orders'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN others THEN
      -- Table already in publication — safe to ignore
      NULL;
    END;
  END LOOP;
END $$;


-- ── 6. AUTO-UPDATE updated_at TRIGGER ────────────────────────────────────────
-- Creates a single trigger function and applies it to every table that has
-- an updated_at column. The trigger fires on UPDATE and sets updated_at = now().

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'quotations','sale_orders','invoices','delivery_orders',
    'receipts','vendors','vendor_pricelist','purchase_orders','app_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      tbl
    );
  END LOOP;
END $$;


-- ── 7. DUPLICATE CLEANUP ──────────────────────────────────────────────────────
-- Remove duplicate sale_orders rows that were created by the onConflict mismatch.
-- Keeps the most recently updated row for each SO No.
DELETE FROM public.sale_orders a
USING public.sale_orders b
WHERE a.ctid < b.ctid
  AND a."SO No" = b."SO No";

-- Same for quotations
DELETE FROM public.quotations a
USING public.quotations b
WHERE a.ctid < b.ctid
  AND a."Quote No" = b."Quote No";


-- ── 8. VERIFY ────────────────────────────────────────────────────────────────
-- Run this SELECT to confirm realtime is set up correctly.
-- Expected: all 15 table names appear in the result.
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
