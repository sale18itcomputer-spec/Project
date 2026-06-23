-- Fix TI2026-00003 deposit: pre-VAT only ($37,976) → VAT-inclusive ($41,773.60)
-- Deposit = 20% of subtotal $189,880 + 10% VAT = $37,976 + $3,797.60 = $41,773.60

UPDATE b2b_invoices
SET "Deposit" = 41773.60
WHERE "Inv No" = 'TI2026-00003';
