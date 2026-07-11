-- JE-2059 was labeled reference='INV2026-00002' but its actual lines (DR AR
-- $1,230 / CR Revenue ASUS $1,230 / DR COGS ASUS $1,200 / CR Inventory ASUS
-- $1,200) match invoice 2026-00009 (BMSC, same date 2026-07-03, same $1,230
-- amount, same ASUS item SNB01304) exactly. Because autoPostInvoiceJournal's
-- idempotency check only matched on reference+source, this mislabeling
-- silently blocked INV2026-00002's real $33,600 sale from ever getting a JE
-- when it was marked Completed — see services/accountingApi.ts hardening in
-- the same commit, which now verifies AR totals match before treating a
-- reference match as "already posted".

SET app.allow_je_repair = 'on';  -- sanctioned bypass of the immutability trigger

UPDATE journal_entries
SET reference = '2026-00009'
WHERE entry_number = 'JE-2059'
  AND reference = 'INV2026-00002';

-- Verify: SELECT entry_number, reference, source FROM journal_entries WHERE entry_number = 'JE-2059';
-- Should show reference = '2026-00009'.
