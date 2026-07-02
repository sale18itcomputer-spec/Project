-- Repair receipt JEs that split VAT out of the AR credit.
--
-- Design (per 20260623_fix_ti2026_00003_je_amounts.sql): VAT Output 23000 is
-- declared once, in full, by the INVOICE journal entry. Receipt JEs must credit
-- AR gross. The VAT split briefly added to autoPostReceiptJournal (2026-07-01)
-- double-declared VAT and left AR with a permanent residual.
--
-- Only JE-2056-FIX (OR2026-00003) was created during that window — verified
-- 2026-07-02 against journal_entries source='receipt'. This repair is written
-- set-based anyway so it also catches any receipt JE created before deploy.

-- 1. Fold each receipt JE's VAT credit back into its AR (11900) credit line.
UPDATE journal_entry_lines ar
SET credit = ROUND((ar.credit + vat.credit)::numeric, 2)
FROM journal_entry_lines vat
JOIN journal_entries je ON je.id = vat.journal_entry_id AND je.source = 'receipt'
WHERE ar.journal_entry_id = vat.journal_entry_id
  AND ar.account_number  = '11900'
  AND vat.account_number = '23000';

-- 2. Remove the VAT lines from receipt JEs.
DELETE FROM journal_entry_lines vat
USING journal_entries je
WHERE je.id = vat.journal_entry_id
  AND je.source = 'receipt'
  AND vat.account_number = '23000';

-- Verification: every receipt JE should now have debits = credits and no 23000 line.
-- SELECT je.entry_number, SUM(l.debit) AS dr, SUM(l.credit) AS cr
-- FROM journal_entries je JOIN journal_entry_lines l ON l.journal_entry_id = je.id
-- WHERE je.source = 'receipt'
-- GROUP BY je.entry_number
-- HAVING ABS(SUM(l.debit) - SUM(l.credit)) > 0.001;
