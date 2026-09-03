-- 20260903_receipt_display_rv_no.sql
--
-- Print-only receipt number override.
--
-- `RV No` stays the internal identity + journal-entry idempotency key (never
-- editable). `display_rv_no` is an OPTIONAL presentation override: when set, the
-- receipt PDF shows it instead of RV No; when NULL/blank, the PDF falls back to
-- the real RV No. It carries no accounting meaning — reports, AR, and the JE all
-- continue to use RV No — so editing it is a pure content change.

ALTER TABLE receipts     ADD COLUMN IF NOT EXISTS display_rv_no text;

DO $$
BEGIN
    IF to_regclass('b2b_receipts') IS NOT NULL THEN
        ALTER TABLE b2b_receipts ADD COLUMN IF NOT EXISTS display_rv_no text;
    END IF;
END $$;
