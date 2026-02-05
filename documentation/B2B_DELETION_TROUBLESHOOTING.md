# B2B Deletion Issues - SQL Troubleshooting Guide

## 🔍 Problem: Deleted B2B Records Still Showing

If you delete a B2B record but it still appears in the UI, follow these steps:

---

## Step 1: Check if B2B Tables Exist

**Run this in Supabase SQL Editor:**

```sql
-- File: check_b2b_tables.sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('b2b_companies', 'b2b_pipelines', 'b2b_quotations')
ORDER BY table_name;
```

**Expected Result:** Should show 3 tables

**If you see 0 results:**
- ❌ B2B tables don't exist yet!
- ✅ Run `create_b2b_tables.sql` first

---

## Step 2: View Current B2B Data

**Run this to see what's actually in the database:**

```sql
-- File: view_b2b_data.sql

-- Check B2B Companies
SELECT "Company ID", "Company Name", "Created Date"
FROM b2b_companies
ORDER BY "Created Date" DESC;

-- Check B2B Pipelines
SELECT "Pipeline No.", "Company Name", "Status", "Created Date"
FROM b2b_pipelines
ORDER BY "Created Date" DESC;

-- Check B2B Quotations
SELECT "Quote No.", "Company Name", "Status", "Quote Date"
FROM b2b_quotations
ORDER BY "Quote Date" DESC;
```

**What to look for:**
- Are the records you "deleted" still there?
- Do you see duplicate records?

---

## Step 3: Check for Permission Issues

**Run this to check Row Level Security:**

```sql
-- File: troubleshoot_b2b_deletion.sql (Step 2-3)

-- Check RLS policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename LIKE 'b2b_%'
ORDER BY tablename;

-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'b2b_%';
```

**If RLS is blocking deletions:**
- You might need to update RLS policies
- Or temporarily disable RLS for testing

---

## Step 4: Manual Deletion (Clean Slate)

**If you want to start fresh, delete all B2B data:**

```sql
-- File: delete_all_b2b_data.sql
-- WARNING: This deletes EVERYTHING!

DELETE FROM b2b_quotations;
DELETE FROM b2b_pipelines;
DELETE FROM b2b_companies;

-- Verify deletion
SELECT 
    'b2b_companies' as table_name, COUNT(*) as remaining
FROM b2b_companies
UNION ALL
SELECT 'b2b_pipelines', COUNT(*) FROM b2b_pipelines
UNION ALL
SELECT 'b2b_quotations', COUNT(*) FROM b2b_quotations;
```

**Expected:** All counts should be 0

---

## Step 5: Delete Specific Records

**To delete specific records:**

```sql
-- File: delete_specific_b2b_records.sql

-- Delete specific company
DELETE FROM b2b_companies
WHERE "Company ID" = 'COM0000001';  -- Replace with actual ID

-- Delete specific pipeline
DELETE FROM b2b_pipelines
WHERE "Pipeline No." = 'PL00000001';  -- Replace with actual ID

-- Delete specific quotation
DELETE FROM b2b_quotations
WHERE "Quote No." = 'Q-0000001';  -- Replace with actual ID
```

---

## Common Issues & Solutions

### Issue 1: "Tables don't exist"

**Solution:**
1. Go to Supabase SQL Editor
2. Run `create_b2b_tables.sql`
3. Wait for completion
4. Refresh your app

### Issue 2: "Deletion works in SQL but not in UI"

**Possible causes:**
1. **Browser cache** - Hard refresh (Ctrl+Shift+R)
2. **Real-time not enabled** - Enable in Supabase Dashboard
3. **State not updating** - Check browser console for errors

**Solution:**
1. Clear browser cache
2. Enable Realtime for B2B tables
3. Check browser console (F12) for errors

### Issue 3: "Permission denied"

**Solution:**
```sql
-- Check your user's role
SELECT current_user, current_role;

-- Temporarily disable RLS (TESTING ONLY!)
ALTER TABLE b2b_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_pipelines DISABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_quotations DISABLE ROW LEVEL SECURITY;

-- Try deletion again
DELETE FROM b2b_companies WHERE "Company ID" = 'TEST';

-- Re-enable RLS after testing
ALTER TABLE b2b_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_quotations ENABLE ROW LEVEL SECURITY;
```

### Issue 4: "Deleted but still showing"

**This usually means:**
- Data is in browser cache/state
- Real-time subscription not working
- Wrong table being queried

**Solution:**
1. **Hard refresh browser** (Ctrl+Shift+R)
2. **Check actual database:**
   ```sql
   SELECT * FROM b2b_companies WHERE "Company ID" = 'THE_ID_YOU_DELETED';
   ```
3. **If record exists in DB** - deletion failed
4. **If record doesn't exist** - it's a UI cache issue

---

## Quick Diagnostic Checklist

Run these in order:

```sql
-- 1. Do tables exist?
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name LIKE 'b2b_%';
-- Expected: 3

-- 2. How many B2B records exist?
SELECT 
    (SELECT COUNT(*) FROM b2b_companies) as companies,
    (SELECT COUNT(*) FROM b2b_pipelines) as pipelines,
    (SELECT COUNT(*) FROM b2b_quotations) as quotations;

-- 3. Can I delete a test record?
INSERT INTO b2b_companies ("Company ID", "Company Name") 
VALUES ('TEST_DELETE', 'Test Company');

DELETE FROM b2b_companies WHERE "Company ID" = 'TEST_DELETE';

SELECT * FROM b2b_companies WHERE "Company ID" = 'TEST_DELETE';
-- Expected: 0 rows

-- 4. Is RLS blocking me?
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename LIKE 'b2b_%';
```

---

## Files Created

I've created these SQL files for you:

1. **`check_b2b_tables.sql`** - Check if tables exist
2. **`view_b2b_data.sql`** - View all B2B data
3. **`delete_all_b2b_data.sql`** - Clean slate (delete everything)
4. **`delete_specific_b2b_records.sql`** - Delete specific records
5. **`troubleshoot_b2b_deletion.sql`** - Full diagnostic script

---

## Recommended Steps

1. **Run `check_b2b_tables.sql`** first
2. **If tables don't exist** → Run `create_b2b_tables.sql`
3. **Run `view_b2b_data.sql`** to see current data
4. **Try deleting via UI** and check browser console
5. **If still showing** → Run `view_b2b_data.sql` again to confirm deletion
6. **If data still in DB** → Check `troubleshoot_b2b_deletion.sql`

---

## After Fixing

Once deletions work:

1. ✅ **Enable Realtime** for B2B tables in Supabase
2. ✅ **Hard refresh** your browser
3. ✅ **Test** create/update/delete in both modes
4. ✅ **Verify** data separation

---

**Last Updated:** 2026-01-12  
**Status:** Troubleshooting Tools Ready
