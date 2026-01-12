-- ============================================
-- TEST ALL B2B CRUD OPERATIONS
-- ============================================
-- This script tests Create, Read, Update, Delete for all B2B tables

-- ============================================
-- PART 1: SIMPLIFY POLICIES FIRST
-- ============================================

-- Drop complex policies for b2b_quotations
DROP POLICY IF EXISTS "Enable delete access for all users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable insert access for all users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable read access for all users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable update access for all users" ON b2b_quotations;

-- Create simple policy
CREATE POLICY "Enable all access for b2b quotations"
ON b2b_quotations
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Drop complex policies for b2b_companies
DROP POLICY IF EXISTS "Enable delete access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable insert access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable read access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable update access for all users" ON b2b_companies;

-- Create simple policy
CREATE POLICY "Enable all access for b2b companies"
ON b2b_companies
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Drop complex policies for b2b_pipelines
DROP POLICY IF EXISTS "Enable delete access for all users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable insert access for all users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable read access for all users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable update access for all users" ON b2b_pipelines;

-- Create simple policy
CREATE POLICY "Enable all access for b2b pipelines"
ON b2b_pipelines
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ============================================
-- PART 2: TEST CRUD OPERATIONS
-- ============================================

-- TEST 1: CREATE (INSERT)
-- Insert a test company
INSERT INTO b2b_companies ("Company ID", "Company Name", "Created Date")
VALUES ('TEST_COMPANY_001', 'Test Company for CRUD', CURRENT_DATE);

-- Insert a test pipeline
INSERT INTO b2b_pipelines ("Pipeline No.", "Company Name", "Status", "Created Date")
VALUES ('TEST_PIPELINE_001', 'Test Company for CRUD', 'Quote Submitted', CURRENT_DATE);

-- Insert a test quotation
INSERT INTO b2b_quotations ("Quote No.", "Company Name", "Status", "Quote Date")
VALUES ('TEST_QUOTE_001', 'Test Company for CRUD', 'Pending', CURRENT_DATE);

-- Verify inserts
SELECT 'Companies' as table_name, COUNT(*) as count FROM b2b_companies WHERE "Company ID" = 'TEST_COMPANY_001'
UNION ALL
SELECT 'Pipelines', COUNT(*) FROM b2b_pipelines WHERE "Pipeline No." = 'TEST_PIPELINE_001'
UNION ALL
SELECT 'Quotations', COUNT(*) FROM b2b_quotations WHERE "Quote No." = 'TEST_QUOTE_001';
-- Expected: All counts should be 1

-- TEST 2: READ (SELECT)
SELECT "Company ID", "Company Name" FROM b2b_companies WHERE "Company ID" = 'TEST_COMPANY_001';
SELECT "Pipeline No.", "Company Name", "Status" FROM b2b_pipelines WHERE "Pipeline No." = 'TEST_PIPELINE_001';
SELECT "Quote No.", "Company Name", "Status" FROM b2b_quotations WHERE "Quote No." = 'TEST_QUOTE_001';
-- Expected: Should see the test records

-- TEST 3: UPDATE
UPDATE b2b_companies 
SET "Company Name" = 'Updated Test Company'
WHERE "Company ID" = 'TEST_COMPANY_001';

UPDATE b2b_pipelines
SET "Status" = 'Close (win)'
WHERE "Pipeline No." = 'TEST_PIPELINE_001';

UPDATE b2b_quotations
SET "Status" = 'Approved'
WHERE "Quote No." = 'TEST_QUOTE_001';

-- Verify updates
SELECT "Company ID", "Company Name" FROM b2b_companies WHERE "Company ID" = 'TEST_COMPANY_001';
-- Expected: Company Name should be 'Updated Test Company'

SELECT "Pipeline No.", "Status" FROM b2b_pipelines WHERE "Pipeline No." = 'TEST_PIPELINE_001';
-- Expected: Status should be 'Close (win)'

SELECT "Quote No.", "Status" FROM b2b_quotations WHERE "Quote No." = 'TEST_QUOTE_001';
-- Expected: Status should be 'Approved'

-- TEST 4: DELETE
DELETE FROM b2b_quotations WHERE "Quote No." = 'TEST_QUOTE_001';
DELETE FROM b2b_pipelines WHERE "Pipeline No." = 'TEST_PIPELINE_001';
DELETE FROM b2b_companies WHERE "Company ID" = 'TEST_COMPANY_001';

-- Verify deletions
SELECT 'Companies' as table_name, COUNT(*) as remaining FROM b2b_companies WHERE "Company ID" = 'TEST_COMPANY_001'
UNION ALL
SELECT 'Pipelines', COUNT(*) FROM b2b_pipelines WHERE "Pipeline No." = 'TEST_PIPELINE_001'
UNION ALL
SELECT 'Quotations', COUNT(*) FROM b2b_quotations WHERE "Quote No." = 'TEST_QUOTE_001';
-- Expected: All counts should be 0

-- ============================================
-- PART 3: VERIFY POLICIES
-- ============================================

SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename LIKE 'b2b_%'
ORDER BY tablename, policyname;

-- Expected: 1 policy per table, all with cmd='ALL'

-- ============================================
-- SUMMARY
-- ============================================

SELECT 
    'Test completed! Check results above.' as message,
    'If all counts are correct, CRUD operations work!' as status;
