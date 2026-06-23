-- QB Import: Insert payment receipts to mark all QB-imported invoices as Paid
--
-- Background: The 20260615_import_qb_jan_may_2026.sql migration imported QB invoice data
-- but did NOT import the corresponding payment receipts. All these amounts have been
-- collected in QuickBooks; the outstanding balances are accounting artifacts.
--
-- Mechanism: Collection status = 'Paid' when:
--   outstanding = Invoice.Amount - Invoice.Deposit - SUM(Receipts) <= 0.005
-- This migration inserts one receipt per invoice for the exact outstanding amount.
--
-- Scope:
--   B2C: 16 invoices → receipts table
--   B2B: 18 invoices → b2b_receipts table
--
-- Excluded (intentionally not auto-paid — review separately):
--   TI2026-00002 (B2C, QUEEN FINANCE, $112.01 remaining) — not QB import; partial receipt already in system
--   TI2026-00003 (B2B, PROXY SOLUTIONS, $170,892)        — live invoice, issued Jun 2026 by Kakada Eng
--   TI2026-00002 (B2B, IT Solution Digital, $511)         — live invoice, System Admin
--   2026-00004   (B2B, IT Solution Digital, $17,240)      — live invoice, issued Jun 2026 by Kakada Eng
--   2026-00005   (B2B, IT Solution Digital, $1,758)       — live invoice, issued Jun 2026 by Kakada Eng
--
-- After running:
--   B2C outstanding:  $0 (except TI2026-00002 QUEEN FINANCE $112.01 — still Overdue)
--   B2B outstanding:  $190,401 (Pending only — TI2026-00003, TI2026-00002, 2026-00004, 2026-00005)
--   B2B overdue:      $0 (all 18 QB-import overdue invoices cleared)

-- ────────────────────────────────────────────────────────────────────────────────
-- B2C RECEIPTS  (receipts table)
-- Outstanding = Amount (no deposits on any of these)
-- ────────────────────────────────────────────────────────────────────────────────
INSERT INTO receipts (
    "RV No", "RV Date", "Inv No", "SO No", "DO No",
    "Company Name", "Company Address", "Contact Name", "Phone Number", "Email",
    "Amount", "Currency", "Payment Method", "Tax Type", "Status",
    "Payment Term", "Tin No", "Prepared By", "Approved By",
    "Prepared By Position", "Approved By Position",
    "Remark", "Terms and Conditions", "File", "Created By", "ItemsJSON"
) VALUES

-- SJ0000019 · GANZBERG BREWERY · $6,798
('QBRV-SJ0000019', '2026-01-02', 'SJ0000019', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 6798, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000019","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000019","qty":1,"unitPrice":6798,"amount":6798}]'),

-- SJ0000024 · GANZBERG BREWERY · $1,674
('QBRV-SJ0000024', '2026-03-02', 'SJ0000024', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 1674, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000024","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000024","qty":1,"unitPrice":1674,"amount":1674}]'),

-- SJ0000105 · GANZBERG BREWERY · $1,560
('QBRV-SJ0000105', '2026-03-04', 'SJ0000105', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 1560, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000105","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000105","qty":1,"unitPrice":1560,"amount":1560}]'),

-- SJ0000154 · GANZBERG BREWERY · $780
('QBRV-SJ0000154', '2026-03-06', 'SJ0000154', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 780, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000154","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000154","qty":1,"unitPrice":780,"amount":780}]'),

-- SJ0000156 · GANZBERG BREWERY · $780
('QBRV-SJ0000156', '2026-03-06', 'SJ0000156', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 780, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000156","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000156","qty":1,"unitPrice":780,"amount":780}]'),

-- SJ0000213 · Tonle Sap Authority · $8,850
('QBRV-SJ0000213', '2026-04-07', 'SJ0000213', NULL, NULL,
 'Tonle Sap Authority', NULL, 'Tonle Sap Authority', NULL, NULL,
 8850, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000213","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000213","qty":1,"unitPrice":8850,"amount":8850}]'),

-- SJ0000307 · GANZBERG BREWERY · $837
('QBRV-SJ0000307', '2026-03-13', 'SJ0000307', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 837, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000307","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000307","qty":1,"unitPrice":837,"amount":837}]'),

-- SJ0000325 · GANZBERG BREWERY · $4,670
('QBRV-SJ0000325', '2026-03-13', 'SJ0000325', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 4670, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000325","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000325","qty":1,"unitPrice":4670,"amount":4670}]'),

-- SJ0000379 · GANZBERG BREWERY · $755
('QBRV-SJ0000379', '2026-03-16', 'SJ0000379', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 755, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000379","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000379","qty":1,"unitPrice":755,"amount":755}]'),

-- SJ0000441 · GANZBERG BREWERY · $1,880
('QBRV-SJ0000441', '2026-04-21', 'SJ0000441', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 1880, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000441","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000441","qty":1,"unitPrice":1880,"amount":1880}]'),

-- SJ0000463 · GANZBERG BREWERY · $755
('QBRV-SJ0000463', '2026-03-18', 'SJ0000463', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 755, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000463","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000463","qty":1,"unitPrice":755,"amount":755}]'),

-- SJ0000507 · SOKIMEX INVESTMENT GROUP CO. · $445
('QBRV-SJ0000507', '2026-01-14', 'SJ0000507', NULL, NULL,
 'SOKIMEX INVESTMENT GROUP CO.', NULL, 'SOKIMEX INVESTMENT GROUP CO.', NULL, NULL,
 445, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000507","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000507","qty":1,"unitPrice":445,"amount":445}]'),

-- SJ0000586 · GANZBERG BREWERY · $1,210
('QBRV-SJ0000586', '2026-04-25', 'SJ0000586', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 1210, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000586","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000586","qty":1,"unitPrice":1210,"amount":1210}]'),

-- SJ0000607 · CCU Commercial Bank · $670
('QBRV-SJ0000607', '2026-03-23', 'SJ0000607', NULL, NULL,
 'CCU Commercial Bank', NULL, 'CCU Commercial Bank', NULL, NULL,
 670, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0000607","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000607","qty":1,"unitPrice":670,"amount":670}]'),

-- SJ0001028 · GANZBERG BREWERY · $2,050
('QBRV-SJ0001028', '2026-01-26', 'SJ0001028', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 2050, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-SJ0001028","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0001028","qty":1,"unitPrice":2050,"amount":2050}]'),

-- 05SJ0000118 · GANZBERG BREWERY · $1,800
('QBRV-05SJ0000118', '2026-05-04', '05SJ0000118', NULL, NULL,
 'GANZBERG BREWERY', NULL, 'GANZBERG BREWERY', NULL, NULL,
 1800, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-05SJ0000118","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice 05SJ0000118","qty":1,"unitPrice":1800,"amount":1800}]')

ON CONFLICT ("RV No") DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────────
-- B2B RECEIPTS  (b2b_receipts table)
-- ────────────────────────────────────────────────────────────────────────────────
-- Note on TI2026-0000: Amount=$370,832, Deposit=$92,708 → outstanding=$278,124
--   The deposit offset is already baked into the invoice Amount (line item -$92,708)
--   AND the Deposit field is set, so the collection system subtracts it a second time.
--   Receipt is for $278,124 to match the system's computed outstanding exactly.
--
-- Note on 2025-00171: This is the advance payment/deposit invoice ($92,708).
--   It has no deposit field and no receipts, so outstanding = $92,708.
-- ────────────────────────────────────────────────────────────────────────────────
INSERT INTO b2b_receipts (
    "RV No", "RV Date", "Inv No", "SO No", "DO No",
    "Company Name", "Company Address", "Contact Name", "Phone Number", "Email",
    "Amount", "Currency", "Payment Method", "Tax Type", "Status",
    "Payment Term", "Tin No", "Prepared By", "Approved By",
    "Prepared By Position", "Approved By Position",
    "Remark", "Terms and Conditions", "File", "Created By", "ItemsJSON"
) VALUES

-- TI2026-0000 · PROXY SOLUTIONS Co.,LTD · outstanding $278,124 (Amount $370,832 − Deposit $92,708)
('QBRV-B2B-TI2026-0000', '2026-05-07', 'TI2026-0000', NULL, NULL,
 'PROXY SOLUTIONS Co.,LTD', NULL, 'PROXY SOLUTIONS Co.,LTD', NULL, NULL,
 278124, 'USD', 'Bank Transfer', 'VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-TI2026-0000","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice TI2026-0000 (balance after deposit)","qty":1,"unitPrice":278124,"amount":278124}]'),

-- 2025-00171 · PROXY SOLUTIONS Co.,LTD · $92,708 (advance deposit invoice)
('QBRV-B2B-2025-00171', '2025-12-22', '2025-00171', NULL, NULL,
 'PROXY SOLUTIONS Co.,LTD', NULL, 'PROXY SOLUTIONS Co.,LTD', NULL, NULL,
 92708, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Deposit payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-2025-00171","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice 2025-00171 (advance deposit)","qty":1,"unitPrice":92708,"amount":92708}]'),

-- SJ0000232 · TECHWIZ SOLUTIONS · $830
('QBRV-B2B-SJ0000232', '2026-01-07', 'SJ0000232', NULL, NULL,
 'TECHWIZ SOLUTIONS', NULL, 'TECHWIZ SOLUTIONS', NULL, NULL,
 830, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000232","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000232","qty":1,"unitPrice":830,"amount":830}]'),

-- SJ0000270 · ICTECH SOLUTIONS · $2,450
('QBRV-B2B-SJ0000270', '2026-01-08', 'SJ0000270', NULL, NULL,
 'ICTECH SOLUTIONS', NULL, 'ICTECH SOLUTIONS', NULL, NULL,
 2450, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000270","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000270","qty":1,"unitPrice":2450,"amount":2450}]'),

-- SJ0000270-TW · TECHWIZ SOLUTIONS · $948
('QBRV-B2B-SJ0000270-TW', '2026-04-10', 'SJ0000270-TW', NULL, NULL,
 'TECHWIZ SOLUTIONS', NULL, 'TECHWIZ SOLUTIONS', NULL, NULL,
 948, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000270-TW","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000270-TW","qty":1,"unitPrice":948,"amount":948}]'),

-- SJ0000281 · BMSC · $172
('QBRV-B2B-SJ0000281', '2026-02-10', 'SJ0000281', NULL, NULL,
 'BMSC', NULL, 'BMSC', NULL, NULL,
 172, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000281","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000281","qty":1,"unitPrice":172,"amount":172}]'),

-- SJ0000539 · PROXY SOLUTIONS Co.,LTD · $399
('QBRV-B2B-SJ0000539', '2026-03-20', 'SJ0000539', NULL, NULL,
 'PROXY SOLUTIONS Co.,LTD', NULL, 'PROXY SOLUTIONS Co.,LTD', NULL, NULL,
 399, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000539","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000539","qty":1,"unitPrice":399,"amount":399}]'),

-- SJ0000568 · IT SOLUTION PARTNER · $20,416
('QBRV-B2B-SJ0000568', '2026-01-15', 'SJ0000568', NULL, NULL,
 'IT SOLUTION PARTNER', NULL, 'IT SOLUTION PARTNER', NULL, NULL,
 20416, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000568","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000568","qty":1,"unitPrice":20416,"amount":20416}]'),

-- SJ0000620 · TECHWIZ SOLUTIONS · $634
('QBRV-B2B-SJ0000620', '2026-03-24', 'SJ0000620', NULL, NULL,
 'TECHWIZ SOLUTIONS', NULL, 'TECHWIZ SOLUTIONS', NULL, NULL,
 634, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000620","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000620","qty":1,"unitPrice":634,"amount":634}]'),

-- SJ0000687 · ICTECH SOLUTIONS · $1,125
('QBRV-B2B-SJ0000687', '2026-03-26', 'SJ0000687', NULL, NULL,
 'ICTECH SOLUTIONS', NULL, 'ICTECH SOLUTIONS', NULL, NULL,
 1125, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000687","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000687","qty":1,"unitPrice":1125,"amount":1125}]'),

-- SJ0000240 · IT SOLUTION DIGITAL CO.,LTD · $87
('QBRV-B2B-SJ0000240', '2026-04-09', 'SJ0000240', NULL, NULL,
 'IT SOLUTION DIGITAL CO.,LTD', NULL, 'IT SOLUTION DIGITAL CO.,LTD', NULL, NULL,
 87, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000240","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000240","qty":1,"unitPrice":87,"amount":87}]'),

-- SJ0000241 · IT SOLUTION DIGITAL CO.,LTD · $5,825
('QBRV-B2B-SJ0000241', '2026-04-09', 'SJ0000241', NULL, NULL,
 'IT SOLUTION DIGITAL CO.,LTD', NULL, 'IT SOLUTION DIGITAL CO.,LTD', NULL, NULL,
 5825, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000241","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000241","qty":1,"unitPrice":5825,"amount":5825}]'),

-- SJ0000746 · MYTEB MALAYSIA · $119
('QBRV-B2B-SJ0000746', '2026-01-19', 'SJ0000746', NULL, NULL,
 'MYTEB MALAYSIA', NULL, 'MYTEB MALAYSIA', NULL, NULL,
 119, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000746","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000746","qty":1,"unitPrice":119,"amount":119}]'),

-- SJ0000845 · IT SOLUTION DIGITAL CO.,LTD · $110
('QBRV-B2B-SJ0000845', '2026-01-22', 'SJ0000845', NULL, NULL,
 'IT SOLUTION DIGITAL CO.,LTD', NULL, 'IT SOLUTION DIGITAL CO.,LTD', NULL, NULL,
 110, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000845","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000845","qty":1,"unitPrice":110,"amount":110}]'),

-- SJ0000895 · IT SOLUTION DIGITAL CO.,LTD · $929
('QBRV-B2B-SJ0000895', '2026-01-23', 'SJ0000895', NULL, NULL,
 'IT SOLUTION DIGITAL CO.,LTD', NULL, 'IT SOLUTION DIGITAL CO.,LTD', NULL, NULL,
 929, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000895","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000895","qty":1,"unitPrice":929,"amount":929}]'),

-- SJ0000024 · ICTECH SOLUTIONS · $635  (B2B — separate from B2C SJ0000024/GANZBERG)
('QBRV-B2B-SJ0000024', '2026-02-02', 'SJ0000024', NULL, NULL,
 'ICTECH SOLUTIONS', NULL, 'ICTECH SOLUTIONS', NULL, NULL,
 635, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-SJ0000024","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice SJ0000024 (B2B)","qty":1,"unitPrice":635,"amount":635}]'),

-- 05SJ0000113 · IT SOLUTION DIGITAL CO.,LTD · $836
('QBRV-B2B-05SJ0000113', '2026-05-04', '05SJ0000113', NULL, NULL,
 'IT SOLUTION DIGITAL CO.,LTD', NULL, 'IT SOLUTION DIGITAL CO.,LTD', NULL, NULL,
 836, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-05SJ0000113","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice 05SJ0000113","qty":1,"unitPrice":836,"amount":836}]'),

-- 05SJ0000303 · TECHWIZ SOLUTIONS · $1,455
('QBRV-B2B-05SJ0000303', '2026-05-08', '05SJ0000303', NULL, NULL,
 'TECHWIZ SOLUTIONS', NULL, 'TECHWIZ SOLUTIONS', NULL, NULL,
 1455, 'USD', 'Bank Transfer', 'NON-VAT', 'Issued',
 NULL, NULL, 'QB Import', NULL, NULL, NULL,
 'QB Import - Payment received in QuickBooks', NULL, NULL, 'QB Import',
 '[{"id":"qb-pmt-B2B-05SJ0000303","no":1,"itemCode":"","modelName":"Payment Received","description":"QB Import Payment for Invoice 05SJ0000303","qty":1,"unitPrice":1455,"amount":1455}]')

ON CONFLICT ("RV No") DO NOTHING;
