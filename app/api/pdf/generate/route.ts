/**
 * /api/pdf/generate — POST
 * Body: PdfTemplateOptions (JSON)
 * Returns: application/pdf bytes
 *
 * Auth (either one accepted):
 *  1. Cookie  — `limperial_legacy_session`  (dashboard users)
 *  2. Header  — `x-miniapp-init-data`       (Telegram miniapp users)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { buildHtml, PdfTemplateOptions } from '@/lib/pdfTemplate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BROWSERLESS_ENDPOINT =
    process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// ── Telegram initData verification (same logic as /api/miniapp/auth) ──────────
function verifyTelegramInitData(initData: string): boolean {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash) return false;

        params.delete('hash');
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

        const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        if (expectedHash !== hash) return false;

        // Allow up to 24h — PDF previews may happen later in the session
        const authDate = parseInt(params.get('auth_date') || '0', 10);
        if (Date.now() / 1000 - authDate > 86400) return false;

        return true;
    } catch {
        return false;
    }
}

// ── Auth check ────────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): { ok: boolean; key: string } {
    // 1. Dashboard session cookie
    const sessionCookie = req.cookies.get('limperial_legacy_session')?.value;
    if (sessionCookie) return { ok: true, key: sessionCookie };

    // 2. Miniapp Telegram initData header
    const initData = req.headers.get('x-miniapp-init-data');
    if (initData && BOT_TOKEN) {
        const valid = verifyTelegramInitData(initData);
        if (valid) {
            // Use a hash of the initData as the rate-limit key
            const key = createHmac('sha256', 'ratelimit').update(initData.slice(0, 64)).digest('hex');
            return { ok: true, key };
        }
    }

    return { ok: false, key: '' };
}

// ── Simple in-memory rate limiter ─────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT  = 30;
const RATE_WINDOW = 60_000;

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW });
        return true;
    }
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
    return true;
}

export async function POST(req: NextRequest) {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const auth = isAuthorized(req);
    if (!auth.ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Rate limit ────────────────────────────────────────────────────────────
    if (!checkRateLimit(auth.key)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let opts: PdfTemplateOptions;
    try {
        opts = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!opts.type || !opts.headerData || !opts.items || !opts.totals || !opts.currency) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── HTML preview shortcut (no Browserless) ────────────────────────────────
    if (opts.previewMode) {
        try {
            const html = buildHtml(opts);
            return new NextResponse(html, {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
            });
        } catch (err: any) {
            return NextResponse.json({ error: err?.message || 'Template error' }, { status: 500 });
        }
    }

    const token = process.env.BROWSERLESS_TOKEN;
    if (!token) {
        console.error('[PDF API] Missing BROWSERLESS_TOKEN environment variable.');
        return NextResponse.json(
            { error: 'PDF service not configured. Set BROWSERLESS_TOKEN in environment variables.' },
            { status: 503 }
        );
    }

    try {
        const html = buildHtml(opts);

        const browserlessRes = await fetch(
            `${BROWSERLESS_ENDPOINT}/pdf?token=${token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html,
                    options: {
                        format:          'A4',
                        printBackground: true,
                        margin: { top: '10mm', right: '11mm', bottom: '14mm', left: '11mm' },
                    },
                    gotoOptions: {
                        waitUntil: 'networkidle0',
                        timeout:   30000,
                    },
                }),
            }
        );

        if (!browserlessRes.ok) {
            const errText = await browserlessRes.text().catch(() => browserlessRes.statusText);
            console.error('[PDF API] Browserless error:', browserlessRes.status, errText);
            return NextResponse.json(
                { error: `Browserless ${browserlessRes.status}: ${errText.slice(0, 300)}` },
                { status: 502 }
            );
        }

        const pdfBuffer = Buffer.from(await browserlessRes.arrayBuffer());

        return new NextResponse(pdfBuffer as unknown as BodyInit, {
            status: 200,
            headers: {
                'Content-Type':        'application/pdf',
                'Content-Disposition': `attachment; filename="${sanitizeFilename(opts)}"`,
                'Cache-Control':       'no-store',
            },
        });

    } catch (err: any) {
        console.error('[PDF API] Error:', err?.message || err);
        return NextResponse.json(
            { error: 'PDF generation failed', message: err?.message || String(err) },
            { status: 500 }
        );
    }
}

function sanitizeFilename(opts: PdfTemplateOptions): string {
    const id = opts.headerData['Quotation ID']
        || opts.headerData['Sale Order ID']
        || opts.headerData['Invoice No']
        || opts.headerData['RV No']
        || opts.headerData['Receipt No']
        || opts.headerData['PO Number']
        || opts.type;
    return `${String(id).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
}
