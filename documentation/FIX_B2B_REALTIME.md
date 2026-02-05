# Fix B2B Real-Time Updates

## 🔴 Problem
Created B2B records don't appear until you refresh or switch dashboards.

## ✅ Solution
Enable Realtime for B2B tables in Supabase.

---

## Quick Fix (2 Steps)

### Step 1: Check if Realtime is Enabled

**Run in Supabase SQL Editor:**
```sql
-- File: check_b2b_realtime_status.sql
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'b2b_companies'
        ) THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as b2b_companies_realtime,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'b2b_pipelines'
        ) THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as b2b_pipelines_realtime,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'b2b_quotations'
        ) THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as b2b_quotations_realtime;
```

**Expected Result:**
- All should show ✅ Enabled
- If any show ❌ Disabled, continue to Step 2

### Step 2: Enable Realtime

**Run in Supabase SQL Editor:**
```sql
-- File: enable_b2b_realtime.sql

-- Enable realtime for b2b_companies
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_companies;

-- Enable realtime for b2b_pipelines
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_pipelines;

-- Enable realtime for b2b_quotations
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_quotations;
```

**After running, verify:**
```sql
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename LIKE 'b2b_%'
ORDER BY tablename;
```

**Should show:**
- b2b_companies
- b2b_pipelines
- b2b_quotations

---

## Alternative: Enable via Supabase Dashboard

If SQL doesn't work, use the UI:

1. **Go to Supabase Dashboard**
2. **Click on "Database" → "Replication"**
3. **Find these tables:**
   - `b2b_companies`
   - `b2b_pipelines`
   - `b2b_quotations`
4. **Toggle "Enable Replication" for each**
5. **Click "Save"**

---

## Test Real-Time Updates

After enabling:

1. **Open two browser tabs**
2. **Both in B2B mode**
3. **Create a company in Tab 1**
4. **Watch it appear in Tab 2 instantly!** ✨

If it works, you're done! 🎉

---

## Troubleshooting

### "ALTER PUBLICATION" gives an error

**Error:** `permission denied for publication supabase_realtime`

**Solution:** You need to be a database owner. Try via Supabase Dashboard UI instead.

### Still not working after enabling

**Check browser console (F12):**
- Look for WebSocket connection
- Should see: `SUBSCRIBED` status
- No error messages

**Check subscription in code:**
```typescript
// In useB2BData.ts - already implemented!
const channel = supabase.channel('b2b_changes_channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_companies' }, ...)
    .subscribe();
```

**Hard refresh browser:**
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### Realtime works but slow

**Check Supabase plan:**
- Free tier: 2 concurrent connections
- Pro tier: 500 concurrent connections

**Optimize:**
- Close unused browser tabs
- Check network connection

---

## Files Created

1. **`enable_b2b_realtime.sql`** - Enable Realtime (run this!)
2. **`check_b2b_realtime_status.sql`** - Check if enabled

---

## Summary

**Run this ONE command in Supabase SQL Editor:**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_companies;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_pipelines;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_quotations;
```

**Then refresh your browser and test!** 🚀

---

**Last Updated:** 2026-01-12  
**Status:** Ready to Enable
