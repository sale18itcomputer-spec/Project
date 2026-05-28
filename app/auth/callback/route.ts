import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Server-side OAuth callback.
 *
 * Exchanges the authorization code for a session using the PKCE code verifier
 * stored in the request cookie (set by /api/auth/google). This runs entirely
 * on the server so browser storage blocking (Brave, Firefox strict, Safari ITP)
 * has no effect.
 *
 * On success  → redirects to /unlock/otp (session is now in cookies, AuthContext picks it up)
 * On failure  → falls back to /auth/callback-client for legacy/implicit flows
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
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

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Session is now stored in pendingCookies — attach them to the redirect
            // so the browser carries the session to /unlock/otp.
            // AuthContext.bootstrapAuth will call getSession(), find the session,
            // syncUser(), and set currentUser — the OTP page uses currentUser.Email.
            const dest = `${origin}/unlock/otp`;
            const redirect = NextResponse.redirect(dest);
            pendingCookies.forEach(({ name, value, options }) => {
                try { redirect.cookies.set(name, value, options); } catch { /* ignore */ }
            });
            return redirect;
        }
    }

    // No code, or exchange failed — hand off to the client-side handler.
    // This covers: implicit/magic-link flows, and browsers where even
    // server-side PKCE fails (extremely rare, but keeps a safe fallback).
    const fallback = new URL('/auth/callback-client', origin);
    if (code) fallback.searchParams.set('code', code);
    if (next !== '/') fallback.searchParams.set('next', next);
    return NextResponse.redirect(fallback.toString());
}
