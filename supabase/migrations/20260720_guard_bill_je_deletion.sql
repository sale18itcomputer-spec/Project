-- Guard: a posted/paid bill must never lose its journal entry.
--
-- bills.journal_entry_id and payment_journal_id are declared ON DELETE SET NULL
-- (20260618_create_bills.sql). That means deleting a journal entry a posted bill
-- depends on silently nulls the link and drops the bill's AP (and inventory)
-- from the GL — with nothing surfacing the drift. This is exactly how BILL-0010
-- and BILL-0011 ended up "posted" with no JE: they reused their PO's journal
-- entry, that JE was later deleted, and SET NULL orphaned them, understating
-- Accounts Payable by $2,614 until it was caught during a manual reconciliation.
--
-- This BEFORE DELETE trigger blocks the delete at its source, so the SET NULL
-- cascade can never fire for a posted/paid bill. Draft bills are unaffected
-- (they hold no GL balance, so losing a JE link is harmless). Covers both the
-- bill JE and the payment JE.

CREATE OR REPLACE FUNCTION prevent_delete_je_referenced_by_active_bill()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_bill TEXT;
BEGIN
    SELECT b.bill_number INTO v_bill
    FROM bills b
    WHERE (b.journal_entry_id = OLD.id AND b.status IN ('posted', 'paid'))
       OR (b.payment_journal_id = OLD.id AND b.status = 'paid')
    LIMIT 1;

    IF v_bill IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot delete journal entry % — it backs posted/paid bill %. Unpost that bill first so its AP is reversed before removing the entry.',
            OLD.entry_number, v_bill;
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_je_active_bill ON journal_entries;
CREATE TRIGGER trg_prevent_delete_je_active_bill
    BEFORE DELETE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION prevent_delete_je_referenced_by_active_bill();

-- Detection helper: posted/paid bills whose AP is genuinely absent from the GL.
-- A null journal_entry_id ALONE is not enough — some bills (e.g. QB-imported or
-- ones whose link was nulled while their entry survives) still have a journal
-- entry referencing them by bill_number, so their AP is booked and this must NOT
-- flag them. The real drift is a bill that NO journal entry references at all
-- (BILL-0010/0011 before repair). Used by the Bills tab to surface that, and
-- only that, instead of letting it hide.
CREATE OR REPLACE VIEW bills_missing_journal_entry AS
SELECT b.id, b.bill_number, b.status, b.total_amount, b.vendor_name, b.bill_date
FROM bills b
WHERE b.status IN ('posted', 'paid')
  AND b.journal_entry_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM journal_entries je WHERE je.reference = b.bill_number
  );
