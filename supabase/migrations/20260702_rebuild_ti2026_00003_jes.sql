-- Rebuild TI2026-00003 (PROXY SOLUTIONS) journal entries to the confirmed design.
--
-- History: 20260623_backfill_ti2026_00003_je.sql created JE-2039 (deposit) and
-- JE-2040 (invoice, with deposit-application lines and reduced VAT). The invoice
-- JE was then DELETED (~2026-06-24 — its number was reused by a bill JE), and
-- 20260623_fix_ti2026_00003_je_amounts.sql was never executed. Live state as of
-- 2026-07-02:
--   JE-2039: DR AR 41,773.60 / CR 25000 37,976.00 / CR 23000 3,797.60  ← wrong shape
--   Invoice JE: MISSING — $189,880 revenue + $18,988 VAT never booked.
--
-- Confirmed design (VAT declared once, in full, at invoice time):
--   Deposit JE:  DR Bank 11100  41,773.60 / CR 25000 41,773.60
--   Invoice JE:  DR AR 208,868 / CR 40700 189,880 / CR 23000 18,988
--   Final receipt (auto, on settlement): DR Bank 167,094.40 / DR 25000 41,773.60
--                                        / CR AR 208,868 → AR and 25000 both zero.

-- Sanctioned repair of posted lines — bypasses the immutability triggers
-- (20260702_harden_posted_je_immutability.sql) if they are already installed.
SET app.allow_je_repair = 'on';

-- ── 1. Fix JE-2039 (deposit receipt) ─────────────────────────────────────────
-- Deposit cash was received → debit Bank, not AR. Adjust the bank account below
-- if the transfer landed somewhere other than ABA 11100.
UPDATE journal_entry_lines
SET account_number = '11100',
    description    = 'Deposit received — TI2026-00003'
WHERE journal_entry_id = 'c65ef110-d478-4b3f-917c-b06e0bc6ecfe'
  AND account_number = '11900';

UPDATE journal_entry_lines
SET credit = 41773.60
WHERE journal_entry_id = 'c65ef110-d478-4b3f-917c-b06e0bc6ecfe'
  AND account_number = '25000';

DELETE FROM journal_entry_lines
WHERE journal_entry_id = 'c65ef110-d478-4b3f-917c-b06e0bc6ecfe'
  AND account_number = '23000';

-- ── 2. Recreate the invoice JE ───────────────────────────────────────────────
-- Full VAT, no deposit lines. source='invoice' + reference makes the app's
-- idempotency guard and the settling receipt recognise it.
DO $$
DECLARE
    v_next INTEGER;
    v_je   TEXT;
    v_id   UUID := gen_random_uuid();
BEGIN
    IF EXISTS (
        SELECT 1 FROM journal_entries
        WHERE source = 'invoice' AND reference = 'TI2026-00003'
    ) THEN
        RAISE NOTICE 'Invoice JE for TI2026-00003 already exists — skipping';
        RETURN;
    END IF;

    SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM 4) AS INTEGER)), 0) + 1
    INTO v_next FROM journal_entries
    WHERE entry_number ~ '^JE-\d+$';
    v_je := 'JE-' || LPAD(v_next::TEXT, 4, '0');

    INSERT INTO journal_entries
        (id, entry_number, entry_date, description, reference, created_by, is_posted, source)
    VALUES
        (v_id, v_je, '2026-06-15', 'Auto: Invoice TI2026-00003',
         'TI2026-00003', 'Kakada Eng', true, 'invoice');

    INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
        (v_id, '11900', 'AR — TI2026-00003',             208868.00,         0),
        (v_id, '40700', 'Revenue Lenovo — TI2026-00003',         0, 189880.00),
        (v_id, '23000', 'VAT Output — TI2026-00003',             0,  18988.00);
END $$;

-- Verification:
-- SELECT je.entry_number, l.account_number, l.debit, l.credit
-- FROM journal_entries je JOIN journal_entry_lines l ON l.journal_entry_id = je.id
-- WHERE je.reference = 'TI2026-00003' ORDER BY je.entry_number, l.debit DESC;
--
-- Note: COGS for the Lenovo units is still unbooked. After this runs, use the
-- "Backfill COGS" action in the Accounting dashboard — it detects invoice JEs
-- without 5xxxx lines and drafts the COGS entry from inventory costs.
