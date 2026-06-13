-- ==============================================================================
-- MIGRATION: Reform Pipeline Module
-- ==============================================================================
-- Adds new columns, renames fields, migrates statuses, and drops obsolete columns
-- for both pipelines (B2C) and b2b_pipelines (B2B) tables.
-- ==============================================================================

-- ── 1. ADD NEW COLUMNS ─────────────────────────────────────────────────────────

-- pipelines (B2C)
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS "Win Rate" numeric DEFAULT NULL;
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS "Ref Inquiry No" text DEFAULT NULL;

-- b2b_pipelines (B2B)
ALTER TABLE public.b2b_pipelines ADD COLUMN IF NOT EXISTS "Win Rate" numeric DEFAULT NULL;
ALTER TABLE public.b2b_pipelines ADD COLUMN IF NOT EXISTS "Ref Inquiry No" text DEFAULT NULL;

-- ── 2. RENAME COLUMNS ──────────────────────────────────────────────────────────

-- Rename "Require" → "Requirements" (pipelines)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pipelines' AND column_name='Require') THEN
    ALTER TABLE public.pipelines RENAME COLUMN "Require" TO "Requirements";
  END IF;
END $$;

-- Rename "Require" → "Requirements" (b2b_pipelines)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='b2b_pipelines' AND column_name='Require') THEN
    ALTER TABLE public.b2b_pipelines RENAME COLUMN "Require" TO "Requirements";
  END IF;
END $$;

-- Rename "Bid Value" → "Total Amount" (pipelines)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pipelines' AND column_name='Bid Value') THEN
    ALTER TABLE public.pipelines RENAME COLUMN "Bid Value" TO "Total Amount";
  END IF;
END $$;

-- Rename "Bid Value" → "Total Amount" (b2b_pipelines)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='b2b_pipelines' AND column_name='Bid Value') THEN
    ALTER TABLE public.b2b_pipelines RENAME COLUMN "Bid Value" TO "Total Amount";
  END IF;
END $$;

-- ── 3. MIGRATE STATUSES ────────────────────────────────────────────────────────

-- pipelines (B2C)
UPDATE public.pipelines SET "Status" = 'New Deal'               WHERE "Status" = 'Qualification';
UPDATE public.pipelines SET "Status" = 'Proposal Submission'    WHERE "Status" IN ('Presentation', 'Quote Submitted');
UPDATE public.pipelines SET "Status" = 'Negotiation | Revision' WHERE "Status" IN ('Revising Specs', 'Bid Evaluation');
UPDATE public.pipelines SET "Status" = 'Contract | PO'          WHERE "Status" IN ('Pass Evaluation', 'Pending PO');
UPDATE public.pipelines SET "Status" = 'Order Processing'       WHERE "Status" = 'Ordering';
UPDATE public.pipelines SET "Status" = 'Closure (Win)'          WHERE "Status" = 'Close (win)';
UPDATE public.pipelines SET "Status" = 'Closure (Lose)'         WHERE "Status" = 'Close (lose)';
-- 'Price Request' stays as-is (same name in both old and new)

-- b2b_pipelines (B2B)
UPDATE public.b2b_pipelines SET "Status" = 'New Deal'               WHERE "Status" = 'Qualification';
UPDATE public.b2b_pipelines SET "Status" = 'Proposal Submission'    WHERE "Status" IN ('Presentation', 'Quote Submitted');
UPDATE public.b2b_pipelines SET "Status" = 'Negotiation | Revision' WHERE "Status" IN ('Revising Specs', 'Bid Evaluation');
UPDATE public.b2b_pipelines SET "Status" = 'Contract | PO'          WHERE "Status" IN ('Pass Evaluation', 'Pending PO');
UPDATE public.b2b_pipelines SET "Status" = 'Order Processing'       WHERE "Status" = 'Ordering';
UPDATE public.b2b_pipelines SET "Status" = 'Closure (Win)'          WHERE "Status" = 'Close (win)';
UPDATE public.b2b_pipelines SET "Status" = 'Closure (Lose)'         WHERE "Status" = 'Close (lose)';

-- ── 4. DROP OBSOLETE COLUMNS ───────────────────────────────────────────────────

-- pipelines (B2C)
ALTER TABLE public.pipelines DROP COLUMN IF EXISTS "Brand 1";
ALTER TABLE public.pipelines DROP COLUMN IF EXISTS "Conditional";
ALTER TABLE public.pipelines DROP COLUMN IF EXISTS "Quote";
ALTER TABLE public.pipelines DROP COLUMN IF EXISTS "Inv Date";
ALTER TABLE public.pipelines DROP COLUMN IF EXISTS "Type";

-- b2b_pipelines (B2B)
ALTER TABLE public.b2b_pipelines DROP COLUMN IF EXISTS "Brand 1";
ALTER TABLE public.b2b_pipelines DROP COLUMN IF EXISTS "Conditional";
ALTER TABLE public.b2b_pipelines DROP COLUMN IF EXISTS "Quote";
ALTER TABLE public.b2b_pipelines DROP COLUMN IF EXISTS "Inv Date";
ALTER TABLE public.b2b_pipelines DROP COLUMN IF EXISTS "Type";

-- ── 5. VERIFY ──────────────────────────────────────────────────────────────────

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pipelines'
ORDER BY ordinal_position;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'b2b_pipelines'
ORDER BY ordinal_position;
