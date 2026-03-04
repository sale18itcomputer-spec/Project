import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/update-user-password
 * Updates password for an existing Supabase Auth user by email using the admin API.
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

    // Find user by email
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const authUser = (listData?.users ?? []).find((u: { email?: string }) => u.email === email);
    if (!authUser) {
        // User doesn't exist in Supabase Auth yet — create them instead
        const { data, error } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ user: data.user, created: true }, { status: 201 });
    }

    // Update the existing user's password
    const { data, error } = await adminClient.auth.admin.updateUserById(authUser.id, {
        password,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data.user, created: false }, { status: 200 });
}
