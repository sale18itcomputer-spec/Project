-- Fix RLS: change accounting tables from TO authenticated → TO public.
--
-- Context: chart_of_accounts, journal_entries, and journal_entry_lines were created
-- with TO authenticated RLS policies. When auth.getSession() is slow (cold start,
-- token refresh), the Supabase JS client falls back to the anon role, which is
-- rejected by TO authenticated policies.
--
-- All other data tables in the system use TO public, allowing both anon and
-- authenticated roles. This aligns accounting tables with the rest of the app.

-- chart_of_accounts
DROP POLICY IF EXISTS "Authenticated users can manage chart_of_accounts" ON chart_of_accounts;
CREATE POLICY "Allow all" ON chart_of_accounts
  FOR ALL TO public USING (true) WITH CHECK (true);

-- journal_entries: replace old broad policy with split operations
DROP POLICY IF EXISTS "Authenticated users can manage journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "je_select" ON journal_entries;
DROP POLICY IF EXISTS "je_insert" ON journal_entries;
DROP POLICY IF EXISTS "je_update" ON journal_entries;
DROP POLICY IF EXISTS "je_delete" ON journal_entries;

CREATE POLICY "je_select" ON journal_entries
  FOR SELECT TO public USING (true);

CREATE POLICY "je_insert" ON journal_entries
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "je_update" ON journal_entries
  FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Only UNPOSTED entries may be deleted — posted entries are permanent records
CREATE POLICY "je_delete" ON journal_entries
  FOR DELETE TO public USING (NOT is_posted);

-- journal_entry_lines
DROP POLICY IF EXISTS "Authenticated users can manage journal_entry_lines" ON journal_entry_lines;
DROP POLICY IF EXISTS "jel_select" ON journal_entry_lines;
DROP POLICY IF EXISTS "jel_insert" ON journal_entry_lines;
DROP POLICY IF EXISTS "jel_update" ON journal_entry_lines;
DROP POLICY IF EXISTS "jel_delete" ON journal_entry_lines;

CREATE POLICY "jel_select" ON journal_entry_lines
  FOR SELECT TO public USING (true);

CREATE POLICY "jel_insert" ON journal_entry_lines
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "jel_update" ON journal_entry_lines
  FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Lines belonging to posted entries cannot be deleted directly
CREATE POLICY "jel_delete" ON journal_entry_lines
  FOR DELETE TO public USING (
    NOT EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_id AND je.is_posted
    )
  );

-- brand_account_mapping: also change to public for consistency
DROP POLICY IF EXISTS "bam_select" ON brand_account_mapping;
CREATE POLICY "Allow all" ON brand_account_mapping
  FOR ALL TO public USING (true) WITH CHECK (true);

-- consignments
DROP POLICY IF EXISTS "Authenticated users can manage consignments" ON consignments;
CREATE POLICY "Allow all" ON consignments
  FOR ALL TO public USING (true) WITH CHECK (true);

-- consignment_items
DROP POLICY IF EXISTS "Authenticated users can manage consignment_items" ON consignment_items;
CREATE POLICY "Allow all" ON consignment_items
  FOR ALL TO public USING (true) WITH CHECK (true);
