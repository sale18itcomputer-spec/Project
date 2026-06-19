-- COGS back-fill for Invoice 2026-00004
-- Invoice: 20× ASUS S3407CA-LY071W (SNB01367) sold at $902 each = $18,040 revenue
-- PO-2026-005 net cost after $800 vendor cashback = $16,660 total ($833/unit)
-- DR COGS ASUS (50100) $16,660 / CR Inventory ASUS (12100) $16,660
--
-- Note: JE-0018 (PO-2026-005) recorded inventory at gross $17,460 (DR 12100).
-- After this COGS JE, 12100 will carry a $800 residual debit — this represents
-- the gross-vs-net difference already captured as Purchase Discount in 70200.
-- Reconcile with your accountant if needed.
--
-- Run once in Supabase SQL Editor.

DO $$
DECLARE
    v_entry_number TEXT;
    v_je_id        UUID;
    v_max          INT;
BEGIN
    -- Guard: skip if already exists
    IF EXISTS (
        SELECT 1 FROM journal_entries
        WHERE reference = '2026-00004' AND source = 'cogs_backfill'
    ) THEN
        RAISE NOTICE 'COGS back-fill for 2026-00004 already exists — skipping.';
        RETURN;
    END IF;

    -- Next JE number (same logic as getNextEntryNumber())
    SELECT COALESCE(
        MAX(CAST(REGEXP_REPLACE(entry_number, '[^0-9]', '', 'g') AS INT)),
        0
    ) INTO v_max
    FROM journal_entries
    WHERE entry_number ~ '^JE-';

    v_entry_number := 'JE-' || LPAD((v_max + 1)::TEXT, 4, '0');

    -- Insert journal entry header
    INSERT INTO journal_entries (
        entry_number, entry_date, description, reference,
        created_by, is_posted, source
    ) VALUES (
        v_entry_number,
        '2026-06-17',
        'COGS back-fill — 2026-00004',
        '2026-00004',
        'Jea',
        TRUE,
        'cogs_backfill'
    )
    RETURNING id INTO v_je_id;

    -- Insert lines: DR COGS ASUS / CR Inventory ASUS
    INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit)
    VALUES
        (v_je_id, '50100', 'COGS ASUS — 2026-00004 (20× S3407CA-LY071W @ $833 net)', 16660, 0),
        (v_je_id, '12100', 'Inventory out ASUS — 2026-00004',                          0,     16660);

    RAISE NOTICE 'Created % — COGS back-fill for 2026-00004: DR 50100 $16,660 / CR 12100 $16,660', v_entry_number;
END;
$$;
