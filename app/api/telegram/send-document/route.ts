/**
 * POST /api/telegram/send-document
 * ─────────────────────────────────────────────────────────────
 * Relays a generated PDF to a Telegram chat via the system bot.
 * Used by the dashboard's "Send to my Telegram" actions — the
 * client generates the PDF via /api/pdf/generate, base64-encodes
 * it, and posts it here with the target chat id.
 *
 * Auth: dashboard session cookie (same check as /api/pdf/generate).
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN — from @BotFather
 *
 * Body (application/json):
 *   chat_id     — Telegram chat/user ID to deliver to
 *   filename    — e.g. "ServiceInvoice_SI2026-00001.pdf"
 *   caption     — optional HTML caption shown above the document
 *   pdf_base64  — the PDF bytes, base64-encoded
 * ─────────────────────────────────────────────────────────────
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Simple in-memory rate limiter (mirrors /api/pdf/generate) ────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
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
    const sessionCookie = req.cookies.get('limperial_legacy_session')?.value;
    if (!sessionCookie) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!checkRateLimit(sessionCookie)) {
        return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 503 });
    }

    let body: { chat_id?: string; filename?: string; caption?: string; pdf_base64?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { chat_id, filename, caption, pdf_base64 } = body;
    if (!chat_id || !filename || !pdf_base64) {
        return NextResponse.json({ ok: false, error: 'chat_id, filename and pdf_base64 are required' }, { status: 400 });
    }
    // ~30 MB base64 ceiling — well above any invoice PDF, below Telegram's 50 MB bot limit.
    if (pdf_base64.length > 40_000_000) {
        return NextResponse.json({ ok: false, error: 'Document too large' }, { status: 413 });
    }

    try {
        const pdfBuffer = Buffer.from(pdf_base64, 'base64');

        const form = new FormData();
        form.append('chat_id', String(chat_id));
        if (caption) {
            form.append('caption', caption.slice(0, 1024));
            form.append('parse_mode', 'HTML');
        }
        form.append('document', new Blob([pdfBuffer as unknown as BlobPart], { type: 'application/pdf' }), filename);

        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
            method: 'POST',
            body: form,
        });
        const tgData = await tgRes.json();

        if (!tgRes.ok || !tgData.ok) {
            return NextResponse.json(
                { ok: false, error: tgData.description || 'Telegram API error' },
                { status: 502 }
            );
        }

        return NextResponse.json({ ok: true, message_id: tgData.result?.message_id });
    } catch (err: any) {
        console.error('[send-document]', err?.message || err);
        return NextResponse.json({ ok: false, error: err?.message || 'Send failed' }, { status: 500 });
    }
}
