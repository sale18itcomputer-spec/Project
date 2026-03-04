import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that are always public
const PUBLIC_ROUTES = ['/login'];

// Next.js internals and static assets — always allowed
const ALWAYS_ALLOW = ['/_next', '/favicon.ico', '/api/', '/public/'];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow Next.js internals and static assets
    if (ALWAYS_ALLOW.some(p => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // Allow public routes
    if (PUBLIC_ROUTES.includes(pathname)) {
        return NextResponse.next();
    }

    // In development with auto-login enabled, skip auth check entirely —
    // AuthContext handles the bypass client-side via NEXT_PUBLIC_DEV_AUTO_LOGIN
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN) {
        return NextResponse.next();
    }

    // Check for our custom auth session stored in localStorage key 'limperial_auth_user'.
    // Note: localStorage is client-only, so the middleware checks a cookie we set on login.
    const authSession = request.cookies.get('limperial_auth_user');
    if (!authSession?.value) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
