-- ============================================
-- VIEW ALL B2B DATA
-- ============================================
-- Run these queries to see what data exists in B2B tables

-- Check B2B Companies
SELECT 
    "Company ID",
    "Company Name",
    "Created Date"
FROM b2b_companies
ORDER BY "Created Date" DESC;

-- Check B2B Pipelines
SELECT 
    "Pipeline No.",
    "Company Name",
    "Status",
    "Created Date"
FROM b2b_pipelines
ORDER BY "Created Date" DESC;

-- Check B2B Quotations
SELECT 
    "Quote No.",
    "Company Name",
    "Status",
    "Quote Date"
FROM b2b_quotations
ORDER BY "Quote Date" DESC;

-- Count records in each table
SELECT 
    'b2b_companies' as table_name,
    COUNT(*) as record_count
FROM b2b_companies
UNION ALL
SELECT 
    'b2b_pipelines' as table_name,
    COUNT(*) as record_count
FROM b2b_pipelines
UNION ALL
SELECT 
    'b2b_quotations' as table_name,
    COUNT(*) as record_count
FROM b2b_quotations;
