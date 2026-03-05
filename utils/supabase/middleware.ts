import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // Protection logic
    const { pathname } = request.nextUrl
    const PUBLIC_ROUTES = ['/login']
    const ALWAYS_ALLOW = ['/_next', '/favicon.ico', '/api/', '/public/']

    if (ALWAYS_ALLOW.some(p => pathname.startsWith(p))) {
        return response
    }

    if (PUBLIC_ROUTES.includes(pathname)) {
        return response
    }

    // Dev auto-login bypass
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN) {
        return response
    }

    const legacySession = request.cookies.get('limperial_legacy_session')?.value
    // Note: Since we are moving away from SSR, we are skipping server-side Supabase session check 
    // and relying on the legacy session cookie or client-side AuthContext.

    if (!legacySession) {
        // If no legacy session, we check if we're on a protected route
        // For Supabase users, the client-side AuthContext will handle state once loaded.
        // To prevent unauthorized access to sensitive dashboards, you might want to 
        // implement a client-side guard in your layout or components.

        // For now, we redirect to login if no legacy session is found.
        // If a user is a Supabase user, they will login and then AuthContext will set the 
        // legacy cookie for middleware consistency, OR we let the client handle it.

        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
    }

    return response
}
