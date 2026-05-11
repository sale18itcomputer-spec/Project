import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const url = new URL('/auth/callback-client', origin);
        url.searchParams.set('code', code);
        url.searchParams.set('next', next);
        return NextResponse.redirect(url.toString());
    }

    // Implicit flow: token is in hash fragment — let the client page handle it
    return NextResponse.redirect(`${origin}/auth/callback-client`);
}
