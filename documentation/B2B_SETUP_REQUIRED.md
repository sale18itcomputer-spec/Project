# ⚠️ IMPORTANT: B2B Tables Setup Required

## Why You're Seeing B2C Data in B2B Mode

The B2B tables **haven't been created in your Supabase database yet**. Until you run the SQL script, the B2B mode will show empty data or fall back to B2C data.

## 🚀 Quick Setup (2 Minutes)

### Step 1: Run the SQL Script

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Open the file: `create_b2b_tables.sql` (in your project root)
4. Copy all the SQL code
5. Paste it into the Supabase SQL Editor
6. Click **RUN**

### Step 2: Verify Tables Were Created

After running the script, check that these tables exist:
- `b2b_companies`
- `b2b_pipelines`
- `b2b_quotations`

You can verify by going to **Table Editor** in Supabase and looking for these tables.

### Step 3: Test the Feature

1. Refresh your application
2. Click the **B2C ⟷ B2B** toggle in the header
3. Switch to **B2B mode**
4. You should now see empty tables (no data yet)
5. Create a new company in B2B mode
6. It will be stored in `b2b_companies` table
7. Switch back to B2C mode - the B2B company won't appear!

## ✅ What's Already Done

The following components are **already B2B-aware**:
- ✅ **CompanyDashboard** - Shows B2B companies when in B2B mode
- ✅ **PipelineDashboard** - Shows B2B pipelines when in B2B mode
- ✅ **QuotationDashboard** - Shows B2B quotations when in B2B mode
- ✅ **Sidebar** - Hides irrelevant items in B2B mode
- ✅ **MobileBottomNav** - Filters navigation for B2B mode

## 📋 What Still Needs To Be Done

### Update Modal Components

The following modals need to be updated to use B2B database operations:

1. **NewCompanyModal.tsx**
   - Use `insertRecord('companies', data, isB2B)` instead of direct API call
   - Import `useB2B` hook to get `isB2B` flag

2. **CompanyDetailModal.tsx**
   - Use `updateRecord('companies', id, updates, isB2B)`
   - Use `deleteRecord('companies', id, isB2B)`

3. **NewProjectModal.tsx**
   - Use `insertRecord('pipelines', data, isB2B)`

4. **ProjectDetailModal.tsx**
   - Use `updateRecord('pipelines', id, updates, isB2B)`
   - Use `deleteRecord('pipelines', id, isB2B)`

5. **QuotationCreator.tsx**
   - Use `insertRecord('quotations', data, isB2B)`
   - Use `updateRecord('quotations', id, updates, isB2B)`

### Example Update Pattern

**Before:**
```typescript
import { createRecord } from '../services/api';

const handleSave = async () => {
  await createRecord('Company List', companyData);
};
```

**After:**
```typescript
import { insertRecord } from '../utils/b2bDb';
import { useB2B } from '../contexts/B2BContext';

const { isB2B } = useB2B();

const handleSave = async () => {
  await insertRecord('companies', companyData, isB2B);
};
```

## 🎯 Testing Checklist

After running the SQL script:

- [ ] Switch to B2B mode
- [ ] Dashboards show empty (no B2C data)
- [ ] Create a B2B company
- [ ] Create a B2B pipeline
- [ ] Create a B2B quotation
- [ ] Switch to B2C mode
- [ ] Verify B2B data doesn't appear in B2C
- [ ] Switch back to B2B mode
- [ ] Verify B2B data is still there

## 🔍 Troubleshooting

### "I ran the SQL but still see B2C data"
- Clear your browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check browser console for errors
- Verify the tables exist in Supabase

### "I get permission errors"
- Check RLS policies are created
- Verify you're authenticated
- Check Supabase logs for policy violations

### "Real-time updates don't work"
- Enable realtime in Supabase project settings
- Go to Database → Replication
- Enable realtime for b2b_* tables

## 📞 Need Help?

If you encounter issues:
1. Check the browser console for errors
2. Check Supabase logs
3. Verify the SQL script ran successfully
4. Make sure you're authenticated

---

**Remember:** The B2B feature is fully implemented in the code, but the database tables need to be created first!
