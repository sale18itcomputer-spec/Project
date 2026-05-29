-- ─── Seed: Journal Entries (LIMPERIAL TECHNOLOGY, Jan–May 2026) ────────────────
-- 6 entries: 1 opening balance (Dec 31 2025) + 5 monthly activity summaries.
-- Every entry is self-balancing: total debits = total credits.
-- Idempotent: each block is skipped if the entry_number already exists.

DO $$
DECLARE eid UUID;
BEGIN

-- ── Opening Balance (Dec 31, 2025) ────────────────────────────────────────────
-- ABA bank funded by a customer deposit received before the period.
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'JE-0000') THEN
    INSERT INTO journal_entries
        (entry_number, entry_date, description, reference, created_by, is_posted)
    VALUES
        ('JE-0000', '2025-12-31',
         'Opening Balance — ABA Bank funded by Customer Deposit',
         'OPEN-2025', 'system', true)
    RETURNING id INTO eid;

    INSERT INTO journal_entry_lines
        (journal_entry_id, account_number, description, debit, credit)
    VALUES
        (eid, '11300', 'ABA Bank Opening Balance',     92708.00,     0.00),
        (eid, '25000', 'Customer Deposit (Pre-period)',     0.00, 92708.00);
    -- DR = CR = 92,708.00 ✓
END IF;

-- ── January 2026 ──────────────────────────────────────────────────────────────
-- Revenue: 34,597 | COGS: 34,601 | Other Income: 450 | Net Income: -4
-- BS changes: AR +3,089 | Other Acc Inventory +38 | AP +3,131
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'JE-0001') THEN
    INSERT INTO journal_entries
        (entry_number, entry_date, description, reference, created_by, is_posted)
    VALUES
        ('JE-0001', '2026-01-31',
         'January 2026 — Monthly Activity Summary',
         'JAN-2026', 'system', true)
    RETURNING id INTO eid;

    INSERT INTO journal_entry_lines
        (journal_entry_id, account_number, description, debit, credit)
    VALUES
        (eid, '40100', 'ASUS Revenue',                      0.00, 22446.00),
        (eid, '40300', 'MSI Revenue',                       0.00,  8557.00),
        (eid, '40700', 'Lenovo Revenue',                    0.00,  3365.00),
        (eid, '40400', 'Asus Acc & PW Supply Revenue',      0.00,   229.00),
        (eid, '41100', 'Sale Discount',                   450.00,     0.00),
        (eid, '50100', 'ASUS COGS',                     22446.00,     0.00),
        (eid, '50300', 'MSI COGS',                       8557.00,     0.00),
        (eid, '50700', 'Lenovo COGS',                    3365.00,     0.00),
        (eid, '50400', 'Asus Acc & PW Supply COGS',       229.00,     0.00),
        (eid, '50600', 'Other Accessories COGS',            4.00,     0.00),
        (eid, '70200', 'Purchase Discount',                 0.00,   450.00),
        (eid, '11900', 'Accounts Receivable',            3089.00,     0.00),
        (eid, '12600', 'Inventory — Other Accessories',    38.00,     0.00),
        (eid, '20000', 'Accounts Payable',                  0.00,  3131.00);
    -- DR: 450+22446+8557+3365+229+4+3089+38 = 38,178.00
    -- CR: 22446+8557+3365+229+450+3131      = 38,178.00 ✓
END IF;

-- ── February 2026 ─────────────────────────────────────────────────────────────
-- Revenue: 807 | COGS: 807 | Net Income: 0
-- BS: Cash on Hand +358 | AR -3,089 (collected) | AP -2,731 (paid)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'JE-0002') THEN
    INSERT INTO journal_entries
        (entry_number, entry_date, description, reference, created_by, is_posted)
    VALUES
        ('JE-0002', '2026-02-28',
         'February 2026 — Monthly Activity Summary',
         'FEB-2026', 'system', true)
    RETURNING id INTO eid;

    INSERT INTO journal_entry_lines
        (journal_entry_id, account_number, description, debit, credit)
    VALUES
        (eid, '40700', 'Lenovo Revenue',                  0.00,  635.00),
        (eid, '40400', 'Asus Acc & PW Supply Revenue',    0.00,  172.00),
        (eid, '50700', 'Lenovo COGS',                   635.00,    0.00),
        (eid, '50400', 'Asus Acc & PW Supply COGS',     172.00,    0.00),
        (eid, '10100', 'Cash on Hand Increase',         358.00,    0.00),
        (eid, '20000', 'AP Payment',                   2731.00,    0.00),
        (eid, '11900', 'AR Collection',                   0.00, 3089.00);
    -- DR: 635+172+358+2731 = 3,896.00
    -- CR: 635+172+3089     = 3,896.00 ✓
END IF;

-- ── March 2026 ────────────────────────────────────────────────────────────────
-- Revenue: 14,654 | COGS: 14,689 | Expense: 25.83 | Other Income: 15 | Net: -60.83
-- BS: AR +2,514 | Inventory +15 | POSM +3,690 | Renovation Cost +620
--     Cash on Hand -358 | Acc.Dep -25.83 | AP +4,051 | Equity +2,465
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'JE-0003') THEN
    INSERT INTO journal_entries
        (entry_number, entry_date, description, reference, created_by, is_posted)
    VALUES
        ('JE-0003', '2026-03-31',
         'March 2026 — Monthly Activity Summary',
         'MAR-2026', 'system', true)
    RETURNING id INTO eid;

    INSERT INTO journal_entry_lines
        (journal_entry_id, account_number, description, debit, credit)
    VALUES
        (eid, '40100', 'ASUS Revenue',                        0.00,   385.00),
        (eid, '40300', 'MSI Revenue',                         0.00,  4670.00),
        (eid, '40700', 'Lenovo Revenue',                      0.00,  9585.00),
        (eid, '40400', 'Asus Acc & PW Supply Revenue',        0.00,    14.00),
        (eid, '41100', 'Sale Discount',                      15.00,     0.00),
        (eid, '50100', 'ASUS COGS',                         385.00,     0.00),
        (eid, '50300', 'MSI COGS',                         4670.00,     0.00),
        (eid, '50700', 'Lenovo COGS',                      9585.00,     0.00),
        (eid, '50400', 'Asus Acc & PW Supply COGS',          14.00,     0.00),
        (eid, '50600', 'Other Accessories COGS',             35.00,     0.00),
        (eid, '64000', 'Depreciation Expense',               25.83,     0.00),
        (eid, '70200', 'Purchase Discount',                   0.00,    15.00),
        (eid, '11900', 'Accounts Receivable',              2514.00,     0.00),
        (eid, '12600', 'Inventory — Other Accessories',      15.00,     0.00),
        (eid, '14300', 'POSM Marketing',                   3690.00,     0.00),
        (eid, '18002', 'Cost of Renovation',                620.00,     0.00),
        (eid, '10100', 'Cash on Hand Decrease',               0.00,   358.00),
        (eid, '18001', 'Acc. dep of Renovation',              0.00,    25.83),
        (eid, '20000', 'Accounts Payable',                    0.00,  4051.00),
        (eid, '30100', 'Equity — Tan Pisey',                  0.00,  2465.00);
    -- DR: 15+385+4670+9585+14+35+25.83+2514+15+3690+620 = 21,568.83
    -- CR: 385+4670+9585+14+15+358+25.83+4051+2465        = 21,568.83 ✓
END IF;

-- ── April 2026 ────────────────────────────────────────────────────────────────
-- Revenue: 18,800 | COGS: 18,010.85 | Expense: 259.29 | Net: 529.86
-- BS: ABA Pisey +758.94 | ABA Tax -85,158.68 | ABA Tax-Visa +179.04
--     AR +4,521 | Inventory Other +4.15 | ASUS Inventory +391,902
--     VAT Input +37,054.07 | POSM -233.46 | Acc.Dep -25.83
--     AP +341,896.07 | Equity +6,575.30
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'JE-0004') THEN
    INSERT INTO journal_entries
        (entry_number, entry_date, description, reference, created_by, is_posted)
    VALUES
        ('JE-0004', '2026-04-30',
         'April 2026 — Monthly Activity Summary',
         'APR-2026', 'system', true)
    RETURNING id INTO eid;

    INSERT INTO journal_entry_lines
        (journal_entry_id, account_number, description, debit, credit)
    VALUES
        (eid, '40100', 'ASUS Revenue',                        0.00,   8915.00),
        (eid, '40300', 'MSI Revenue',                         0.00,    948.00),
        (eid, '40200', 'DELL Revenue',                        0.00,   8850.00),
        (eid, '40500', 'MSI Acc & PW Supply Revenue',         0.00,     87.00),
        (eid, '50100', 'ASUS COGS',                        8915.00,      0.00),
        (eid, '50300', 'MSI COGS',                          948.00,      0.00),
        (eid, '50200', 'DELL COGS',                        8050.00,      0.00),
        (eid, '50500', 'MSI Acc & PW Supply COGS',           87.00,      0.00),
        (eid, '50600', 'Other Accessories COGS',             10.85,      0.00),
        (eid, '63000', 'Advertising & Promotion',           233.46,      0.00),
        (eid, '64000', 'Depreciation Expense',               25.83,      0.00),
        (eid, '11100', 'ABA — USD-Pisey (opened)',          758.94,      0.00),
        (eid, '11400', 'ABA — Tax-Visa (opened)',           179.04,      0.00),
        (eid, '11900', 'Accounts Receivable Increase',     4521.00,      0.00),
        (eid, '12600', 'Inventory — Other Accessories',       4.15,      0.00),
        (eid, '12100', 'ASUS Inventory Purchase',        391902.00,      0.00),
        (eid, '13000', 'VAT Input',                      37054.07,      0.00),
        (eid, '11300', 'ABA Tax Bank Decrease',               0.00,  85158.68),
        (eid, '14300', 'POSM → Advertising Expense',          0.00,    233.46),
        (eid, '18001', 'Acc. dep of Renovation',              0.00,     25.83),
        (eid, '20000', 'Accounts Payable',                    0.00, 341896.07),
        (eid, '30100', 'Equity — Tan Pisey',                  0.00,   6575.30);
    -- DR: 8915+948+8050+87+10.85+233.46+25.83+758.94+179.04+4521+4.15+391902+37054.07
    --   = 452,689.34
    -- CR: 8915+948+8850+87+85158.68+233.46+25.83+341896.07+6575.30
    --   = 452,689.34 ✓
END IF;

-- ── May 2026 (May 1–28) ───────────────────────────────────────────────────────
-- Revenue: 431,015 | Discount: -71 | COGS: 401,445.59
-- Expense: 1,689.62 | Other Income: 76.68 | Other Expense: 1,056.45
-- Net Income: 26,829.02
-- BS: ABA Pisey +15,987.16 | ABA Tax +30,177.83 | VAT Input +51 | Prepaid +510
--     AP -345,823.60 | Customer Deposit -92,708 | AR -6,711 | Inventory -1.12
--     ASUS Inventory -391,902 | VAT Output +33,712 | Equity +26,102.45
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'JE-0005') THEN
    INSERT INTO journal_entries
        (entry_number, entry_date, description, reference, created_by, is_posted)
    VALUES
        ('JE-0005', '2026-05-28',
         'May 2026 (1–28) — Monthly Activity Summary',
         'MAY-2026', 'system', true)
    RETURNING id INTO eid;

    INSERT INTO journal_entry_lines
        (journal_entry_id, account_number, description, debit, credit)
    VALUES
        (eid, '40100', 'ASUS Revenue',                        0.00, 421400.00),
        (eid, '40300', 'MSI Revenue',                         0.00,   7180.00),
        (eid, '40700', 'Lenovo Revenue',                      0.00,   2078.00),
        (eid, '40600', 'Other Accessories Revenue',           0.00,    357.00),
        (eid, '41100', 'Sale Discount',                      71.00,      0.00),
        (eid, '50100', 'ASUS COGS',                      391902.00,      0.00),
        (eid, '50300', 'MSI COGS',                         7180.00,      0.00),
        (eid, '50700', 'Lenovo COGS',                      2037.47,      0.00),
        (eid, '50600', 'Other Accessories COGS',            326.12,      0.00),
        (eid, '60000', 'Rental Expense',                   1000.00,      0.00),
        (eid, '65000', 'Repairs & Maintenance',              50.00,      0.00),
        (eid, '67600', 'Bank Service Charges',                0.23,      0.00),
        (eid, '69100', 'Monthly Tax Expense',               222.26,      0.00),
        (eid, '69200', 'Monthly NSSF Expense',              153.03,      0.00),
        (eid, '68400', 'Electric',                          251.10,      0.00),
        (eid, '68200', 'Telephone',                          13.00,      0.00),
        (eid, '80000', 'Other Expense',                    1056.45,      0.00),
        (eid, '70200', 'Purchase Discount',                   0.00,     71.00),
        (eid, '70100', 'Interest Income',                     0.00,      5.68),
        (eid, '11100', 'ABA — USD-Pisey Increase',        15987.16,      0.00),
        (eid, '11300', 'ABA Tax Bank Increase',           30177.83,      0.00),
        (eid, '13000', 'VAT Input Increase',                 51.00,      0.00),
        (eid, '14000', 'Prepaid Expense',                   510.00,      0.00),
        (eid, '20000', 'AP Payment',                     345823.60,      0.00),
        (eid, '25000', 'Customer Deposit Released',        92708.00,      0.00),
        (eid, '11900', 'AR Collection',                       0.00,   6711.00),
        (eid, '12600', 'Inventory Used',                      0.00,      1.12),
        (eid, '12100', 'ASUS Inventory Sold',                 0.00, 391902.00),
        (eid, '23000', 'VAT Output',                          0.00,  33712.00),
        (eid, '30100', 'Equity — Tan Pisey',                  0.00,  26102.45);
    -- DR: 71+391902+7180+2037.47+326.12+1000+50+0.23+222.26+153.03+251.10+13+1056.45
    --     +15987.16+30177.83+51+510+345823.60+92708 = 889,520.25
    -- CR: 421400+7180+2078+357+71+5.68+6711+1.12+391902+33712+26102.45
    --   = 889,520.25 ✓
END IF;

END $$;
