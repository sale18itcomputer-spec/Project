-- Credit memo application.
--
-- A credit memo is an invoice row with a negative Amount (e.g. 05SJ0000304, -$240 for eCam).
-- Its journal entry already credits AR, so applying it to another invoice moves no cash:
-- the application is recorded as a receipt with Payment Method = 'Credit Memo' and NO journal
-- entry. This column links that receipt back to the credit memo it consumed, so the memo's
-- remaining credit = |Amount| - SUM(applications) can be derived the same way AR is.
ALTER TABLE receipts     ADD COLUMN IF NOT EXISTS credit_memo_no text;
ALTER TABLE b2b_receipts ADD COLUMN IF NOT EXISTS credit_memo_no text;

CREATE INDEX IF NOT EXISTS receipts_credit_memo_no_idx     ON receipts (credit_memo_no)     WHERE credit_memo_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS b2b_receipts_credit_memo_no_idx ON b2b_receipts (credit_memo_no) WHERE credit_memo_no IS NOT NULL;
