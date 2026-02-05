# Fix: B2B Subscription Channel Error

## 🔴 Error

```
❌ B2B subscription error!
CHANNEL_ERROR
```

## 🔍 Root Cause

Realtime is not properly enabled for B2B tables in Supabase.

---

## ✅ Quick Fix (3 Steps)

### Step 1: Enable Realtime

**Run in Supabase SQL Editor:**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_companies;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_pipelines;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_quotations;
```

### Step 2: Set REPLICA IDENTITY

```sql
ALTER TABLE b2b_companies REPLICA IDENTITY FULL;
ALTER TABLE b2b_pipelines REPLICA IDENTITY FULL;
ALTER TABLE b2b_quotations REPLICA IDENTITY FULL;
```

### Step 3: Verify

```sql
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename LIKE 'b2b_%';
```

**Expected:** Should show all 3 tables

---

## 🧪 Test It

1. **Refresh your browser**
2. **Open console** (F12)
3. **Switch to B2B mode**

**Look for:**
```
🔵 Setting up B2B real-time subscriptions...
🔵 B2B Subscription status: SUBSCRIBED  ← Should say SUBSCRIBED, not CHANNEL_ERROR
✅ B2B real-time subscriptions active!
```

4. **Create a company in another tab**
5. **Should appear in first tab automatically!**

---

## 📋 Full Diagnostic Script

**File:** `fix_realtime_error.sql`

This script:
1. Checks if Realtime is enabled
2. Enables it if not
3. Fixes RLS policies
4. Sets REPLICA IDENTITY
5. Verifies everything is working

**Just run the entire file in Supabase SQL Editor!**

---

## 🐛 If Still Not Working

### Check 1: Supabase Project Settings

1. Go to Supabase Dashboard
2. Settings → API
3. Check if Realtime is enabled for your project

### Check 2: Network/Firewall

- Realtime uses WebSocket connections
- Some networks block WebSockets
- Try different network or disable VPN

### Check 3: Browser Console

Look for WebSocket errors:
```
WebSocket connection failed
Blocked by CORS
Connection refused
```

---

## ✨ Summary

**The error means Realtime is not enabled.**

**Quick fix:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_companies;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_pipelines;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_quotations;

ALTER TABLE b2b_companies REPLICA IDENTITY FULL;
ALTER TABLE b2b_pipelines REPLICA IDENTITY FULL;
ALTER TABLE b2b_quotations REPLICA IDENTITY FULL;
```

**Then refresh browser and test!** 🚀

---

**Last Updated:** 2026-01-12  
**Status:** Fix Ready
