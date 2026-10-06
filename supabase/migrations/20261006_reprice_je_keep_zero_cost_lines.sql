-- reprice_invoice_je: keep $0.00 lines (free / zero-cost items).
--
-- Free stock still leaves inventory, so an invoice's JE lists it as a $0.00 COGS /
-- Inventory-out pair naming the item (e.g. "SAC00003 ×6 @ $0.00 (no cost)").
-- The original function netted every account into one line and dropped anything that
-- netted to zero, so those lines were erased on the next reprice and could never be
-- added by an edit. This version nets only the lines that carry an amount and carries
-- every zero-amount line (existing ones and new ones from the delta) through unchanged.
-- Behaviour for non-zero lines is identical to the previous definition.

CREATE OR REPLACE FUNCTION public.reprice_invoice_je(p_inv_no text, p_delta_lines jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id     uuid;
    v_num    text;
    v_merged jsonb;
    v_zero   jsonb;
    v_td     numeric;
    v_tc     numeric;
BEGIN
    SELECT id, entry_number INTO v_id, v_num
      FROM journal_entries
     WHERE reference = p_inv_no AND source = 'invoice'
     LIMIT 1;
    IF v_id IS NULL THEN
        RETURN NULL;  -- no main JE (e.g. never posted) — caller falls back
    END IF;

    -- Merge existing AMOUNT lines (grouped by account) with the AMOUNT delta lines,
    -- netting each account to a single debit/credit side. Computed BEFORE we touch rows.
    SELECT jsonb_agg(jsonb_build_object(
               'account_number', account_number,
               'description',     descr,
               'debit',           GREATEST(d - c, 0),
               'credit',          GREATEST(c - d, 0)))
      INTO v_merged
      FROM (
        SELECT COALESCE(e.account_number, x.account_number)      AS account_number,
               COALESCE(e.d, 0) + COALESCE(x.d, 0)               AS d,
               COALESCE(e.c, 0) + COALESCE(x.c, 0)               AS c,
               COALESCE(e.descr, x.descr)                        AS descr
          FROM (
                SELECT account_number,
                       SUM(debit)  AS d,
                       SUM(credit) AS c,
                       MAX(description) AS descr
                  FROM journal_entry_lines
                 WHERE journal_entry_id = v_id
                   AND (COALESCE(debit, 0) <> 0 OR COALESCE(credit, 0) <> 0)
                 GROUP BY account_number
               ) e
          FULL OUTER JOIN (
                SELECT (l->>'account_number')                    AS account_number,
                       COALESCE((l->>'debit')::numeric, 0)       AS d,
                       COALESCE((l->>'credit')::numeric, 0)      AS c,
                       COALESCE(l->>'description', '')           AS descr
                  FROM jsonb_array_elements(p_delta_lines) l
                 WHERE COALESCE((l->>'debit')::numeric, 0) <> 0
                    OR COALESCE((l->>'credit')::numeric, 0) <> 0
               ) x ON e.account_number = x.account_number
      ) merged
     WHERE GREATEST(d - c, 0) > 0.005 OR GREATEST(c - d, 0) > 0.005;

    -- Zero-amount lines (free items): existing ones plus new ones from the delta, kept as-is.
    SELECT jsonb_agg(z)
      INTO v_zero
      FROM (
        SELECT jsonb_build_object('account_number', account_number, 'description', description,
                                  'debit', 0, 'credit', 0) AS z
          FROM journal_entry_lines
         WHERE journal_entry_id = v_id
           AND COALESCE(debit, 0) = 0 AND COALESCE(credit, 0) = 0
        UNION ALL
        SELECT jsonb_build_object('account_number', l->>'account_number',
                                  'description',    COALESCE(l->>'description', ''),
                                  'debit', 0, 'credit', 0)
          FROM jsonb_array_elements(p_delta_lines) l
         WHERE COALESCE((l->>'debit')::numeric, 0) = 0
           AND COALESCE((l->>'credit')::numeric, 0) = 0
      ) zl;

    -- Unpost so the lines are editable (the posted-JE immutability trigger only
    -- blocks changes while the parent is posted), then replace the line set.
    UPDATE journal_entries SET is_posted = false WHERE id = v_id;
    DELETE FROM journal_entry_lines WHERE journal_entry_id = v_id;
    INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit)
    SELECT v_id,
           l->>'account_number',
           l->>'description',
           (l->>'debit')::numeric,
           (l->>'credit')::numeric
      FROM jsonb_array_elements(COALESCE(v_merged, '[]'::jsonb) || COALESCE(v_zero, '[]'::jsonb)) l;

    -- Invariant: the repriced JE must still balance.
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO v_td, v_tc
      FROM journal_entry_lines WHERE journal_entry_id = v_id;
    IF abs(v_td - v_tc) > 0.01 THEN
        RAISE EXCEPTION 'reprice_invoice_je(%): result does not balance (DR % <> CR %)', p_inv_no, v_td, v_tc;
    END IF;

    UPDATE journal_entries SET is_posted = true, updated_at = now() WHERE id = v_id;
    RETURN v_num;
END;
$function$;
