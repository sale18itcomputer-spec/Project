// utils/telegram.ts
// Sends quotation data to our own Next.js API route, which forwards it
// to Telegram using the bot token stored in server-side env vars.

import { User } from '../types';

/**
 * Resolve the Telegram chat the system bot can message for a user.
 * Prefers the explicit "Telegram Chat ID" profile field; falls back to the
 * legacy `telegram_id` column populated when the user linked the miniapp.
 */
export const getUserTelegramChatId = (user: User | null | undefined): string | null => {
    const explicit = user?.['Telegram Chat ID']?.trim();
    if (explicit) return explicit;
    const legacy = (user as any)?.telegram_id;
    return legacy != null && String(legacy).trim() !== '' ? String(legacy) : null;
};

export interface QuotationTelegramPayload {
    quoteNo: string;
    customerName: string;
    customerContact?: string;
    currency: 'USD' | 'KHR';
    taxType: 'VAT' | 'NON-VAT';
    items: {
        itemCode?: string;
        modelName?: string;
        description?: string;
        qty: number | string;
        unitPrice: number | string;
    }[];
    note?: string;
    chatId?: string; // optional override; defaults to TELEGRAM_ADMIN_CHAT_ID on server
}

export async function sendQuotationToTelegram(
    payload: QuotationTelegramPayload
): Promise<{ messageId: number; grandTotal: number }> {
    const body = new URLSearchParams({
        quoteNo:         payload.quoteNo,
        customerName:    payload.customerName    || '',
        customerContact: payload.customerContact || '',
        currency:        payload.currency        || 'USD',
        taxType:         payload.taxType         || 'VAT',
        note:            payload.note            || '',
        items:           JSON.stringify(
            payload.items.map(it => ({
                itemCode:    (it.itemCode    || '').trim(),
                modelName:   (it.modelName   || '').trim(),
                description: (it.description || '').trim(),
                qty:         Number(it.qty       || 1),
                unitPrice:   Number(it.unitPrice || 0),
            }))
        ),
        ...(payload.chatId ? { chat_id: payload.chatId } : {}),
    });

    const resp = await fetch('/api/telegram/send-quotation', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
    });

    if (!resp.ok) {
        const text = await resp.text().catch(() => 'Unknown error');
        throw new Error(`Send failed (${resp.status}): ${text}`);
    }

    const data = await resp.json();
    if (!data.success) throw new Error(data.error || 'Unknown error');
    return { messageId: data.message_id, grandTotal: data.grandTotal };
}
