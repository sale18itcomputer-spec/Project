-- ── VERIFICATION QUERIES ─────────────────────────────────────────────────────
-- Run each block separately in the SQL editor and check results.

-- 1. Confirm primary key column names have NO trailing dots
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('pipelines', 'quotations', 'sale_orders', 'invoices', 'delivery_orders', 'receipts')
  AND column_name IN (
    'Pipeline No', 'Pipeline No.',
    'Quote No',    'Quote No.',
    'SO No',       'SO No.',
    'Inv No',      'Inv No.',
    'DO No',
    'RV No'
  )
ORDER BY table_name, column_name;

-- Expected: ONLY the dot-free versions appear.
-- If you still see "Pipeline No." or "SO No." — the rename didn't apply (run it again).


-- 2. Confirm REPLICA IDENTITY FULL is set on all data tables
SELECT c.relname AS table_name,
       CASE c.relreplident
         WHEN 'd' THEN 'DEFAULT (missing primary key only)'
         WHEN 'n' THEN 'NOTHING (DELETE events will be empty)'
         WHEN 'f' THEN 'FULL (correct)'
         WHEN 'i' THEN 'INDEX'
       END AS replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'pipelines','companies','contacts','contact_logs','meeting_logs',
    'site_survey_logs','quotations','sale_orders','pricelist',
    'invoices','delivery_orders','receipts','vendors','vendor_pricelist',
    'purchase_orders'
  )
ORDER BY c.relname;

-- Expected: every row shows 'FULL'. Any 'DEFAULT' or 'NOTHING' means
-- DELETE events won't carry the old record — fix with:
-- ALTER TABLE public.<table_name> REPLICA IDENTITY FULL;


-- 3. Confirm RLS is enabled and open policies exist
SELECT t.tablename,
       t.rowsecurity AS rls_enabled,
       count(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'pipelines','companies','contacts','contact_logs','meeting_logs',
    'site_survey_logs','quotations','sale_orders','pricelist',
    'invoices','delivery_orders','receipts','vendors','vendor_pricelist',
    'purchase_orders','app_settings'
  )
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- Expected: rls_enabled = true, policy_count >= 4 for every table.


-- 4. Check for duplicate sale_orders (should return 0 rows after cleanup)
SELECT "SO No", count(*) AS cnt
FROM public.sale_orders
GROUP BY "SO No"
HAVING count(*) > 1;

-- 5. Check for duplicate quotations (should return 0 rows after cleanup)
SELECT "Quote No", count(*) AS cnt
FROM public.quotations
GROUP BY "Quote No"
HAVING count(*) > 1;
