# B2B/B2C Toggle Feature

This document explains the B2B (Business-to-Business) and B2C (Business-to-Consumer) toggle feature implementation.

## Overview

The application now supports two distinct business modes:
- **B2C Mode** (Default): Uses the original tables for consumer-focused transactions
- **B2B Mode**: Uses dedicated B2B tables for business-focused transactions

## Database Schema

### B2B Tables Created

Three new tables have been created in Supabase to mirror the B2C structure:

1. **b2b_companies** - B2B company records
2. **b2b_pipelines** - B2B pipeline/project records  
3. **b2b_quotations** - B2B quotation records

### SQL Setup

Run the following SQL file in your Supabase SQL Editor to create the B2B tables:

```bash
create_b2b_tables.sql
```

This will:
- Create the three B2B tables with the same schema as their B2C counterparts
- Enable Row Level Security (RLS)
- Create appropriate policies for authenticated access
- Add indexes for performance optimization

## Architecture

### Context Providers

#### B2BContext (`contexts/B2BContext.tsx`)
- Manages the current business mode (B2C or B2B)
- Persists mode selection to localStorage
- Provides `useB2B()` hook for accessing mode state

```typescript
const { mode, setMode, toggleMode, isB2B } = useB2B();
```

### Custom Hooks

#### useB2BData (`hooks/useB2BData.ts`)
- Provides mode-aware data access
- Automatically switches between B2C and B2B data sources
- Handles real-time subscriptions for B2B tables
- Returns the same interface as `useData()` for seamless integration

```typescript
// Use this instead of useData() in components that need B2B support
const { companies, projects, quotations } = useB2BData();
```

### Components

#### B2BToggle (`components/B2BToggle.tsx`)
- Visual toggle switch for switching between B2C and B2B modes
- Shows current mode with visual indicators
- Integrated into the Header component

### Utilities

#### b2bDb (`utils/b2bDb.ts`)
- CRUD operations for B2B tables
- Generic functions that work with both B2C and B2B tables
- Helper functions for mode-aware table name resolution

## Usage Guide

### For Developers

#### 1. Using B2B-Aware Data in Components

Replace `useData()` with `useB2BData()` in components that need to support both modes:

```typescript
// Before
import { useData } from '../contexts/DataContext';
const { companies, projects, quotations } = useData();

// After
import { useB2BData } from '../hooks/useB2BData';
const { companies, projects, quotations } = useB2BData();
```

#### 2. Creating Records with Mode Awareness

Use the utility functions from `utils/b2bDb.ts`:

```typescript
import { insertRecord } from '../utils/b2bDb';
import { useB2B } from '../contexts/B2BContext';

const { isB2B } = useB2B();

// Insert a company
await insertRecord('companies', companyData, isB2B);
```

#### 3. Updating Components to Support B2B

For components that create/edit companies, pipelines, or quotations:

1. Import the B2B context:
```typescript
import { useB2B } from '../contexts/B2BContext';
```

2. Get the current mode:
```typescript
const { isB2B } = useB2B();
```

3. Use mode-aware database operations:
```typescript
import { insertRecord, updateRecord, deleteRecord } from '../utils/b2bDb';

// These functions automatically use the correct table based on isB2B
await insertRecord('companies', data, isB2B);
await updateRecord('companies', 'Company ID', id, updates, isB2B);
await deleteRecord('companies', 'Company ID', id, isB2B);
```

### For End Users

#### Switching Between Modes

1. Look for the B2B toggle switch in the header (next to notifications)
2. Click on either "B2C" or "B2B" to switch modes
3. The mode indicator will show the current active mode
4. Your selection is saved and will persist across sessions

#### What Changes When Switching Modes?

- **Companies Dashboard**: Shows B2B companies when in B2B mode
- **Pipelines Dashboard**: Shows B2B pipelines when in B2B mode
- **Quotations Dashboard**: Shows B2B quotations when in B2B mode
- All other features (contacts, meetings, pricelist, etc.) remain shared

## Components to Update

The following components should be updated to use `useB2BData()` and mode-aware operations:

### High Priority (Core B2B Features)
- [x] `CompanyDashboard.tsx` - Display B2B companies
- [x] `PipelineDashboard.tsx` - Display B2B pipelines
- [x] `QuotationDashboard.tsx` - Display B2B quotations
- [ ] `NewCompanyModal.tsx` - Create B2B companies
- [ ] `CompanyDetailModal.tsx` - Edit B2B companies
- [ ] `NewProjectModal.tsx` - Create B2B pipelines
- [ ] `ProjectDetailModal.tsx` - Edit B2B pipelines
- [ ] `QuotationCreator.tsx` - Create B2B quotations

### Medium Priority (Related Features)
- [ ] `Dashboard.tsx` - Show B2B metrics
- [ ] `CompanyDashboard.tsx` - Filter by B2B companies
- [ ] `SaleOrderCreator.tsx` - Link to B2B quotations

## Real-Time Updates

The B2B tables support real-time updates via Supabase subscriptions:
- Changes to B2B tables are automatically reflected in the UI
- No manual refresh needed
- Works for INSERT, UPDATE, and DELETE operations

## Data Separation

B2C and B2B data are completely separate:
- Switching modes does not affect the other mode's data
- Each mode has its own set of companies, pipelines, and quotations
- Shared resources (contacts, pricelist, etc.) are accessible in both modes

## Best Practices

1. **Always use `useB2BData()`** in components that display companies, pipelines, or quotations
2. **Use the utility functions** from `utils/b2bDb.ts` for database operations
3. **Check `isB2B`** before performing operations that should be mode-specific
4. **Test both modes** when making changes to affected components
5. **Consider the user experience** - make it clear which mode they're in

## Future Enhancements

Potential improvements for the B2B feature:

- [ ] Add B2B-specific sale orders table
- [ ] Add B2B-specific invoices table
- [ ] Add mode-specific dashboard metrics
- [ ] Add data migration tools (B2C to B2B)
- [ ] Add bulk import/export for B2B data
- [ ] Add B2B-specific reporting
- [ ] Add role-based access control per mode
- [ ] Add mode-specific customization options

## Troubleshooting

### Toggle not appearing
- Ensure `B2BProvider` is wrapped around the app in `App.tsx`
- Check that `B2BToggle` is imported in `Header.tsx`

### Data not switching
- Verify B2B tables exist in Supabase
- Check browser console for errors
- Ensure `useB2BData()` is being used instead of `useData()`

### Real-time updates not working
- Verify realtime is enabled in Supabase project settings
- Check that RLS policies are correctly configured
- Ensure the subscription channel is not being blocked

## Support

For questions or issues related to the B2B feature, please contact the development team.
