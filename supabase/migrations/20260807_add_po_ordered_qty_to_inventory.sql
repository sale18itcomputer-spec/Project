-- Baseline "ordered quantity" from the PO, stored on each inventory row created
-- by a PO conversion. Editing a PO after conversion re-syncs inventory using the
-- DELTA (new ordered qty − this baseline), so a qty change is applied on top of
-- whatever is currently on hand without clobbering units already sold.
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS po_ordered_qty INTEGER;

-- Backfill existing PO-linked rows with their current qty as the baseline (for
-- stock not yet sold this is the true ordered qty; for partially-sold stock it
-- establishes a correct baseline going forward).
UPDATE inventory SET po_ordered_qty = qty
WHERE po_id IS NOT NULL AND po_ordered_qty IS NULL;

COMMENT ON COLUMN inventory.po_ordered_qty IS 'Baseline ordered qty from the source PO; used to compute qty deltas when the PO is edited after conversion.';
