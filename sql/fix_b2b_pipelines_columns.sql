-- ==============================================================================
-- FIX: Rename mismatched columns in b2b_pipelines
-- ==============================================================================
-- Renames the period-suffixed column names to match the standard schema (without periods).
-- This resolves column mismatch errors like:
-- "Could not find the 'Invoice No' column of 'b2b_pipelines' in the schema cache"
-- ==============================================================================

-- 1. Rename column "Quote No." to "Quote No"
ALTER TABLE public.b2b_pipelines RENAME COLUMN "Quote No." TO "Quote No";

-- 2. Rename column "Invoice No." to "Invoice No"
ALTER TABLE public.b2b_pipelines RENAME COLUMN "Invoice No." TO "Invoice No";

-- 3. Rename column "SO No." to "SO No"
ALTER TABLE public.b2b_pipelines RENAME COLUMN "SO No." TO "SO No";

-- 4. Verify columns in b2b_pipelines after rename
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'b2b_pipelines'
AND column_name IN ('Quote No', 'Quote No.', 'Invoice No', 'Invoice No.', 'SO No', 'SO No.');
