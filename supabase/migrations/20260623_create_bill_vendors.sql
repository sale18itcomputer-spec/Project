-- Accounting: Bill Vendors directory for Inter-Bill (Utility / NSSF) entries
-- Separate from procurement `vendors` table — these are payees on utility/tax/gov bills.

CREATE TABLE IF NOT EXISTS bill_vendors (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name             TEXT        NOT NULL,
    vendor_type             TEXT        NOT NULL DEFAULT 'Other',
    contact_person          TEXT        NOT NULL DEFAULT '',
    phone                   TEXT        NOT NULL DEFAULT '',
    email                   TEXT        NOT NULL DEFAULT '',
    address                 TEXT        NOT NULL DEFAULT '',
    tax_id                  TEXT        NOT NULL DEFAULT '',
    account_number          TEXT        NOT NULL DEFAULT '',
    payment_terms           TEXT        NOT NULL DEFAULT 'Due on Receipt',
    default_expense_account TEXT        NOT NULL DEFAULT '',
    bank_name               TEXT        NOT NULL DEFAULT '',
    bank_account            TEXT        NOT NULL DEFAULT '',
    notes                   TEXT        NOT NULL DEFAULT '',
    status                  TEXT        NOT NULL DEFAULT 'Active',
    created_by              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bill_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill_vendors_public" ON bill_vendors FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TRIGGER bill_vendors_updated_at
    BEFORE UPDATE ON bill_vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed common inter-bill vendors for LPT
INSERT INTO bill_vendors (vendor_name, vendor_type, phone, default_expense_account, notes, created_by) VALUES
('EdC (Electricite du Cambodge)', 'Utility',    '1800', '65100', 'Electricity provider',        'system'),
('NSSF Cambodia',                 'Government', '',     '65200', 'National Social Security Fund','system'),
('Phnom Penh Water Supply',       'Utility',    '',     '65300', 'Water supply authority',       'system'),
('Smart Axiata',                  'Utility',    '',     '65400', 'Internet / telecom',           'system'),
('Metfone',                       'Utility',    '',     '65400', 'Telecom provider',             'system')
ON CONFLICT DO NOTHING;
