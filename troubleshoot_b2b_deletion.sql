-- ============================================
-- TROUBLESHOOTING B2B DELETION ISSUES
-- ============================================

-- Step 1: Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'b2b_%'
ORDER BY table_name;

-- Step 2: Check Row Level Security (RLS) policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename LIKE 'b2b_%'
ORDER BY tablename, policyname;

-- Step 3: Check if RLS is enabled on B2B tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename LIKE 'b2b_%';

-- Step 4: Temporarily disable RLS for testing (CAREFUL!)
-- Only run this if you're having permission issues
-- ALTER TABLE b2b_companies DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE b2b_pipelines DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE b2b_quotations DISABLE ROW LEVEL SECURITY;

-- Step 5: Check for foreign key constraints
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name LIKE 'b2b_%';

-- Step 6: Try a simple delete with RETURNING to see what happens
DELETE FROM b2b_companies
WHERE "Company ID" = 'TEST123'  -- Use a test ID
RETURNING *;

-- If this returns nothing, the record doesn't exist
-- If this returns an error, check the error message
