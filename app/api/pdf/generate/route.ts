/**
 * /api/pdf/generate — POST
 * Body: PdfTemplateOptions (JSON)
 * Returns: application/pdf bytes
 *
 * Uses Browserless.io (cloud Chrome) to render the HTML template and
 * return a PDF. No local Chromium needed — works on Vercel Hobby.
 *
 * Setup:
 *  1. Sign up free at https://www.browserless.io/
 *  2. Copy your API token from the dashboard.
 *  3. Add to .env.local:   BROWSERLESS_TOKEN=your_token_here
 *  4. Add to Vercel env:   BROWSERLESS_TOKEN=your_token_here
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildHtml, PdfTemplateOptions } from '@/lib/pdfTemplate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Browserless.io config ─────────────────────────────────────────────────────
// Default endpoint is Browserless v2 SFO region. Override via env if needed.
const BROWSERLESS_ENDPOINT =
    process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io';

export async function POST(req: NextRequest) {
    let opts: PdfTemplateOptions;
    try {
        opts = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!opts.type || !opts.headerData || !opts.items || !opts.totals || !opts.currency) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
        // Build the full HTML string using the existing template
        const html = buildHtml(opts);

        // POST to Browserless /pdf endpoint
        // Docs: https://docs.browserless.io/HTTP-APIs/pdf
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
                        margin: { top: '10mm', right: '11mm', bottom: '10mm', left: '11mm' },
                    },
                    // Wait for fonts and the logo image to load before printing
                    gotoOptions: {
                        waitUntil: 'networkidle0',
                        timeout: 30000,
                    },
                }),
            }
        );

        if (!browserlessRes.ok) {
            const errText = await browserlessRes.text().catch(() => browserlessRes.statusText);
            console.error('[PDF API] Browserless error:', browserlessRes.status, errText);
            return NextResponse.json(
                { error: 'PDF generation failed', detail: errText },
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
        console.error('[PDF API] Stack:', err?.stack);
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
        || opts.headerData['PO Number']
        || opts.type;
    return `${String(id).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
}
