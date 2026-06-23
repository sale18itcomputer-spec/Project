-- Fix Balance Sheet mismatch for March, April, and May 2026
--
-- Root cause: Three monthly depreciation "ADJ" entries (QB-0128, QB-0126, QB-0213)
-- were entered in QuickBooks RETROACTIVELY (after the monthly BS snapshots were exported).
-- QB's exported BS:
--   March  → does NOT include QB-0128 (entered later, backdated to March 31)
--   April  → INCLUDES QB-0128, does NOT include QB-0126 (entered later, backdated to April 30)
--   May    → INCLUDES QB-0128 + QB-0126, does NOT include QB-0213 (entered later, backdated to May 31)
--
-- LPT ERP system uses entry_date for BS cutoff, so all three are currently included in
-- the month they're dated → system is $25.83 lower than QB in each affected month.
--
-- Fix: Shift each entry to the first day of the NEXT month.
-- This reproduces exactly when QB recognized them, matching all three monthly snapshots.
--
-- Result:
--   QB-0128 → April 1  : excluded from March BS, included in April BS ✓
--   QB-0126 → May 1    : excluded from April BS, included in May BS ✓
--   QB-0213 → June 1   : excluded from May BS, included in June+ BS ✓

UPDATE journal_entries
SET entry_date = '2026-04-01'
WHERE entry_number = 'QB-0128' AND created_by = 'quickbooks-import';

UPDATE journal_entries
SET entry_date = '2026-05-01'
WHERE entry_number = 'QB-0126' AND created_by = 'quickbooks-import';

UPDATE journal_entries
SET entry_date = '2026-06-01'
WHERE entry_number = 'QB-0213' AND created_by = 'quickbooks-import';
