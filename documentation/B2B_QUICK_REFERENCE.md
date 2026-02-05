# B2B Feature - Quick Reference Guide

## 🎯 Quick Start

### 1. Setup Database (One-time)
```sql
-- Run this in Supabase SQL Editor
-- File: create_b2b_tables.sql
```

### 2. Use in Components

#### Before (B2C only):
```typescript
import { useData } from '../contexts/DataContext';

const MyComponent = () => {
  const { companies, projects, quotations } = useData();
  // ...
};
```

#### After (B2B/B2C aware):
```typescript
import { useB2BData } from '../hooks/useB2BData';

const MyComponent = () => {
  const { companies, projects, quotations } = useB2BData();
  // Automatically switches between B2C and B2B data!
};
```

## 📦 Available Hooks

### useB2B()
Get current mode and control functions:
```typescript
const { mode, setMode, toggleMode, isB2B } = useB2B();

// Check mode
if (isB2B) {
  console.log('In B2B mode');
}

// Switch mode
setMode('B2B');  // or 'B2C'
toggleMode();    // Toggle between modes
```

### useB2BData()
Get mode-aware data:
```typescript
const {
  companies,    // B2B or B2C companies based on mode
  projects,     // B2B or B2C pipelines based on mode
  quotations,   // B2B or B2C quotations based on mode
  loading,      // Loading state
  error,        // Error state
  // ... all other data from useData()
} = useB2BData();
```

## 🔧 Database Operations

### Generic Functions (Recommended)
```typescript
import { insertRecord, updateRecord, deleteRecord } from '../utils/b2bDb';
import { useB2B } from '../contexts/B2BContext';

const { isB2B } = useB2B();

// Create
await insertRecord('companies', companyData, isB2B);

// Update
await updateRecord('companies', 'Company ID', id, updates, isB2B);

// Delete
await deleteRecord('companies', 'Company ID', id, isB2B);
```

### B2B-Specific Functions
```typescript
import {
  createB2BCompany,
  updateB2BCompany,
  deleteB2BCompany,
  getB2BCompanies,
  // ... similar for pipelines and quotations
} from '../utils/b2bDb';

// Create B2B company
const newCompany = await createB2BCompany(companyData);

// Update B2B company
await updateB2BCompany(companyId, updates);

// Delete B2B company
await deleteB2BCompany(companyId);

// Get all B2B companies
const companies = await getB2BCompanies();
```

## 🎨 UI Components

### B2BToggle
Already integrated in Header - no action needed!

### Custom Toggle (if needed)
```typescript
import { useB2B } from '../contexts/B2BContext';

const CustomToggle = () => {
  const { mode, toggleMode } = useB2B();
  
  return (
    <button onClick={toggleMode}>
      Current Mode: {mode}
    </button>
  );
};
```

## 📊 Data Tables

### B2C Tables (Original)
- `companies`
- `pipelines`
- `quotations`

### B2B Tables (New)
- `b2b_companies`
- `b2b_pipelines`
- `b2b_quotations`

### Shared Tables (Both Modes)
- `contacts`
- `pricelist`
- `sale_orders` (currently)
- `invoices` (currently)
- `contact_logs`
- `meeting_logs`
- `site_survey_logs`

## ✅ Component Update Checklist

When updating a component to support B2B:

1. [ ] Replace `useData()` with `useB2BData()`
2. [ ] Import `useB2B()` if needed for mode checking
3. [ ] Update database operations to use `utils/b2bDb.ts` functions
4. [ ] Pass `isB2B` to database operation functions
5. [ ] Test in both B2C and B2B modes
6. [ ] Verify real-time updates work

## 🔍 Debugging

### Check Current Mode
```typescript
const { mode, isB2B } = useB2B();
console.log('Current mode:', mode);
console.log('Is B2B?', isB2B);
```

### Check Data Source
```typescript
const data = useB2BData();
console.log('Companies:', data.companies);
console.log('Loading:', data.loading);
console.log('Error:', data.error);
```

### Verify Table Name
```typescript
import { getTableName } from '../utils/b2bDb';

const tableName = getTableName('companies', isB2B);
console.log('Using table:', tableName);
// B2C: 'companies'
// B2B: 'b2b_companies'
```

## 🚨 Common Issues

### Issue: Toggle not appearing
**Solution:** Ensure `B2BProvider` wraps the app in `App.tsx`

### Issue: Data not switching
**Solution:** 
1. Verify B2B tables exist in Supabase
2. Check component uses `useB2BData()` not `useData()`
3. Check browser console for errors

### Issue: Real-time updates not working
**Solution:**
1. Enable realtime in Supabase project settings
2. Verify RLS policies are correct
3. Check subscription channel isn't blocked

### Issue: Mode not persisting
**Solution:** Check localStorage is enabled in browser

## 📝 Examples

### Complete Component Example
```typescript
import React from 'react';
import { useB2BData } from '../hooks/useB2BData';
import { useB2B } from '../contexts/B2BContext';
import { insertRecord } from '../utils/b2bDb';

const MyComponent = () => {
  const { companies, loading } = useB2BData();
  const { isB2B, mode } = useB2B();
  
  const handleCreate = async (data) => {
    try {
      await insertRecord('companies', data, isB2B);
      console.log(`Created in ${mode} mode`);
    } catch (error) {
      console.error('Failed to create:', error);
    }
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{mode} Companies ({companies?.length})</h1>
      {companies?.map(company => (
        <div key={company['Company ID']}>
          {company['Company Name']}
        </div>
      ))}
    </div>
  );
};
```

## 🎓 Best Practices

1. **Always use `useB2BData()`** for companies, pipelines, and quotations
2. **Use generic functions** from `utils/b2bDb.ts` for flexibility
3. **Check `isB2B`** before mode-specific operations
4. **Test both modes** when making changes
5. **Handle loading and error states** properly
6. **Use TypeScript** for type safety

## 📚 Related Files

- `contexts/B2BContext.tsx` - Mode management
- `hooks/useB2BData.ts` - Data switching
- `utils/b2bDb.ts` - Database operations
- `components/B2BToggle.tsx` - Toggle UI
- `create_b2b_tables.sql` - Database schema
- `B2B_FEATURE_README.md` - Full documentation
- `B2B_IMPLEMENTATION_SUMMARY.md` - Implementation details

## 🆘 Need Help?

1. Check `B2B_FEATURE_README.md` for detailed documentation
2. Review `B2B_IMPLEMENTATION_SUMMARY.md` for implementation details
3. Look at `CompanyDashboard.tsx` for a working example
4. Contact the development team

---

**Last Updated:** 2026-01-12
**Version:** 1.0.0
