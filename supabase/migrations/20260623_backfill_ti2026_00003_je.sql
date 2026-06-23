-- Backfill JEs for TI2026-00003 (already issued, no JEs exist)
-- Invoice: $208,868 | Deposit: $41,773.60 (VAT-incl) | Net deposit: $37,976 | VAT on deposit: $3,797.60
-- Revenue: Lenovo $189,880 | Full invoice VAT: $18,988 | Remaining invoice VAT: $15,190.40

DO $$
DECLARE
    v_next  INTEGER;
    v_je1   TEXT;
    v_je2   TEXT;
    v_id1   UUID := gen_random_uuid();
    v_id2   UUID := gen_random_uuid();
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM 4) AS INTEGER)), 0) + 1
    INTO v_next FROM journal_entries
    WHERE entry_number ~ '^JE-\d+$';

    v_je1 := 'JE-' || LPAD(v_next::TEXT, 4, '0');
    v_je2 := 'JE-' || LPAD((v_next + 1)::TEXT, 4, '0');

    -- ── JE 1: Deposit Receipt ─────────────────────────────────────────────────
    -- DR AR 11900 $41,773.60  |  CR COA 25000 $37,976  |  CR VAT 23000 $3,797.60
    INSERT INTO journal_entries
        (id, entry_number, entry_date, description, reference, created_by, is_posted, source)
    VALUES
        (v_id1, v_je1, '2026-06-15', 'Deposit Receipt — TI2026-00003',
         'TI2026-00003', 'Kakada Eng', true, 'deposit_receipt');

    INSERT INTO journal_entry_lines (id, journal_entry_id, account_number, description, debit, credit) VALUES
        (gen_random_uuid(), v_id1, '11900', 'Deposit AR — TI2026-00003',           41773.60,    0),
        (gen_random_uuid(), v_id1, '25000', 'Customer Deposit — TI2026-00003',          0, 37976.00),
        (gen_random_uuid(), v_id1, '23000', 'VAT Output (Deposit) — TI2026-00003',      0,  3797.60);

    -- ── JE 2: Invoice + Deposit Application ──────────────────────────────────
    -- DR AR 11900 $208,868  |  CR Revenue (Lenovo) 40700 $189,880
    -- CR VAT 23000 $15,190.40  (full $18,988 minus deposit VAT $3,797.60 already declared)
    -- DR COA 25000 $37,976  |  CR AR 11900 $41,773.60  (deposit applied)
    -- Balance: DR $208,868 + $37,976 = $246,844  |  CR $189,880 + $15,190.40 + $41,773.60 = $246,844 ✓
    INSERT INTO journal_entries
        (id, entry_number, entry_date, description, reference, created_by, is_posted, source)
    VALUES
        (v_id2, v_je2, '2026-06-15', 'Auto: Invoice TI2026-00003',
         'TI2026-00003', 'Kakada Eng', true, 'invoice');

    INSERT INTO journal_entry_lines (id, journal_entry_id, account_number, description, debit, credit) VALUES
        (gen_random_uuid(), v_id2, '11900', 'AR — TI2026-00003',                  208868.00,        0),
        (gen_random_uuid(), v_id2, '40700', 'Revenue Lenovo — TI2026-00003',             0, 189880.00),
        (gen_random_uuid(), v_id2, '23000', 'VAT Output — TI2026-00003',                 0,  15190.40),
        (gen_random_uuid(), v_id2, '25000', 'Deposit Applied — TI2026-00003',      37976.00,        0),
        (gen_random_uuid(), v_id2, '11900', 'Deposit offset AR — TI2026-00003',           0,  41773.60);

END $$;
