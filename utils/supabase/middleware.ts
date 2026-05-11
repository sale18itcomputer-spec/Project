import { NextResponse, type NextRequest } from 'next/server'

const PIN_STORAGE_KEY = 'limperial_local_pin';
const UNLOCK_STORAGE_KEY = 'limperial_unlocked';

export async function updateSession(request: NextRequest) {
    const response = NextResponse.next({
        request: { headers: request.headers },
    })

    const { pathname } = request.nextUrl

    const ALWAYS_ALLOW = ['/_next', '/favicon.ico', '/api/', '/public/']
    const AUTH_ROUTES = ['/login']
    const UNLOCK_ROUTES = ['/unlock']
    const AUTH_CALLBACK = ['/auth/callback', '/auth/callback-client']

    if (ALWAYS_ALLOW.some(p => pathname.startsWith(p))) return response
    if (AUTH_CALLBACK.some(p => pathname.startsWith(p))) return response

    // Dev auto-login bypass
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN) {
        return response
    }

    const legacySession = request.cookies.get('limperial_legacy_session')?.value

    // Not logged in — redirect to login
    if (!legacySession) {
        if (AUTH_ROUTES.some(p => pathname.startsWith(p))) return response
        if (UNLOCK_ROUTES.some(p => pathname.startsWith(p))) return response
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // Logged in — let unlock routes pass through
    if (UNLOCK_ROUTES.some(p => pathname.startsWith(p))) return response
    if (AUTH_ROUTES.some(p => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return response
}
