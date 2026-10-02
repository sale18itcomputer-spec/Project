-- 20261002_guard_brand_and_tax_type.sql
--
-- Two root causes found auditing INV2026-00024 / BILL-0038 (JE-2296 / JE-2297):
--
-- A) BLANK BRAND -> WRONG INVENTORY ACCOUNT
--    PO save auto-added every line to vendor_pricelist with brand = '' ; the PO
--    item picker then showed that blank row instead of the main-pricelist row, so
--    the PO line (and the bill) lost its brand and ASUS stock was posted to
--    12600 Other Accessories instead of 12100. The app is fixed; these triggers
--    are the backstop for EVERY writer (app, mini-app, agent tools, MCP).
--
-- B) STRAY "Tax Type" DEFAULT
--    b2b_invoices."Tax Type" defaults to 'VAT' while the app only writes
--    "Taxable" (the source of truth), so every B2B invoice was tagged VAT and the
--    receipts/DOs copied from it inherited it. Default dropped, the two columns are
--    kept in sync by trigger, and existing conflicting rows are corrected.
--
-- Idempotent: safe to re-run. Touches metadata/tags only - no amounts, no JEs.

BEGIN;

-- ── A. Never persist a blank brand/category when the pricelist knows it ───────

CREATE OR REPLACE FUNCTION trg_poi_fill_brand() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_brand text; v_cat text;
BEGIN
  IF COALESCE(NEW.is_promotion, false) = false
     AND COALESCE(trim(NEW.item_number), '') <> ''
     AND (COALESCE(trim(NEW.brand), '') = '' OR COALESCE(trim(NEW.category), '') = '') THEN
    SELECT pl."Brand", pl."Category" INTO v_brand, v_cat
      FROM pricelist pl WHERE lower(pl."Code") = lower(NEW.item_number) LIMIT 1;
    IF FOUND THEN
      IF COALESCE(trim(NEW.brand), '') = ''    THEN NEW.brand    := COALESCE(v_brand, ''); END IF;
      IF COALESCE(trim(NEW.category), '') = '' THEN NEW.category := COALESCE(v_cat, '');   END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS poi_fill_brand ON purchase_order_items;
CREATE TRIGGER poi_fill_brand
  BEFORE INSERT OR UPDATE OF item_number, brand, category ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION trg_poi_fill_brand();

CREATE OR REPLACE FUNCTION trg_vpl_fill_brand() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_brand text;
BEGIN
  IF COALESCE(trim(NEW.brand), '') = '' AND COALESCE(trim(NEW.model_name), '') <> '' THEN
    SELECT pl."Brand" INTO v_brand
      FROM pricelist pl WHERE lower(pl."Code") = lower(NEW.model_name) LIMIT 1;
    IF FOUND AND COALESCE(v_brand, '') <> '' THEN NEW.brand := v_brand; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vpl_fill_brand ON vendor_pricelist;
CREATE TRIGGER vpl_fill_brand
  BEFORE INSERT OR UPDATE OF model_name, brand ON vendor_pricelist
  FOR EACH ROW EXECUTE FUNCTION trg_vpl_fill_brand();

-- Backfill existing blanks (the triggers do the work via a no-op update).
UPDATE vendor_pricelist SET brand = brand WHERE COALESCE(trim(brand), '') = '';
UPDATE purchase_order_items SET brand = brand
 WHERE COALESCE(is_promotion, false) = false AND COALESCE(trim(item_number), '') <> ''
   AND (COALESCE(trim(brand), '') = '' OR COALESCE(trim(category), '') = '');

-- ── B. "Tax Type" must follow "Taxable" ───────────────────────────────────────

ALTER TABLE b2b_invoices ALTER COLUMN "Tax Type" DROP DEFAULT;

CREATE OR REPLACE FUNCTION trg_sync_invoice_tax_type() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."Taxable" IN ('VAT', 'Yes') THEN
    NEW."Tax Type" := 'VAT';
  ELSIF NEW."Taxable" IN ('NON-VAT', 'No') THEN
    NEW."Tax Type" := 'NON-VAT';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sync_invoice_tax_type ON b2b_invoices;
CREATE TRIGGER sync_invoice_tax_type
  BEFORE INSERT OR UPDATE OF "Taxable", "Tax Type" ON b2b_invoices
  FOR EACH ROW EXECUTE FUNCTION trg_sync_invoice_tax_type();

DROP TRIGGER IF EXISTS sync_invoice_tax_type ON invoices;
CREATE TRIGGER sync_invoice_tax_type
  BEFORE INSERT OR UPDATE OF "Taxable", "Tax Type" ON invoices
  FOR EACH ROW EXECUTE FUNCTION trg_sync_invoice_tax_type();

-- Correct invoices whose two columns disagree (only rows with a clear Taxable).
UPDATE b2b_invoices SET "Tax Type" = CASE WHEN "Taxable" IN ('VAT','Yes') THEN 'VAT' ELSE 'NON-VAT' END
 WHERE "Taxable" IN ('VAT','Yes','NON-VAT','No')
   AND "Tax Type" IN ('VAT','NON-VAT')
   AND "Tax Type" <> CASE WHEN "Taxable" IN ('VAT','Yes') THEN 'VAT' ELSE 'NON-VAT' END;

UPDATE invoices SET "Tax Type" = CASE WHEN "Taxable" IN ('VAT','Yes') THEN 'VAT' ELSE 'NON-VAT' END
 WHERE "Taxable" IN ('VAT','Yes','NON-VAT','No')
   AND "Tax Type" IN ('VAT','NON-VAT')
   AND "Tax Type" <> CASE WHEN "Taxable" IN ('VAT','Yes') THEN 'VAT' ELSE 'NON-VAT' END;

-- Receipts copied the stale tag from their invoice (Quick Payment). Align them with the
-- invoice's Taxable. QuickBooks-imported receipts (QBRV-*) are legacy and left untouched.
UPDATE b2b_receipts r SET "Tax Type" = m.t
  FROM (SELECT "Inv No", CASE WHEN "Taxable" IN ('VAT','Yes') THEN 'VAT' ELSE 'NON-VAT' END AS t
          FROM b2b_invoices WHERE "Taxable" IN ('VAT','Yes','NON-VAT','No')) m
 WHERE m."Inv No" = r."Inv No" AND r."RV No" NOT LIKE 'QBRV-%'
   AND r."Tax Type" IN ('VAT','NON-VAT') AND r."Tax Type" <> m.t;

UPDATE receipts r SET "Tax Type" = m.t
  FROM (SELECT "Inv No", CASE WHEN "Taxable" IN ('VAT','Yes') THEN 'VAT' ELSE 'NON-VAT' END AS t
          FROM invoices WHERE "Taxable" IN ('VAT','Yes','NON-VAT','No')) m
 WHERE m."Inv No" = r."Inv No" AND r."RV No" NOT LIKE 'QBRV-%'
   AND r."Tax Type" IN ('VAT','NON-VAT') AND r."Tax Type" <> m.t;

COMMIT;
