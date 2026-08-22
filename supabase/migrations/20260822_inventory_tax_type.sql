-- ═══════════════════════════════════════════════════════════════════════════
-- Inventory tax type — enforce "VAT stock sells on VAT invoices only".
--
-- Each inventory lot inherits the tax type of its source Purchase Order
-- (VAT / NON-VAT). Sale-time deduction then only draws lots whose tax_type
-- matches the document: a VAT invoice may consume only VAT stock, a non-VAT
-- invoice only non-VAT stock. NULL = unclassified legacy stock (no PO or a PO
-- with no tax type) — treated as eligible for either so old flows don't break.
--
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS tax_type text;

COMMENT ON COLUMN inventory.tax_type IS
  'VAT | NON-VAT — tax type of the source PO. A VAT invoice draws only VAT stock; a non-VAT invoice only non-VAT stock. NULL = unclassified legacy (eligible for either).';

-- Backfill existing lots from their source PO.
UPDATE inventory i
   SET tax_type = po.tax_type
  FROM purchase_orders po
 WHERE i.po_id = po.id
   AND i.tax_type IS NULL
   AND po.tax_type IN ('VAT', 'NON-VAT');
