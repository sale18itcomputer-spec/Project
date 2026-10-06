-- One-off backfill: add the $0.00 lines for free / zero-cost items that were sold on
-- already-posted invoices, so their journals list every item that left stock.
--
-- RUN ORDER: apply 20261006_reprice_je_keep_zero_cost_lines.sql FIRST. Without it the
-- old reprice_invoice_je drops zero lines and this script would change nothing.
--
-- Each call only appends zero-amount lines (DR 0 / CR 0), so no balance moves:
-- AR, revenue, COGS and inventory totals are unchanged. reprice_invoice_je unposts,
-- rewrites and re-posts the invoice's own JE atomically and re-checks that it balances.
--
-- If any call fails with a locked-period error, stop and tell Ops: the month is closed
-- and needs a deliberate unlock (SET app.allow_locked_period = 'on') — do not add that
-- here by default.

BEGIN;

-- INV2026-00021 (B2C, 24 Sep): free mousepad, 6 units
SELECT reprice_invoice_je('INV2026-00021', '[
 {"account_number":"50600","description":"COGS Other Accessories — INV2026-00021 · SAC00003 ×6 @ $0.00 (no cost)","debit":0,"credit":0},
 {"account_number":"12600","description":"Inventory out Other Accessories — INV2026-00021 · SAC00003 ×6 @ $0.00 (no cost)","debit":0,"credit":0}
]'::jsonb);

-- INV2026-00002 (B2B, 3 Jul): Lenovo bag LAC00065 ×30
SELECT reprice_invoice_je('INV2026-00002', '[
 {"account_number":"50700","description":"COGS Lenovo — INV2026-00002 · LAC00065 ×30 @ $0.00 (no cost)","debit":0,"credit":0},
 {"account_number":"12700","description":"Inventory out Lenovo — INV2026-00002 · LAC00065 ×30 @ $0.00 (no cost)","debit":0,"credit":0}
]'::jsonb);

-- 2026-00010 (B2B, 13 Jul): LAC00065 ×1
SELECT reprice_invoice_je('2026-00010', '[
 {"account_number":"50700","description":"COGS Lenovo — 2026-00010 · LAC00065 ×1 @ $0.00 (no cost)","debit":0,"credit":0},
 {"account_number":"12700","description":"Inventory out Lenovo — 2026-00010 · LAC00065 ×1 @ $0.00 (no cost)","debit":0,"credit":0}
]'::jsonb);

-- 2026-00012 (B2B, 21 Jul): Lenovo case LAC00050 ×1
SELECT reprice_invoice_je('2026-00012', '[
 {"account_number":"50700","description":"COGS Lenovo — 2026-00012 · LAC00050 ×1 @ $0.00 (no cost)","debit":0,"credit":0},
 {"account_number":"12700","description":"Inventory out Lenovo — 2026-00012 · LAC00050 ×1 @ $0.00 (no cost)","debit":0,"credit":0}
]'::jsonb);

-- INV2026-00004 (B2B, 30 Jul): LAC00065 ×3
SELECT reprice_invoice_je('INV2026-00004', '[
 {"account_number":"50700","description":"COGS Lenovo — INV2026-00004 · LAC00065 ×3 @ $0.00 (no cost)","debit":0,"credit":0},
 {"account_number":"12700","description":"Inventory out Lenovo — INV2026-00004 · LAC00065 ×3 @ $0.00 (no cost)","debit":0,"credit":0}
]'::jsonb);

-- INV2026-00008 (B2B, 7 Aug): MSI mouse pad MAC00310 ×1
SELECT reprice_invoice_je('INV2026-00008', '[
 {"account_number":"50300","description":"COGS MSI — INV2026-00008 · MAC00310 ×1 @ $0.00 (no cost)","debit":0,"credit":0},
 {"account_number":"12300","description":"Inventory out MSI — INV2026-00008 · MAC00310 ×1 @ $0.00 (no cost)","debit":0,"credit":0}
]'::jsonb);

-- INV2026-00010 (B2B, 11 Aug): LAC00050 ×1
SELECT reprice_invoice_je('INV2026-00010', '[
 {"account_number":"50700","description":"COGS Lenovo — INV2026-00010 · LAC00050 ×1 @ $0.00 (no cost)","debit":0,"credit":0},
 {"account_number":"12700","description":"Inventory out Lenovo — INV2026-00010 · LAC00050 ×1 @ $0.00 (no cost)","debit":0,"credit":0}
]'::jsonb);

-- INV2026-00011 (B2B, 11 Aug): LAC00050 ×1
SELECT reprice_invoice_je('INV2026-00011', '[
 {"account_number":"50700","description":"COGS Lenovo — INV2026-00011 · LAC00050 ×1 @ $0.00 (no cost)","debit":0,"credit":0},
 {"account_number":"12700","description":"Inventory out Lenovo — INV2026-00011 · LAC00050 ×1 @ $0.00 (no cost)","debit":0,"credit":0}
]'::jsonb);

COMMIT;

-- Verify (expect 8 invoices x 2 zero lines, and every JE still posted and balanced):
-- SELECT je.reference, je.is_posted, SUM(l.debit) dr, SUM(l.credit) cr,
--        COUNT(*) FILTER (WHERE l.debit = 0 AND l.credit = 0) AS zero_lines
--   FROM journal_entries je JOIN journal_entry_lines l ON l.journal_entry_id = je.id
--  WHERE je.source = 'invoice'
--    AND je.reference IN ('INV2026-00021','INV2026-00002','2026-00010','2026-00012','INV2026-00004','INV2026-00008','INV2026-00010','INV2026-00011')
--  GROUP BY je.reference, je.is_posted ORDER BY 1;
