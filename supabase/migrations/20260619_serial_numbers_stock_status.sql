-- Track stock availability separately from warranty/service lifecycle status.
-- status: warranty/service state (Active/In Service/Returned/Written Off/Retired)
-- stock_status: is this physical unit currently allocatable to a new sale
ALTER TABLE serial_numbers
  ADD COLUMN IF NOT EXISTS stock_status text NOT NULL DEFAULT 'In Stock';

-- Backfill: anything already linked to a sale is Sold, everything else is In Stock
UPDATE serial_numbers
  SET stock_status = 'Sold'
  WHERE stock_status = 'In Stock' AND (so_no <> '' OR company_name <> '');

CREATE INDEX IF NOT EXISTS idx_serial_numbers_stock_status ON serial_numbers(stock_status);
