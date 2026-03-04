import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/create-user
 * Creates a new user in Supabase Auth using the service role key (admin).
 * This must be a server-side route so the service role key is never exposed to the client.
 *
 * Body: { email: string, password: string }
 */
export async function POST(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json(
            { error: 'Supabase service role key is not configured on the server.' },
            { status: 500 }
        );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { email, password } = await request.json();

    if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // Use admin API to create the user — this bypasses email confirmation
    const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm so they can log in immediately
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data.user }, { status: 201 });
}
