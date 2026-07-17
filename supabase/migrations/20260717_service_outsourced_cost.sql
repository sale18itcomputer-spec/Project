-- Outsourced-service accounting (see JE-2060 audit). A Service Invoice can
-- involve a job outsourced to a third-party vendor: we charge the customer
-- one price, the vendor charges us a lower one, and the difference is our
-- margin. Previously services had no COGS side at all — revenue posted to
-- the generic 40600 Other Accessories fallback and no vendor cost was ever
-- recorded, so the P&L couldn't show service margin and nothing tracked
-- what we owed the vendor.

INSERT INTO chart_of_accounts (account_number, account_name, parent_account_number, account_type, description, sort_order) VALUES
    ('40950', 'Service Income',            '40000', 'Income',             'Revenue from Service Invoices (in-house or outsourced)', 125),
    ('50950', 'Cost of Outsourced Service', '50000', 'Cost of Goods Sold', 'Vendor cost when a service job is outsourced — credits 20000 Accounts Payable, not an inventory account', 145)
ON CONFLICT (account_number) DO NOTHING;

-- brand_account_mapping is a DB mirror of services/accountingApi.ts's
-- BRAND_ACCOUNT_MAP constant (not read by the app at runtime — see
-- 20260711_pc_build_accounts.sql) kept for consistency. 'Service' has no
-- inventory account (nothing physical is relieved) and instead credits a
-- payable account, so both columns need to allow that.
ALTER TABLE brand_account_mapping ALTER COLUMN inventory_account DROP NOT NULL;
ALTER TABLE brand_account_mapping ADD COLUMN IF NOT EXISTS payable_account TEXT REFERENCES chart_of_accounts(account_number);

INSERT INTO brand_account_mapping (brand, revenue_account, cogs_account, inventory_account, payable_account) VALUES
    ('Service', '40950', '50950', NULL, '20000')
ON CONFLICT (brand) DO UPDATE SET payable_account = EXCLUDED.payable_account;
