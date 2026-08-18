-- Marks a FINAL invoice (issued from a deposit/pre-order invoice) so its PDF
-- renders the deposit-deducted footer: Sub Total → Deposit (net, %) → Total Less
-- Deposit → VAT (10% of the remainder) → Grand Total = balance due. Holds the
-- source deposit invoice's number. A plain deposit invoice (no value here) keeps
-- the "charge the deposit now" footer.
ALTER TABLE invoices     ADD COLUMN IF NOT EXISTS finalized_from_deposit TEXT;
ALTER TABLE b2b_invoices ADD COLUMN IF NOT EXISTS finalized_from_deposit TEXT;

COMMENT ON COLUMN invoices.finalized_from_deposit     IS 'If set, this is the final invoice for the named deposit invoice; PDF shows deposit deducted + VAT on the remainder.';
COMMENT ON COLUMN b2b_invoices.finalized_from_deposit IS 'If set, this is the final invoice for the named deposit invoice; PDF shows deposit deducted + VAT on the remainder.';
