-- Deposit / pre-order invoices: when the goods arrive, a SEPARATE final invoice
-- is issued (new number) that carries the whole sale and applies the deposit.
-- The original deposit invoice stays visible AS-IS but must drop out of open A/R
-- (otherwise the balance shows on both documents). This column, set to the final
-- invoice's number, is the signal computeInvoiceAR uses to exclude it.
ALTER TABLE invoices     ADD COLUMN IF NOT EXISTS deposit_finalized_by TEXT;
ALTER TABLE b2b_invoices ADD COLUMN IF NOT EXISTS deposit_finalized_by TEXT;

COMMENT ON COLUMN invoices.deposit_finalized_by     IS 'If set, this deposit/pre-order invoice was converted into the named final invoice; excluded from open A/R.';
COMMENT ON COLUMN b2b_invoices.deposit_finalized_by IS 'If set, this deposit/pre-order invoice was converted into the named final invoice; excluded from open A/R.';
