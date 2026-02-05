-- ============================================
-- CHECK REALTIME STATUS FOR B2B TABLES
-- ============================================
-- Run this to verify if Realtime is enabled

-- Check which tables have Realtime enabled
SELECT 
    schemaname,
    tablename,
    pubname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Check specifically for B2B tables
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'b2b_companies'
        ) THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as b2b_companies_realtime,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'b2b_pipelines'
        ) THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as b2b_pipelines_realtime,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'b2b_quotations'
        ) THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as b2b_quotations_realtime;

-- If all show ✅ Enabled, Realtime is working!
-- If any show ❌ Disabled, run enable_b2b_realtime.sql
