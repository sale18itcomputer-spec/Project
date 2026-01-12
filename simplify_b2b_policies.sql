-- ============================================
-- SIMPLIFY B2B RLS POLICIES (Match B2C Style)
-- ============================================
-- This will replace the 4 separate policies with 1 simple policy

-- First, drop the existing individual policies
DROP POLICY IF EXISTS "Enable delete access for all users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable insert access for all users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable read access for all users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable update access for all users" ON b2b_quotations;

-- Create a single policy for all operations (like B2C)
CREATE POLICY "Enable all access for b2b quotations"
ON b2b_quotations
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Do the same for b2b_companies
DROP POLICY IF EXISTS "Enable delete access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable insert access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable read access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable update access for all users" ON b2b_companies;

CREATE POLICY "Enable all access for b2b companies"
ON b2b_companies
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Do the same for b2b_pipelines
DROP POLICY IF EXISTS "Enable delete access for all users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable insert access for all users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable read access for all users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable update access for all users" ON b2b_pipelines;

CREATE POLICY "Enable all access for b2b pipelines"
ON b2b_pipelines
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Verify the policies
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename LIKE 'b2b_%'
ORDER BY tablename, policyname;

-- Expected result: 1 policy per table (3 total)
-- b2b_companies  | Enable all access for b2b companies  | ALL
-- b2b_pipelines  | Enable all access for b2b pipelines  | ALL
-- b2b_quotations | Enable all access for b2b quotations | ALL
