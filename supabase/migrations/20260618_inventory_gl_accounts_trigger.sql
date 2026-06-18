-- Trigger: auto-populate GL account columns on inventory INSERT or brand UPDATE.
-- Ensures every inventory row carries the correct revenue/COGS/inventory account
-- without relying on application-level BRAND_ACCOUNT_MAP inference.

CREATE OR REPLACE FUNCTION set_inventory_gl_accounts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.revenue_account := CASE NEW.brand
        WHEN 'ASUS'                  THEN '40100'
        WHEN 'DELL'                  THEN '40200'
        WHEN 'MSI'                   THEN '40300'
        WHEN 'Asus Acc. & PW Supply' THEN '40400'
        WHEN 'MSI Acc. & PW Supply'  THEN '40500'
        WHEN 'Lenovo Accessories'    THEN '40800'
        WHEN 'Lenovo'                THEN '40700'
        ELSE '40600'
    END;
    NEW.cogs_account := CASE NEW.brand
        WHEN 'ASUS'                  THEN '50100'
        WHEN 'DELL'                  THEN '50200'
        WHEN 'MSI'                   THEN '50300'
        WHEN 'Asus Acc. & PW Supply' THEN '50400'
        WHEN 'MSI Acc. & PW Supply'  THEN '50500'
        WHEN 'Lenovo Accessories'    THEN '50800'
        WHEN 'Lenovo'                THEN '50700'
        ELSE '50600'
    END;
    NEW.inventory_account := CASE NEW.brand
        WHEN 'ASUS'                  THEN '12100'
        WHEN 'DELL'                  THEN '12200'
        WHEN 'MSI'                   THEN '12300'
        WHEN 'Asus Acc. & PW Supply' THEN '12400'
        WHEN 'MSI Acc. & PW Supply'  THEN '12500'
        WHEN 'Lenovo Accessories'    THEN '12800'
        WHEN 'Lenovo'                THEN '12700'
        ELSE '12600'
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_gl_accounts ON inventory;
CREATE TRIGGER trg_inventory_gl_accounts
    BEFORE INSERT OR UPDATE OF brand ON inventory
    FOR EACH ROW EXECUTE FUNCTION set_inventory_gl_accounts();
