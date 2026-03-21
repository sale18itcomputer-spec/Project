import { getSupabaseBrowserClient } from '../utils/supabase/client';

// Singleton — throws at startup if env vars are missing.
export const supabase = getSupabaseBrowserClient();
