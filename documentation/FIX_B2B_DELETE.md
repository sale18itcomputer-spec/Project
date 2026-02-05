# Fix: B2B Delete Not Working

## 🔴 Problem

When you delete a B2B record in the UI, it still exists in Supabase database.

---

## 🔍 Root Cause

Most likely one of these issues:

1. **RLS policies blocking DELETE** - Policies don't allow delete operation
2. **Wrong table being queried** - Deleting from B2C instead of B2B
3. **Delete function not using isB2B flag** - Not routing to correct table

---

## ✅ Solution (3 Steps)

### Step 1: Fix RLS Policies

**Run this in Supabase SQL Editor:**

```sql
-- File: fix_b2b_delete.sql (lines 29-58)

-- Drop all existing policies
DROP POLICY IF EXISTS "Enable delete access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable insert access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable read access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable update access for all users" ON b2b_companies;
DROP POLICY IF EXISTS "Enable all access for b2b companies" ON b2b_companies;

-- Create comprehensive policy
CREATE POLICY "Enable all operations for authenticated users"
ON b2b_companies
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Repeat for pipelines and quotations
-- (See full script in fix_b2b_delete.sql)
```

### Step 2: Test DELETE Operation

**Run this test:**

```sql
-- Create test record
INSERT INTO b2b_companies ("Company ID", "Company Name")
VALUES ('DELETE_TEST_001', 'Delete Test Company');

-- Verify it exists
SELECT * FROM b2b_companies WHERE "Company ID" = 'DELETE_TEST_001';

-- Delete it
DELETE FROM b2b_companies WHERE "Company ID" = 'DELETE_TEST_001' RETURNING *;

-- Verify it's gone
SELECT COUNT(*) FROM b2b_companies WHERE "Company ID" = 'DELETE_TEST_001';
-- Expected: 0
```

**If DELETE returns the record:**
✅ Delete is working!

**If DELETE returns nothing:**
❌ RLS is still blocking it

### Step 3: If Still Not Working

**Temporarily disable RLS to test:**

```sql
-- Disable RLS
ALTER TABLE b2b_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_pipelines DISABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_quotations DISABLE ROW LEVEL SECURITY;

-- Try delete again
DELETE FROM b2b_companies WHERE "Company ID" = 'YOUR_ID';

-- If this works, RLS was the issue
-- Re-enable RLS
ALTER TABLE b2b_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_quotations ENABLE ROW LEVEL SECURITY;

-- Then fix the policies properly
```

---

## 🧪 Complete CRUD Test

**Run this to test all operations:**

```sql
-- File: test_b2b_crud.sql

-- This script tests:
-- ✅ CREATE (INSERT)
-- ✅ READ (SELECT)
-- ✅ UPDATE
-- ✅ DELETE

-- Run the entire file and check results
```

---

## 🔍 Verify Current State

**Check what policies exist:**

```sql
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename LIKE 'b2b_%'
ORDER BY tablename;
```

**Good result:**
```
tablename       | policyname                                    | cmd
----------------|-----------------------------------------------|-----
b2b_companies   | Enable all operations for authenticated users | ALL
b2b_pipelines   | Enable all operations for authenticated users | ALL
b2b_quotations  | Enable all operations for authenticated users | ALL
```

**Bad result:**
```
tablename       | policyname                           | cmd
----------------|--------------------------------------|--------
b2b_companies   | Enable delete access for all users   | DELETE
b2b_companies   | Enable insert access for all users   | INSERT
b2b_companies   | Enable read access for all users     | SELECT
b2b_companies   | Enable update access for all users   | UPDATE
```

If you see the "bad result", run the fix script!

---

## 📊 Expected Behavior

### After Fix:

**In UI:**
1. Delete a B2B company
2. Company disappears from list immediately
3. Toast: "Company deleted!"

**In Supabase:**
1. Go to b2b_companies table
2. Record should be GONE
3. Not just hidden - actually deleted

---

## 🐛 Debugging Steps

### 1. Check Console Logs

When you delete, you should see:
```
🔴 Cleaning up B2B subscriptions... (if switching modes)
```

Or nothing (if staying in B2B mode).

### 2. Check Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Delete a record
4. Look for DELETE request to Supabase
5. Check response - should be 204 (success)

### 3. Check Database Directly

```sql
-- Before delete
SELECT * FROM b2b_companies WHERE "Company ID" = 'THE_ID';

-- Delete in UI

-- After delete
SELECT * FROM b2b_companies WHERE "Company ID" = 'THE_ID';
-- Should return 0 rows
```

---

## 🎯 Quick Fix Checklist

- [ ] Run `fix_b2b_delete.sql` in Supabase
- [ ] Verify policies with SELECT query
- [ ] Test DELETE with test record
- [ ] Delete a real record in UI
- [ ] Check Supabase - record should be gone
- [ ] If still there, check console for errors

---

## 📁 Files Created

1. **`fix_b2b_delete.sql`** - Fix DELETE issues
2. **`test_b2b_crud.sql`** - Test all CRUD operations
3. **`FIX_B2B_DELETE.md`** - This guide

---

## ✨ Summary

**The issue is most likely RLS policies blocking DELETE.**

**Quick fix:**
1. Run `fix_b2b_delete.sql`
2. Test with `test_b2b_crud.sql`
3. Verify in UI and database

**After fix, DELETE should work perfectly!** 🎉

---

**Last Updated:** 2026-01-12  
**Status:** Ready to Fix
