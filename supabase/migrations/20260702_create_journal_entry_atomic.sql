-- Atomic journal entry creation: header + lines in ONE transaction.
--
-- The client previously inserted journal_entries then journal_entry_lines in
-- two separate requests. A failure between them left an orphaned header with
-- no lines (the JE-2049 incident class). This RPC makes the pair atomic —
-- either both commit or neither does.
--
-- services/accountingApi.ts calls this via supabase.rpc('create_journal_entry_atomic')
-- and falls back to the legacy two-step path if the function doesn't exist yet.

CREATE OR REPLACE FUNCTION create_journal_entry_atomic(p_header jsonb, p_lines jsonb)
RETURNS SETOF journal_entries
LANGUAGE plpgsql
AS $$
DECLARE
    v_entry  journal_entries;
    v_debit  numeric;
    v_credit numeric;
BEGIN
    -- Server-side balance check (mirrors the client + posting trigger)
    SELECT COALESCE(SUM((l->>'debit')::numeric), 0),
           COALESCE(SUM((l->>'credit')::numeric), 0)
    INTO v_debit, v_credit
    FROM jsonb_array_elements(p_lines) l;

    IF ABS(v_debit - v_credit) > 0.001 THEN
        RAISE EXCEPTION 'Journal entry is not balanced: debits % <> credits %', v_debit, v_credit;
    END IF;

    IF jsonb_array_length(p_lines) < 2 THEN
        RAISE EXCEPTION 'Journal entry needs at least two lines';
    END IF;

    INSERT INTO journal_entries (entry_number, entry_date, description, reference, created_by, is_posted, source)
    VALUES (
        p_header->>'entry_number',
        (p_header->>'entry_date')::date,
        p_header->>'description',
        p_header->>'reference',
        p_header->>'created_by',
        COALESCE((p_header->>'is_posted')::boolean, false),
        p_header->>'source'
    )
    RETURNING * INTO v_entry;

    INSERT INTO journal_entry_lines (journal_entry_id, account_number, description, debit, credit)
    SELECT v_entry.id,
           l->>'account_number',
           l->>'description',
           COALESCE((l->>'debit')::numeric, 0),
           COALESCE((l->>'credit')::numeric, 0)
    FROM jsonb_array_elements(p_lines) l;

    RETURN NEXT v_entry;
END;
$$;
