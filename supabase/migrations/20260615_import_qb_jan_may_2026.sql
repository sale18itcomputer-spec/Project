-- QB Import: Jan–May 2026 (QuickBooks export)
-- Replaces all existing seed journal entries with 158 individual QB transactions.
-- Opening balance (JE-0000) corrected to match QB implicit state at Jan 1, 2026:
--   DR 11900 (AR) $84,280 / CR 25000 (Customer Deposit) $84,280
-- Idempotent: skips if QB-0004 already exists.

-- ── Add missing account 70300 ──────────────────────────────────────────────────
INSERT INTO chart_of_accounts
    (account_number, account_name, parent_account_number, account_type, description, sort_order)
VALUES ('70300', 'Others Income', '70000', 'Other Income', '', 183)
ON CONFLICT (account_number) DO NOTHING;

-- ── Remove old seed entries ─────────────────────────────────────────────────────
-- Only runs if the QB import hasn't been done yet
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0004') THEN
    DELETE FROM journal_entries
      WHERE entry_number IN ('JE-0000','JE-0001','JE-0002','JE-0003','JE-0004','JE-0005');
  END IF;
END $$;

-- ── Insert opening balance + 158 QB transactions ────────────────────────────────
DO $$
DECLARE eid UUID;
BEGIN

-- Opening Balance (Dec 31, 2025)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'JE-0000') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('JE-0000', '2025-12-31', 'Opening Balance — AR from Customer Deposit (PROXY SOLUTIONS)', 'OPEN-2025', 'system', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'AR — Customer Deposit receivable (PROXY SOLUTIONS)', 84280.00, 0.00),
    (eid, '25000', 'Customer Deposit — PROXY SOLUTIONS advance', 0.00, 84280.00);
END IF;

-- Trans#4 (2026-04-07)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0004') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0004', '2026-04-07', 'Bill — TOP TECH', 'KH-C00009', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'TOP TECH', 0.00, 15.00),
    (eid, '12600', 'SAC00003', 15.00, 0.00);
END IF;

-- Trans#5 (2026-04-07)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0005') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0005', '2026-04-07', 'Bill — SMC Computer', 'PV2026-00002', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'SMC Computer', 0.00, 8050.00),
    (eid, '12200', 'SMC Computer', 8050.00, 0.00);
END IF;

-- Trans#7 (2026-04-07)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0007') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0007', '2026-04-07', 'Invoice — Tonle Sap Authority', 'SJ0000213', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'SO-000039', 8850.00, 0.00),
    (eid, '40200', 'Tonle Sap Authority', 0.00, 8850.00),
    (eid, '12200', 'Tonle Sap Authority', 0.00, 8050.00),
    (eid, '50200', 'Tonle Sap Authority', 8050.00, 0.00),
    (eid, '12600', 'SAC00003', 0.00, 5.71),
    (eid, '50600', 'SAC00003', 5.71, 0.00);
END IF;

-- Trans#8 (2026-04-08)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0008') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0008', '2026-04-08', 'Payment — Tonle Sap Authority', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'Tonle Sap Authority', 8850.00, 0.00),
    (eid, '11900', 'Tonle Sap Authority', 0.00, 8850.00);
END IF;

-- Trans#10 (2026-04-20)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0010') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0010', '2026-04-20', 'Bill Pmt -Check — SMC Computer', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'SMC Computer', 0.00, 8050.00),
    (eid, '20000', 'SMC Computer', 8050.00, 0.00);
END IF;

-- Trans#11 (2026-04-20)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0011') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0011', '2026-04-20', 'Bill Pmt -Check — TOP TECH', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'TOP TECH', 0.00, 15.00),
    (eid, '20000', 'TOP TECH', 15.00, 0.00);
END IF;

-- Trans#12 (2026-04-09)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0012') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0012', '2026-04-09', 'Bill — ITC', '4 invoices', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'refKH-26-04- 240-241-270-441', 0.00, 8740.00),
    (eid, '12500', 'MSI MAG A750GL PCIE5  ( 750W / 80 Plus Gold / Full Modular / Active PFC / PCIe 5.1 / ATX 3.1 / F...', 87.00, 0.00),
    (eid, '12100', 'ITC', 7705.00, 0.00),
    (eid, '12300', 'MSI Cyborg 15 A13VEK-2252KH-Translucent Black', 948.00, 0.00);
END IF;

-- Trans#13 (2026-04-09)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0013') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0013', '2026-04-09', 'Invoice — IT SOLUTION DIGITAL CO.,LTD', 'SJ0000240', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'IT SOLUTION DIGITAL CO.,LTD', 87.00, 0.00),
    (eid, '40500', 'MSI MAG A750GL PCIE5  ( 750W / 80 Plus Gold / Full Modular / Active PFC / PCIe 5.1 / ATX 3.1 / F...', 0.00, 87.00),
    (eid, '12500', 'MSI MAG A750GL PCIE5  ( 750W / 80 Plus Gold / Full Modular / Active PFC / PCIe 5.1 / ATX 3.1 / F...', 0.00, 87.00),
    (eid, '50500', 'MSI MAG A750GL PCIE5  ( 750W / 80 Plus Gold / Full Modular / Active PFC / PCIe 5.1 / ATX 3.1 / F...', 87.00, 0.00);
END IF;

-- Trans#14 (2026-04-09)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0014') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0014', '2026-04-09', 'Invoice — IT SOLUTION DIGITAL CO.,LTD', 'SJ0000241', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'IT SOLUTION DIGITAL CO.,LTD', 5825.00, 0.00),
    (eid, '40100', 'ASUS Zenbook UX3405CA-PZ331W-Ponder Blue', 0.00, 5825.00),
    (eid, '12100', 'ASUS Zenbook UX3405CA-PZ331W-Ponder Blue', 0.00, 5825.00),
    (eid, '50100', 'ASUS Zenbook UX3405CA-PZ331W-Ponder Blue', 5825.00, 0.00);
END IF;

-- Trans#15 (2026-04-10)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0015') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0015', '2026-04-10', 'Invoice — TECHWIZ SOLUTIONS', 'SJ0000270', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'TECHWIZ SOLUTIONS', 948.00, 0.00),
    (eid, '40300', 'MSI Cyborg 15 A13VEK-2252KH-Translucent Black', 0.00, 948.00),
    (eid, '12300', 'MSI Cyborg 15 A13VEK-2252KH-Translucent Black', 0.00, 948.00),
    (eid, '50300', 'MSI Cyborg 15 A13VEK-2252KH-Translucent Black', 948.00, 0.00);
END IF;

-- Trans#16 (2026-04-21)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0016') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0016', '2026-04-21', 'Invoice — GANZBERG BREWERY', 'SJ0000441', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 1880.00, 0.00),
    (eid, '40100', 'ASUS GA403WM-QS044WS-Eclipse Gray', 0.00, 1880.00),
    (eid, '12100', 'ASUS GA403WM-QS044WS-Eclipse Gray', 0.00, 1880.00),
    (eid, '50100', 'ASUS GA403WM-QS044WS-Eclipse Gray', 1880.00, 0.00),
    (eid, '12600', 'SAC00003', 0.00, 0.57),
    (eid, '50600', 'SAC00003', 0.57, 0.00);
END IF;

-- Trans#18 (2026-03-26)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0018') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0018', '2026-03-26', 'Check — 620/24Month =25.83 per month', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', '620/24Month =25.83 per month', 0.00, 620.00),
    (eid, '18002', '', 620.00, 0.00);
END IF;

-- Trans#20 (2026-03-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0020') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0020', '2026-03-30', 'Bill — MD Premium Gifts Supply', 'MD260009', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'MD Premium Gifts Supply', 0.00, 3690.00),
    (eid, '14300', 'MD Premium Gifts Supply', 3690.00, 0.00);
END IF;

-- Trans#24 (2026-03-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0024') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0024', '2026-03-30', 'Bill Pmt -Check — MD Premium Gifts Supply', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', '50% Deposit', 0.00, 1845.00),
    (eid, '20000', '50% Deposit', 1845.00, 0.00);
END IF;

-- Trans#27 (2026-01-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0027') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0027', '2026-01-01', 'Bill — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'ITC', 0.00, 34147.00),
    (eid, '12400', 'ITC', 229.00, 0.00),
    (eid, '12300', 'ITC', 8557.00, 0.00),
    (eid, '12700', 'ITC', 3365.00, 0.00),
    (eid, '12100', 'ITC', 22446.00, 0.00),
    (eid, '70200', 'PURCHASE DISC', 0.00, 450.00);
END IF;

-- Trans#28 (2026-01-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0028') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0028', '2026-01-01', 'Bill — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'SAC00003 ref : KH-C00002,OA00410: 5 ref KH-C00008', 0.00, 42.00),
    (eid, '12600', 'ITC', 42.00, 0.00);
END IF;

-- Trans#29 (2026-01-07)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0029') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0029', '2026-01-07', 'Invoice — TECHWIZ SOLUTIONS', 'SJ0000232', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'TECHWIZ SOLUTIONS', 830.00, 0.00),
    (eid, '40300', 'MSI Cyborg 15 A13VEK-2253KH  Raptor Lake i7-13620H/ DDR5 16GB/ 512GB NVMe PCIe SSD Gen4x4/ RTX 4...', 0.00, 830.00),
    (eid, '12300', 'MSI Cyborg 15 A13VEK-2253KH  Raptor Lake i7-13620H/ DDR5 16GB/ 512GB NVMe PCIe SSD Gen4x4/ RTX 4...', 0.00, 830.00),
    (eid, '50300', 'MSI Cyborg 15 A13VEK-2253KH  Raptor Lake i7-13620H/ DDR5 16GB/ 512GB NVMe PCIe SSD Gen4x4/ RTX 4...', 830.00, 0.00);
END IF;

-- Trans#30 (2026-01-08)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0030') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0030', '2026-01-08', 'Invoice — ICTECH SOLUTIONS', 'SJ0000270', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'ICTECH SOLUTIONS', 2450.00, 0.00),
    (eid, '40100', 'Asus GU605CR-QR105W 8E-ECLIPSE GRAY  Intel Core Ultra 9 Processor 285H/ LPDDR5X 32G [ON BD.]/ 1T...', 0.00, 2450.00),
    (eid, '12100', 'Asus GU605CR-QR105W 8E-ECLIPSE GRAY  Intel Core Ultra 9 Processor 285H/ LPDDR5X 32G [ON BD.]/ 1T...', 0.00, 2450.00),
    (eid, '50100', 'Asus GU605CR-QR105W 8E-ECLIPSE GRAY  Intel Core Ultra 9 Processor 285H/ LPDDR5X 32G [ON BD.]/ 1T...', 2450.00, 0.00);
END IF;

-- Trans#31 (2026-01-15)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0031') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0031', '2026-01-15', 'Invoice — IT SOLUTION PARTNER', 'SJ0000568', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'IT SOLUTION PARTNER', 20416.00, 0.00),
    (eid, '40100', 'Asus GU605CM-QR058W 2E-ECLIPSE GRAY  Intel Core Ultra 9 Processor 285H/ LPDDR5X 32G [ON BD.]/ 1T...', 0.00, 17946.00),
    (eid, '12100', 'Asus GU605CM-QR058W 2E-ECLIPSE GRAY  Intel Core Ultra 9 Processor 285H/ LPDDR5X 32G [ON BD.]/ 1T...', 0.00, 17996.40),
    (eid, '50100', 'Asus GU605CM-QR058W 2E-ECLIPSE GRAY  Intel Core Ultra 9 Processor 285H/ LPDDR5X 32G [ON BD.]/ 1T...', 17996.40, 0.00),
    (eid, '40700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 0.00, 2920.00),
    (eid, '12700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 0.00, 2920.00),
    (eid, '50700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 2920.00, 0.00),
    (eid, '41100', 'Sale Discount', 450.00, 0.00);
END IF;

-- Trans#32 (2026-01-19)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0032') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0032', '2026-01-19', 'Invoice — MYTEB MALAYSIA', 'SJ0000746', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'MYTEB MALAYSIA', 119.00, 0.00),
    (eid, '40400', 'Asus TUF Gaming VG259Q5A  24.5", Fast IPS/ FHD (1920x1080)/ 200Hz, 1ms(GTG)/ DisplayPort 1.4 x 1...', 0.00, 119.00),
    (eid, '12400', 'Asus TUF Gaming VG259Q5A  24.5", Fast IPS/ FHD (1920x1080)/ 200Hz, 1ms(GTG)/ DisplayPort 1.4 x 1...', 0.00, 119.00),
    (eid, '50400', 'Asus TUF Gaming VG259Q5A  24.5", Fast IPS/ FHD (1920x1080)/ 200Hz, 1ms(GTG)/ DisplayPort 1.4 x 1...', 119.00, 0.00);
END IF;

-- Trans#33 (2026-01-22)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0033') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0033', '2026-01-22', 'Invoice — IT SOLUTION DIGITAL CO.,LTD', 'SJ0000845', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'IT SOLUTION DIGITAL CO.,LTD', 110.00, 0.00),
    (eid, '40400', 'IT SOLUTION DIGITAL CO.,LTD', 0.00, 110.00),
    (eid, '12400', 'IT SOLUTION DIGITAL CO.,LTD', 0.00, 110.00),
    (eid, '50400', 'IT SOLUTION DIGITAL CO.,LTD', 110.00, 0.00);
END IF;

-- Trans#34 (2026-01-23)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0034') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0034', '2026-01-23', 'Invoice — IT SOLUTION DIGITAL CO.,LTD', 'SJ0000895', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'IT SOLUTION DIGITAL CO.,LTD', 929.00, 0.00),
    (eid, '40300', 'MSI Cyborg 14 A13VF-216KH  Raptor Lake i7-13620H/ DDR5 8GB*2/ 1TB NVMePCIe SSDGen4x4 w/oDRAM/ RT...', 0.00, 929.00),
    (eid, '12300', 'MSI Cyborg 14 A13VF-216KH  Raptor Lake i7-13620H/ DDR5 8GB*2/ 1TB NVMePCIe SSDGen4x4 w/oDRAM/ RT...', 0.00, 929.00),
    (eid, '50300', 'MSI Cyborg 14 A13VF-216KH  Raptor Lake i7-13620H/ DDR5 8GB*2/ 1TB NVMePCIe SSDGen4x4 w/oDRAM/ RT...', 929.00, 0.00);
END IF;

-- Trans#35 (2026-02-02)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0035') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0035', '2026-02-02', 'Invoice — ICTECH SOLUTIONS', 'SJ0000024', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'ICTECH SOLUTIONS', 635.00, 0.00),
    (eid, '40700', 'Lenovo IdeaCentre AIO 24IRH9 (F0HN00T4VN)  Intel Core i5-13420H/ Integrated Intel UHD Graphics/ ...', 0.00, 635.00),
    (eid, '12700', 'Lenovo IdeaCentre AIO 24IRH9 (F0HN00T4VN)  Intel Core i5-13420H/ Integrated Intel UHD Graphics/ ...', 0.00, 635.00),
    (eid, '50700', 'Lenovo IdeaCentre AIO 24IRH9 (F0HN00T4VN)  Intel Core i5-13420H/ Integrated Intel UHD Graphics/ ...', 635.00, 0.00);
END IF;

-- Trans#36 (2026-02-10)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0036') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0036', '2026-02-10', 'Invoice — BMSC', 'SJ0000281', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'BMSC', 172.00, 0.00),
    (eid, '40400', 'Asus TUF Gaming VG27AQ5A  27", Fast IPS/ QHD (2560x1440)/ 210Hz(OC)/ 1ms(GTG)/ DisplayPort 1.4 x...', 0.00, 172.00),
    (eid, '12400', 'Asus TUF Gaming VG27AQ5A  27", Fast IPS/ QHD (2560x1440)/ 210Hz(OC)/ 1ms(GTG)/ DisplayPort 1.4 x...', 0.00, 172.00),
    (eid, '50400', 'Asus TUF Gaming VG27AQ5A  27", Fast IPS/ QHD (2560x1440)/ 210Hz(OC)/ 1ms(GTG)/ DisplayPort 1.4 x...', 172.00, 0.00);
END IF;

-- Trans#37 (2026-03-20)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0037') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0037', '2026-03-20', 'Invoice — PROXY SOLUTIONS Co.,LTD', 'SJ0000539', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'PROXY SOLUTIONS Co.,LTD', 399.00, 0.00),
    (eid, '40100', 'Asus E1404FA-EB945W 1K-MIXED BLACK  AMD RYZEN 3 30/ LPDDR5 8G [ON BD.]/ 512GB M.2 NVMe PCIe 3.0 ...', 0.00, 385.00),
    (eid, '12100', 'Asus E1404FA-EB945W 1K-MIXED BLACK  AMD RYZEN 3 30/ LPDDR5 8G [ON BD.]/ 512GB M.2 NVMe PCIe 3.0 ...', 0.00, 385.00),
    (eid, '50100', 'Asus E1404FA-EB945W 1K-MIXED BLACK  AMD RYZEN 3 30/ LPDDR5 8G [ON BD.]/ 512GB M.2 NVMe PCIe 3.0 ...', 385.00, 0.00),
    (eid, '40400', 'ASUS Wireless Silent Mouse MW103  Wireless RF 2.4GHz/ 1600dpi/ RF Distance Up to 10m/ 1 year', 0.00, 14.00),
    (eid, '12400', 'ASUS Wireless Silent Mouse MW103  Wireless RF 2.4GHz/ 1600dpi/ RF Distance Up to 10m/ 1 year', 0.00, 14.00),
    (eid, '50400', 'ASUS Wireless Silent Mouse MW103  Wireless RF 2.4GHz/ 1600dpi/ RF Distance Up to 10m/ 1 year', 14.00, 0.00);
END IF;

-- Trans#38 (2026-03-24)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0038') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0038', '2026-03-24', 'Invoice — TECHWIZ SOLUTIONS', 'SJ0000620', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'TECHWIZ SOLUTIONS', 634.00, 0.00),
    (eid, '40700', 'Lenovo IdeaPad Slim 3 14IRH10R (83K3001PFQ)  Intel Core 7 240H/ 8GB Soldered + 8GB SODIMM DDR5-4...', 0.00, 649.00),
    (eid, '12700', 'Lenovo IdeaPad Slim 3 14IRH10R (83K3001PFQ)  Intel Core 7 240H/ 8GB Soldered + 8GB SODIMM DDR5-4...', 0.00, 659.50),
    (eid, '50700', 'Lenovo IdeaPad Slim 3 14IRH10R (83K3001PFQ)  Intel Core 7 240H/ 8GB Soldered + 8GB SODIMM DDR5-4...', 659.50, 0.00),
    (eid, '41100', 'Sale Discount', 15.00, 0.00);
END IF;

-- Trans#39 (2026-03-26)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0039') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0039', '2026-03-26', 'Invoice — ICTECH SOLUTIONS', 'SJ0000687', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'ICTECH SOLUTIONS', 1125.00, 0.00),
    (eid, '40700', 'Lenovo LOQ 15IRX10 (83JE0132FQ)  Intel Core i7-14700HX/ 2x 16GB SODIMM DDR5-5600/ 512GB SSD M.2 ...', 0.00, 1125.00),
    (eid, '12700', 'Lenovo LOQ 15IRX10 (83JE0132FQ)  Intel Core i7-14700HX/ 2x 16GB SODIMM DDR5-5600/ 512GB SSD M.2 ...', 0.00, 1125.00),
    (eid, '50700', 'Lenovo LOQ 15IRX10 (83JE0132FQ)  Intel Core i7-14700HX/ 2x 16GB SODIMM DDR5-5600/ 512GB SSD M.2 ...', 1125.00, 0.00);
END IF;

-- Trans#40 (2026-01-02)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0040') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0040', '2026-01-02', 'Invoice — GANZBERG BREWERY', 'SJ0000019', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 6798.00, 0.00),
    (eid, '40300', 'MSI Raider 18 HX AI A2XWIG-200KH  Intel Core Ultra 9 275HX/ RTX 5080 Laptop GPU, GDDR7 16GB/ 18"...', 0.00, 6798.00),
    (eid, '12300', 'MSI Raider 18 HX AI A2XWIG-200KH  Intel Core Ultra 9 275HX/ RTX 5080 Laptop GPU, GDDR7 16GB/ 18"...', 0.00, 6798.00),
    (eid, '50300', 'MSI Raider 18 HX AI A2XWIG-200KH  Intel Core Ultra 9 275HX/ RTX 5080 Laptop GPU, GDDR7 16GB/ 18"...', 6798.00, 0.00),
    (eid, '12600', 'SAC00003', 0.00, 2.00),
    (eid, '50600', 'SAC00003', 2.00, 0.00);
END IF;

-- Trans#41 (2026-01-14)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0041') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0041', '2026-01-14', 'Invoice — SOKIMEX INVESTMENT GROUP CO.', 'SJ0000507', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'SOKIMEX INVESTMENT GROUP CO.', 445.00, 0.00),
    (eid, '40700', 'Lenovo ThinkCentre neo 50t Gen 5 (12UB001TFQ)  Intel Core i3-14100/ 1x 16GB UDIMM DDR5-4800/ 512...', 0.00, 445.00),
    (eid, '12700', 'Lenovo ThinkCentre neo 50t Gen 5 (12UB001TFQ)  Intel Core i3-14100/ 1x 16GB UDIMM DDR5-4800/ 512...', 0.00, 445.00),
    (eid, '50700', 'Lenovo ThinkCentre neo 50t Gen 5 (12UB001TFQ)  Intel Core i3-14100/ 1x 16GB UDIMM DDR5-4800/ 512...', 445.00, 0.00),
    (eid, '12600', 'SAC00003', 0.00, 1.00),
    (eid, '50600', 'SAC00003', 1.00, 0.00);
END IF;

-- Trans#42 (2026-01-26)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0042') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0042', '2026-01-26', 'Invoice — GANZBERG BREWERY', 'SJ0001028', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 2050.00, 0.00),
    (eid, '40100', 'Asus GU605CM-QR058W 2E-ECLIPSE GRAY  Intel Core Ultra 9 Processor 285H/ LPDDR5X 32G [ON BD.]/ 1T...', 0.00, 2050.00),
    (eid, '12100', 'Asus GU605CM-QR058W 2E-ECLIPSE GRAY  Intel Core Ultra 9 Processor 285H/ LPDDR5X 32G [ON BD.]/ 1T...', 0.00, 1999.60),
    (eid, '50100', 'Asus GU605CM-QR058W 2E-ECLIPSE GRAY  Intel Core Ultra 9 Processor 285H/ LPDDR5X 32G [ON BD.]/ 1T...', 1999.60, 0.00),
    (eid, '12600', 'SAC00003', 0.00, 1.00),
    (eid, '50600', 'SAC00003', 1.00, 0.00);
END IF;

-- Trans#43 (2026-03-02)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0043') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0043', '2026-03-02', 'Invoice — GANZBERG BREWERY', 'SJ0000024', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 1674.00, 0.00),
    (eid, '40700', 'Lenovo ThinkPad E16 Gen 3 (21SR004AFQ)  Intel Core Ultra 5 225U/ 1x 16GB SODIMM DDR5-5600/ 512GB...', 0.00, 1674.00),
    (eid, '12700', 'Lenovo ThinkPad E16 Gen 3 (21SR004AFQ)  Intel Core Ultra 5 225U/ 1x 16GB SODIMM DDR5-5600/ 512GB...', 0.00, 1674.00),
    (eid, '50700', 'Lenovo ThinkPad E16 Gen 3 (21SR004AFQ)  Intel Core Ultra 5 225U/ 1x 16GB SODIMM DDR5-5600/ 512GB...', 1674.00, 0.00),
    (eid, '12600', 'GANZBERG BREWERY', 0.00, 8.00),
    (eid, '50600', 'GANZBERG BREWERY', 8.00, 0.00);
END IF;

-- Trans#44 (2026-03-04)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0044') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0044', '2026-03-04', 'Invoice — GANZBERG BREWERY', 'SJ0000105', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 1560.00, 0.00),
    (eid, '40700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 0.00, 1560.00),
    (eid, '12700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 0.00, 1560.00),
    (eid, '50700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 1560.00, 0.00),
    (eid, '12600', 'SAC00003', 0.00, 2.00),
    (eid, '50600', 'SAC00003', 2.00, 0.00);
END IF;

-- Trans#45 (2026-03-06)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0045') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0045', '2026-03-06', 'Invoice — GANZBERG BREWERY', 'SJ0000154', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 780.00, 0.00),
    (eid, '40700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 0.00, 780.00),
    (eid, '12700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 0.00, 780.00),
    (eid, '50700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 780.00, 0.00),
    (eid, '12600', 'SAC00003', 0.00, 1.00),
    (eid, '50600', 'SAC00003', 1.00, 0.00);
END IF;

-- Trans#46 (2026-03-06)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0046') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0046', '2026-03-06', 'Invoice — GANZBERG BREWERY', 'SJ0000156', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 780.00, 0.00),
    (eid, '40700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 0.00, 780.00),
    (eid, '12700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 0.00, 780.00),
    (eid, '50700', 'Lenovo IdeaCentre AIO 27IRH9 (F0HM00T2VN)  Intel Core i7-13620H/ Integrated Intel UHD Graphics/ ...', 780.00, 0.00),
    (eid, '12600', 'SAC00003', 0.00, 1.00),
    (eid, '50600', 'SAC00003', 1.00, 0.00);
END IF;

-- Trans#47 (2026-03-13)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0047') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0047', '2026-03-13', 'Invoice — GANZBERG BREWERY', 'SJ0000307', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 837.00, 0.00),
    (eid, '40700', 'Lenovo ThinkPad E16 Gen 3 (21SR004AFQ)  Intel Core Ultra 5 225U/ 1x 16GB SODIMM DDR5-5600/ 512GB...', 0.00, 837.00),
    (eid, '12700', 'Lenovo ThinkPad E16 Gen 3 (21SR004AFQ)  Intel Core Ultra 5 225U/ 1x 16GB SODIMM DDR5-5600/ 512GB...', 0.00, 837.00),
    (eid, '50700', 'Lenovo ThinkPad E16 Gen 3 (21SR004AFQ)  Intel Core Ultra 5 225U/ 1x 16GB SODIMM DDR5-5600/ 512GB...', 837.00, 0.00),
    (eid, '12600', 'GANZBERG BREWERY', 0.00, 5.00),
    (eid, '50600', 'GANZBERG BREWERY', 5.00, 0.00);
END IF;

-- Trans#48 (2026-03-13)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0048') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0048', '2026-03-13', 'Invoice — GANZBERG BREWERY', 'SJ0000325', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 4670.00, 0.00),
    (eid, '40300', 'MSI Raider 18 HX AI A2XWJG-1015KH  Intel Core Ultra 9 285HX/ DDR5 6400MHz 32GB*2/ 2TB NVMe PCIe ...', 0.00, 4670.00),
    (eid, '12300', 'MSI Raider 18 HX AI A2XWJG-1015KH  Intel Core Ultra 9 285HX/ DDR5 6400MHz 32GB*2/ 2TB NVMe PCIe ...', 0.00, 4670.00),
    (eid, '50300', 'MSI Raider 18 HX AI A2XWJG-1015KH  Intel Core Ultra 9 285HX/ DDR5 6400MHz 32GB*2/ 2TB NVMe PCIe ...', 4670.00, 0.00),
    (eid, '12600', 'SAC00003', 0.00, 1.00),
    (eid, '50600', 'SAC00003', 1.00, 0.00);
END IF;

-- Trans#49 (2026-03-16)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0049') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0049', '2026-03-16', 'Invoice — GANZBERG BREWERY', 'SJ0000379', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 755.00, 0.00),
    (eid, '40700', 'Lenovo IdeaPad Slim 5 16IMH10 (83V7001MFQ)  Intel Core Ultra 5 135H/ 2x 8GB SODIMM DDR5-5600/ 51...', 0.00, 755.00),
    (eid, '12700', 'Lenovo IdeaPad Slim 5 16IMH10 (83V7001MFQ)  Intel Core Ultra 5 135H/ 2x 8GB SODIMM DDR5-5600/ 51...', 0.00, 755.00),
    (eid, '50700', 'Lenovo IdeaPad Slim 5 16IMH10 (83V7001MFQ)  Intel Core Ultra 5 135H/ 2x 8GB SODIMM DDR5-5600/ 51...', 755.00, 0.00),
    (eid, '12600', 'GANZBERG BREWERY', 0.00, 5.00),
    (eid, '50600', 'GANZBERG BREWERY', 5.00, 0.00);
END IF;

-- Trans#50 (2026-03-18)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0050') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0050', '2026-03-18', 'Invoice — GANZBERG BREWERY', 'SJ0000463', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 755.00, 0.00),
    (eid, '40700', 'Lenovo IdeaPad Slim 5 16IMH10 (83V7001MFQ)  Intel Core Ultra 5 135H/ 2x 8GB SODIMM DDR5-5600/ 51...', 0.00, 755.00),
    (eid, '12700', 'Lenovo IdeaPad Slim 5 16IMH10 (83V7001MFQ)  Intel Core Ultra 5 135H/ 2x 8GB SODIMM DDR5-5600/ 51...', 0.00, 755.00),
    (eid, '50700', 'Lenovo IdeaPad Slim 5 16IMH10 (83V7001MFQ)  Intel Core Ultra 5 135H/ 2x 8GB SODIMM DDR5-5600/ 51...', 755.00, 0.00),
    (eid, '12600', 'GANZBERG BREWERY', 0.00, 5.00),
    (eid, '50600', 'GANZBERG BREWERY', 5.00, 0.00);
END IF;

-- Trans#51 (2026-03-23)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0051') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0051', '2026-03-23', 'Invoice — CCU Commercial Bank', 'SJ0000607', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'CCU Commercial Bank', 670.00, 0.00),
    (eid, '40700', 'Lenovo IdeaPad Slim 3 14IRH10R (83K3001PFQ)  Intel Core 7 240H/ 8GB Soldered + 8GB SODIMM DDR5-4...', 0.00, 670.00),
    (eid, '12700', 'Lenovo IdeaPad Slim 3 14IRH10R (83K3001PFQ)  Intel Core 7 240H/ 8GB Soldered + 8GB SODIMM DDR5-4...', 0.00, 659.50),
    (eid, '50700', 'Lenovo IdeaPad Slim 3 14IRH10R (83K3001PFQ)  Intel Core 7 240H/ 8GB Soldered + 8GB SODIMM DDR5-4...', 659.50, 0.00),
    (eid, '12600', 'CCU Commercial Bank', 0.00, 4.83),
    (eid, '50600', 'CCU Commercial Bank', 4.83, 0.00);
END IF;

-- Trans#52 (2026-02-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0052') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0052', '2026-02-01', 'Bill — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'ITC', 0.00, 807.00),
    (eid, '12700', 'Lenovo IdeaCentre AIO 24IRH9 (F0HN00T4VN)  Intel Core i5-13420H/ Integrated Intel UHD Graphics/ ...', 635.00, 0.00),
    (eid, '12400', 'Asus TUF Gaming VG27AQ5A  27", Fast IPS/ QHD (2560x1440)/ 210Hz(OC)/ 1ms(GTG)/ DisplayPort 1.4 x...', 172.00, 0.00);
END IF;

-- Trans#53 (2026-03-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0053') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0053', '2026-03-01', 'Bill — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'ITC', 0.00, 14639.00),
    (eid, '12100', 'Asus E1404FA-EB945W 1K-MIXED BLACK  AMD RYZEN 3 30/ LPDDR5 8G [ON BD.]/ 512GB M.2 NVMe PCIe 3.0 ...', 385.00, 0.00),
    (eid, '12400', 'ASUS Wireless Silent Mouse MW103  Wireless RF 2.4GHz/ 1600dpi/ RF Distance Up to 10m/ 1 year', 14.00, 0.00),
    (eid, '12700', 'ITC', 9585.00, 0.00),
    (eid, '12300', 'MSI Raider 18 HX AI A2XWJG-1015KH  Intel Core Ultra 9 285HX/ DDR5 6400MHz 32GB*2/ 2TB NVMe PCIe ...', 4670.00, 0.00),
    (eid, '70200', 'ITC', 0.00, 15.00);
END IF;

-- Trans#55 (2026-04-25)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0055') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0055', '2026-04-25', 'Payment — GANZBERG BREWERY', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'GANZBERG BREWERY', 1880.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 1880.00);
END IF;

-- Trans#60 (2026-01-15)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0060') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0060', '2026-01-15', 'Payment — GANZBERG BREWERY', 'ABA 939 891', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'GANZBERG BREWERY', 6798.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 6798.00);
END IF;

-- Trans#61 (2026-02-03)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0061') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0061', '2026-02-03', 'Payment — GANZBERG BREWERY', 'ABA 939 891', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'GANZBERG BREWERY', 2050.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 2050.00);
END IF;

-- Trans#62 (2026-01-26)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0062') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0062', '2026-01-26', 'Payment — ICTECH SOLUTIONS', 'ABA 939 891', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ICTECH SOLUTIONS', 2450.00, 0.00),
    (eid, '11900', 'ICTECH SOLUTIONS', 0.00, 2450.00);
END IF;

-- Trans#63 (2026-02-21)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0063') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0063', '2026-02-21', 'Payment — IT SOLUTION DIGITAL CO.,LTD', 'ABA 888 858', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'IT SOLUTION DIGITAL CO.,LTD', 929.00, 0.00),
    (eid, '11900', 'IT SOLUTION DIGITAL CO.,LTD', 0.00, 929.00);
END IF;

-- Trans#64 (2026-02-05)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0064') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0064', '2026-02-05', 'Payment — IT SOLUTION DIGITAL CO.,LTD', 'ABA 888 858', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'IT SOLUTION DIGITAL CO.,LTD', 110.00, 0.00),
    (eid, '11900', 'IT SOLUTION DIGITAL CO.,LTD', 0.00, 110.00);
END IF;

-- Trans#65 (2026-01-20)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0065') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0065', '2026-01-20', 'Payment — IT SOLUTION PARTNER', 'Acleda ToanChet', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'IT SOLUTION PARTNER', 20416.00, 0.00),
    (eid, '11900', 'IT SOLUTION PARTNER', 0.00, 20416.00);
END IF;

-- Trans#66 (2026-01-21)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0066') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0066', '2026-01-21', 'Payment — MYTEB MALAYSIA', 'ABA 939 891', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'MYTEB MALAYSIA', 119.00, 0.00),
    (eid, '11900', 'MYTEB MALAYSIA', 0.00, 119.00);
END IF;

-- Trans#67 (2026-01-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0067') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0067', '2026-01-30', 'Payment — SOKIMEX INVESTMENT GROUP CO.', 'ABA 939 891', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'SOKIMEX INVESTMENT GROUP CO.', 445.00, 0.00),
    (eid, '11900', 'SOKIMEX INVESTMENT GROUP CO.', 0.00, 445.00);
END IF;

-- Trans#68 (2026-01-16)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0068') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0068', '2026-01-16', 'Payment — TECHWIZ SOLUTIONS', 'ABA 888 858', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'TECHWIZ SOLUTIONS', 830.00, 0.00),
    (eid, '11900', 'TECHWIZ SOLUTIONS', 0.00, 830.00);
END IF;

-- Trans#69 (2026-02-10)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0069') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0069', '2026-02-10', 'Payment — BMSC', 'ABA 888 858', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'BMSC', 172.00, 0.00),
    (eid, '11900', 'BMSC', 0.00, 172.00);
END IF;

-- Trans#70 (2026-02-21)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0070') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0070', '2026-02-21', 'Payment — ICTECH SOLUTIONS', 'ABA 888 858', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ICTECH SOLUTIONS', 635.00, 0.00),
    (eid, '11900', 'ICTECH SOLUTIONS', 0.00, 635.00);
END IF;

-- Trans#71 (2026-03-23)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0071') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0071', '2026-03-23', 'Payment — CCU Commercial Bank', 'ABA 888 858', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'CCU Commercial Bank', 670.00, 0.00),
    (eid, '11900', 'CCU Commercial Bank', 0.00, 670.00);
END IF;

-- Trans#72 (2026-03-19)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0072') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0072', '2026-03-19', 'Payment — GANZBERG BREWERY', 'ABA 939 891', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'GANZBERG BREWERY', 1674.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 1674.00);
END IF;

-- Trans#73 (2026-03-19)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0073') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0073', '2026-03-19', 'Payment — GANZBERG BREWERY', 'ABA 939 891', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'GANZBERG BREWERY', 1560.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 1560.00);
END IF;

-- Trans#74 (2026-03-20)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0074') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0074', '2026-03-20', 'Payment — GANZBERG BREWERY', 'ABA 939 891', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'GANZBERG BREWERY', 1560.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 1560.00);
END IF;

-- Trans#75 (2026-03-26)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0075') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0075', '2026-03-26', 'Payment — GANZBERG BREWERY', 'ABA 939 891', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'GANZBERG BREWERY', 1592.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 1592.00);
END IF;

-- Trans#76 (2026-03-31)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0076') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0076', '2026-03-31', 'Payment — GANZBERG BREWERY', 'ABA 939 891', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'GANZBERG BREWERY', 4670.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 4670.00);
END IF;

-- Trans#77 (2026-04-18)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0077') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0077', '2026-04-18', 'Payment — ICTECH SOLUTIONS', 'ABA 888 858', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ICTECH SOLUTIONS', 1125.00, 0.00),
    (eid, '11900', 'ICTECH SOLUTIONS', 0.00, 1125.00);
END IF;

-- Trans#78 (2026-04-22)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0078') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0078', '2026-04-22', 'Payment — IT SOLUTION DIGITAL CO.,LTD', 'ABA 888 858', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'IT SOLUTION DIGITAL CO.,LTD', 87.00, 0.00),
    (eid, '11900', 'IT SOLUTION DIGITAL CO.,LTD', 0.00, 87.00);
END IF;

-- Trans#79 (2026-03-21)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0079') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0079', '2026-03-21', 'Payment — PROXY SOLUTIONS Co.,LTD', 'ABA 888 858', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'PROXY SOLUTIONS Co.,LTD', 399.00, 0.00),
    (eid, '11900', 'PROXY SOLUTIONS Co.,LTD', 0.00, 399.00);
END IF;

-- Trans#81 (2026-04-03)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0081') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0081', '2026-04-03', 'Payment — GANZBERG BREWERY', 'ABA 939 891', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'GANZBERG BREWERY', 755.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 755.00);
END IF;

-- Trans#84 (2026-04-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0084') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0084', '2026-04-01', 'Payment — TECHWIZ SOLUTIONS', 'ABA 002 888 858', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'TECHWIZ SOLUTIONS', 634.00, 0.00),
    (eid, '11900', 'TECHWIZ SOLUTIONS', 0.00, 634.00);
END IF;

-- Trans#85 (2026-04-21)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0085') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0085', '2026-04-21', 'Payment — TECHWIZ SOLUTIONS', 'ABA 002 888 858', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'TECHWIZ SOLUTIONS', 948.00, 0.00),
    (eid, '11900', 'TECHWIZ SOLUTIONS', 0.00, 948.00);
END IF;

-- Trans#87 (2026-04-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0087') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0087', '2026-04-30', 'General Journal — VAT input Importax', '5', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '13000', 'VAT input Importax', 36885.17, 0.00),
    (eid, '20000', 'Customs declaration form 15,000 + Doc Fee 60,000', 0.00, 36885.17);
END IF;

-- Trans#88 (2026-04-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0088') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0088', '2026-04-30', 'General Journal — Jaket 9*8.3=74.70', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '63000', 'Jaket 9*8.3=74.70', 233.46, 0.00),
    (eid, '14300', 'Pen 8 x0.27=2.16', 0.00, 233.46);
END IF;

-- Trans#93 (2026-04-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0093') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0093', '2026-04-30', 'Bill Pmt -Check — MD Premium Gifts Supply', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'MD Premium Gifts Supply', 0.00, 1845.00),
    (eid, '20000', 'MD Premium Gifts Supply', 1845.00, 0.00);
END IF;

-- Trans#98 (2026-04-25)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0098') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0098', '2026-04-25', 'Invoice — GANZBERG BREWERY', 'SJ0000586', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 1210.00, 0.00),
    (eid, '40100', 'ASUS Zenbook UX3405CA-PZ331W-Ponder Blue', 0.00, 1210.00),
    (eid, '12100', 'ASUS Zenbook UX3405CA-PZ331W-Ponder Blue', 0.00, 1210.00),
    (eid, '50100', 'ASUS Zenbook UX3405CA-PZ331W-Ponder Blue', 1210.00, 0.00),
    (eid, '12600', 'GANZBERG BREWERY', 0.00, 4.40),
    (eid, '50600', 'GANZBERG BREWERY', 4.40, 0.00);
END IF;

-- Trans#99 (2026-04-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0099') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0099', '2026-04-01', 'Deposit — Deposit', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11400', 'Deposit', 179.04, 0.00),
    (eid, '30100', 'Openning Balance Visa Account beg April', 0.00, 179.04);
END IF;

-- Trans#101 (2026-05-06)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0101') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0101', '2026-05-06', 'Payment — IT SOLUTION DIGITAL CO.,LTD', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'IT SOLUTION DIGITAL CO.,LTD', 5825.00, 0.00),
    (eid, '11900', 'IT SOLUTION DIGITAL CO.,LTD', 0.00, 5825.00);
END IF;

-- Trans#102 (2026-04-24)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0102') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0102', '2026-04-24', 'Bill — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'ITC', 0.00, 1210.00),
    (eid, '12100', 'ASUS Zenbook UX3405CA-PZ331W-Ponder Blue', 1210.00, 0.00);
END IF;

-- Trans#103 (2026-05-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0103') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0103', '2026-05-01', 'Bill — TOP TECH', 'KH-C00010', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'TOP TECH', 0.00, 325.00),
    (eid, '12600', 'TOP TECH', 325.00, 0.00);
END IF;

-- Trans#104 (2026-04-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0104') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0104', '2026-04-30', 'Bill — Advanced Glory Logistic', 'AGL2601126', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'Shipping Cost', 0.00, 1619.20),
    (eid, '30100', 'Shipping Cost', 1472.00, 0.00),
    (eid, '13000', 'Shipping Cost', 147.20, 0.00);
END IF;

-- Trans#105 (2026-04-22)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0105') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0105', '2026-04-22', 'Bill — Advanced Glory Logistic', 'AGL2601028', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'Advanced Glory Logistic', 0.00, 126.50),
    (eid, '30100', 'Advanced Glory Logistic', 115.00, 0.00),
    (eid, '13000', 'Advanced Glory Logistic', 11.50, 0.00);
END IF;

-- Trans#106 (2026-04-22)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0106') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0106', '2026-04-22', 'Bill — Advanced Glory Logistic', 'AGL2601027', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'Advanced Glory Logistic', 0.00, 315.00),
    (eid, '30100', 'Advanced Glory Logistic', 315.00, 0.00);
END IF;

-- Trans#107 (2026-04-22)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0107') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0107', '2026-04-22', 'Bill — Advanced Glory Logistic', 'AGL2601026', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'OCEAN FREIGHT', 0.00, 1050.00),
    (eid, '30100', 'OCEAN FREIGHT', 1050.00, 0.00);
END IF;

-- Trans#108 (2026-04-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0108') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0108', '2026-04-30', 'Bill — SHIHANOUKVILLE AUTONOMOUS PORT', '202600140967', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'SHIHANOUKVILLE AUTONOMOUS PORT', 0.00, 112.20),
    (eid, '30100', 'SHIHANOUKVILLE AUTONOMOUS PORT', 102.00, 0.00),
    (eid, '13000', 'SHIHANOUKVILLE AUTONOMOUS PORT', 10.20, 0.00);
END IF;

-- Trans#109 (2026-04-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0109') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0109', '2026-04-30', 'Bill — ITC', 'KH-26-05-SJ0000783', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'ITC', 0.00, 391902.00),
    (eid, '12100', 'E1504FA-BQ4298W 1K-MIXED BLACK', 391902.00, 0.00);
END IF;

-- Trans#120 (2026-03-12)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0120') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0120', '2026-03-12', 'Bill — ITC', 'KH-C00007', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'ITC', 0.00, 50.00),
    (eid, '12600', 'ITC', 50.00, 0.00);
END IF;

-- Trans#123 (2026-05-08)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0123') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0123', '2026-05-08', 'Payment — GANZBERG BREWERY', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'GANZBERG BREWERY', 1210.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 1210.00);
END IF;

-- Trans#125 (2026-05-06)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0125') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0125', '2026-05-06', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ITC', 0.00, 5825.00),
    (eid, '20000', 'ITC', 5825.00, 0.00);
END IF;

-- Trans#126 (2026-04-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0126') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0126', '2026-04-30', 'General Journal — 620/24Month =25.83 per month', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '64000', '620/24Month =25.83 per month', 25.83, 0.00),
    (eid, '18001', '620/24Month =25.83 per month', 0.00, 25.83);
END IF;

-- Trans#128 (2026-03-31)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0128') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0128', '2026-03-31', 'General Journal — 620/24Month =25.83 per month', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '64000', '620/24Month =25.83 per month', 25.83, 0.00),
    (eid, '18001', '620/24Month =25.83 per month', 0.00, 25.83);
END IF;

-- Trans#129 (2026-05-04)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0129') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0129', '2026-05-04', 'Invoice — GANZBERG BREWERY', '05SJ0000118', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 1800.00, 0.00),
    (eid, '40700', 'Legion 5 15IRX10 (83LY00S9FQ)', 0.00, 1499.00),
    (eid, '40600', 'GANZBERG BREWERY', 0.00, 357.00),
    (eid, '12600', 'GANZBERG BREWERY', 0.00, 325.57),
    (eid, '50600', 'GANZBERG BREWERY', 325.57, 0.00),
    (eid, '41100', 'Sale Discount', 56.00, 0.00);
END IF;

-- Trans#130 (2026-05-04)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0130') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0130', '2026-05-04', 'Invoice — IT SOLUTION DIGITAL CO.,LTD', '05SJ0000113', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'IT SOLUTION DIGITAL CO.,LTD', 836.00, 0.00),
    (eid, '40300', 'Cyborg 15 Black Edition A13UC-2440KH', 0.00, 836.00);
END IF;

-- Trans#131 (2026-05-07)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0131') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0131', '2026-05-07', 'Invoice — GANZBERG BREWERY', '05SJ0000269', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GANZBERG BREWERY', 4889.00, 0.00),
    (eid, '40300', 'Raider 18 Max HX A2WJ-1202KH', 0.00, 4889.00),
    (eid, '12600', 'SAC00003', 0.00, 0.57),
    (eid, '50600', 'SAC00003', 0.57, 0.00);
END IF;

-- Trans#134 (2026-05-07)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0134') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0134', '2026-05-07', 'Invoice — PROXY SOLUTIONS Co.,LTD', 'TI2026-0001', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'refKH26-05-SJ0000275', 370832.00, 0.00),
    (eid, '40100', 'E1504FA-BQ4298W 1K-MIXED BLACK', 0.00, 421400.00),
    (eid, '12100', 'E1504FA-BQ4298W 1K-MIXED BLACK', 0.00, 391902.00),
    (eid, '50100', 'E1504FA-BQ4298W 1K-MIXED BLACK', 391902.00, 0.00),
    (eid, '25000', 'refKH26-05-SJ0000275', 84280.00, 0.00),
    (eid, '23000', 'Vat Out', 0.00, 33712.00);
END IF;

-- Trans#135 (2026-05-08)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0135') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0135', '2026-05-08', 'Invoice — TECHWIZ SOLUTIONS', '05SJ0000303', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'TECHWIZ SOLUTIONS', 1455.00, 0.00),
    (eid, '40300', 'Prestige 16 AI+ C3MG-036KH', 0.00, 1455.00),
    (eid, '12300', 'Prestige 16 AI+ C3MG-036KH', 0.00, 1455.00),
    (eid, '50300', 'Prestige 16 AI+ C3MG-036KH', 1455.00, 0.00);
END IF;

-- Trans#137 (2026-05-12)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0137') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0137', '2026-05-12', 'General Journal', '2026-05001', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', '', 10000.00, 0.00),
    (eid, '30100', '', 0.00, 10000.00);
END IF;

-- Trans#138 (2026-05-13)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0138') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0138', '2026-05-13', 'Credit Memo — ECAM SOLUTION CO., LTD.', '05SJ0000304', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'ECAM SOLUTION CO., LTD.', 0.00, 240.00),
    (eid, '14400', 'ECAM SOLUTION CO., LTD.', 240.00, 0.00);
END IF;

-- Trans#139 (2026-05-13)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0139') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0139', '2026-05-13', 'General Journal — Adjustment Ecam solution KH-26-03-RT0000001', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '30100', 'Adjustment Ecam solution KH-26-03-RT0000001', 240.00, 0.00),
    (eid, '14400', 'Adjustment Ecam solution KH-26-03-RT0000001', 0.00, 240.00);
END IF;

-- Trans#141 (2026-05-04)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0141') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0141', '2026-05-04', 'Bill — Wicam Corporation LTD', '000753', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'Wicam Corporation LTD', 0.00, 561.00),
    (eid, '14000', 'Internet 6 Months ( 21-May-20-Nov-2026)', 510.00, 0.00),
    (eid, '13000', '510/6=85/permonth', 51.00, 0.00);
END IF;

-- Trans#144 (2026-05-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0144') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0144', '2026-05-01', 'General Journal — Interest PMNT', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '70100', 'Interest PMNT', 0.00, 5.68),
    (eid, '11100', 'Interest PMNT', 5.68, 0.00);
END IF;

-- Trans#145 (2026-05-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0145') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0145', '2026-05-01', 'General Journal — Withholding tax on interest INT Withhold', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '67600', 'Withholding tax on interest INT Withhold', 0.23, 0.00),
    (eid, '11100', 'Withholding tax on interest INT Withhold', 0.00, 0.23);
END IF;

-- Trans#146 (2026-05-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0146') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0146', '2026-05-01', 'Bill — Tann Pisey', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'Tann Pisey', 0.00, 1000.00),
    (eid, '60000', 'Tann Pisey', 1000.00, 0.00);
END IF;

-- Trans#147 (2026-05-04)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0147') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0147', '2026-05-04', 'Bill — staffs', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'staffs', 0.00, 13.00),
    (eid, '68200', 'staffs', 13.00, 0.00);
END IF;

-- Trans#148 (2026-05-05)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0148') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0148', '2026-05-05', 'Bill Pmt -Check — staffs', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'staffs', 0.00, 13.00),
    (eid, '20000', 'staffs', 13.00, 0.00);
END IF;

-- Trans#149 (2026-05-05)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0149') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0149', '2026-05-05', 'Bill Pmt -Check — Tann Pisey', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'Tann Pisey', 0.00, 1000.00),
    (eid, '20000', 'Tann Pisey', 1000.00, 0.00);
END IF;

-- Trans#150 (2026-05-05)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0150') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0150', '2026-05-05', 'Bill Pmt -Check — TOP TECH', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'TOP TECH', 0.00, 325.00),
    (eid, '20000', 'TOP TECH', 325.00, 0.00);
END IF;

-- Trans#151 (2026-05-12)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0151') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0151', '2026-05-12', 'Bill — staffs', '2026-05006', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'staffs', 0.00, 153.03),
    (eid, '69200', 'staffs', 153.03, 0.00);
END IF;

-- Trans#152 (2026-05-12)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0152') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0152', '2026-05-12', 'Bill — Others', '2026-05005', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'Others', 0.00, 50.00),
    (eid, '65000', 'Fill The Gas Air-conditioner', 50.00, 0.00);
END IF;

-- Trans#153 (2026-05-13)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0153') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0153', '2026-05-13', 'Bill Pmt -Check — Others', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'Others', 0.00, 50.00),
    (eid, '20000', 'Others', 50.00, 0.00);
END IF;

-- Trans#154 (2026-05-13)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0154') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0154', '2026-05-13', 'Bill Pmt -Check — staffs', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'staffs', 0.00, 153.03),
    (eid, '20000', 'staffs', 153.03, 0.00);
END IF;

-- Trans#155 (2026-05-13)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0155') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0155', '2026-05-13', 'Bill Pmt -Check — Wicam Corporation LTD', '2026-05004', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'Wicam Corporation LTD', 0.00, 561.00),
    (eid, '20000', 'Wicam Corporation LTD', 561.00, 0.00);
END IF;

-- Trans#156 (2026-04-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0156') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0156', '2026-04-30', 'Bill — General Deparetment of Customs and Excise', 'P28944', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'General Deparetment of Customs and Excise', 0.00, 10.00),
    (eid, '30100', 'Scanning Fee', 10.00, 0.00);
END IF;

-- Trans#159 (2026-05-20)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0159') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0159', '2026-05-20', 'Payment — GANZBERG BREWERY', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'GANZBERG BREWERY', 4889.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 4889.00);
END IF;

-- Trans#160 (2026-05-19)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0160') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0160', '2026-05-19', 'Bill Pmt -Check — Advanced Glory Logistic', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'Advanced Glory Logistic', 0.00, 3110.70),
    (eid, '20000', 'Advanced Glory Logistic', 3110.70, 0.00);
END IF;

-- Trans#161 (2026-05-19)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0161') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0161', '2026-05-19', 'Bill Pmt -Check — General Deparetment of Customs and Excise', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'General Deparetment of Customs and Excise', 0.00, 10.00),
    (eid, '20000', 'General Deparetment of Customs and Excise', 10.00, 0.00);
END IF;

-- Trans#162 (2026-05-19)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0162') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0162', '2026-05-19', 'Bill Pmt -Check — SHIHANOUKVILLE AUTONOMOUS PORT', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'SHIHANOUKVILLE AUTONOMOUS PORT', 0.00, 112.20),
    (eid, '20000', 'SHIHANOUKVILLE AUTONOMOUS PORT', 112.20, 0.00);
END IF;

-- Trans#163 (2026-05-18)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0163') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0163', '2026-05-18', 'Check — EDC', '2026-05007', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'EDC', 0.00, 251.10),
    (eid, '68400', 'Electric for 04/04/2026-05/05/2026', 251.10, 0.00);
END IF;

-- Trans#164 (2026-05-20)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0164') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0164', '2026-05-20', 'Transfer — Funds Transfer', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'Funds Transfer', 0.00, 4889.00),
    (eid, '11100', 'Funds Transfer', 4889.00, 0.00);
END IF;

-- Trans#165 (2026-05-07)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0165') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0165', '2026-05-07', 'Bill — ITC', 'KH-26-05-SJ0000269', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'ITC', 0.00, 4889.00),
    (eid, '12300', 'Raider 18 Max HX A2WJ-1202KH', 4889.00, 0.00),
    (eid, '12300', 'Raider 18 Max HX A2WJ-1202KH', 0.00, 4889.00),
    (eid, '50300', 'Raider 18 Max HX A2WJ-1202KH', 4889.00, 0.00);
END IF;

-- Trans#166 (2026-05-04)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0166') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0166', '2026-05-04', 'Bill — ITC', 'KH-26-05-SJ0000133', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'ITC', 0.00, 836.00),
    (eid, '12300', 'Cyborg 15 Black Edition A13UC-2440KH', 836.00, 0.00),
    (eid, '12300', 'Cyborg 15 Black Edition A13UC-2440KH', 0.00, 836.00),
    (eid, '50300', 'Cyborg 15 Black Edition A13UC-2440KH', 836.00, 0.00);
END IF;

-- Trans#167 (2026-05-04)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0167') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0167', '2026-05-04', 'Bill — ITC', 'KH-26-05-SJ0000303', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'ITC', 0.00, 1455.00),
    (eid, '12300', 'Prestige 16 AI+ C3MG-036KH', 1455.00, 0.00);
END IF;

-- Trans#168 (2026-05-22)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0168') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0168', '2026-05-22', 'Payment — GANZBERG BREWERY', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11200', 'GANZBERG BREWERY', 1800.00, 0.00),
    (eid, '11900', 'GANZBERG BREWERY', 0.00, 1800.00);
END IF;

-- Trans#170 (2026-05-25)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0170') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0170', '2026-05-25', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11300', 'Prepayment KH26-05-SJ0000783', 0.00, 84280.00),
    (eid, '20000', 'Prepayment KH26-05-SJ0000783', 84280.00, 0.00);
END IF;

-- Trans#172 (2026-04-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0172') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0172', '2026-04-30', 'Deposit — Deposit', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11300', 'Deposit', 7549.32, 0.00),
    (eid, '30100', 'Beg bal for April', 0.00, 7549.32);
END IF;

-- Trans#173 (2026-01-15)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0173') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0173', '2026-01-15', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'SAC00003 ref : KH-C00002,OA00410: 5 ref KH-C00008', 0.00, 42.00),
    (eid, '20000', 'SAC00003 ref : KH-C00002,OA00410: 5 ref KH-C00008', 42.00, 0.00);
END IF;

-- Trans#174 (2026-01-23)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0174') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0174', '2026-01-23', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ITC', 0.00, 50.00),
    (eid, '20000', 'ITC', 50.00, 0.00);
END IF;

-- Trans#175 (2026-05-08)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0175') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0175', '2026-05-08', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ITC', 0.00, 1210.00),
    (eid, '20000', 'ITC', 1210.00, 0.00);
END IF;

-- Trans#176 (2026-05-08)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0176') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0176', '2026-05-08', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ITC', 0.00, 836.00),
    (eid, '20000', 'ITC', 836.00, 0.00);
END IF;

-- Trans#177 (2026-05-08)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0177') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0177', '2026-05-08', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ITC', 0.00, 1455.00),
    (eid, '20000', 'ITC', 1455.00, 0.00);
END IF;

-- Trans#178 (2026-05-19)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0178') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0178', '2026-05-19', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ITC', 0.00, 4889.00),
    (eid, '20000', 'ITC', 4889.00, 0.00);
END IF;

-- Trans#179 (2026-05-25)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0179') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0179', '2026-05-25', 'Payment — PROXY SOLUTIONS Co.,LTD', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11300', 'PROXY SOLUTIONS Co.,LTD', 84280.00, 0.00),
    (eid, '11900', 'PROXY SOLUTIONS Co.,LTD', 0.00, 84280.00);
END IF;

-- Trans#180 (2026-05-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0180') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0180', '2026-05-01', 'Deposit — Deposit', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'Deposit', 9833.00, 0.00),
    (eid, '30100', '1210+836+1455+1443+4889', 0.00, 9833.00);
END IF;

-- Trans#181 (2026-05-07)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0181') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0181', '2026-05-07', 'General Journal — Adjustment VAT out 2025 8,428.00', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
END IF;

-- Trans#182 (2026-05-22)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0182') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0182', '2026-05-22', 'Transfer — Funds Transfer', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11200', 'Funds Transfer', 0.00, 1800.00),
    (eid, '11100', 'Funds Transfer', 1800.00, 0.00);
END IF;

-- Trans#184 (2026-05-04)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0184') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0184', '2026-05-04', 'Bill — ITC', 'KH-26-05-SJ0000118', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'ITC', 0.00, 1443.00),
    (eid, '12700', 'Legion 5 15IRX10 (83LY00S9FQ)', 1499.00, 0.00),
    (eid, '12700', 'Legion 5 15IRX10 (83LY00S9FQ)', 0.00, 1499.00),
    (eid, '50700', 'Legion 5 15IRX10 (83LY00S9FQ)', 1499.00, 0.00),
    (eid, '70200', 'PURCHASE DISC', 0.00, 56.00);
END IF;

-- Trans#185 (2026-05-14)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0185') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0185', '2026-05-14', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ITC', 0.00, 1443.00),
    (eid, '20000', 'ITC', 1443.00, 0.00);
END IF;

-- Trans#186 (2026-05-25)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0186') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0186', '2026-05-25', 'Payment — PROXY SOLUTIONS Co.,LTD', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11300', 'PROXY SOLUTIONS Co.,LTD', 370832.00, 0.00),
    (eid, '11900', 'PROXY SOLUTIONS Co.,LTD', 0.00, 370832.00);
END IF;

-- Trans#187 (2026-05-25)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0187') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0187', '2026-05-25', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11300', 'ITC', 0.00, 336079.17),
    (eid, '20000', 'ITC', 336079.17, 0.00);
END IF;

-- Trans#188 (2026-05-27)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0188') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0188', '2026-05-27', 'Payment — TECHWIZ SOLUTIONS', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'TECHWIZ SOLUTIONS', 1455.00, 0.00),
    (eid, '11900', 'TECHWIZ SOLUTIONS', 0.00, 1455.00);
END IF;

-- Trans#189 (2026-05-25)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0189') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0189', '2026-05-25', 'Bill — ITC', 'KH-26-05-SJ0000817', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'Buy 1 Unit get cash back 15$', 0.00, 523.47),
    (eid, '12700', 'IdeaPad Slim 3 15AMN8 (82XQ00KQFQ)', 538.47, 0.00),
    (eid, '70200', 'PURCHASE DISC', 0.00, 15.00);
END IF;

-- Trans#190 (2026-05-25)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0190') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0190', '2026-05-25', 'Invoice — GATES-HUB COMPANY LIMTIED', '05SJ0000817', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11900', 'GATES-HUB COMPANY LIMTIED', 564.00, 0.00),
    (eid, '40700', 'IdeaPad Slim 3 15AMN8 (82XQ00KQFQ)', 0.00, 579.00),
    (eid, '12700', 'IdeaPad Slim 3 15AMN8 (82XQ00KQFQ)', 0.00, 538.47),
    (eid, '50700', 'IdeaPad Slim 3 15AMN8 (82XQ00KQFQ)', 538.47, 0.00),
    (eid, '41100', 'Sale Discount', 15.00, 0.00);
END IF;

-- Trans#195 (2026-03-31)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0195') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0195', '2026-03-31', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ITC', 0.00, 12483.00),
    (eid, '20000', 'ITC', 12483.00, 0.00);
END IF;

-- Trans#196 (2026-01-31)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0196') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0196', '2026-01-31', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ITC', 0.00, 30966.00),
    (eid, '20000', 'ITC', 30966.00, 0.00);
END IF;

-- Trans#197 (2026-02-28)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0197') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0197', '2026-02-28', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ITC', 0.00, 3538.00),
    (eid, '20000', 'ITC', 3538.00, 0.00);
END IF;

-- Trans#198 (2026-03-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0198') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0198', '2026-03-01', 'Deposit — Deposit', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'Deposit', 620.00, 0.00),
    (eid, '30100', 'Internet', 0.00, 620.00);
END IF;

-- Trans#199 (2026-03-01)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0199') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0199', '2026-03-01', 'Deposit — Deposit', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'Deposit', 1845.00, 0.00),
    (eid, '30100', 'POSM', 0.00, 1845.00);
END IF;

-- Trans#200 (2026-04-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0200') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0200', '2026-04-30', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'ITC', 0.00, 5521.00),
    (eid, '20000', 'ITC', 5521.00, 0.00);
END IF;

-- Trans#202 (2026-05-27)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0202') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0202', '2026-05-27', 'Transfer — Funds Transfer', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'Funds Transfer', 0.00, 1455.00),
    (eid, '11100', 'Funds Transfer', 1455.00, 0.00);
END IF;

-- Trans#204 (2026-04-15)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0204') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0204', '2026-04-15', 'Deposit — Deposit', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '10100', 'Deposit', 1972.00, 0.00),
    (eid, '30100', 'AP-1092', 0.00, 1972.00);
END IF;

-- Trans#205 (2026-05-28)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0205') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0205', '2026-05-28', 'Payment — IT SOLUTION DIGITAL CO.,LTD', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'IT SOLUTION DIGITAL CO.,LTD', 836.00, 0.00),
    (eid, '11900', 'IT SOLUTION DIGITAL CO.,LTD', 0.00, 836.00);
END IF;

-- Trans#206 (2026-05-21)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0206') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0206', '2026-05-21', 'Bill — GDT', '2626-05009', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'TAX PAYMENT FOR APRIL', 0.00, 222.26),
    (eid, '69100', 'TAX PAYMENT FOR APRIL', 222.26, 0.00);
END IF;

-- Trans#207 (2026-05-21)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0207') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0207', '2026-05-21', 'Bill Pmt -Check — GDT', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'TAX PAYMENT FOR APRIL', 0.00, 222.26),
    (eid, '20000', 'TAX PAYMENT FOR APRIL', 222.26, 0.00);
END IF;

-- Trans#210 (2026-05-30)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0210') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0210', '2026-05-30', 'Check', '2026-05008', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', '', 0.00, 20.00),
    (eid, '67900', 'Kakada paid request Claude Pro Monthly Subcription for June', 20.00, 0.00);
END IF;

-- Trans#211 (2026-05-31)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0211') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0211', '2026-05-31', 'General Journal — Pen 4 x0.27=1.08', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '63000', 'Pen 4 x0.27=1.08', 28.28, 0.00),
    (eid, '14300', 'Tote Bag 1 x2.8=2.8', 0.00, 28.28);
END IF;

-- Trans#212 (2026-05-31)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0212') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0212', '2026-05-31', 'General Journal — Internet Expense for May', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '68100', 'Internet Expense for May', 85.00, 0.00),
    (eid, '14000', 'Internet Expense for May', 0.00, 85.00);
END IF;

-- Trans#213 (2026-05-31)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0213') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0213', '2026-05-31', 'General Journal — 620/24Month =25.83 per month', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '64000', '620/24Month =25.83 per month', 25.83, 0.00),
    (eid, '18001', '620/24Month =25.83 per month', 0.00, 25.83);
END IF;

-- Trans#214 (2026-05-31)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0214') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0214', '2026-05-31', 'General Journal', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '13100', '', 3393.07, 0.00),
    (eid, '13000', '', 0.00, 37105.07),
    (eid, '23000', '', 33712.00, 0.00);
END IF;

-- Trans#218 (2026-05-04)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0218') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0218', '2026-05-04', 'General Journal — Bank Transfer for Rental Expense', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11100', 'Bank Transfer for Rental Expense', 1600.00, 0.00),
    (eid, '30100', 'Adjustment', 0.00, 1084.45),
    (eid, '70300', 'Adjustment', 0.00, 515.55);
END IF;

-- Trans#219 (2026-04-20)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0219') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0219', '2026-04-20', 'General Journal — Adjustment Expense for April', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '30100', 'Adjustment Expense for April', 61.06, 0.00),
    (eid, '11100', 'Adjustment Expense for April', 0.00, 61.06);
END IF;

-- Trans#220 (2026-05-04)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0220') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0220', '2026-05-04', 'General Journal — Adjustment to opening balance with Sovanney', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '30100', 'Adjustment to opening balance with Sovanney', 4575.00, 0.00),
    (eid, '11300', 'Adjustment to opening balance with Sovanney', 0.00, 4575.00);
END IF;

-- Trans#221 (2026-05-31)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0221') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0221', '2026-05-31', 'Bill — staffs', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'staffs', 0.00, 4575.00),
    (eid, '61000', 'staffs', 4575.00, 0.00);
END IF;

-- Trans#224 (2026-05-28)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0224') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0224', '2026-05-28', 'Bill — PPWSA', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '20000', 'PPWSA', 0.00, 3.05),
    (eid, '68500', 'PPWSA', 3.05, 0.00);
END IF;

-- Trans#225 (2026-05-25)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0225') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0225', '2026-05-25', 'Bill Pmt -Check — ITC', '', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11300', 'ITC', 0.00, 8428.00),
    (eid, '20000', 'ITC', 8428.00, 0.00);
END IF;

-- Trans#226 (2026-05-25)
IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE entry_number = 'QB-0226') THEN
  INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted)
  VALUES ('QB-0226', '2026-05-25', 'General Journal — Ajustment VAT out 2025', 'ADJ', 'quickbooks-import', true)
  RETURNING id INTO eid;
  INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit) VALUES
    (eid, '11300', 'Ajustment VAT out 2025', 8428.00, 0.00),
    (eid, '70300', 'Ajustment VAT out 2025', 0.00, 8428.00);
END IF;

END $$;
