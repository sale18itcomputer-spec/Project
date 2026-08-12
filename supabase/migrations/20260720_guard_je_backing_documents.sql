-- Guard: journal entries that back a sales/purchase document must not be
-- casually deleted, so the document can never silently lose its GL record.
--
-- Companion to 20260720_guard_bill_je_deletion.sql (which guards BILLS via
-- their FK link). Invoices, receipts, deposit receipts and purchase orders
-- have NO journal_entry_id FK column — they link to their entry only by
-- journal_entries.reference + source. The posted-JE immutability triggers
-- (20260702) already block deleting a *posted* entry's lines, but the drift
-- still happens via "unpost the entry, then delete it": the document keeps
-- showing Completed/Issued while its revenue/COGS/AP vanishes from the ledger
-- (this is how invoice 2026-00011 lost JE-2070 before it was re-posted).
--
-- These entries should be corrected by a reversing entry or by re-saving the
-- document (auto-post is idempotent) — never by deletion. This blocks deletion
-- of any entry whose source is a document-backing source, regardless of posted
-- state. Deliberate DB repairs bypass it for the session with
--     SET app.allow_je_repair = 'on';
-- (same convention as the immutability triggers; PostgREST clients can't set it).
--
-- Not covered here (intentionally): 'manual', 'recurring', 'reclassification',
-- 'cogs_backfill' — user/adjustment entries that are meant to be editable; and
-- 'cheque_deposit', already protected by the cheque_deposit_marks FK.

CREATE OR REPLACE FUNCTION prevent_delete_je_backing_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('app.allow_je_repair', true) = 'on' THEN
        RETURN OLD;
    END IF;

    IF OLD.source IN ('invoice', 'receipt', 'deposit_receipt', 'purchase_order') THEN
        RAISE EXCEPTION
            'Cannot delete journal entry % (source: %, ref: %) — it backs a sales/purchase document. Reverse it with a correcting entry or re-save the document instead of deleting its ledger record.',
            OLD.entry_number, OLD.source, OLD.reference;
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_je_backing_document ON journal_entries;
CREATE TRIGGER trg_prevent_delete_je_backing_document
    BEFORE DELETE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION prevent_delete_je_backing_document();
