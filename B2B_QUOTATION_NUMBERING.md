# B2B Quotation Numbering - Separate Sequences

## ✅ Implementation Complete

B2B and B2C quotations now have **separate numbering sequences**. Each mode starts from Q-0000001 independently.

---

## 🔢 How It Works

### B2C Mode Quotations:
- **First quotation**: `Q-0000001`
- **Second quotation**: `Q-0000002`
- **Third quotation**: `Q-0000003`
- Stored in: `quotations` table

### B2B Mode Quotations:
- **First quotation**: `Q-0000001` (independent sequence!)
- **Second quotation**: `Q-0000002`
- **Third quotation**: `Q-0000003`
- Stored in: `b2b_quotations` table

---

## 📊 Example Scenario

### Timeline:

1. **Admin creates B2C quotation** → `Q-0000001` (in B2C)
2. **Admin creates B2C quotation** → `Q-0000002` (in B2C)
3. **Admin switches to B2B mode**
4. **Admin creates B2B quotation** → `Q-0000001` (in B2B) ✨
5. **Admin creates B2B quotation** → `Q-0000002` (in B2B)
6. **Admin switches back to B2C**
7. **Admin creates B2C quotation** → `Q-0000003` (in B2C)

### Result:

**B2C Quotations:**
- Q-0000001
- Q-0000002
- Q-0000003

**B2B Quotations:**
- Q-0000001
- Q-0000002

---

## 🎯 Why Separate Sequences?

### Benefits:
1. **Clear Separation** - B2B and B2C quotations are completely independent
2. **Easy Tracking** - Each business type has its own sequence
3. **Simple Numbering** - Both start from 1, easy to understand
4. **No Conflicts** - Same number can exist in both modes without confusion

### Database Separation:
- B2C quotations → `quotations` table
- B2B quotations → `b2b_quotations` table
- **No overlap or conflicts**

---

## 🔧 Technical Implementation

### Updated Components:

**QuotationCreator.tsx:**
- ✅ Now uses `useB2BData()` instead of `useData()`
- ✅ Automatically uses correct quotation list based on mode
- ✅ Generates next number from current mode's sequence
- ✅ Saves to correct table (quotations or b2b_quotations)

**PricelistCombobox:**
- ✅ Uses `useB2BData()` for pricelist access
- ✅ Works in both B2C and B2B modes

### Number Generation Logic:

```typescript
// In QuotationCreator.tsx
const nextQuotationNumber = useMemo(() => {
    if (existingQuotation) return existingQuotation['Quote No.'];
    if (!quotations || quotations.length === 0) return 'Q-0000001';

    // quotations comes from useB2BData()
    // which automatically switches between B2C and B2B data
    const maxNum = quotations.reduce((max, q) => {
        const match = q['Quote No.'].match(/Q-(\d+)/);
        if (!match) return max;
        const numPart = parseInt(match[1], 10);
        return isNaN(numPart) ? max : Math.max(max, numPart);
    }, 0);

    return `Q-${String(maxNum + 1).padStart(7, '0')}`;
}, [quotations, existingQuotation]);
```

---

## 📋 User Experience

### For Admin Users:

**Creating B2C Quotation:**
1. Ensure in B2C mode (toggle shows B2C)
2. Go to Quotations dashboard
3. Click "New Quotation"
4. Quote number auto-generates from B2C sequence
5. Save → Stored in `quotations` table

**Creating B2B Quotation:**
1. Switch to B2B mode (toggle to B2B)
2. Go to Quotations dashboard
3. Click "New Quotation"
4. Quote number auto-generates from B2B sequence (starts at 1!)
5. Save → Stored in `b2b_quotations` table

### For Non-Admin Users:
- Always in B2C mode
- Only see B2C quotations
- Only create B2C quotations
- B2B quotations are hidden

---

## 🔍 Viewing Quotations

### B2C Mode:
- Shows only B2C quotations
- Numbers: Q-0000001, Q-0000002, Q-0000003, etc.
- From `quotations` table

### B2B Mode:
- Shows only B2B quotations
- Numbers: Q-0000001, Q-0000002, Q-0000003, etc.
- From `b2b_quotations` table

**Note:** Same numbers can appear in both modes, but they're completely different quotations!

---

## ⚠️ Important Notes

### Number Format:
- Always starts with `Q-`
- Followed by 7 digits: `0000001`
- Format: `Q-NNNNNNN`

### Sequence Independence:
- B2C and B2B sequences are **completely independent**
- Deleting a B2C quotation doesn't affect B2B numbering
- Deleting a B2B quotation doesn't affect B2C numbering

### Data Storage:
- **B2C**: `quotations` table
- **B2B**: `b2b_quotations` table
- Both tables have identical schema
- RLS policies ensure data separation

---

## 🧪 Testing

### Test Scenario 1: Create First Quotations
1. Switch to B2C mode
2. Create quotation → Should be `Q-0000001`
3. Switch to B2B mode
4. Create quotation → Should be `Q-0000001` (not Q-0000002!)
5. Verify both exist in their respective tables

### Test Scenario 2: Sequence Continuation
1. In B2C mode, create 3 quotations
2. Should have: Q-0000001, Q-0000002, Q-0000003
3. Switch to B2B mode
4. Create 2 quotations
5. Should have: Q-0000001, Q-0000002
6. Switch back to B2C
7. Create another quotation
8. Should be Q-0000004 (continues from 3)

### Test Scenario 3: Editing Quotations
1. Edit a B2C quotation
2. Number should remain the same
3. Switch to B2B, edit a B2B quotation
4. Number should remain the same
5. No cross-contamination

---

## 📚 Related Files

- `components/QuotationCreator.tsx` - Main quotation creation component
- `hooks/useB2BData.ts` - B2B-aware data hook
- `utils/quotationNumberGenerator.ts` - Number generation utilities
- `create_b2b_tables.sql` - B2B tables schema

---

## 🚀 Summary

✅ **Separate Sequences**: B2C and B2B quotations have independent numbering  
✅ **Starts from 1**: Each mode starts from Q-0000001  
✅ **No Conflicts**: Same number can exist in both modes  
✅ **Auto-Generated**: Numbers automatically increment in each mode  
✅ **Database Separated**: Stored in different tables  
✅ **Mode-Aware**: QuotationCreator uses correct sequence based on current mode  

**Your B2B quotations now have their own independent numbering!** 🎉

---

**Last Updated:** 2026-01-12
**Status:** ✅ Complete
