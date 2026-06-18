-- Fix inventory RLS: change from TO authenticated → TO public.
--
-- The original migration (20260526_create_inventory.sql) created the policy with
-- USING (auth.role() = 'authenticated'), which blocks requests that arrive under
-- the anon key. The Supabase client in lib/supabase.ts falls back to anon when
-- auth.getSession() takes more than 5 seconds (cold start, token refresh), so any
-- inventory read/write during that window is silently rejected (empty result set).
--
-- Fix: drop the authenticated-only policy, add a permissive public policy matching
-- the pattern used by all other tables in this project.

DROP POLICY IF EXISTS "Authenticated users can manage inventory" ON inventory;

CREATE POLICY "Allow all"
    ON inventory
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);
