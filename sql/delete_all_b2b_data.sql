-- ============================================
-- DELETE ALL B2B DATA (CLEAN SLATE)
-- ============================================
-- WARNING: This will delete ALL data from B2B tables!
-- Only run this if you want to start fresh

-- Delete all B2B quotations
DELETE FROM b2b_quotations;

-- Delete all B2B pipelines
DELETE FROM b2b_pipelines;

-- Delete all B2B companies
DELETE FROM b2b_companies;

-- Verify deletion
SELECT 
    'b2b_companies' as table_name,
    COUNT(*) as remaining_records
FROM b2b_companies
UNION ALL
SELECT 
    'b2b_pipelines' as table_name,
    COUNT(*) as remaining_records
FROM b2b_pipelines
UNION ALL
SELECT 
    'b2b_quotations' as table_name,
    COUNT(*) as remaining_records
FROM b2b_quotations;

-- Expected result: All counts should be 0
