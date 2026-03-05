import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createSupabaseClient> | undefined;

export function getSupabaseBrowserClient() {
    if (!client) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        client = createSupabaseClient(url, anon);
    }
    return client;
}

// Keep createClient for compatibility with existing imports
export const createClient = getSupabaseBrowserClient;
