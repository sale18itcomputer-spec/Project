import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Minimal Database stub — lets all .from() calls accept any payload.
// Replace with generated types from `supabase gen types typescript` when ready.
type Database = { [key: string]: any };

type SupabaseClient = ReturnType<typeof createSupabaseClient<Database>>;

let client: SupabaseClient | null = null;

/**
 * Returns the Supabase browser client singleton.
 * Throws at runtime if env vars are missing — this is intentional,
 * as missing env vars are a fatal misconfiguration.
 * Return type is non-nullable so callers never have to guard against null.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
    if (client) return client;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anon) {
        const msg = '[Supabase] Missing env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY';
        console.error(msg);
        // Throw so the error surface is clear at startup rather than silent null refs later
        throw new Error(msg);
    }

    client = createSupabaseClient<Database>(url, anon);
    return client;
}

/** @deprecated Use getSupabaseBrowserClient() directly. Kept for AuthContext compatibility. */
export const createClient = getSupabaseBrowserClient;
