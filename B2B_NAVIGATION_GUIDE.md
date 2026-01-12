# B2B Mode Navigation - Visibility Guide

## Navigation Items by Mode

### 🟢 B2C Mode (Default)
Shows **ALL** navigation items:

#### Main Section
- ✅ Dashboard
- ✅ Companies
- ✅ Contacts

#### Sales Documents
- ✅ Quotations
- ✅ Sale Orders
- ✅ Invoice & DO

#### Products
- ✅ Pricelist

#### Logs
- ✅ Pipelines
- ✅ Contact Logs
- ✅ Site Surveys
- ✅ Meetings

---

### 🔵 B2B Mode
Shows **ONLY** these navigation items:

#### Main Section
- ✅ Dashboard
- ✅ Companies
- ❌ Contacts (Hidden)

#### Sales Documents
- ✅ Quotations
- ❌ Sale Orders (Hidden)
- ❌ Invoice & DO (Hidden)

#### Products
- ❌ Pricelist (Hidden - entire section)

#### Logs
- ✅ Pipelines
- ❌ Contact Logs (Hidden)
- ❌ Site Surveys (Hidden)
- ❌ Meetings (Hidden)

---

## Summary

### B2B Mode Shows Only:
1. **Dashboard** - Main overview
2. **Companies** - B2B company management
3. **Pipelines** - B2B pipeline tracking
4. **Quotations** - B2B quotation management

### Hidden in B2B Mode:
- Contacts
- Sale Orders
- Invoice & DO
- Pricelist
- Contact Logs
- Site Surveys
- Meetings

---

## Implementation Details

### Desktop Sidebar (`components/Sidebar.tsx`)
- Uses `useB2B()` hook to get current mode
- Conditionally renders navigation items with `{!isB2B && <NavItem />}`
- Entire sections hidden when all items are B2B-only

### Mobile Bottom Nav (`components/MobileBottomNav.tsx`)
- Filters navigation items based on `showInB2B` flag
- Uses `useMemo` for performance optimization
- Automatically adjusts spacing when items are hidden

---

## User Experience

### When Switching to B2B Mode:
1. Navigation automatically updates
2. Hidden items disappear smoothly
3. If user was on a hidden page, they stay there (can navigate back)
4. Mobile bottom nav shows only 4 items instead of 5

### When Switching to B2C Mode:
1. All navigation items reappear
2. Full menu restored
3. Mobile bottom nav shows all 5 items

---

## Why These Items?

### B2B Focus:
- **Companies**: Core B2B entity
- **Pipelines**: Business development tracking
- **Quotations**: Formal business proposals
- **Dashboard**: Overview and metrics

### B2C Features (Hidden in B2B):
- **Contacts**: Individual consumer contacts
- **Sale Orders**: Retail transactions
- **Invoice & DO**: Delivery operations
- **Pricelist**: Consumer pricing
- **Contact/Site/Meeting Logs**: Consumer engagement tracking

---

## Configuration

To change which items appear in B2B mode:

### Desktop Sidebar
Edit `components/Sidebar.tsx`:
```tsx
{/* To hide in B2B mode */}
{!isB2B && (
  <NavItem ... />
)}

{/* To show in both modes */}
<NavItem ... />
```

### Mobile Bottom Nav
Edit `components/MobileBottomNav.tsx`:
```tsx
const allNavItems = [
  { view: 'dashboard', showInB2B: true },  // Shows in B2B
  { view: 'contacts', showInB2B: false },  // Hidden in B2B
];
```

---

**Last Updated:** 2026-01-12
