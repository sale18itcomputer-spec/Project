-- Attempt to delete a specific record to verify RLS and Keys
DELETE FROM "public"."b2b_quotations" WHERE "Quote No." = 'BQ-0000001';

-- Check if it still exists
SELECT * FROM "public"."b2b_quotations" WHERE "Quote No." = 'BQ-0000001';
