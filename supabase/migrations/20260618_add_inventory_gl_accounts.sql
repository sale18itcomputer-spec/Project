-- NOTE: This file adds columns. The reclassification entry for TI2026-00003 is run separately via SQL Editor.
-- Add GL account columns to inventory so each item carries its own chart-of-account
-- mapping. This replaces the hardcoded BRAND_ACCOUNT_MAP inference in application code.
--
-- Priority at journal-posting time:
--   1. inventory.cogs_account / revenue_account / inventory_account (this column)
--   2. BRAND_ACCOUNT_MAP[brand] (backward-compat fallback for rows with no GL column)
--   3. Generic parent account (50000 / 40000 / 12000)

ALTER TABLE inventory
    ADD COLUMN IF NOT EXISTS revenue_account   TEXT,
    ADD COLUMN IF NOT EXISTS cogs_account      TEXT,
    ADD COLUMN IF NOT EXISTS inventory_account TEXT;

-- Backfill existing rows from the brand column using the same mapping as BRAND_ACCOUNT_MAP
UPDATE inventory
SET
    revenue_account = CASE
        WHEN brand ILIKE 'ASUS'                  THEN '40100'
        WHEN brand ILIKE 'DELL'                  THEN '40200'
        WHEN brand ILIKE 'MSI'                   THEN '40300'
        WHEN brand ILIKE 'Asus Acc. & PW Supply' THEN '40400'
        WHEN brand ILIKE 'MSI Acc. & PW Supply'  THEN '40500'
        WHEN brand ILIKE 'Lenovo Accessories'    THEN '40800'
        WHEN brand ILIKE 'Lenovo'                THEN '40700'
        ELSE '40600'
    END,
    cogs_account = CASE
        WHEN brand ILIKE 'ASUS'                  THEN '50100'
        WHEN brand ILIKE 'DELL'                  THEN '50200'
        WHEN brand ILIKE 'MSI'                   THEN '50300'
        WHEN brand ILIKE 'Asus Acc. & PW Supply' THEN '50400'
        WHEN brand ILIKE 'MSI Acc. & PW Supply'  THEN '50500'
        WHEN brand ILIKE 'Lenovo Accessories'    THEN '50800'
        WHEN brand ILIKE 'Lenovo'                THEN '50700'
        ELSE '50600'
    END,
    inventory_account = CASE
        WHEN brand ILIKE 'ASUS'                  THEN '12100'
        WHEN brand ILIKE 'DELL'                  THEN '12200'
        WHEN brand ILIKE 'MSI'                   THEN '12300'
        WHEN brand ILIKE 'Asus Acc. & PW Supply' THEN '12400'
        WHEN brand ILIKE 'MSI Acc. & PW Supply'  THEN '12500'
        WHEN brand ILIKE 'Lenovo Accessories'    THEN '12800'
        WHEN brand ILIKE 'Lenovo'                THEN '12700'
        ELSE '12600'
    END
WHERE revenue_account IS NULL;
