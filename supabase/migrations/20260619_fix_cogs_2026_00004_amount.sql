-- Fix COGS back-fill for 2026-00004: update $16,000 → $16,660
-- Correct net cost: 20× SNB01367 @ $833/unit (PO-2026-005 net after $800 cashback)

DO $$
DECLARE
    v_je_id UUID;
BEGIN
    SELECT id INTO v_je_id
    FROM journal_entries
    WHERE reference = '2026-00004' AND source = 'cogs_backfill'
    LIMIT 1;

    IF v_je_id IS NULL THEN
        RAISE NOTICE 'COGS back-fill JE for 2026-00004 not found — nothing to fix.';
        RETURN;
    END IF;

    -- Fix debit line (50100 COGS ASUS)
    UPDATE journal_entry_lines
    SET debit = 16660,
        description = 'COGS ASUS — 2026-00004 (20× S3407CA-LY071W @ $833 net)'
    WHERE journal_entry_id = v_je_id AND account_number = '50100';

    -- Fix credit line (12100 Inventory ASUS)
    UPDATE journal_entry_lines
    SET credit = 16660
    WHERE journal_entry_id = v_je_id AND account_number = '12100';

    RAISE NOTICE 'Updated JE lines for % — COGS now $16,660', v_je_id;
END;
$$;
