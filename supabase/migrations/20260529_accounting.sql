-- ─── Accounting Module ────────────────────────────────────────────────────────
-- Creates chart_of_accounts, journal_entries, and journal_entry_lines tables.
-- Seeds chart_of_accounts with all 113 accounts from the company's Chart of Account.
-- Double-entry bookkeeping: every journal entry must have equal debits and credits.

-- ── Chart of Accounts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id                     SERIAL PRIMARY KEY,
    account_number         TEXT UNIQUE NOT NULL,
    account_name           TEXT NOT NULL,
    parent_account_number  TEXT REFERENCES chart_of_accounts(account_number) ON DELETE SET NULL,
    account_type           TEXT NOT NULL,
    -- Types: Bank | Accounts Receivable | Other Current Asset | Fixed Asset |
    --        Accounts Payable | Other Current Liability | Equity | Income |
    --        Cost of Goods Sold | Expense | Other Income | Other Expense | Non-Posting
    description            TEXT NOT NULL DEFAULT '',
    is_hidden              BOOLEAN NOT NULL DEFAULT false,
    sort_order             INT NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coa_account_type    ON chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_coa_parent_number   ON chart_of_accounts(parent_account_number);

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage chart_of_accounts"
    ON chart_of_accounts FOR ALL USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION update_coa_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_coa_updated_at
    BEFORE UPDATE ON chart_of_accounts FOR EACH ROW
    EXECUTE PROCEDURE update_coa_updated_at();

-- ── Journal Entries ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_entries (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entry_number TEXT UNIQUE NOT NULL,
    entry_date   DATE NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    reference    TEXT NOT NULL DEFAULT '',
    created_by   TEXT NOT NULL DEFAULT '',
    is_posted    BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_je_entry_date  ON journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_je_is_posted   ON journal_entries(is_posted);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage journal_entries"
    ON journal_entries FOR ALL USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION update_je_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_je_updated_at
    BEFORE UPDATE ON journal_entries FOR EACH ROW
    EXECUTE PROCEDURE update_je_updated_at();

-- ── Journal Entry Lines ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    journal_entry_id  UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_number    TEXT NOT NULL REFERENCES chart_of_accounts(account_number),
    description       TEXT NOT NULL DEFAULT '',
    debit             DECIMAL(15,2) NOT NULL DEFAULT 0,
    credit            DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jel_entry_id      ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account_number ON journal_entry_lines(account_number);

ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage journal_entry_lines"
    ON journal_entry_lines FOR ALL USING (auth.role() = 'authenticated');

-- ── Seed: Chart of Accounts ───────────────────────────────────────────────────
-- Ordered so parent rows are inserted before their children (FK constraint).

INSERT INTO chart_of_accounts (account_number, account_name, parent_account_number, account_type, description, sort_order) VALUES

-- ASSETS: Bank / Cash (10000-11800)
('10000', 'Cash Accounts',                       NULL,    'Bank',                    '',                                                            10),
('10100', 'Cash on Hand',                        '10000', 'Bank',                    '',                                                            11),
('11000', 'Bank Accounts',                       NULL,    'Bank',                    '',                                                            20),
('11100', 'ABA - 000512512 (USD-Pisey)',          '11000', 'Bank',                    '',                                                            21),
('11200', 'ABA - 017505468 (USD-Ana)',            '11000', 'Bank',                    '',                                                            22),
('11300', 'ABA - 003916564 (Tax-LPT)',            '11000', 'Bank',                    '',                                                            23),
('11400', 'ABA - 011650632 (Tax-Visa)',           '11000', 'Bank',                    '',                                                            24),
('11500', 'ABA 017960669 LPT TAX (Services)',     '11000', 'Bank',                    '',                                                            25),
('11600', 'ABA 017960669 LPT TAX (KHR)',          '11000', 'Bank',                    '',                                                            26),
('11800', 'Undeposit Cheque',                    '11000', 'Bank',                    '',                                                            27),

-- ASSETS: Accounts Receivable (11900)
('11900', 'Accounts Receivable',                 NULL,    'Accounts Receivable',     'Unpaid or unapplied customer invoices and credits',           30),

-- ASSETS: Other Current Assets (12000-14400)
('12000', 'Inventory Assets',                    NULL,    'Other Current Asset',     'Costs of inventory purchased for resale',                     40),
('12100', 'ASUS',                                '12000', 'Other Current Asset',     'ASUS',                                                        41),
('12200', 'DELL',                                '12000', 'Other Current Asset',     'DELL',                                                        42),
('12300', 'MSI',                                 '12000', 'Other Current Asset',     'MSI',                                                         43),
('12400', 'Asus Acc. & PW Supply',               '12000', 'Other Current Asset',     'Asus Accessories & Power Supply',                             44),
('12500', 'MSI Acc. & PW Supply',                '12000', 'Other Current Asset',     'MSI Accessories & Power Supply',                              45),
('12600', 'Other Accessories',                   '12000', 'Other Current Asset',     '',                                                            46),
('12700', 'Lenovo',                              '12000', 'Other Current Asset',     '',                                                            47),
('12800', 'Lenovo Accessories',                  '12000', 'Other Current Asset',     '',                                                            48),
('13000', 'VAT Input',                           NULL,    'Other Current Asset',     '',                                                            50),
('13100', 'VAT CCF',                             NULL,    'Other Current Asset',     '',                                                            51),
('13200', 'Prepayment Profit Tax',               NULL,    'Other Current Asset',     '',                                                            52),
('14000', 'Prepaid Expense',                     NULL,    'Other Current Asset',     '',                                                            53),
('14100', 'Prepayment to Vendor',                NULL,    'Other Current Asset',     '',                                                            54),
('14200', 'Deposit Rent',                        NULL,    'Other Current Asset',     '',                                                            55),
('14300', 'POSM Marketing',                      NULL,    'Other Current Asset',     'Supply for Marketing and Promotion',                          56),
('14400', 'Sale Promotion',                      NULL,    'Other Current Asset',     '',                                                            57),

-- ASSETS: Fixed Assets (15000-18002)
('15000', 'Furniture & Equipment',               NULL,    'Fixed Asset',             'Furniture and equipment with useful life exceeding one year',  60),
('15001', 'Acc-De Of Furniture & Equip',         '15000', 'Fixed Asset',             '',                                                            61),
('15002', 'Furniture & Equipment (Cost)',         '15000', 'Fixed Asset',             '',                                                            62),
('16000', 'Computer Equipment',                  NULL,    'Fixed Asset',             '',                                                            63),
('16001', 'Acc-De of Computer',                  '16000', 'Fixed Asset',             '',                                                            64),
('16002', 'Cost of Computer',                    '16000', 'Fixed Asset',             '',                                                            65),
('17000', 'Vehicle',                             NULL,    'Fixed Asset',             'Phnom Penh 1KR-1465',                                         66),
('17001', 'Acc.De of Vehicle',                   '17000', 'Fixed Asset',             '',                                                            67),
('17002', 'Cost of Vehicle',                     '17000', 'Fixed Asset',             '',                                                            68),
('18000', 'Renovation',                          NULL,    'Fixed Asset',             '',                                                            69),
('18001', 'Acc. dep of Renovation',              '18000', 'Fixed Asset',             '',                                                            70),
('18002', 'Cost of Renovation',                  '18000', 'Fixed Asset',             '',                                                            71),

-- LIABILITIES: Accounts Payable (20000)
('20000', 'Accounts Payable',                    NULL,    'Accounts Payable',        'Unpaid or unapplied vendor bills or credits',                 80),

-- LIABILITIES: Other Current Liabilities (21000-27000)
('21000', 'Loan from Shareholder',               NULL,    'Other Current Liability', '',                                                            90),
('22000', 'Taxes Liabilities',                   NULL,    'Other Current Liability', '',                                                            91),
('23000', 'VAT Output',                          NULL,    'Other Current Liability', '',                                                            92),
('24000', 'Payroll Liabilities',                 NULL,    'Other Current Liability', 'Unpaid payroll liabilities. Amounts withheld or accrued, but not yet paid', 93),
('25000', 'Customer Deposit',                    NULL,    'Other Current Liability', '',                                                            94),
('26000', 'NSSF Payable',                        NULL,    'Other Current Liability', '',                                                            95),
('27000', 'Loan from ITC',                       NULL,    'Other Current Liability', '',                                                            96),

-- EQUITY (30000-32000)
('30000', 'Equity',                              NULL,    'Equity',                  'Opening balances during setup post to this account',          100),
('30100', 'Tan Pisey',                           '30000', 'Equity',                  '',                                                            101),
('32000', 'Retained Earnings',                   NULL,    'Equity',                  'Undistributed earnings of the business',                      102),

-- INCOME (40000-41100)
('40000', 'Incomes',                             NULL,    'Income',                  'Income received from customers',                              110),
('40100', 'ASUS',                                '40000', 'Income',                  '',                                                            111),
('40200', 'DELL',                                '40000', 'Income',                  '',                                                            112),
('40300', 'MSI',                                 '40000', 'Income',                  'MSI',                                                         113),
('40400', 'Asus Acc. & PW Supply',               '40000', 'Income',                  'Asus Accessories & Power Supply',                             114),
('40500', 'MSI Acc. & PW Supply',                '40000', 'Income',                  '',                                                            115),
('40600', 'Other Accessories',                   '40000', 'Income',                  '',                                                            116),
('40700', 'Lenovo',                              '40000', 'Income',                  '',                                                            117),
('40800', 'Lenovo Accessories',                  '40000', 'Income',                  '',                                                            118),
('41000', 'Sale Discount',                       NULL,    'Income',                  '',                                                            119),
('41100', 'Sale Discount (Detail)',              '41000', 'Income',                  '',                                                            120),

-- COST OF GOODS SOLD (50000-50800)
('50000', 'Cost of Goods Sold',                  NULL,    'Cost of Goods Sold',      'Costs of items purchased and then sold to customers',         130),
('50100', 'ASUS',                                '50000', 'Cost of Goods Sold',      '',                                                            131),
('50200', 'DELL',                                '50000', 'Cost of Goods Sold',      'DELL',                                                        132),
('50300', 'MSI',                                 '50000', 'Cost of Goods Sold',      'MSI',                                                         133),
('50400', 'Asus Acc. & PW Supply',               '50000', 'Cost of Goods Sold',      'Asus Accessories & Power Supply',                             134),
('50500', 'MSI Acc. & PW Supply',                '50000', 'Cost of Goods Sold',      '',                                                            135),
('50600', 'Other Accessories',                   '50000', 'Cost of Goods Sold',      '',                                                            136),
('50700', 'Lenovo',                              '50000', 'Cost of Goods Sold',      '',                                                            137),
('50800', 'Lenovo Accessories',                  '50000', 'Cost of Goods Sold',      '',                                                            138),

-- EXPENSES (60000-69200)
('61100', 'Staff Benefit',                       NULL,    'Expense',                 '',                                                            140),
('61000', 'Payroll Expenses',                    '61100', 'Expense',                 'Payroll expenses',                                            141),
('61110', 'Gasoline',                            '61100', 'Expense',                 '',                                                            142),
('61120', 'Food & Meals',                        '61100', 'Expense',                 '',                                                            143),
('61130', 'NSSF Expense',                        '61100', 'Expense',                 'Insurance expenses',                                          144),
('62000', 'Mission Allowance',                   NULL,    'Expense',                 'Fuel, oil, repairs, and other automobile maintenance for business autos', 145),
('60210', 'Others Allowance',                    '62000', 'Expense',                 '',                                                            146),
('60220', 'Accommodation',                       '62000', 'Expense',                 '',                                                            147),
('60230', 'Traveling Expense',                   '62000', 'Expense',                 '',                                                            148),
('67000', 'Operation Expense',                   NULL,    'Expense',                 '',                                                            149),
('60000', 'Rental Expense',                      '67000', 'Expense',                 'Rent paid for company offices or other structures used in the business', 150),
('63000', 'Advertising & Promotion',             '67000', 'Expense',                 'Advertising, marketing, graphic design, and other promotional expenses', 151),
('64000', 'Depreciation Expense',                '67000', 'Expense',                 'Depreciation on equipment, buildings and improvements',       152),
('65000', 'Repairs & Maintenance',               '67000', 'Expense',                 'Incidental repairs and maintenance of business assets',       153),
('66000', 'Professional Service',                '67000', 'Expense',                 'Payments to accounting professionals and attorneys for accounting or legal services', 154),
('66100', 'Others Services',                     '67000', 'Expense',                 '',                                                            155),
('66200', 'Business Licenses & Permits',         '67000', 'Expense',                 'Business licenses, permits, and other business-related fees', 156),
('67100', 'Photo and Printing',                  '67000', 'Expense',                 '',                                                            157),
('67200', 'Office Supplies',                     '67000', 'Expense',                 'Office supplies expense',                                     158),
('67300', 'Praying Expense',                     '67000', 'Expense',                 '',                                                            159),
('67400', 'Delivery Expense',                    '67000', 'Expense',                 '',                                                            160),
('67500', 'Cleaning Expense',                    '67000', 'Expense',                 '',                                                            161),
('67600', 'Bank Service Charges',                '67000', 'Expense',                 'Bank account service fees, bad check charges and other bank fees', 162),
('67700', 'Drinking Water in Office',            '67000', 'Expense',                 '',                                                            163),
('67900', 'Other Operation Expense',             '67000', 'Expense',                 '',                                                            164),
('68000', 'Utilities',                           NULL,    'Expense',                 'Water, electricity, garbage, and other basic utilities expenses', 165),
('68100', 'Internet Expenses',                   '68000', 'Expense',                 'Computer supplies, off-the-shelf software, online fees, and other computer or internet related expenses', 166),
('68200', 'Telephone Expense',                   '68000', 'Expense',                 'Telephone and long distance charges, faxing, and other fees', 167),
('68300', 'Trash Collection',                    '68000', 'Expense',                 '',                                                            168),
('68400', 'Electric',                            '68000', 'Expense',                 '',                                                            169),
('68500', 'Water',                               '68000', 'Expense',                 '',                                                            170),
('69000', 'Registration Expenses',               NULL,    'Expense',                 '',                                                            171),
('69100', 'Monthly Tax Expense',                 '69000', 'Expense',                 '',                                                            172),
('69200', 'Monthly NSSF Expense',                '69000', 'Expense',                 '',                                                            173),

-- OTHER INCOME (70000-70200)
('70000', 'Others Income',                       NULL,    'Other Income',            '',                                                            180),
('70100', 'Interest Income',                     '70000', 'Other Income',            'Interest Income',                                             181),
('70200', 'Purchase Discount',                   '70000', 'Other Income',            '',                                                            182),

-- OTHER EXPENSE (80000-88000)
('80000', 'Other Expense',                       NULL,    'Other Expense',           '',                                                            190),
('88000', 'Ask My Accountant',                   NULL,    'Other Expense',           'Transactions to be discussed with accountant, consultant, or tax preparer', 191),

-- NON-POSTING (90000-90200)
('90000', 'Estimates',                           NULL,    'Non-Posting',             'Estimates for jobs or projects',                              200),
('90100', 'Sales Orders',                        NULL,    'Non-Posting',             'Orders from customers to be filled',                          201),
('90200', 'Purchase Orders',                     NULL,    'Non-Posting',             'Purchase orders specifying items ordered from vendors',        202)

ON CONFLICT (account_number) DO NOTHING;
