-- ═══════════════════════════════════════════════════════════════════════════
-- Audit Trail (Phase 1) — who did what, when.
--
-- `audit_logs` captures every INSERT / UPDATE / DELETE on the high-value tables
-- through ONE generic trigger function. Coverage is DB-level, so it records
-- writes from the app, the anon-fallback data client, AND direct service
-- scripts — nothing routed through Postgres escapes it.
--
-- Actor: best-effort from the Supabase JWT (request.jwt.claims -> email). The
-- data client (lib/supabase.ts) falls back to the anon key on slow auth, so the
-- DB-derived actor can be NULL. The app therefore ALSO writes semantic events
-- via logAudit() (source='app') carrying the reliable currentUser. See
-- services/auditApi.ts.
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at    timestamptz NOT NULL DEFAULT now(),
    table_name     text        NOT NULL,
    record_pk      text,
    operation      text        NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE','ACTION')),
    actor_id       text,
    actor_name     text,
    actor_role     text,
    source         text        NOT NULL DEFAULT 'trigger',  -- 'trigger' | 'app'
    action_label   text,
    changed_fields jsonb,
    old_row        jsonb,
    new_row        jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table       ON audit_logs (table_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor       ON audit_logs (actor_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record      ON audit_logs (table_name, record_pk);

-- RLS TO public (matches this DB's anon-key model): app/anon may INSERT app
-- events and SELECT for the viewer.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_all ON audit_logs;
CREATE POLICY audit_logs_all ON audit_logs FOR ALL TO public USING (true) WITH CHECK (true);

-- Append-only: block UPDATE/DELETE from PostgREST clients. A deliberate
-- service-role purge/retention job sets  SET app.allow_audit_purge = 'on'
-- (same bypass convention as the JE-guard triggers; PostgREST can't set it).
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('app.allow_audit_purge', true) = 'on' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    RAISE EXCEPTION 'audit_logs is append-only — % blocked', TG_OP;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_logs;
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
DROP TRIGGER IF EXISTS trg_audit_no_delete ON audit_logs;
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- Generic row-audit function. TG_ARGV[0] = the table's human PK column.
-- UPDATE stores only the field-level diff (updated_at-only changes are skipped);
-- INSERT stores the new row; DELETE stores the old row.
CREATE OR REPLACE FUNCTION fn_audit_row() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_pk_col  text := COALESCE(TG_ARGV[0], 'id');
    v_old     jsonb;
    v_new     jsonb;
    v_pk      text;
    v_actor   text;
    v_changed jsonb;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN
        v_new := to_jsonb(NEW);
    ELSE
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
    END IF;

    v_pk := COALESCE(v_new ->> v_pk_col, v_old ->> v_pk_col);

    BEGIN
        v_actor := current_setting('request.jwt.claims', true)::jsonb ->> 'email';
    EXCEPTION WHEN others THEN
        v_actor := NULL;
    END;

    IF TG_OP = 'UPDATE' THEN
        SELECT jsonb_object_agg(k, jsonb_build_object('old', v_old->k, 'new', v_new->k))
          INTO v_changed
          FROM jsonb_object_keys(v_new) AS k
         WHERE (v_new->k) IS DISTINCT FROM (v_old->k)
           AND k <> 'updated_at';
        IF v_changed IS NULL THEN
            RETURN NULL;  -- nothing meaningful changed (e.g. updated_at only)
        END IF;
        INSERT INTO audit_logs(table_name, record_pk, operation, actor_id, actor_name, source, changed_fields)
        VALUES (TG_TABLE_NAME, v_pk, 'UPDATE', v_actor, v_actor, 'trigger', v_changed);
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs(table_name, record_pk, operation, actor_id, actor_name, source, new_row)
        VALUES (TG_TABLE_NAME, v_pk, 'INSERT', v_actor, v_actor, 'trigger', v_new);
    ELSE  -- DELETE
        INSERT INTO audit_logs(table_name, record_pk, operation, actor_id, actor_name, source, old_row)
        VALUES (TG_TABLE_NAME, v_pk, 'DELETE', v_actor, v_actor, 'trigger', v_old);
    END IF;

    RETURN NULL;  -- AFTER trigger
END;
$$;

-- Attach the audit trigger to each target table with its PK column.
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT * FROM (VALUES
            ('invoices',           'Inv No'),
            ('b2b_invoices',       'Inv No'),
            ('receipts',           'RV No'),
            ('b2b_receipts',       'RV No'),
            ('journal_entries',    'entry_number'),
            ('journal_entry_lines','id'),
            ('bills',              'id'),
            ('purchase_orders',    'id'),
            ('inventory',          'id'),
            ('serial_numbers',     'id'),
            ('consignments',       'voucher_no'),
            ('consignment_items',  'id'),
            ('pricelist',          'Code'),
            ('users',              'UserID')
        ) AS v(tbl, pk)
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit ON %I', t.tbl);
        EXECUTE format(
            'CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_audit_row(%L)',
            t.tbl, t.pk
        );
    END LOOP;
END $$;
