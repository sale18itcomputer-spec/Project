
DO $$
DECLARE
    r RECORD;
    new_so_no TEXT;
    row_count INT;
BEGIN
    -- Log start
    RAISE NOTICE 'Starting migration of SO Numbers...';

    -- Loop through Sale Orders that match the old format (S followed by 8 digits, no dash)
    FOR r IN SELECT "SO No." FROM public.sale_orders WHERE "SO No." ~ '^S\d{8}$' LOOP
        
        -- Extract the integer value. Substring from index 2 (skipping 'S')
        -- Cast to integer to remove leading zeros.
        -- Reformat as S-XXXXXXX (7 digits)
        new_so_no := 'S-' || lpad(CAST(substring(r."SO No." from 2) AS INTEGER)::TEXT, 7, '0');
        
        RAISE NOTICE 'Migrating % to %', r."SO No.", new_so_no;

        -- Check if new ID already exists (sanity check)
        PERFORM 1 FROM public.sale_orders WHERE "SO No." = new_so_no;
        IF FOUND THEN
            RAISE WARNING 'Target ID % already exists. Skipping %.', new_so_no, r."SO No.";
            CONTINUE;
        END IF;

        -- Update the Sale Order
        -- Disable triggers if necessary, but standard update is fine
        UPDATE public.sale_orders 
        SET "SO No." = new_so_no 
        WHERE "SO No." = r."SO No.";
        
        -- Update referencing tables
        -- Pipelines
        UPDATE public.pipelines
        SET "SO No." = new_so_no
        WHERE "SO No." = r."SO No.";

        -- Invoices
        UPDATE public.invoices
        SET "SO No." = new_so_no
        WHERE "SO No." = r."SO No.";

    END LOOP;

    RAISE NOTICE 'Migration completed.';
END $$;
