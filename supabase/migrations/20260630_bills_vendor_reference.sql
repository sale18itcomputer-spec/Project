-- Add vendor reference / voucher number field to bills table.
-- This stores the actual reference number from the vendor's document,
-- separate from the internal auto-generated bill_number.

ALTER TABLE bills
ADD COLUMN IF NOT EXISTS vendor_reference TEXT;
