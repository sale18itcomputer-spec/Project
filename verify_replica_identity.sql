-- ==============================================================================
-- VERIFY REPLICA IDENTITY FOR B2B TABLES
-- ==============================================================================
-- This script checks if the tables are configured to send full data on delete.
-- ==============================================================================

SELECT 
    c.relname AS table_name,
    CASE c.relreplident
        WHEN 'd' THEN 'DEFAULT (Key only)'
        WHEN 'n' THEN 'NOTHING'
        WHEN 'f' THEN 'FULL (All columns)'
        WHEN 'i' THEN 'INDEX'
    END AS replica_identity,
    CASE WHEN c.relreplident = 'f' THEN '✅ OK' ELSE '❌ FIX NEEDED' END as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relname IN ('b2b_companies', 'b2b_pipelines', 'b2b_quotations');

-- ==============================================================================
-- INSTRUCTIONS
-- ==============================================================================
-- If any table shows '❌ FIX NEEDED', you MUST run the following:
--
-- ALTER TABLE b2b_companies REPLICA IDENTITY FULL;
-- ALTER TABLE b2b_pipelines REPLICA IDENTITY FULL;
-- ALTER TABLE b2b_quotations REPLICA IDENTITY FULL;
-- ==============================================================================
