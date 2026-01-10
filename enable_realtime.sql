
/**
 * EXECUTE THIS SQL IN YOUR SUPABASE SQL EDITOR TO ENABLE REALTIME FOR ALL TABLES
 */

begin;

-- Enable replication for specific tables to broadcast changes
alter publication supabase_realtime add table pipelines;
alter publication supabase_realtime add table companies;
alter publication supabase_realtime add table contacts;
alter publication supabase_realtime add table meeting_logs;
alter publication supabase_realtime add table contact_logs;
alter publication supabase_realtime add table site_survey_logs;
alter publication supabase_realtime add table quotations;
alter publication supabase_realtime add table sale_orders;
alter publication supabase_realtime add table pricelist;

-- Add 'users' if you want realtime on users, though usually handled via Auth
-- alter publication supabase_realtime add table users;

commit;

/**
 * Note: If you have already enabled realtime for 'all tables' via the dashboard, 
 * this might error or be redundant, which is fine.
 * 
 * To check what is enabled:
 * select * from pg_publication_tables where pubname = 'supabase_realtime';
 */
