-- ============================================
-- FIX: B2B Subscription Channel Error
-- ============================================
-- Error: ❌ B2B subscription error!
-- Cause: Realtime not properly configured for B2B tables

-- STEP 1: Check if Realtime is enabled
SELECT 
    schemaname,
    tablename,
    pubname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename LIKE 'b2b_%'
ORDER BY tablename;

-- Expected: Should show 3 tables (b2b_companies, b2b_pipelines, b2b_quotations)
-- If empty, Realtime is NOT enabled!

-- STEP 2: Enable Realtime for B2B tables
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_companies;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_pipelines;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_quotations;

-- STEP 3: Verify Realtime is now enabled
SELECT 
    tablename,
    'Realtime Enabled' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename LIKE 'b2b_%'
ORDER BY tablename;

-- Expected result:
-- b2b_companies  | Realtime Enabled
-- b2b_pipelines  | Realtime Enabled
-- b2b_quotations | Realtime Enabled

-- STEP 4: Check RLS policies (must allow SELECT for realtime to work)
SELECT 
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename LIKE 'b2b_%'
ORDER BY tablename;

-- Expected: Each table should have a policy with cmd='ALL' or cmd='SELECT'

-- STEP 5: Ensure RLS allows SELECT for realtime
-- If policies are missing or restrictive, run this:

DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable all operations for all users" ON b2b_companies;

CREATE POLICY "Enable all access for realtime"
ON b2b_companies
FOR ALL
TO public
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable all operations for all users" ON b2b_pipelines;

CREATE POLICY "Enable all access for realtime"
ON b2b_pipelines
FOR ALL
TO public
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable all operations for all users" ON b2b_quotations;

CREATE POLICY "Enable all access for realtime"
ON b2b_quotations
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- STEP 6: Check table ownership (realtime needs proper permissions)
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE tablename LIKE 'b2b_%';

-- Expected: tableowner should be 'postgres' or your database owner

-- STEP 7: If still not working, check if tables have REPLICA IDENTITY
ALTER TABLE b2b_companies REPLICA IDENTITY FULL;
ALTER TABLE b2b_pipelines REPLICA IDENTITY FULL;
ALTER TABLE b2b_quotations REPLICA IDENTITY FULL;

-- STEP 8: Final verification
SELECT 
    'b2b_companies' as table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'b2b_companies'
        ) THEN '✅ Realtime Enabled'
        ELSE '❌ Realtime Disabled'
    END as realtime_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'b2b_companies'
            AND (cmd = 'ALL' OR cmd = 'SELECT')
        ) THEN '✅ RLS Allows SELECT'
        ELSE '❌ RLS Blocks SELECT'
    END as rls_status
UNION ALL
SELECT 
    'b2b_pipelines',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'b2b_pipelines'
        ) THEN '✅ Realtime Enabled'
        ELSE '❌ Realtime Disabled'
    END,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'b2b_pipelines'
            AND (cmd = 'ALL' OR cmd = 'SELECT')
        ) THEN '✅ RLS Allows SELECT'
        ELSE '❌ RLS Blocks SELECT'
    END
UNION ALL
SELECT 
    'b2b_quotations',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'b2b_quotations'
        ) THEN '✅ Realtime Enabled'
        ELSE '❌ Realtime Disabled'
    END,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'b2b_quotations'
            AND (cmd = 'ALL' OR cmd = 'SELECT')
        ) THEN '✅ RLS Allows SELECT'
        ELSE '❌ RLS Blocks SELECT'
    END;

-- All should show ✅ for both realtime_status and rls_status

-- STEP 9: Test realtime with a simple insert
INSERT INTO b2b_companies ("Company ID", "Company Name")
VALUES ('REALTIME_TEST', 'Realtime Test Company');

-- Wait 2 seconds, then check if it appears in your UI
-- If it appears, realtime is working!

-- Clean up test
DELETE FROM b2b_companies WHERE "Company ID" = 'REALTIME_TEST';
