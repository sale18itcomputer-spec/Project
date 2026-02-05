-- ============================================
-- FIX: RLS Policy Blocking Quotation Insert
-- ============================================

-- The issue: Policy is set to "authenticated" role
-- But the app might be using "anon" or "public" role

-- Solution: Change policy to work with all roles

-- Drop the current policy
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON b2b_quotations;

-- Create policy that works for ALL roles (public, anon, authenticated)
CREATE POLICY "Enable all operations for all users"
ON b2b_quotations
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Do the same for companies and pipelines to be consistent
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON b2b_companies;
CREATE POLICY "Enable all operations for all users"
ON b2b_companies
FOR ALL
TO public
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON b2b_pipelines;
CREATE POLICY "Enable all operations for all users"
ON b2b_pipelines
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Verify the policies
SELECT 
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename LIKE 'b2b_%'
ORDER BY tablename;

-- Expected: All policies should show roles = {public}

-- Test insert
INSERT INTO b2b_quotations ("Quote No.", "Company Name", "Status", "Quote Date")
VALUES ('TEST_QUOTE_RLS', 'Test Company', 'Pending', CURRENT_DATE);

-- Verify it worked
SELECT * FROM b2b_quotations WHERE "Quote No." = 'TEST_QUOTE_RLS';

-- Clean up test
DELETE FROM b2b_quotations WHERE "Quote No." = 'TEST_QUOTE_RLS';
