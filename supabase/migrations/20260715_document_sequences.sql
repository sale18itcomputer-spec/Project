-- Persistent, monotonic document numbering — closes the reissue hole in
-- generateInvNo / generateServiceInvNo / generateQuoteNo / generateSaleOrderNo.
--
-- Those functions previously computed "next number" as MAX(existing rows
-- with this prefix) + 1. Renaming or deleting a document frees its number
-- for the very next caller, even though it was already used and referenced
-- elsewhere (journal entries, printed documents). This is exactly what
-- happened on 2026-07-15: 20260710_renumber_ti2026_00003_to_inv2026_00003.sql
-- freed "TI2026-00003" by renaming an unrelated invoice away from it, and the
-- next VAT invoice created was handed that same number — a Non-VAT sale
-- (ICTECH SOLUTIONS, $1,804) briefly carrying a VAT-sequence number, tracked
-- back from journal entries JE-2070/JE-2071.
--
-- This table tracks the highest sequence ever issued per key, independent of
-- whether the row that used it still exists or still has that number.

CREATE TABLE IF NOT EXISTS document_sequences (
    prefix     TEXT PRIMARY KEY,
    last_seq   INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docseq_select" ON document_sequences;
DROP POLICY IF EXISTS "docseq_insert" ON document_sequences;
DROP POLICY IF EXISTS "docseq_update" ON document_sequences;

CREATE POLICY "docseq_select" ON document_sequences
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "docseq_insert" ON document_sequences
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "docseq_update" ON document_sequences
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Atomic "give me the next number for this key" — single UPSERT means the
-- row lock serializes concurrent callers, so two users saving at the same
-- moment can never receive the same sequence number.
CREATE OR REPLACE FUNCTION next_document_seq(p_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
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

GRANT EXECUTE ON FUNCTION next_document_seq(TEXT) TO authenticated;

-- Seeding of initial last_seq values (from live MAX-existing data, matching
-- current numbering exactly so the cutover introduces no jump or collision)
-- is done by scripts/_tmp-seed-document-sequences.mjs, run once against
-- production data before services/api.ts switches over to this function.
