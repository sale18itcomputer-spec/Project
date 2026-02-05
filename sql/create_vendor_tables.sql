-- Create Vendor Management Tables
-- These tables are for the procurement officer to manage suppliers and their pricing

-- Table: vendors (Vendor Master List)
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  website text,
  payment_terms text,
  tax_id text,
  category text, -- e.g., Hardware, Software, Services, Logistics
  status text DEFAULT 'Active', -- Active, Inactive, Blocked
  remarks text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text
);

-- Table: vendor_pricelist (Vendor Price List)
CREATE TABLE IF NOT EXISTS public.vendor_pricelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  brand text,
  model_name text NOT NULL,
  specification text,
  dealer_price numeric NOT NULL,
  user_price numeric,
  promotion text,
  currency text DEFAULT 'USD',
  status text DEFAULT 'Available', -- Available, Discontinued, Out of Stock
  remarks text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_pricelist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to handle re-runs)
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.vendors;
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.vendor_pricelist;

-- Create policies (allowing authenticated access for simplicity, matching existing patterns)
CREATE POLICY "Enable full access for authenticated users" ON public.vendors
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable full access for authenticated users" ON public.vendor_pricelist
  FOR ALL USING (true) WITH CHECK (true);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_vendors_updated_at ON public.vendors;
CREATE TRIGGER update_vendors_updated_at
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_pricelist_updated_at ON public.vendor_pricelist;
CREATE TRIGGER update_vendor_pricelist_updated_at
BEFORE UPDATE ON public.vendor_pricelist
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create indexes (using IF NOT EXISTS where possible or standard creation)
CREATE INDEX IF NOT EXISTS idx_vendors_name ON public.vendors(vendor_name);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON public.vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendor_pricelist_vendor_id ON public.vendor_pricelist(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_pricelist_model_name ON public.vendor_pricelist(model_name);
CREATE INDEX IF NOT EXISTS idx_vendor_pricelist_brand ON public.vendor_pricelist(brand);
