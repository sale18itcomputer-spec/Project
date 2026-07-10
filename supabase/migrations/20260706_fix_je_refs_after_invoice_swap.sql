-- Complete the TI2026-00003 (PROXY) <-> TI2026-00002 (IT Solution Digital)
-- invoice-number swap requested by Jea.
--
-- b2b_invoices, b2b_receipts, and b2b_delivery_orders were already swapped via
-- a service-role script. Only the posted journal_entries.reference fields
-- remain — blocked by the posted-JE immutability trigger added in
-- 20260702_harden_posted_je_immutability.sql (working as intended: it
-- correctly refused an unsanctioned reference change on a posted entry).
--
-- After this runs:
--   TI2026-00003 = IT Solution Digital Co., LTD. ($511, NON-VAT/NON-VAT)
--   TI2026-00002 = PROXY SOLUTIONS CO., LTD. ($208,868, VAT/VAT, deposit intact)
--   JE-2039 (deposit_receipt)            -> reference TI2026-00002 (PROXY)
--   JE-0008, JE-0022, JE-2026-0003       -> reference TI2026-00003 (IT Solution Digital)

SET app.allow_je_repair = 'on';  -- sanctioned bypass of the immutability trigger

UPDATE journal_entries SET reference = 'TI2026-00002' WHERE entry_number = 'JE-2039';
UPDATE journal_entries SET reference = 'TI2026-00003' WHERE entry_number IN ('JE-0008', 'JE-0022', 'JE-2026-0003');

-- Verify: SELECT entry_number, reference, source FROM journal_entries
-- WHERE entry_number IN ('JE-2039','JE-0008','JE-0022','JE-2026-0003');
