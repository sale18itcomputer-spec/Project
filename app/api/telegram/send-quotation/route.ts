/**
 * POST /api/telegram/send-quotation
 * ─────────────────────────────────────────────────────────────
 * Receives a quotation payload from the web app and sends a
 * formatted summary message to the Telegram admin chat.
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN       — from @BotFather
 *   TELEGRAM_ADMIN_CHAT_ID   — the chat/user ID to deliver to
 *
 * Body (application/x-www-form-urlencoded or JSON):
 *   quoteNo, customerName, customerContact, currency, taxType,
 *   note, items (JSON string), chat_id (optional override)
 * ─────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';

interface LineItem {
    itemCode:    string;
    modelName:   string;
    description: string;
    qty:         number;
    unitPrice:   number;
}

function buildMessage(params: {
    quoteNo:         string;
    customerName:    string;
    customerContact: string;
    currency:        string;
    taxType:         string;
    items:           LineItem[];
    note:            string;
}): string {
    const { quoteNo, customerName, customerContact, currency, taxType, items, note } = params;
    const symbol = currency === 'KHR' ? '៛' : '$';

    const subTotal = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
    const vat      = taxType === 'NON-VAT' ? 0 : subTotal * 0.1;
    const grand    = subTotal + vat;

    const fmt = (n: number) =>
        currency === 'KHR'
            ? `${symbol}${Math.round(n).toLocaleString('en-US')}`
            : `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const lines = items
        .filter(it => it.modelName || it.itemCode)
        .map((it, i) => {
            const amt  = it.qty * it.unitPrice;
            const desc = it.description
                ? `\n    _${it.description.slice(0, 80).replace(/\n/g, ' ')}_`
                : '';
            return `${i + 1}\\. *${(it.modelName || it.itemCode).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')}*${desc}\n    Qty: ${it.qty}  ×  ${fmt(it.unitPrice)}  =  *${fmt(amt)}*`;
        })
        .join('\n\n');

    const taxLine = taxType === 'NON-VAT'
        ? `Tax: NON\\-VAT`
        : `VAT \\(10%\\): ${fmt(vat)}`;

    const noteLine = note ? `\n📝 *Note:* ${note}` : '';

    return [
        `📋 *Quotation: ${quoteNo}*`,
        `🏢 Customer: ${customerName}`,
        customerContact ? `📞 Contact: ${customerContact}` : '',
        `💱 Currency: ${currency}  |  ${taxType}`,
        ``,
        `*── Items ──*`,
        lines || '_No items_',
        ``,
        `*── Totals ──*`,
        `Subtotal: ${fmt(subTotal)}`,
        taxLine,
        `*Grand Total: ${fmt(grand)}*`,
        noteLine,
    ].filter(l => l !== '').join('\n');
}

export async function POST(request: NextRequest) {
    try {
        const token   = process.env.TELEGRAM_BOT_TOKEN;
        const adminId = process.env.TELEGRAM_ADMIN_CHAT_ID;

        if (!token) return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });

        // Support both JSON and form-encoded bodies
        let fields: Record<string, string> = {};
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            fields = await request.json();
        } else {
            const text = await request.text();
            for (const pair of text.split('&')) {
                const eqIdx = pair.indexOf('=');
                if (eqIdx === -1) continue;
                const k = decodeURIComponent(pair.slice(0, eqIdx));
                const v = decodeURIComponent(pair.slice(eqIdx + 1).replace(/\+/g, ' '));
                fields[k] = v;
            }
        }

        const quoteNo         = fields.quoteNo         || '';
        const customerName    = fields.customerName     || '';
        const customerContact = fields.customerContact  || '';
        const currency        = fields.currency         || 'USD';
        const taxType         = fields.taxType          || 'VAT';
        const note            = fields.note             || '';
        const chatId          = fields.chat_id          || adminId;
        if (!chatId) {
            return NextResponse.json(
                { success: false, error: 'No destination chat — set your Telegram Chat ID on your user profile, or configure TELEGRAM_ADMIN_CHAT_ID' },
                { status: 400 }
            );
        }

        let items: LineItem[] = [];
        try {
            items = JSON.parse(fields.items || '[]');
        } catch {
            return NextResponse.json({ success: false, error: 'Invalid items JSON' }, { status: 400 });
        }

        const text = buildMessage({ quoteNo, customerName, customerContact, currency, taxType, items, note });

        const subTotal   = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
        const vat        = taxType === 'NON-VAT' ? 0 : subTotal * 0.1;
        const grandTotal = subTotal + vat;

        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id:    chatId,
                text,
                parse_mode: 'Markdown',
            }),
        });

        const tgData = await tgRes.json();

        if (!tgRes.ok || !tgData.ok) {
            return NextResponse.json(
                { success: false, error: tgData.description || 'Telegram API error' },
                { status: 502 }
            );
        }

        return NextResponse.json({
            success:    true,
            message_id: tgData.result?.message_id,
            grandTotal,
        });

    } catch (err: any) {
        console.error('[send-quotation]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
