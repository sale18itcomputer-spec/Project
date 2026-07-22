-- Add a dedicated VAT TIN to companies, separate from the existing Patent Number.
-- Nullable text column: fully backward-compatible (existing rows get NULL, and
-- the app only sends this key once the field is populated). The B2B mirror table
-- gets the same column so both modes behave identically.
--
-- Column is intentionally named "Tin No" (quoted, with a space) to match the
-- existing header/column convention (e.g. "Company Name", "Patent") that the
-- app writes directly via PostgREST. Documents already read
-- company['Tin No'] || company['Patent'], so invoices/receipts/DOs pick it up
-- automatically once populated.

ALTER TABLE companies     ADD COLUMN IF NOT EXISTS "Tin No" text;
ALTER TABLE b2b_companies ADD COLUMN IF NOT EXISTS "Tin No" text;
