-- Bills: vendor bills (linked to PO) and inter-bills (utilities, NSSF, etc.)
CREATE TABLE IF NOT EXISTS bills (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number         TEXT        NOT NULL UNIQUE,
    bill_type           TEXT        NOT NULL DEFAULT 'inter',   -- 'vendor' | 'inter'
    vendor_name         TEXT,
    po_reference        TEXT,
    bill_date           DATE        NOT NULL,
    due_date            DATE,
    description         TEXT        NOT NULL DEFAULT '',
    status              TEXT        NOT NULL DEFAULT 'draft',   -- 'draft' | 'posted' | 'paid'
    total_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    journal_entry_id    UUID        REFERENCES journal_entries(id) ON DELETE SET NULL,
    payment_journal_id  UUID        REFERENCES journal_entries(id) ON DELETE SET NULL,
    payment_date        DATE,
    payment_method      TEXT,
    payment_reference   TEXT,
    notes               TEXT,
    created_by          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_lines (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id         UUID          NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    description     TEXT          DEFAULT '',
    account_number  TEXT          NOT NULL,
    qty             NUMERIC(10,3) NOT NULL DEFAULT 1,
    unit_price      NUMERIC(12,4) NOT NULL DEFAULT 0,
    amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Permissive RLS (matches existing tables)
ALTER TABLE bills       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_lines  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public bills"       ON bills       FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public bill_lines"  ON bill_lines  FOR ALL TO public USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_bills_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER bills_updated_at
    BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION update_bills_updated_at();
