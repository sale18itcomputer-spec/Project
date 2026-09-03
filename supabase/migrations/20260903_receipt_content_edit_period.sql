-- 20260903_receipt_content_edit_period.sql
--
-- Allow CONTENT-ONLY edits of an issued receipt even when its month is locked.
--
-- An issued receipt's presentation (customer name/address, contact, refs,
-- prepared-by, remarks) may be edited to tidy it before sending to a customer.
-- That edit never changes the amount or anything that feeds the payment journal
-- entry, so it has zero GL impact and is safe inside a locked period.
--
-- This replaces the generic period guard on receipts / b2b_receipts with a
-- content-aware version: an UPDATE that leaves Amount, RV Date, Inv No, Payment
-- Method, Currency and Status unchanged is always allowed. Any other UPDATE, and
-- every INSERT/DELETE, still obey the period lock exactly as before. The
-- `app.allow_locked_period='on'` repair bypass is preserved.

CREATE OR REPLACE FUNCTION fn_guard_locked_period_receipt() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    d_old date;
    d_new date;
BEGIN
    IF current_setting('app.allow_locked_period', true) = 'on' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Content-only UPDATE: nothing that touches the GL has changed → always allowed.
    IF TG_OP = 'UPDATE'
       AND NEW."Amount"         IS NOT DISTINCT FROM OLD."Amount"
       AND NEW."RV Date"        IS NOT DISTINCT FROM OLD."RV Date"
       AND NEW."Inv No"         IS NOT DISTINCT FROM OLD."Inv No"
       AND NEW."Payment Method" IS NOT DISTINCT FROM OLD."Payment Method"
       AND NEW."Currency"       IS NOT DISTINCT FROM OLD."Currency"
       AND NEW."Status"         IS NOT DISTINCT FROM OLD."Status"
    THEN
        RETURN NEW;
    END IF;

    IF TG_OP <> 'INSERT' THEN d_old := parse_flexible_date(to_jsonb(OLD) ->> 'RV Date'); END IF;
    IF TG_OP <> 'DELETE' THEN d_new := parse_flexible_date(to_jsonb(NEW) ->> 'RV Date'); END IF;

    IF is_period_locked(d_old) THEN
        RAISE EXCEPTION 'Period % is locked — cannot % receipts dated %. Unlock the period to make changes.',
            to_char(date_trunc('month', d_old), 'YYYY-MM'), lower(TG_OP), d_old
            USING ERRCODE = 'check_violation';
    END IF;
    IF is_period_locked(d_new) THEN
        RAISE EXCEPTION 'Period % is locked — cannot % receipts dated %. Unlock the period to make changes.',
            to_char(date_trunc('month', d_new), 'YYYY-MM'), lower(TG_OP), d_new
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Re-point the receipt tables at the content-aware guard.
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['receipts', 'b2b_receipts'] LOOP
        IF to_regclass(t) IS NOT NULL THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_period_guard ON %I', t);
            EXECUTE format(
                'CREATE TRIGGER trg_period_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_guard_locked_period_receipt()',
                t
            );
        END IF;
    END LOOP;
END $$;
