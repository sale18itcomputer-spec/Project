import { createBrowserClient } from "@supabase/ssr";

// Minimal Database stub — lets all .from() calls accept any payload.
// Replace with generated types from `supabase gen types typescript` when ready.
type Database = { [key: string]: any };

type SupabaseClient = ReturnType<typeof createBrowserClient<Database>>;

let client: SupabaseClient | null = null;

/**
 * Returns the Supabase browser client singleton using @supabase/ssr.
 * createBrowserClient handles cookie-based session storage correctly in Next.js,
 * preventing getSession from hanging on page reload.
 * Throws at runtime if env vars are missing — this is intentional,
 * as missing env vars are a fatal misconfiguration.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
    if (client) return client;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anon) {
        const msg = '[Supabase] Missing env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY';
        console.error(msg);
        throw new Error(msg);
    }

    // createBrowserClient from @supabase/ssr is cookie-aware — it correctly
    // reads/writes session tokens via cookies in Next.js, fixing getSession
    // timeouts that occur with the plain supabase-js client on page reload.
    client = createBrowserClient<Database>(url, anon);
    return client;
}

/** @deprecated Use getSupabaseBrowserClient() directly. Kept for AuthContext compatibility. */
export const createClient = getSupabaseBrowserClient;

/**
 * Resets the singleton so the next call to getSupabaseBrowserClient()
 * creates a fresh client. Call this on sign-out to avoid stale auth state
 * from persisting in the cached instance.
 */
export function resetSupabaseBrowserClient(): void {
    client = null;
}
