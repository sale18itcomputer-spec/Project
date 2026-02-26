-- ============================================================
-- Purchase Order Tables
-- ============================================================

-- Table: purchase_orders (PO Header)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,           -- e.g. PO-2026-001
  order_date timestamp with time zone DEFAULT now(),
  delivery_date timestamp with time zone,
  payment_term text,                        -- Credit Term / Payment Term
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ship_to_address text,
  vendor_name text,
  vendor_address text,
  vendor_contact text,
  vendor_phone text,
  vendor_email text,
  ordered_by_name text,
  ordered_by_phone text,
  sub_total numeric DEFAULT 0,
  vat_amount numeric DEFAULT 0,
  grand_total numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  status text DEFAULT 'Draft',              -- Draft, Approved, Sent, Completed, Cancelled
  prepared_by text,
  approved_by text,
  prepared_by_position text,
  approved_by_position text,
  remarks text,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Table: purchase_order_items (PO Line Items)
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  line_number integer NOT NULL DEFAULT 1,
  item_number text,                         -- Item # / SKU
  description text NOT NULL,
  qty numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total numeric GENERATED ALWAYS AS (qty * unit_price) STORED,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.purchase_orders;
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.purchase_order_items;

-- Policies
CREATE POLICY "Enable full access for authenticated users" ON public.purchase_orders
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable full access for authenticated users" ON public.purchase_order_items
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at on purchase_orders
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON public.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON public.purchase_order_items(po_id);
