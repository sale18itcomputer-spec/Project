/**
 * pdfClient.ts
 * Sends document data to /api/pdf/generate (server-side Puppeteer)
 * and either downloads the result, returns a blob URL for preview,
 * or sends it directly to Telegram via the bot.
 *
 * Auth:
 *  - Dashboard: relies on the session cookie (sent automatically).
 *  - Miniapp:   attaches `x-miniapp-init-data` header with Telegram initData.
 */

import { sharePdfViaBot } from './miniapp/telegramShare';

export interface PdfClientOptions {
    type: 'Quotation' | 'Sale Order' | 'Invoice' | 'Tax Invoice' | 'Commercial Invoice' | 'Delivery Order' | 'Purchase Order' | 'Receipt';
    headerData: Record<string, any>;
    items: Array<{
        no: number | string;
        itemCode: string;
        modelName?: string;
        description?: string;
        qty: number | string;
        unitPrice?: number | string;
        commission?: number | string;
        amount?: number | string;
    }>;
    totals: { subTotal: number; tax?: number; vat?: number; grandTotal: number };
    currency: 'USD' | 'KHR';
    signaturePadding?: number;
    labelPadding?: number;
    filename?: string;
    /** If true, returns a blob URL instead of auto-downloading */
    previewMode?: boolean;
}

/** Read Telegram initData if we're running inside a Telegram WebApp. */
function getTelegramInitData(): string | null {
    try {
        const initData = (window as any)?.Telegram?.WebApp?.initData;
        return initData || null;
    } catch {
        return null;
    }
}

/** Build request headers, attaching Telegram initData when available. */
function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const initData = getTelegramInitData();
    if (initData) headers['x-miniapp-init-data'] = initData;
    return headers;
}

/** Build the POST body for /api/pdf/generate. */
function buildBody(opts: PdfClientOptions): string {
    return JSON.stringify({
        type:             opts.type,
        headerData:       opts.headerData,
        items:            opts.items,
        totals:           opts.totals,
        currency:         opts.currency,
        signaturePadding: opts.signaturePadding,
        labelPadding:     opts.labelPadding,
    });
}

/**
 * Generates a PDF via the server-side API route.
 * - previewMode=false (default): triggers a file download, returns void
 * - previewMode=true: returns a blob URL for embedding in an <iframe>
 */
export async function generatePDF(opts: PdfClientOptions): Promise<string | void> {
    const res = await fetch('/api/pdf/generate', {
        method:  'POST',
        headers: buildHeaders(),
        body:    buildBody(opts),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(`PDF generation failed: ${err.error || res.statusText}`);
    }

    const blob = await res.blob();

    if (opts.previewMode) {
        return URL.createObjectURL(blob);
    }

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = opts.filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Generates the PDF and sends it directly to one or more Telegram chat_ids
 * via the bot. Only works inside a Telegram WebApp — returns false otherwise.
 *
 * Usage:
 *   const ok = await sharePdfToTelegram({
 *     ...pdfOpts,
 *     chat_ids: [user.telegram_id],
 *     caption:  `<b>${quoteNo}</b>\n${companyName}`,
 *   });
 */
export async function sharePdfToTelegram(
    opts: PdfClientOptions & { chat_ids?: number[]; caption?: string }
): Promise<boolean> {
    const initData = getTelegramInitData();
    if (!initData) return false;

    let targetChatIds = opts.chat_ids;
    if (!targetChatIds || targetChatIds.length === 0) {
        try {
            const params = new URLSearchParams(initData);
            const userStr = params.get('user');
            if (userStr) {
                const user = JSON.parse(decodeURIComponent(userStr));
                if (user.id) targetChatIds = [user.id];
            }
        } catch (e) {
            console.error('Failed to parse initData user', e);
        }
    }

    if (!targetChatIds || targetChatIds.length === 0) return false;

    const res = await fetch('/api/pdf/generate', {
        method:  'POST',
        headers: buildHeaders(),
        body:    buildBody(opts),
    });

    if (!res.ok) return false;

    const blob     = await res.blob();
    const filename = opts.filename || 'document.pdf';
    const caption  = opts.caption ?? `<b>${filename.replace('.pdf', '')}</b>`;

    return sharePdfViaBot({
        pdfBlob:  blob,
        filename,
        caption,
        chat_ids: targetChatIds,
    });
}
