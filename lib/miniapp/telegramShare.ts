/**
 * lib/miniapp/telegramShare.ts
 *
 * Utilities for sharing PDFs and sending notifications via the Telegram bot
 * from within the Telegram WebApp.
 *
 * Usage:
 *   import { sharePdfViaBot, notifyUsers } from '@/lib/miniapp/telegramShare';
 *
 *   // Share a generated PDF blob to a list of Telegram user IDs
 *   await sharePdfViaBot({
 *     pdfBlob: blob,
 *     filename: 'Q-0000067.pdf',
 *     caption: '<b>Quotation Q-0000067</b>\nFamily Health International\n$1,200',
 *     chat_ids: [123456789],
 *   });
 *
 *   // Send a plain text notification
 *   await notifyUsers({
 *     text: '📋 New quotation <b>Q-0000068</b> created by John.',
 *     chat_ids: [123456789, 987654321],
 *   });
 */

function getInitData(): string {
    try {
        return (window as any)?.Telegram?.WebApp?.initData ?? '';
    } catch {
        return '';
    }
}

// ── Haptic helper (fire-and-forget, never throws) ─────────────────────────────
export function haptic(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') {
    try {
        (window as any)?.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
    } catch { /* not in Telegram — silently skip */ }
}

// ── Share a PDF blob via the bot ──────────────────────────────────────────────
export interface SharePdfOptions {
    pdfBlob: Blob;
    filename: string;
    /** HTML-formatted caption shown above the document in Telegram */
    caption: string;
    /** List of Telegram user IDs to send the document to */
    chat_ids: number[];
    onProgress?: (status: 'uploading' | 'done' | 'error', message?: string) => void;
}

export async function sharePdfViaBot(opts: SharePdfOptions): Promise<boolean> {
    const { pdfBlob, filename, caption, chat_ids, onProgress } = opts;
    const initData = getInitData();
    if (!initData) {
        onProgress?.('error', 'Not running inside Telegram');
        return false;
    }

    try {
        onProgress?.('uploading');
        haptic('light');

        // Convert blob to base64
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        const pdf_base64 = btoa(binary);

        const res = await fetch('/api/miniapp/notify', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                initData,
                type: 'document',
                chat_ids,
                filename,
                caption,
                pdf_base64,
            }),
        });

        const data = await res.json();
        if (res.ok && data.ok) {
            onProgress?.('done');
            haptic('medium');
            return true;
        } else {
            onProgress?.('error', data.error ?? 'Send failed');
            return false;
        }
    } catch (err: any) {
        onProgress?.('error', err.message ?? 'Network error');
        return false;
    }
}

// ── Send a plain-text notification via the bot ────────────────────────────────
export interface NotifyOptions {
    /** HTML-formatted message text */
    text: string;
    chat_ids: number[];
}

export async function notifyUsers(opts: NotifyOptions): Promise<boolean> {
    const initData = getInitData();
    if (!initData) return false;

    try {
        const res = await fetch('/api/miniapp/notify', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData, type: 'message', ...opts }),
        });
        const data = await res.json();
        return res.ok && data.ok;
    } catch {
        return false;
    }
}

// ── Cross-module search ───────────────────────────────────────────────────────
export interface SearchResult {
    module: string;
    label: string;
    sublabel: string;
    meta?: string;
    href: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
    const initData = getInitData();
    if (!initData || query.trim().length < 2) return [];

    try {
        const res = await fetch('/api/miniapp/search', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData, query }),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.results ?? [];
    } catch {
        return [];
    }
}
