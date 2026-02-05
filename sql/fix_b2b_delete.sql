-- ============================================
-- FIX DELETE ISSUES FOR B2B TABLES
-- ============================================

-- Step 1: Check current RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename LIKE 'b2b_%';

-- Step 2: Check DELETE policies specifically
SELECT 
    tablename,
    policyname,
    cmd,
    permissive,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename LIKE 'b2b_%'
AND (cmd = 'DELETE' OR cmd = 'ALL')
ORDER BY tablename, policyname;

-- Step 3: If DELETE policies are missing or restrictive, fix them

-- Option A: Temporarily disable RLS to test (TESTING ONLY!)
-- ALTER TABLE b2b_companies DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE b2b_pipelines DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE b2b_quotations DISABLE ROW LEVEL SECURITY;

-- Option B: Ensure proper DELETE policies exist
-- Drop all existing policies
DROP POLICY IF EXISTS "Enable delete access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable insert access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable read access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable update access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable all access for b2b companies" ON b2b_companies;

DROP POLICY IF EXISTS "Enable delete access for all users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable insert access for all users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable read access for all users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable update access for all users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable all access for b2b pipelines" ON b2b_pipelines;

DROP POLICY IF EXISTS "Enable delete access for all users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable insert access for all users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable read access for all users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable update access for all users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable all access for b2b quotations" ON b2b_quotations;

-- Create comprehensive policies that allow ALL operations
CREATE POLICY "Enable all operations for authenticated users"
ON b2b_companies
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users"
ON b2b_pipelines
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users"
ON b2b_quotations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Step 4: Test DELETE operation
-- Create a test record
INSERT INTO b2b_companies ("Company ID", "Company Name")
VALUES ('DELETE_TEST_001', 'Delete Test Company');

-- Verify it exists
SELECT * FROM b2b_companies WHERE "Company ID" = 'DELETE_TEST_001';

-- Try to delete it
DELETE FROM b2b_companies WHERE "Company ID" = 'DELETE_TEST_001' RETURNING *;

-- Verify it's gone
SELECT COUNT(*) as should_be_zero FROM b2b_companies WHERE "Company ID" = 'DELETE_TEST_001';

-- Step 5: Check if RLS is the issue
-- If the above DELETE didn't work, try this:

-- Temporarily disable RLS
ALTER TABLE b2b_companies DISABLE ROW LEVEL SECURITY;

-- Try delete again
INSERT INTO b2b_companies ("Company ID", "Company Name")
VALUES ('DELETE_TEST_002', 'Delete Test 2');

DELETE FROM b2b_companies WHERE "Company ID" = 'DELETE_TEST_002' RETURNING *;

SELECT COUNT(*) as should_be_zero FROM b2b_companies WHERE "Company ID" = 'DELETE_TEST_002';

-- Re-enable RLS
ALTER TABLE b2b_companies ENABLE ROW LEVEL SECURITY;

-- Step 6: Final verification
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename LIKE 'b2b_%'
ORDER BY tablename;

-- Expected: 1 policy per table with cmd='ALL'
