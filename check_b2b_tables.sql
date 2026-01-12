-- ============================================
-- CHECK IF B2B TABLES EXIST
-- ============================================
-- Run this first to see if your B2B tables exist

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('b2b_companies', 'b2b_pipelines', 'b2b_quotations')
ORDER BY table_name;

-- Expected result: Should show 3 tables
-- If you see 0 results, the tables don't exist yet!
