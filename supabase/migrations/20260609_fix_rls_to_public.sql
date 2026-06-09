-- Fix RLS: change all new procurement/service tables from TO authenticated → TO public.
--
-- Context: all existing/working tables (quotations, sale_orders, invoices, delivery_orders,
-- receipts, vendors, purchase_orders, inventory, …) use TO public RLS, which allows
-- both anon and authenticated roles to read/write.
--
-- The new tables added in 20260608_* were mistakenly created with TO authenticated,
-- meaning every request sent under the anon role is blocked.  This becomes a problem
-- when auth.getSession() is slow (cold start, in-flight token refresh): the Supabase
-- JS client falls back to the anon key, and TO authenticated rejects that outright.
-- The result was "Saving inquiry timed out" even though the DB itself was healthy.

-- product_inquiries
DROP POLICY IF EXISTS "Allow all for authenticated" ON product_inquiries;
DROP POLICY IF EXISTS "Allow all"                   ON product_inquiries;
CREATE POLICY "Allow all" ON product_inquiries
  FOR ALL TO public USING (true) WITH CHECK (true);

-- inquiry_items
DROP POLICY IF EXISTS "Allow all for authenticated" ON inquiry_items;
DROP POLICY IF EXISTS "Allow all"                   ON inquiry_items;
CREATE POLICY "Allow all" ON inquiry_items
  FOR ALL TO public USING (true) WITH CHECK (true);

-- pdi_records
DROP POLICY IF EXISTS "Allow all for authenticated" ON pdi_records;
DROP POLICY IF EXISTS "Allow all"                   ON pdi_records;
CREATE POLICY "Allow all" ON pdi_records
  FOR ALL TO public USING (true) WITH CHECK (true);

-- pdi_items
DROP POLICY IF EXISTS "Allow all for authenticated" ON pdi_items;
DROP POLICY IF EXISTS "Allow all"                   ON pdi_items;
CREATE POLICY "Allow all" ON pdi_items
  FOR ALL TO public USING (true) WITH CHECK (true);

-- serial_numbers
DROP POLICY IF EXISTS "Allow all for authenticated" ON serial_numbers;
DROP POLICY IF EXISTS "Allow all"                   ON serial_numbers;
CREATE POLICY "Allow all" ON serial_numbers
  FOR ALL TO public USING (true) WITH CHECK (true);

-- service_tickets
DROP POLICY IF EXISTS "Allow all for authenticated" ON service_tickets;
DROP POLICY IF EXISTS "Allow all"                   ON service_tickets;
CREATE POLICY "Allow all" ON service_tickets
  FOR ALL TO public USING (true) WITH CHECK (true);

-- spare_parts
DROP POLICY IF EXISTS "Allow all for authenticated" ON spare_parts;
DROP POLICY IF EXISTS "Allow all"                   ON spare_parts;
CREATE POLICY "Allow all" ON spare_parts
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Clean up test row inserted during investigation
DELETE FROM product_inquiries WHERE inquiry_no = 'INQ-TEST-0001';
