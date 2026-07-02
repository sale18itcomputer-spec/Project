-- Reconcile June 2026 to the QuickBooks reference (LPT by Month.xlsx).
--
-- Context: TI2026-00003 (PROXY SOLUTIONS) is a customer PRE-ORDER with a deposit.
-- The Lenovo stock (PO-2026-007) is not received until 2026-09-01, so the SALE is
-- NOT recognised yet — QuickBooks carries only the deposit as a liability.
--
-- Earlier on 2026-07-02, 20260702_rebuild_ti2026_00003_jes.sql (plus manual COGS
-- and PO backfills) over-recognised the whole deal, throwing June out of line with
-- QuickBooks by ~$189,880 revenue / ~$155,463 COGS / AR / AP / VAT / deposit.
--
-- This migration reverses that over-recognition and restores the deposit to the
-- QuickBooks shape. After it runs, June ties to QuickBooks on every statement
-- total (Total Assets 111,825.84, Net Income YTD 28,023.56, June NI -4,535.65).
--
-- The live database was already corrected via service-role script on 2026-07-02;
-- this file exists so a from-scratch migration replay ends in the same state.

SET app.allow_je_repair = 'on';  -- bypass posted-JE immutability triggers

-- 1. Remove the erroneous recognition JEs (invoice, COGS, PO purchases, deposit apply).
DELETE FROM journal_entry_lines
WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE entry_number IN
    ('JE-2059','JE-2060','JE-2061','JE-2062','JE-2063'));
DELETE FROM journal_entries
WHERE entry_number IN ('JE-2059','JE-2060','JE-2061','JE-2062','JE-2063');

-- 2. Restore JE-2039 to the QuickBooks deposit shape:
--    DR 11300 (ABA Tax-LPT) 41,773.60 / CR 25000 (Customer Deposit, net) 37,976
--    / CR 23000 (VAT Output on deposit) 3,797.60  — the VAT is later cleared by
--    JE-2057 (accountant's June VAT settlement), leaving 23000 = 0 at 6/30.
DELETE FROM journal_entry_lines
WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE entry_number = 'JE-2039');
INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit)
SELECT id, v.account_number, v.description, v.debit, v.credit
FROM journal_entries je,
     (VALUES
        ('11300', 'Deposit received — TI2026-00003',        41773.60, 0.00),
        ('25000', 'Customer Deposit (net) — TI2026-00003',   0.00, 37976.00),
        ('23000', 'VAT Output (deposit) — TI2026-00003',     0.00,  3797.60)
     ) AS v(account_number, description, debit, credit)
WHERE je.entry_number = 'JE-2039';

-- 3. Reclassify June accessory sales to match QuickBooks (total-preserving —
--    moves lines between sibling brand accounts within Income / COGS only).
--    Invoice 2026-00005 (JE-2055) and POS mouse sale (JE-0023, POS-2026-0002)
--    are accessories: ASUS -> 40400/50400, MSI -> 40500/50500.
UPDATE journal_entry_lines l SET account_number = '40400'
  FROM journal_entries je WHERE l.journal_entry_id = je.id
   AND je.entry_number IN ('JE-2055','JE-0023') AND l.account_number = '40100';
UPDATE journal_entry_lines l SET account_number = '50400'
  FROM journal_entries je WHERE l.journal_entry_id = je.id
   AND je.entry_number IN ('JE-2055','JE-0023') AND l.account_number = '50100';
UPDATE journal_entry_lines l SET account_number = '40500'
  FROM journal_entries je WHERE l.journal_entry_id = je.id
   AND je.entry_number = 'JE-2055' AND l.account_number = '40300';
UPDATE journal_entry_lines l SET account_number = '50500'
  FROM journal_entries je WHERE l.journal_entry_id = je.id
   AND je.entry_number = 'JE-2055' AND l.account_number = '50300';

-- Verify balanced: SELECT je.entry_number, SUM(l.debit)-SUM(l.credit)
-- FROM journal_entries je JOIN journal_entry_lines l ON l.journal_entry_id=je.id
-- WHERE je.is_posted GROUP BY je.entry_number HAVING ABS(SUM(l.debit)-SUM(l.credit))>0.001;
