-- Fix: "new row violates row-level security policy for table document_sequences"
-- when saving sale orders / quotations / invoices / receipts.
--
-- next_document_seq() was created SECURITY INVOKER, so its INSERT/UPDATE into
-- document_sequences runs as the CALLER's role. The app reaches Supabase under
-- the anon role, but document_sequences has authenticated-only RLS
-- (docseq_insert/update), so the allocation is rejected and numbering fails.
--
-- Rather than loosen the table's RLS to public (the app-wide pattern, but it
-- lets clients tamper with sequence numbers directly), make the allocator a
-- SECURITY DEFINER function: it writes the sequence table with the owner's
-- privilege regardless of caller, so the table stays locked and this atomic
-- function remains the only write path. search_path is pinned per definer-
-- function best practice.

CREATE OR REPLACE FUNCTION next_document_seq(p_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seq INTEGER;
BEGIN
    INSERT INTO document_sequences (prefix, last_seq, updated_at)
    VALUES (p_key, 1, now())
    ON CONFLICT (prefix) DO UPDATE
        SET last_seq = document_sequences.last_seq + 1,
            updated_at = now()
    RETURNING last_seq INTO v_seq;
    RETURN v_seq;
END;
$$;

-- The app calls this under both roles (anon during session cold-start,
-- authenticated once the token is attached), so allow both to execute it.
GRANT EXECUTE ON FUNCTION next_document_seq(TEXT) TO anon, authenticated;
