-- ═══════════════════════════════════════════════════════════════════════════
-- Audit actor from request header (fixes "actor = system" for app writes).
--
-- The data client (lib/supabase.ts) falls back to the ANON key for reliability,
-- so the JWT rarely carries the user's email — the trigger recorded NULL ("system")
-- for real user activity. The app now stamps every write with x-audit-actor
-- (base64 UTF-8 name) + x-audit-role headers, which PostgREST exposes to triggers
-- via request.headers. fn_audit_row now prefers those, falling back to the JWT
-- email, then NULL (genuine service-role / anon writes stay "system").
--
-- Only CREATE OR REPLACE — the trg_audit triggers already point at fn_audit_row.
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_audit_row() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_pk_col  text := COALESCE(TG_ARGV[0], 'id');
    v_old     jsonb;
    v_new     jsonb;
    v_pk      text;
    v_actor   text;
    v_role    text;
    v_changed jsonb;
    v_headers json;
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

    -- Actor: prefer the app-supplied header, then the JWT email, then NULL.
    BEGIN v_headers := current_setting('request.headers', true)::json; EXCEPTION WHEN others THEN v_headers := NULL; END;
    IF v_headers IS NOT NULL THEN
        BEGIN
            v_actor := convert_from(decode(v_headers ->> 'x-audit-actor', 'base64'), 'utf8');
        EXCEPTION WHEN others THEN v_actor := NULL; END;
        v_role := v_headers ->> 'x-audit-role';
    END IF;
    IF v_actor IS NULL OR v_actor = '' THEN
        BEGIN
            v_actor := current_setting('request.jwt.claims', true)::jsonb ->> 'email';
        EXCEPTION WHEN others THEN v_actor := NULL; END;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        SELECT jsonb_object_agg(k, jsonb_build_object('old', v_old->k, 'new', v_new->k))
          INTO v_changed
          FROM jsonb_object_keys(v_new) AS k
         WHERE (v_new->k) IS DISTINCT FROM (v_old->k)
           AND k <> 'updated_at';
        IF v_changed IS NULL THEN
            RETURN NULL;  -- nothing meaningful changed (e.g. updated_at only)
        END IF;
        INSERT INTO audit_logs(table_name, record_pk, operation, actor_id, actor_name, actor_role, source, changed_fields)
        VALUES (TG_TABLE_NAME, v_pk, 'UPDATE', v_actor, v_actor, v_role, 'trigger', v_changed);
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs(table_name, record_pk, operation, actor_id, actor_name, actor_role, source, new_row)
        VALUES (TG_TABLE_NAME, v_pk, 'INSERT', v_actor, v_actor, v_role, 'trigger', v_new);
    ELSE  -- DELETE
        INSERT INTO audit_logs(table_name, record_pk, operation, actor_id, actor_name, actor_role, source, old_row)
        VALUES (TG_TABLE_NAME, v_pk, 'DELETE', v_actor, v_actor, v_role, 'trigger', v_old);
    END IF;

    RETURN NULL;  -- AFTER trigger
END;
$$;
