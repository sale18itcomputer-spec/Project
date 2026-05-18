/**
 * POST /api/miniapp/notify
 *
 * Sends a Telegram bot message or document to one or more chat_ids.
 *
 * Body:
 *   initData    — Telegram WebApp initData (for caller auth)
 *   type        — 'message' | 'document'
 *   chat_ids    — number[]  (max 20)
 *   text        — string    (type=message, HTML parse_mode)
 *   caption     — string    (type=document)
 *   filename    — string    (type=document)
 *   pdf_base64  — string    (type=document, base64 PDF bytes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TG_API           = `https://api.telegram.org/bot${BOT_TOKEN}`;

function verifyInitData(initData: string): number | null {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash) return null;
        params.delete('hash');
        const check = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`).join('\n');
        const secret   = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const expected = createHmac('sha256', secret).update(check).digest('hex');
        if (expected !== hash) return null;
        const authDate = parseInt(params.get('auth_date') || '0', 10);
        if (Date.now() / 1000 - authDate > 86400) return null;
        return JSON.parse(params.get('user') || '{}').id ?? null;
    } catch { return null; }
}

async function tgMessage(chat_id: number, text: string): Promise<boolean> {
    const r = await fetch(`${TG_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
    });
    if (!r.ok) console.error('[notify] sendMessage failed', chat_id, await r.text().catch(() => ''));
    return r.ok;
}

async function tgDocument(chat_id: number, filename: string, pdfBytes: Buffer, caption: string): Promise<boolean> {
    const form = new FormData();
    form.append('chat_id',    String(chat_id));
    form.append('caption',    caption);
    form.append('parse_mode', 'HTML');
    form.append('document',   new Blob([pdfBytes], { type: 'application/pdf' }), filename);
    const r = await fetch(`${TG_API}/sendDocument`, { method: 'POST', body: form });
    if (!r.ok) console.error('[notify] sendDocument failed', chat_id, await r.text().catch(() => ''));
    return r.ok;
}

export async function POST(req: NextRequest) {
    try {
        const { initData, type, chat_ids, text, caption, filename, pdf_base64 } = await req.json();

        // Auth: verify caller is a valid active Limperial user
        const callerId = verifyInitData(initData ?? '');
        if (!callerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);
        const { data: caller } = await sb.from('users').select('UserID')
            .eq('telegram_id', callerId).eq('Status', 'Active').single();
        if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        if (!Array.isArray(chat_ids) || chat_ids.length === 0)
            return NextResponse.json({ error: 'chat_ids required' }, { status: 400 });

        const targets: number[] = (chat_ids as number[]).slice(0, 20);
        const results: { chat_id: number; ok: boolean }[] = [];

        if (type === 'document') {
            if (!pdf_base64 || !filename)
                return NextResponse.json({ error: 'pdf_base64 and filename required' }, { status: 400 });
            const buf = Buffer.from(pdf_base64, 'base64');
            await Promise.all(targets.map(async id => {
                results.push({ chat_id: id, ok: await tgDocument(id, filename, buf, caption ?? '') });
            }));
        } else {
            if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
            await Promise.all(targets.map(async id => {
                results.push({ chat_id: id, ok: await tgMessage(id, text) });
            }));
        }

        return NextResponse.json({ ok: results.every(r => r.ok), results });
    } catch (err: any) {
        console.error('[miniapp/notify]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
