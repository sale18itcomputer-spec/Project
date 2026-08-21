-- ═══════════════════════════════════════════════════════════════════════════
-- Period Locking (Phase 2) — freeze a month so closed-period data can't change.
--
-- `period_locks` holds one row per calendar month. When a month is 'locked',
-- BEFORE triggers reject any INSERT/UPDATE/DELETE whose date falls in that month
-- on the ledger (journal_entries + lines) and the financial documents
-- (invoices, b2b_invoices, receipts, b2b_receipts, bills). This is DB-level, so
-- it holds against the app, the anon-fallback client, and direct scripts alike.
--
-- Deliberate corrections bypass for the session with
--     SET app.allow_locked_period = 'on';
-- (service-role only; PostgREST clients can't set it — same convention as the
-- JE-guard triggers). Lock/unlock is done by the app (Admin Period Control page)
-- and is itself audited.
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS period_locks (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    period       date NOT NULL UNIQUE,                        -- always first-of-month
    status       text NOT NULL DEFAULT 'locked' CHECK (status IN ('open','locked')),
    locked_by    text,
    locked_at    timestamptz,
    unlocked_by  text,
    unlocked_at  timestamptz,
    note         text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE period_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS period_locks_all ON period_locks;
CREATE POLICY period_locks_all ON period_locks FOR ALL TO public USING (true) WITH CHECK (true);

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- Parse the several stored date shapes to a plain date: 'YYYY-MM-DD',
-- ISO timestamps ('2026-01-02T00:00:00+00:00'), and 'M/D/YYYY'. NULL if unknown.
CREATE OR REPLACE FUNCTION parse_flexible_date(s text) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r date;
BEGIN
    IF s IS NULL OR btrim(s) = '' THEN RETURN NULL; END IF;
    BEGIN r := s::date; RETURN r; EXCEPTION WHEN others THEN END;
    BEGIN r := to_date(s, 'FMMM/FMDD/YYYY'); RETURN r; EXCEPTION WHEN others THEN END;
    RETURN NULL;
END;
$$;

-- Is the given date inside a month that is currently locked?
CREATE OR REPLACE FUNCTION is_period_locked(d date) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT d IS NOT NULL AND EXISTS (
        SELECT 1 FROM period_locks
        WHERE status = 'locked' AND period = date_trunc('month', d)::date
    );
$$;

-- ── Guard: generic (date lives in a named column on the row) ────────────────
-- TG_ARGV[0] = the date column name (read generically via to_jsonb, so it works
-- for date, timestamp, and text columns). Blocks if EITHER the pre-image or the
-- post-image date is in a locked month — so you can't move a row into a locked
-- month, and can't touch one already in it.
CREATE OR REPLACE FUNCTION fn_guard_locked_period() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_col text := TG_ARGV[0];
    d_old date;
    d_new date;
BEGIN
    IF current_setting('app.allow_locked_period', true) = 'on' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF TG_OP <> 'INSERT' THEN d_old := parse_flexible_date(to_jsonb(OLD) ->> v_col); END IF;
    IF TG_OP <> 'DELETE' THEN d_new := parse_flexible_date(to_jsonb(NEW) ->> v_col); END IF;

    IF is_period_locked(d_old) THEN
        RAISE EXCEPTION 'Period % is locked — cannot % % dated %. Unlock the period to make changes.',
            to_char(date_trunc('month', d_old), 'YYYY-MM'), lower(TG_OP), TG_TABLE_NAME, d_old
            USING ERRCODE = 'check_violation';
    END IF;
    IF is_period_locked(d_new) THEN
        RAISE EXCEPTION 'Period % is locked — cannot % % dated %. Unlock the period to make changes.',
            to_char(date_trunc('month', d_new), 'YYYY-MM'), lower(TG_OP), TG_TABLE_NAME, d_new
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Guard: journal_entry_lines (period comes from the parent entry's date) ──
CREATE OR REPLACE FUNCTION fn_guard_je_line_locked_period() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_entry uuid := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
    d date;
BEGIN
    IF current_setting('app.allow_locked_period', true) = 'on' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    SELECT parse_flexible_date(entry_date::text) INTO d FROM journal_entries WHERE id = v_entry;
    IF is_period_locked(d) THEN
        RAISE EXCEPTION 'Period % is locked — cannot modify journal lines of an entry dated %. Unlock the period to make changes.',
            to_char(date_trunc('month', d), 'YYYY-MM'), d
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Attach guards ───────────────────────────────────────────────────────────
DO $$
DECLARE t record;
BEGIN
    FOR t IN
        SELECT * FROM (VALUES
            ('journal_entries', 'entry_date'),
            ('invoices',        'Inv Date'),
            ('b2b_invoices',    'Inv Date'),
            ('receipts',        'RV Date'),
            ('b2b_receipts',    'RV Date'),
            ('bills',           'bill_date')
        ) AS v(tbl, datecol)
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_period_guard ON %I', t.tbl);
        EXECUTE format(
            'CREATE TRIGGER trg_period_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_guard_locked_period(%L)',
            t.tbl, t.datecol
        );
    END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_period_guard_lines ON journal_entry_lines;
CREATE TRIGGER trg_period_guard_lines BEFORE INSERT OR UPDATE OR DELETE ON journal_entry_lines
    FOR EACH ROW EXECUTE FUNCTION fn_guard_je_line_locked_period();

-- Audit lock/unlock at the row level too (Phase-1 audit trigger, keyed by period).
DROP TRIGGER IF EXISTS trg_audit ON period_locks;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON period_locks
    FOR EACH ROW EXECUTE FUNCTION fn_audit_row('period');
