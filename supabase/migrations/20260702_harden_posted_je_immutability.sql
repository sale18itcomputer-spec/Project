-- DB-level immutability for posted journal entries.
--
-- RLS is currently TO public (see 20260615_fix_accounting_rls_to_public.sql),
-- so posted-entry protection lived only in client code. These triggers enforce
-- it at the database regardless of role or client:
--
--   * Posted HEADERS: core fields (number, date, description, reference, source)
--     cannot change while is_posted = true. Unposting (is_posted true→false)
--     stays allowed — that is the sanctioned edit path.
--   * Posted LINES: no UPDATE or DELETE while the parent entry is posted.
--     INSERT stays allowed because both JE-creation paths (atomic RPC and the
--     legacy two-step client) write the header before its lines.
--
-- Deliberate repairs (SQL Editor): bypass for the current session with
--     SET app.allow_je_repair = 'on';
-- at the top of the repair script. PostgREST clients cannot set this.

CREATE OR REPLACE FUNCTION guard_posted_je_header()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('app.allow_je_repair', true) = 'on' THEN
        RETURN NEW;
    END IF;
    IF OLD.is_posted AND NEW.is_posted THEN
        IF NEW.entry_number IS DISTINCT FROM OLD.entry_number
           OR NEW.entry_date   IS DISTINCT FROM OLD.entry_date
           OR NEW.description  IS DISTINCT FROM OLD.description
           OR NEW.reference    IS DISTINCT FROM OLD.reference
           OR NEW.source       IS DISTINCT FROM OLD.source THEN
            RAISE EXCEPTION 'Posted entry % is immutable — unpost it first', OLD.entry_number;
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_posted_je_header ON journal_entries;
CREATE TRIGGER trg_guard_posted_je_header
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION guard_posted_je_header();

CREATE OR REPLACE FUNCTION guard_posted_je_lines()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_posted boolean;
    v_number text;
BEGIN
    IF current_setting('app.allow_je_repair', true) = 'on' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    SELECT is_posted, entry_number INTO v_posted, v_number
    FROM journal_entries
    WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
    IF v_posted THEN
        RAISE EXCEPTION 'Lines of posted entry % are immutable — unpost it first', v_number;
    END IF;
    RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_guard_posted_je_lines ON journal_entry_lines;
CREATE TRIGGER trg_guard_posted_je_lines
    BEFORE UPDATE OR DELETE ON journal_entry_lines
    FOR EACH ROW EXECUTE FUNCTION guard_posted_je_lines();
