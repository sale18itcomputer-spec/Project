-- Fix JE-2039 and JE-2040 for TI2026-00003
--
-- Correct design:
--   JE-2039 (deposit_receipt): DR AR $41,773.60 | CR COA 25000 $41,773.60
--   COA 25000 carries $41,773.60 liability until final payment clears it.
--
--   JE-2040 (invoice): DR AR $208,868 | CR Revenue $189,880 | CR VAT $18,988
--   NO COA 25000 lines in the invoice JE.

-- ── JE-2039: Fix deposit receipt ─────────────────────────────────────────────
-- Deposit was already received in cash → debit Bank (11100), NOT AR (11900).
-- COA 25000 holds the full VAT-inclusive deposit as liability.

-- Change debit from AR 11900 → Bank 11100, update description
UPDATE journal_entry_lines
SET account_number = '11100',
    description    = 'Deposit received — TI2026-00003',
    debit          = 41773.60
WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE entry_number = 'JE-2039')
  AND account_number = '11900';

-- Update COA 25000 credit: $37,976 → $41,773.60
UPDATE journal_entry_lines
SET credit = 41773.60
WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE entry_number = 'JE-2039')
  AND account_number = '25000';

-- Remove the incorrectly-added VAT Output split line from JE-2039
DELETE FROM journal_entry_lines
WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE entry_number = 'JE-2039')
  AND account_number = '23000';

-- ── JE-2040: Remove deposit application lines, restore full VAT ──────────────

-- Remove the COA 25000 "Deposit Applied" line
DELETE FROM journal_entry_lines
WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE entry_number = 'JE-2040')
  AND account_number = '25000';

-- Remove the "Deposit offset AR" credit line (11900 credit $41,773.60)
DELETE FROM journal_entry_lines
WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE entry_number = 'JE-2040')
  AND account_number = '11900'
  AND credit > 0;

-- Restore full VAT Output: $15,190.40 → $18,988.00
UPDATE journal_entry_lines
SET credit = 18988.00
WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE entry_number = 'JE-2040')
  AND account_number = '23000';
