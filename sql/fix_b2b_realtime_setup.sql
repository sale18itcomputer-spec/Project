-- ==============================================================================
-- FIX B2B REALTIME SUBSCRIPTION ERROR
-- ==============================================================================
-- Run this entire script in the Supabase SQL Editor to fix the "CHANNEL_ERROR"
-- mismatch between client subscription and database configuration.
-- ==============================================================================

-- 1. Enable Realtime for all B2B tables
-- We drop from publication first to ensure a clean add (idempotent approach)
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS b2b_companies;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS b2b_pipelines;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS b2b_quotations;

ALTER PUBLICATION supabase_realtime ADD TABLE b2b_companies;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_pipelines;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_quotations;

-- 2. Set Replica Identity to FULL
-- This ensures that UPDATE/DELETE events contain the full record data
ALTER TABLE b2b_companies REPLICA IDENTITY FULL;
ALTER TABLE b2b_pipelines REPLICA IDENTITY FULL;
ALTER TABLE b2b_quotations REPLICA IDENTITY FULL;

-- 3. Reset RLS Policies for Realtime Access
-- We need to ensure that the 'anon' and 'authenticated' roles can LISTEN to these tables.
-- The simplest way is to allow ALL operations for public, or specifically SELECT.

-- Reset policies for b2b_companies
DROP POLICY IF EXISTS "Enable all access for realtime" ON b2b_companies;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable all operations for all users" ON b2b_companies;
-- Create permissive policy
CREATE POLICY "Enable all access for realtime"
ON b2b_companies FOR ALL TO public USING (true) WITH CHECK (true);

-- Reset policies for b2b_pipelines
DROP POLICY IF EXISTS "Enable all access for realtime" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON b2b_pipelines;
DROP POLICY IF EXISTS "Enable all operations for all users" ON b2b_pipelines;
-- Create permissive policy
CREATE POLICY "Enable all access for realtime"
ON b2b_pipelines FOR ALL TO public USING (true) WITH CHECK (true);

-- Reset policies for b2b_quotations
DROP POLICY IF EXISTS "Enable all access for realtime" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON b2b_quotations;
DROP POLICY IF EXISTS "Enable all operations for all users" ON b2b_quotations;
-- Create permissive policy
CREATE POLICY "Enable all access for realtime"
ON b2b_quotations FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. Verify Configuration
-- This will output the current status to confirm success
SELECT 
    t.tablename,
    CASE WHEN pt.tablename IS NOT NULL THEN '✅ Realtime Enabled' ELSE '❌ Realtime Disabled' END as realtime_status,
    CASE WHEN pol.policyname IS NOT NULL THEN '✅ Policy Exists' ELSE '❌ Policy Missing' END as policy_status
FROM pg_tables t
LEFT JOIN pg_publication_tables pt ON pt.tablename = t.tablename AND pt.pubname = 'supabase_realtime'
LEFT JOIN pg_policies pol ON pol.tablename = t.tablename AND pol.policyname = 'Enable all access for realtime'
WHERE t.tablename IN ('b2b_companies', 'b2b_pipelines', 'b2b_quotations');
