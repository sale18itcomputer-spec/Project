import { createClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../utils/supabase/client';

// Minimal Database stub — must stay in sync with utils/supabase/client.ts
type Database = { [key: string]: any };

/**
 * Data-only Supabase client that never blocks on auth initialization.
 *
 * Root cause of the "saving … timed out" bug
 * ─────────────────────────────────────────────────────────────────────
 * supabase-js wraps every PostgREST request in fetchWithAuth, which calls
 * auth.getSession() to obtain the JWT before sending the HTTP request.
 * getSession() awaits initializePromise (set in the GoTrueClient constructor).
 *
 * initializePromise can stay pending for 30+ seconds when:
 *   a) Supabase Auth is slow on cold start (first page load).
 *   b) A token refresh is in flight (~58 min into the session).
 *
 * While it's pending, every write hits WRITE_TIMEOUT_MS (30 s) and throws
 * "Saving … timed out" — even though the DB itself is healthy.
 *
 * Fix
 * ─────────────────────────────────────────────────────────────────────
 * Use the `accessToken` option (supabase-js ≥ 2.x) to inject a custom
 * getter that races the real auth client's getSession() against a 5-second
 * timeout.  On timeout it returns undefined, which supabase-js maps to the
 * anon key.  All tables now have TO public RLS, so the anon key has full
 * read/write access and requests always go through immediately.
 *
 *   Auth resolves < 5 s  → request carries the user's JWT (authenticated)
 *   Auth resolves ≥ 5 s  → request falls back to anon key (still works)
 *
 * The auth client itself (getSupabaseBrowserClient()) is untouched and keeps
 * managing the Supabase Auth session for login / logout flows.
 */
/**
 * Audit actor, set by AuthContext when the current user changes.
 *
 * Because this data client falls back to the ANON key for reliability (see above),
 * the DB triggers usually can't derive "who" from the JWT — so the app stamps the
 * actor on every write via the `x-audit-actor` / `x-audit-role` headers below, and
 * fn_audit_row reads them (PostgREST exposes request.headers to triggers). Cleared
 * on logout so writes after sign-out aren't misattributed.
 */
let auditActor: { name?: string | null; role?: string | null } | null = null;
export function setAuditActor(actor: { name?: string | null; role?: string | null } | null) {
    auditActor = actor && actor.name ? actor : null;
}

/** UTF-8-safe base64 so non-ASCII names survive as an HTTP header value. */
function b64(s: string): string {
    try {
        const bytes = new TextEncoder().encode(s);
        let bin = '';
        for (const byte of bytes) bin += String.fromCharCode(byte);
        return btoa(bin);
    } catch { return ''; }
}

/** Wraps fetch to attach the current actor to every data request (when known). */
const auditFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (auditActor?.name) {
        const enc = b64(auditActor.name);
        if (enc) headers.set('x-audit-actor', enc);
        if (auditActor.role) headers.set('x-audit-role', String(auditActor.role));
    }
    return fetch(input, { ...init, headers });
};

export const supabase = (() => {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anon) {
        throw new Error(
            '[Supabase] Missing env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY'
        );
    }

    return createClient<Database>(url, anon, {
        auth: {
            // No auth lifecycle in the data client — the accessToken
            // callback below delegates to the dedicated auth client.
            persistSession:      false,
            autoRefreshToken:    false,
            skipAutoInitialize:  true,
        },
        global: { fetch: auditFetch },
        // Custom token getter — always resolves within 5 s.
        accessToken: async (): Promise<string | undefined> => {
            try {
                const timeout = new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), 5_000)
                );
                const result = await Promise.race([
                    getSupabaseBrowserClient().auth.getSession(),
                    timeout,
                ]);
                if (result === null) return undefined; // timed out → fall back to anon
                return result.data.session?.access_token ?? undefined;
            } catch {
                return undefined;
            }
        },
    });
})();
