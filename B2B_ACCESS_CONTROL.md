# B2B Feature - Role-Based Access Control

## 🔐 Access Control Overview

The B2B/B2C toggle feature is **restricted to Admin users only**. Non-admin users will always see B2C mode and cannot access B2B data.

---

## 👥 User Roles

### Admin Users
- ✅ Can see the B2B/B2C toggle in the header
- ✅ Can switch between B2C and B2B modes
- ✅ Can access B2B data (companies, pipelines, quotations)
- ✅ Can access B2C data (all features)
- ✅ Mode preference is saved to localStorage

### Non-Admin Users (Sales, Manager, etc.)
- ❌ Cannot see the B2B/B2C toggle
- ❌ Cannot access B2B mode
- ❌ Cannot view B2B data
- ✅ Always in B2C mode
- ✅ Full access to all B2C features

---

## 🛡️ Security Implementation

### 1. UI Level Protection

**B2BToggle Component:**
```tsx
// Only renders for admin users
if (currentUser?.Role !== 'Admin') {
    return null;
}
```

### 2. Context Level Protection

**B2BContext:**
- Non-admin users are **forced to B2C mode**
- Attempts to switch to B2B mode are **blocked**
- Mode changes are **logged as warnings**

```tsx
// Force B2C mode for non-admin users
useEffect(() => {
    if (!isAdmin && mode === 'B2B') {
        setModeState('B2C');
        localStorage.setItem(STORAGE_KEY, 'B2C');
    }
}, [isAdmin, mode]);

// Block B2B mode switching
const setMode = (newMode: BusinessMode) => {
    if (newMode === 'B2B' && !isAdmin) {
        console.warn('Only admin users can access B2B mode');
        return;
    }
    // ... rest of logic
};
```

### 3. Data Level Protection

**Database (Supabase RLS):**
- B2B tables have Row Level Security enabled
- Only authenticated users can access B2B data
- Additional policies can be added for role-based access

---

## 🎯 How It Works

### For Admin Users:

1. **Login** as admin
2. **See B2B toggle** in header
3. **Click toggle** to switch modes
4. **Access B2B data** when in B2B mode
5. **Mode persists** across sessions

### For Non-Admin Users:

1. **Login** as non-admin (Sales, Manager, etc.)
2. **No toggle visible** in header
3. **Always in B2C mode**
4. **Cannot access B2B data**
5. **Full B2C functionality** available

---

## 🔍 Checking User Role

### In Components:
```tsx
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.Role === 'Admin';

    if (isAdmin) {
        // Admin-specific features
    }
};
```

### In B2B Context:
```tsx
import { useB2B } from '../contexts/B2BContext';

const MyComponent = () => {
    const { canAccessB2B } = useB2B();

    if (canAccessB2B) {
        // Show B2B features
    }
};
```

---

## 📊 Access Matrix

| Feature | Admin | Non-Admin |
|---------|-------|-----------|
| B2C Mode | ✅ Yes | ✅ Yes |
| B2B Mode | ✅ Yes | ❌ No |
| Toggle Visible | ✅ Yes | ❌ No |
| Switch Modes | ✅ Yes | ❌ No |
| B2C Data | ✅ Yes | ✅ Yes |
| B2B Data | ✅ Yes | ❌ No |
| B2C Dashboard | ✅ Yes | ✅ Yes |
| B2B Dashboard | ✅ Yes | ❌ No |

---

## 🚨 Security Considerations

### Current Protection:
- ✅ UI toggle hidden for non-admins
- ✅ Context enforces B2C mode for non-admins
- ✅ Toggle attempts are blocked and logged
- ✅ Mode is reset to B2C on role change

### Additional Security (Recommended):

1. **Database RLS Policies:**
```sql
-- Example: Only admins can access B2B tables
CREATE POLICY "Admin only access to B2B companies"
ON b2b_companies
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.uid() = id
        AND raw_user_meta_data->>'role' = 'Admin'
    )
);
```

2. **API Endpoint Protection:**
- Add role checks in API routes
- Validate user role on server-side
- Return 403 Forbidden for non-admins

3. **Audit Logging:**
- Log B2B mode access attempts
- Track who accesses B2B data
- Monitor unauthorized access attempts

---

## 🧪 Testing

### Test as Admin:
1. Login with admin credentials
2. Verify toggle is visible
3. Switch to B2B mode
4. Verify B2B data loads
5. Refresh page - mode persists
6. Switch back to B2C

### Test as Non-Admin:
1. Login with non-admin credentials
2. Verify toggle is NOT visible
3. Check browser console - no errors
4. Verify only B2C data is shown
5. Try to manually set B2B mode (should fail)
6. Check localStorage (should be B2C)

### Test Role Change:
1. Login as admin, switch to B2B
2. Change user role to non-admin
3. Verify mode resets to B2C
4. Verify toggle disappears

---

## 🔧 Configuration

### User Roles in Database:

Users table should have a `Role` field with values:
- `Admin` - Full access to B2B and B2C
- `Sales` - B2C only
- `Manager` - B2C only
- (Other roles) - B2C only

### Changing Access Control:

To allow other roles to access B2B mode, update `B2BContext.tsx`:

```tsx
// Current (Admin only)
const isAdmin = currentUser?.Role === 'Admin';

// Allow multiple roles
const canAccessB2B = ['Admin', 'Manager'].includes(currentUser?.Role || '');
```

---

## 📝 Best Practices

1. **Always check role** before showing B2B features
2. **Use `canAccessB2B`** flag from context
3. **Don't rely on UI hiding alone** - enforce in context
4. **Add database-level security** with RLS policies
5. **Log access attempts** for audit trails
6. **Test with different roles** regularly

---

## 🆘 Troubleshooting

### "Toggle not showing for admin"
- Check `currentUser?.Role` value
- Verify role is exactly 'Admin' (case-sensitive)
- Check AuthContext is providing currentUser

### "Non-admin can access B2B mode"
- Check browser localStorage (should be 'B2C')
- Verify B2BContext is enforcing role check
- Check for console warnings

### "Mode resets on page refresh"
- Check localStorage permissions
- Verify STORAGE_KEY is consistent
- Check for errors in browser console

---

**Last Updated:** 2026-01-12
**Security Level:** ✅ UI + Context Protected
**Recommended:** Add database RLS policies
