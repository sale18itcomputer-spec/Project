-- Supporting tables for the new Accounting tabs:
--   • Recurring — reusable journal-entry templates
--   • Bank Reconciliation — per-line "cleared" marks (kept in a side table so we
--     never UPDATE posted journal_entry_lines and thus never touch the posted-JE
--     immutability triggers).
-- Trial Balance needs no schema (pure computation over posted entries).

-- ── Recurring journal-entry templates ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_journal_entries (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    description         text,
    frequency           text NOT NULL DEFAULT 'monthly',  -- weekly | monthly | quarterly | yearly
    is_active           boolean NOT NULL DEFAULT true,
    lines               jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{account_number, description, debit, credit}]
    last_generated_date date,
    created_by          text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recurring_journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON recurring_journal_entries;
CREATE POLICY "Allow all" ON recurring_journal_entries FOR ALL TO public USING (true) WITH CHECK (true);

-- ── Bank reconciliation marks ────────────────────────────────────────────────
-- One row per cleared journal_entry_line. Presence = reconciled; absence = open.
CREATE TABLE IF NOT EXISTS bank_rec_marks (
    line_id        uuid PRIMARY KEY REFERENCES journal_entry_lines(id) ON DELETE CASCADE,
    reconciled_at  timestamptz NOT NULL DEFAULT now(),
    reconciled_by  text
);
ALTER TABLE bank_rec_marks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON bank_rec_marks;
CREATE POLICY "Allow all" ON bank_rec_marks FOR ALL TO public USING (true) WITH CHECK (true);
