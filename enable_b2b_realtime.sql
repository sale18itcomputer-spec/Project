-- ============================================
-- ENABLE REALTIME FOR B2B TABLES
-- ============================================
-- Run this in Supabase SQL Editor to enable real-time updates

-- Enable realtime for b2b_companies
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_companies;

-- Enable realtime for b2b_pipelines
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_pipelines;

-- Enable realtime for b2b_quotations
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_quotations;

-- Verify realtime is enabled
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename LIKE 'b2b_%'
ORDER BY tablename;

-- Expected result: Should show all 3 B2B tables
-- b2b_companies
-- b2b_pipelines
-- b2b_quotations
