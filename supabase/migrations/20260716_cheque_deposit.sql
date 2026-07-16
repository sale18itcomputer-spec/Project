-- Deposit Cheque feature: sweep undeposited-cheque debits (account 11800) into
-- a real bank account with one JE, without ever UPDATEing the original posted
-- journal_entry_lines (same reasoning as bank_rec_marks — posted-JE immutability
-- triggers must never be touched). Presence of a mark = already deposited.
CREATE TABLE IF NOT EXISTS cheque_deposit_marks (
    line_id       uuid PRIMARY KEY REFERENCES journal_entry_lines(id) ON DELETE CASCADE,
    deposit_je_id uuid NOT NULL REFERENCES journal_entries(id),
    deposited_at  timestamptz NOT NULL DEFAULT now(),
    deposited_by  text
);
ALTER TABLE cheque_deposit_marks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON cheque_deposit_marks;
CREATE POLICY "Allow all" ON cheque_deposit_marks FOR ALL TO public USING (true) WITH CHECK (true);
