-- ============================================================
-- Align historical data to the new gross-cost COGS policy:
--   Purchase discount (70200) is recorded separately from COGS.
--   Inventory and COGS are always at the GROSS vendor price.
--
-- Fix 1: inventory.unit_price for SNB01367 (ASUS S3407CA-LY071W)
--         $833 (net after $800 cashback)  →  $873 (gross: $17,460 ÷ 20 units)
--
-- Fix 2: cogs_backfill JE for invoice 2026-00004
--         $16,660 (net COGS)  →  $17,460 (gross COGS)
--         After this fix 12100 Inventory ASUS balance = DR $17,460 − CR $17,460 = $0 ✓
--
-- Run once in Supabase SQL Editor.
-- ============================================================

-- ── Fix 1: Inventory unit cost ────────────────────────────────────────────────
UPDATE inventory
SET    unit_price = 873
WHERE  code = 'SNB01367';

-- Verify
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM inventory WHERE code = 'SNB01367' AND unit_price = 873) THEN
        RAISE WARNING 'SNB01367 not found or unit_price not updated — check the code value.';
    ELSE
        RAISE NOTICE 'inventory SNB01367 unit_price → $873 ✓';
    END IF;
END;
$$;


-- ── Fix 2: COGS backfill JE for 2026-00004 ───────────────────────────────────
DO $$
DECLARE
    v_je_id UUID;
BEGIN
    SELECT id INTO v_je_id
    FROM   journal_entries
    WHERE  reference = '2026-00004'
      AND  source    = 'cogs_backfill'
    LIMIT 1;

    IF v_je_id IS NULL THEN
        RAISE NOTICE 'cogs_backfill JE for 2026-00004 not found — skipping.';
        RETURN;
    END IF;

    -- DR 50100 COGS ASUS: $16,660 → $17,460
    UPDATE journal_entry_lines
    SET    debit       = 17460,
           description = 'COGS ASUS — 2026-00004 (20× S3407CA-LY071W @ $873 gross)'
    WHERE  journal_entry_id = v_je_id
      AND  account_number   = '50100';

    -- CR 12100 Inventory ASUS: $16,660 → $17,460
    UPDATE journal_entry_lines
    SET    credit = 17460
    WHERE  journal_entry_id = v_je_id
      AND  account_number   = '12100';

    RAISE NOTICE 'cogs_backfill JE % updated — DR 50100 / CR 12100 now $17,460 ✓', v_je_id;
END;
$$;
