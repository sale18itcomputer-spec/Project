-- 20261003_pricelist_warranty_months.sql
--
-- Warranty becomes a pricelist DEFAULT that prefills the PO line (the PO value stays
-- the real, per-purchase one that flows to inventory + serials).
--
-- Before: no warranty column anywhere on the catalogue. PO lines were hand-typed, so
-- blank PO lines left inventory.warranty_months NULL and serial_numbers silently
-- defaulted to 12 months (e.g. PO-2026-040's unit, sold 2026-10-02, got 12 months
-- while its 3Y twin on PO-035 got 36).
--
-- Source of the defaults: the pricelist Description already states the warranty for
-- 221 / 565 items ("3Y Warranty(...)", "3 Years (1Perfect warranty)", "3yr warranty",
-- "Battery 1yr / HW 3yr warranty" -> longest wins, "No warranty" -> 0). It was
-- validated against warranties already entered on POs: 7/7 agree. Items whose
-- description says nothing fall back to the most common warranty entered on their past
-- POs; the rest stay NULL (= unknown, never a guessed 12).
--
-- Idempotent: safe to re-run. Sold units are NOT touched (their warranty is what the
-- customer was given) EXCEPT the single PO-040 unit explicitly corrected below.

BEGIN;

-- 1. Column on both catalogue tables ------------------------------------------------
ALTER TABLE pricelist     ADD COLUMN IF NOT EXISTS warranty_months integer;
ALTER TABLE b2b_pricelist ADD COLUMN IF NOT EXISTS warranty_months integer;

ALTER TABLE pricelist DROP CONSTRAINT IF EXISTS chk_pricelist_warranty_range;
ALTER TABLE pricelist ADD CONSTRAINT chk_pricelist_warranty_range
  CHECK (warranty_months IS NULL OR warranty_months BETWEEN 0 AND 120);
ALTER TABLE b2b_pricelist DROP CONSTRAINT IF EXISTS chk_b2b_pricelist_warranty_range;
ALTER TABLE b2b_pricelist ADD CONSTRAINT chk_b2b_pricelist_warranty_range
  CHECK (warranty_months IS NULL OR warranty_months BETWEEN 0 AND 120);

-- 2. Description parser (mirrors utils/warranty.ts) ----------------------------------
CREATE OR REPLACE FUNCTION parse_warranty_months(txt text) RETURNS integer
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s    text := lower(coalesce(txt, ''));
  best integer := NULL;
  w    text[];
  d    text[];
  m    integer;
BEGIN
  IF s = '' THEN RETURN NULL; END IF;
  FOR w IN SELECT regexp_matches(s, '.{0,35}warrant.{0,35}', 'g') LOOP
    FOR d IN SELECT regexp_matches(w[1], '(\d{1,4})\s*(years?|yrs?|y|months?|mths?|mos?)(?![a-z])', 'g') LOOP
      m := CASE WHEN d[2] LIKE 'y%' THEN d[1]::integer * 12 ELSE d[1]::integer END;
      IF m BETWEEN 1 AND 120 AND (best IS NULL OR m > best) THEN best := m; END IF;
    END LOOP;
  END LOOP;
  IF best IS NULL AND s ~ '\mno\s+warranty\M' THEN RETURN 0; END IF;
  RETURN best;
END $$;

-- 3. Backfill pricelist defaults ------------------------------------------------------
UPDATE pricelist SET warranty_months = parse_warranty_months("Description")
 WHERE warranty_months IS NULL AND parse_warranty_months("Description") IS NOT NULL;

UPDATE pricelist pl SET warranty_months = h.w
  FROM (SELECT lower(code) AS c, mode() WITHIN GROUP (ORDER BY warranty_months) AS w
          FROM inventory WHERE warranty_months IS NOT NULL GROUP BY 1) h
 WHERE pl.warranty_months IS NULL AND lower(pl."Code") = h.c;

-- 4. PO lines: never persist a blank brand / category / warranty the pricelist knows --
CREATE OR REPLACE FUNCTION trg_poi_fill_brand() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_brand text; v_cat text; v_w integer;
BEGIN
  IF COALESCE(NEW.is_promotion, false) = false
     AND COALESCE(trim(NEW.item_number), '') <> ''
     AND (COALESCE(trim(NEW.brand), '') = '' OR COALESCE(trim(NEW.category), '') = ''
          OR NEW.warranty_months IS NULL) THEN
    SELECT pl."Brand", pl."Category", pl.warranty_months INTO v_brand, v_cat, v_w
      FROM pricelist pl WHERE lower(pl."Code") = lower(NEW.item_number) LIMIT 1;
    IF FOUND THEN
      IF COALESCE(trim(NEW.brand), '') = ''    THEN NEW.brand    := COALESCE(v_brand, ''); END IF;
      IF COALESCE(trim(NEW.category), '') = '' THEN NEW.category := COALESCE(v_cat, '');   END IF;
      IF NEW.warranty_months IS NULL AND v_w IS NOT NULL THEN NEW.warranty_months := v_w; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS poi_fill_brand ON purchase_order_items;
CREATE TRIGGER poi_fill_brand
  BEFORE INSERT OR UPDATE OF item_number, brand, category, warranty_months ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION trg_poi_fill_brand();

-- Existing PO lines with no warranty pick up the default (metadata only).
UPDATE purchase_order_items SET warranty_months = warranty_months
 WHERE warranty_months IS NULL AND COALESCE(is_promotion, false) = false
   AND COALESCE(trim(item_number), '') <> '';

-- 5. Stock still on the shelf with no warranty -> pricelist default ------------------
WITH filled AS (
  UPDATE inventory i SET warranty_months = pl.warranty_months
    FROM pricelist pl
   WHERE lower(pl."Code") = lower(i.code) AND i.warranty_months IS NULL
     AND pl.warranty_months IS NOT NULL AND COALESCE(i.qty, 0) > 0
  RETURNING i.id, i.warranty_months
)
UPDATE serial_numbers s SET warranty_period_months = f.warranty_months
  FROM filled f
 WHERE s.inventory_id = f.id AND s.stock_status = 'In Stock' AND s.warranty_period_months = 12;

-- 6. The one sold unit in question: PO-2026-040 / SPC00015 (sold 2026-10-02 on 12 months).
UPDATE inventory SET warranty_months = (SELECT warranty_months FROM pricelist WHERE "Code" = 'SPC00015')
 WHERE po_number = 'PO-2026-040' AND code = 'SPC00015' AND warranty_months IS NULL
   AND (SELECT warranty_months FROM pricelist WHERE "Code" = 'SPC00015') IS NOT NULL;

UPDATE serial_numbers s
   SET warranty_period_months = inv.warranty_months,
       warranty_end_date = (s.warranty_start_date + make_interval(months => inv.warranty_months) - interval '1 day')::date
  FROM inventory inv
 WHERE inv.id = s.inventory_id AND inv.po_number = 'PO-2026-040' AND inv.code = 'SPC00015'
   AND inv.warranty_months IS NOT NULL AND s.warranty_period_months = 12
   AND s.warranty_start_date IS NOT NULL;

COMMIT;
