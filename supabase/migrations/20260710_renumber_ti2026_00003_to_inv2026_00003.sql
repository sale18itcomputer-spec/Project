-- IT Solution Digital Co., LTD.'s $511 invoice is Non-VAT and must not carry a
-- "TI" (VAT-sequence) number. The earlier invoice-number swap
-- (20260706_fix_je_refs_after_invoice_swap.sql) moved it from TI2026-00002 to
-- TI2026-00003 — still wrong, just a different VAT-sequence slot. Jea's
-- correction: it must run in the actual Non-VAT sequence (INV), not the TI one.
--
-- b2b_invoices and b2b_delivery_orders were already renumbered via
-- service-role script to INV2026-00003 (the correct next Non-VAT number — only
-- INV2026-00002 existed before this). Only the three posted
-- journal_entries.reference fields remain, blocked by the posted-JE
-- immutability trigger (20260702_harden_posted_je_immutability.sql).

SET app.allow_je_repair = 'on';  -- sanctioned bypass of the immutability trigger

UPDATE journal_entries
SET reference = 'INV2026-00003'
WHERE entry_number IN ('JE-0008', 'JE-0022', 'JE-2026-0003')
  AND reference = 'TI2026-00003';

-- Verify: SELECT entry_number, reference, source FROM journal_entries
-- WHERE entry_number IN ('JE-0008','JE-0022','JE-2026-0003');
