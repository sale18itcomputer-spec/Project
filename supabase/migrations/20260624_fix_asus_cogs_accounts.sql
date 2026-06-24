-- Fix inventory rows where brand = 'ASUS' (or encoding variants) but
-- cogs_account / inventory_account were set to the Other Accessories accounts.
--
-- Root cause: inventory rows seeded or manually edited with cogs_account='50600'
-- (Other Accessories) instead of '50100' (ASUS COGS).  The auto-post logic
-- used cogs_account as first priority, so ASUS items posted to the wrong account.
--
-- Fix: clear the stale overrides so the brand-based lookup in BRAND_ACCOUNT_MAP
-- takes over (ASUS → 50100 / 12100).

UPDATE inventory
SET
    cogs_account      = NULL,
    inventory_account = NULL
WHERE
    -- Any brand value that normalises to ASUS (covers encoding variants like ÀSUS)
    unaccent(brand) ILIKE 'ASUS'
    AND (cogs_account = '50600' OR inventory_account = '12600');

-- Also correct the already-posted JE-2040 lines directly.
-- Account 50600 (Other Accessories COGS) → 50100 (ASUS COGS)
UPDATE journal_entry_lines
SET account_number = '50100'
WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE entry_number = 'JE-2040')
  AND account_number = '50600';

-- Account 12600 (Other Accessories Inventory) → 12100 (ASUS Inventory)
UPDATE journal_entry_lines
SET account_number = '12100'
WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE entry_number = 'JE-2040')
  AND account_number = '12600';
