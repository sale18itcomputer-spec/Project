-- Commercial Invoice (Yanet format, YC{year}- numbers) is its OWN document type: neither VAT nor
-- NON-VAT. The tax-tag trigger only knew VAT / NON-VAT, so a Commercial invoice kept the column
-- default — 'VAT' on b2b_invoices — and would have been mis-tagged as VAT. Tag it with its own
-- value so VAT / NON-VAT totals never include it.

CREATE OR REPLACE FUNCTION trg_sync_invoice_tax_type() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."Taxable" IN ('VAT', 'Yes') THEN
    NEW."Tax Type" := 'VAT';
  ELSIF NEW."Taxable" IN ('NON-VAT', 'No') THEN
    NEW."Tax Type" := 'NON-VAT';
  ELSIF NEW."Taxable" = 'Commercial Invoice' THEN
    NEW."Tax Type" := 'Commercial Invoice';
  END IF;
  RETURN NEW;
END $$;

-- No Commercial invoices exist yet, so there is nothing to backfill. This guards any row
-- that slipped in with the wrong tag before the trigger was updated.
UPDATE b2b_invoices SET "Tax Type" = 'Commercial Invoice' WHERE "Taxable" = 'Commercial Invoice' AND "Tax Type" IS DISTINCT FROM 'Commercial Invoice';
UPDATE invoices     SET "Tax Type" = 'Commercial Invoice' WHERE "Taxable" = 'Commercial Invoice' AND "Tax Type" IS DISTINCT FROM 'Commercial Invoice';
