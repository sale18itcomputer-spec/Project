-- Migration script to update Pricelist schema
-- 1. Rename columns to match new requirements
ALTER TABLE public.pricelist RENAME COLUMN "Item Code" TO "Code";
ALTER TABLE public.pricelist RENAME COLUMN "Item Description" TO "Description";
ALTER TABLE public.pricelist RENAME COLUMN "SRP" TO "End User Price";

-- 2. Add new columns
ALTER TABLE public.pricelist ADD COLUMN "Sheet Name" text;
ALTER TABLE public.pricelist ADD COLUMN "Dealer Price" numeric;
ALTER TABLE public.pricelist ADD COLUMN "Promotion" text;

-- 3. Drop obsolete columns
ALTER TABLE public.pricelist DROP COLUMN "SRP (B)";
ALTER TABLE public.pricelist DROP COLUMN "Qty";
ALTER TABLE public.pricelist DROP COLUMN "OTW";
ALTER TABLE public.pricelist DROP COLUMN "Detail Spec";
