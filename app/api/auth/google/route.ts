import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Server-side Google OAuth initiation.
 *
 * By running this in a Route Handler we can store the PKCE code verifier
 * in a server-set cookie (SameSite=Lax) instead of localStorage.
 * This survives the Google redirect in ALL browsers including Brave,
 * because SameSite=Lax cookies are always sent on top-level GET navigations.
 */
export async function GET(request: NextRequest) {
    const { origin, searchParams } = new URL(request.url);
    const next = searchParams.get('next') ?? '/';

    // Collect cookies that createServerClient wants to set (the code verifier)
    const pendingCookies: { name: string; value: string; options: any }[] = [];

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (list) => { pendingCookies.push(...list); },
            },
        }
    );

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
            skipBrowserRedirect: true,
        },
    });

    if (error || !data?.url) {
        return NextResponse.redirect(`${origin}/login?error=1`);
    }

    // Redirect browser to Google, attaching the code-verifier cookies
    const redirect = NextResponse.redirect(data.url);
    pendingCookies.forEach(({ name, value, options }) => {
        try { redirect.cookies.set(name, value, options); } catch { /* ignore */ }
    });
    return redirect;
}
