import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createSupabaseClient> | undefined;

export function getSupabaseBrowserClient(): any {
    if (!client) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !anon) {
            console.error('Supabase environment variables are missing! Check your Vercel project settings.');
            console.error('NEXT_PUBLIC_SUPABASE_URL:', url ? 'Defined' : 'MISSING');
            console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', anon ? 'Defined' : 'MISSING');

            // Return a dummy client or throw to avoid hard crash if possible, 
            // but usually this is a fatal configuration error.
            if (!url) return null;
        }

        client = createSupabaseClient(url!, anon!);
    }
    return client;
}

// Keep createClient for compatibility with existing imports
export const createClient = getSupabaseBrowserClient;
