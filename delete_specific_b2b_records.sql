-- ============================================
-- DELETE SPECIFIC B2B RECORDS
-- ============================================
-- Use these queries to delete specific records

-- Delete a specific B2B company
DELETE FROM b2b_companies
WHERE "Company ID" = 'COM0000001';  -- Replace with actual Company ID

-- Delete a specific B2B pipeline
DELETE FROM b2b_pipelines
WHERE "Pipeline No." = 'PL00000001';  -- Replace with actual Pipeline No.

-- Delete a specific B2B quotation
DELETE FROM b2b_quotations
WHERE "Quote No." = 'Q-0000001';  -- Replace with actual Quote No.

-- Delete all B2B records for a specific company
DELETE FROM b2b_quotations
WHERE "Company Name" = 'Test Company';  -- Replace with actual company name

DELETE FROM b2b_pipelines
WHERE "Company Name" = 'Test Company';  -- Replace with actual company name

DELETE FROM b2b_companies
WHERE "Company Name" = 'Test Company';  -- Replace with actual company name
