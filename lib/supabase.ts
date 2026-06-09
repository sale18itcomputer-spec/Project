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
