
DO $$
DECLARE
    r RECORD;
    new_so_no TEXT;
    num_part INT;
BEGIN
    RAISE NOTICE 'Starting migration of SO Numbers to SO- prefix...';

    -- Find records starting with 'S' but not 'SO-'
    -- This covers both 'S00000001' and 'S-0000001'
    FOR r IN SELECT "SO No." FROM public.sale_orders WHERE "SO No." LIKE 'S%' AND "SO No." NOT LIKE 'SO-%' LOOP
        
        -- Extract numeric part
        IF r."SO No." LIKE 'S-%' THEN
             -- Skip 'S-' (2 chars)
             num_part := CAST(substring(r."SO No." from 3) AS INTEGER);
        ELSE
             -- Skip 'S' (1 char)
             num_part := CAST(substring(r."SO No." from 2) AS INTEGER);
        END IF;

        -- Format as SO-XXXXXXX
        new_so_no := 'SO-' || lpad(num_part::TEXT, 7, '0');
        
        RAISE NOTICE 'Migrating % to %', r."SO No.", new_so_no;

        -- Check conflicts
        PERFORM 1 FROM public.sale_orders WHERE "SO No." = new_so_no;
        IF FOUND THEN
            RAISE WARNING 'Target ID % already exists. Skipping %.', new_so_no, r."SO No.";
            CONTINUE;
        END IF;

        -- Update tables
        UPDATE public.sale_orders SET "SO No." = new_so_no WHERE "SO No." = r."SO No.";
        UPDATE public.pipelines SET "SO No." = new_so_no WHERE "SO No." = r."SO No.";
        UPDATE public.invoices SET "SO No." = new_so_no WHERE "SO No." = r."SO No.";

    END LOOP;

    RAISE NOTICE 'Migration completed.';
END $$;
