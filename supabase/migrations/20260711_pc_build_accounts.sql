-- PC Build document-type support (see JE-2061 audit/fix). Assembled PCs are
-- sold as one line but built from individually-purchased, individually-serialed
-- components. Revenue and COGS consolidate into their own leaf accounts;
-- inventory always stays credited under each component's REAL brand account
-- (12100/12300/12600/etc.) — never this placeholder — since components are
-- purchased, received, and serial-tracked one PO line at a time.
--
-- 40900/50900 already exist live in chart_of_accounts (inserted via a
-- service-role script during the JE-2061 fix on 2026-07-10) but were never
-- captured in a migration. This makes that state reproducible and adds the
-- brand_account_mapping row so services/accountingApi.ts's BRAND_ACCOUNT_MAP
-- constant and the DB mirror stay in sync (see 20260529_accounting_security.sql).
--
-- 12900 is created only to satisfy brand_account_mapping.inventory_account's
-- NOT NULL constraint — the app never posts to it (autoPostInvoiceJournal
-- always resolves the inventory credit from the component's own real brand).

INSERT INTO chart_of_accounts (account_number, account_name, parent_account_number, account_type, description, sort_order) VALUES
    ('40900', 'PC Build', '40000', 'Income',              'Assembled PC builds sold as one line — see 20260711_pc_build_accounts.sql', 120),
    ('50900', 'PC Build', '50000', 'Cost of Goods Sold',   'Assembled PC builds sold as one line — see 20260711_pc_build_accounts.sql', 140),
    ('12900', 'PC Build', '12000', 'Other Current Asset',  'Unused placeholder — PC-build components always route inventory through their own real brand account, never this one', 47)
ON CONFLICT (account_number) DO NOTHING;

INSERT INTO brand_account_mapping (brand, revenue_account, cogs_account, inventory_account) VALUES
    ('PC Build', '40900', '50900', '12900')
ON CONFLICT (brand) DO NOTHING;
