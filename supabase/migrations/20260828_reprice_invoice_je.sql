-- ═══════════════════════════════════════════════════════════════════════════
-- reprice_invoice_je — fold an invoice edit into the invoice's OWN journal entry.
--
-- Model (per Ops): adjusting an issued invoice sets its FINAL price, so the
-- invoice's own JE (source='invoice') must always equal the invoice total. The
-- "edit adjustment" JE is a NON-POSTING reference ("changed from X to Y"), not a
-- second posting — posting it too double-counts the delta (see INV2026-00014 / JE-2195).
--
-- This function nets the edit's delta lines into the invoice's main JE atomically:
-- unpost → merge lines by account → re-balance check → repost, all in one
-- transaction so a failed browser save can never leave the JE unposted or
-- half-rebuilt. Returns the entry_number repriced, or NULL if no main JE exists.
--
-- p_delta_lines: jsonb array of {account_number, debit, credit, description}.
-- Idempotent to define (CREATE OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reprice_invoice_je(p_inv_no text, p_delta_lines jsonb)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_id     uuid;
    v_num    text;
    v_merged jsonb;
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

    -- Merge existing lines (grouped by account) with the delta lines, netting each
    -- account to a single debit/credit side. Computed BEFORE we touch the rows.
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
                 GROUP BY account_number
               ) e
          FULL OUTER JOIN (
                SELECT (l->>'account_number')                    AS account_number,
                       COALESCE((l->>'debit')::numeric, 0)       AS d,
                       COALESCE((l->>'credit')::numeric, 0)      AS c,
                       COALESCE(l->>'description', '')           AS descr
                  FROM jsonb_array_elements(p_delta_lines) l
               ) x ON e.account_number = x.account_number
      ) merged
     WHERE GREATEST(d - c, 0) > 0.005 OR GREATEST(c - d, 0) > 0.005;

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
      FROM jsonb_array_elements(v_merged) l;

    -- Invariant: the repriced JE must still balance.
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO v_td, v_tc
      FROM journal_entry_lines WHERE journal_entry_id = v_id;
    IF abs(v_td - v_tc) > 0.01 THEN
        RAISE EXCEPTION 'reprice_invoice_je(%): result does not balance (DR % <> CR %)', p_inv_no, v_td, v_tc;
    END IF;

    UPDATE journal_entries SET is_posted = true, updated_at = now() WHERE id = v_id;
    RETURN v_num;
END;
$$;
