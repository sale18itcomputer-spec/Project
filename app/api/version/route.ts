import { NextResponse } from 'next/server';

// Computed once when this server process boots — i.e. fresh on every deploy —
// then held constant for the process lifetime so polling clients get a stable
// value to compare against. Prefers the platform-provided commit SHA so the
// value also stays stable across serverless cold starts within one deployment.
const APP_VERSION =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    String(Date.now());

export const dynamic = 'force-dynamic';

/**
 * GET /api/version
 *
 * Returns an identifier that changes whenever a new build goes live.
 * The client polls this (see UpdateNotifier) to detect that a newer
 * version is deployed and prompt the user to refresh — fixes users
 * getting stuck on a stale cached build after a deploy.
 */
export async function GET() {
    return NextResponse.json(
        { version: APP_VERSION },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
}
