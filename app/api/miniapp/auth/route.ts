/**
 * POST /api/miniapp/auth
 * Verifies Telegram WebApp initData using HMAC-SHA256,
 * looks up the user by telegram_id, returns user info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function verifyTelegramInitData(initData: string): Record<string, string> | null {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash) return null;

        params.delete('hash');
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

        const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        if (expectedHash !== hash) return null;

        // Check auth_date is not too old (1 hour)
        const authDate = parseInt(params.get('auth_date') || '0', 10);
        if (Date.now() / 1000 - authDate > 3600) return null;

        return Object.fromEntries(params.entries());
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { initData } = await req.json();
        if (!initData) {
            return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
        }

        const verified = verifyTelegramInitData(initData);
        if (!verified) {
            return NextResponse.json({ error: 'Invalid Telegram initData' }, { status: 401 });
        }

        const tgUser = JSON.parse(verified.user || '{}');
        const telegramId = tgUser.id as number;
        if (!telegramId) {
            return NextResponse.json({ error: 'No user in initData' }, { status: 400 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Look up user by telegram_id
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', telegramId)
            .eq('Status', 'Active')
            .single();

        if (error || !user) {
            return NextResponse.json({
                error: 'not_linked',
                telegramId,
                firstName: tgUser.first_name,
                username: tgUser.username,
            }, { status: 403 });
        }

        return NextResponse.json({
            ok: true,
            user: {
                UserID: user.UserID,
                Name: user.Name,
                Role: user.Role,
                Email: user.Email,
                Picture: user.Picture,
                Status: user.Status,
                telegram_id: user.telegram_id,
            },
            telegramUser: {
                id: tgUser.id,
                first_name: tgUser.first_name,
                username: tgUser.username,
                photo_url: tgUser.photo_url,
            },
        });
    } catch (err: any) {
        console.error('[miniapp/auth]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
