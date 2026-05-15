/**
 * telegramQuote.ts
 * ─────────────────────────────────────────────────────────────
 * Bridge between the Telegram bot session and your existing
 * Supabase quotation system.
 *
 * - Generates the next Quote No. (same Q-XXXXXXX sequence)
 * - Looks up pricelist items by item code
 * - Looks up company details (address, payment term)
 * - Calls createQuotationSheet() from services/b2bDb.ts
 *
 * Server-side only — uses service-role key, never import on client.
 * ─────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { createQuotationSheet } from '../services/b2bDb';
import { TgSessionData, TgLineItem } from './telegramSession';
import { Quotation, PricelistItem, Company, Contact } from '../types';
import { buildHtml, PdfTemplateOptions } from './pdfTemplate';

// ── Service-role client (bypasses RLS) ───────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('[telegramQuote] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ── Quote number generation ───────────────────────────────────

/**
 * Returns the next available Q-XXXXXXX number by scanning
 * the quotations table — mirrors the logic in QuotationCreator.tsx.
 */
export async function getNextQuoteNo(): Promise<string> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('quotations')
    .select('"Quote No"');

  if (error) throw new Error(`[getNextQuoteNo] ${error.message}`);

  const regex = /Q-(\d+)/;
  const maxNum = (data ?? []).reduce((max: number, row: any) => {
    const match = (row['Quote No'] ?? '').match(regex);
    if (!match) return max;
    const n = parseInt(match[1], 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);

  return `Q-${String(maxNum + 1).padStart(7, '0')}`;
}

// ── Pricelist lookup ──────────────────────────────────────────

/**
 * Look up a pricelist item by its Code (case-insensitive).
 * Returns null if not found.
 */
export async function lookupPricelistItem(code: string): Promise<PricelistItem | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('pricelist')
    .select('*')
    .ilike('Code', code.trim())
    .maybeSingle();

  if (error) throw new Error(`[lookupPricelistItem] ${error.message}`);
  return data as PricelistItem | null;
}

/**
 * Search pricelist by partial code or model name — used when
 * the user types something ambiguous (e.g. "HP" or "Cisco").
 * Returns up to 8 results.
 */
export async function searchPricelist(query: string): Promise<PricelistItem[]> {
  const supabase = getServiceClient();
  const q = query.trim();

  const { data, error } = await supabase
    .from('pricelist')
    .select('Code, "Model", "Brand", "Description", "End User Price", "Status"')
    .or(`Code.ilike.%${q}%,Model.ilike.%${q}%,Brand.ilike.%${q}%,Description.ilike.%${q}%`)
    .eq('Status', 'Available')
    .limit(10);

  if (error) throw new Error(`[searchPricelist] ${error.message}`);
  return (data ?? []) as PricelistItem[];
}

// ── Company lookup ────────────────────────────────────────────

/**
 * Fetch all company names for fuzzy matching.
 */
export async function getAllCompanyNames(): Promise<string[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('companies')
    .select('"Company Name"')
    .order('"Company Name"', { ascending: true });

  if (error) throw new Error(`[getAllCompanyNames] ${error.message}`);
  return (data ?? []).map((r: any) => r['Company Name']).filter(Boolean);
}

/**
 * Fetch full company record by exact name — to auto-fill address,
 * payment term, TIN, etc.
 */
export async function getCompanyByName(name: string): Promise<Company | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('Company Name', name)
    .maybeSingle();

  if (error) throw new Error(`[getCompanyByName] ${error.message}`);
  return data as Company | null;
}

/**
 * Fetch contacts for a given company name.
 */
export async function getContactsForCompany(companyName: string): Promise<Contact[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('Company Name', companyName);

  if (error) throw new Error(`[getContactsForCompany] ${error.message}`);
  return (data ?? []) as Contact[];
}

// ── Build and save quotation ──────────────────────────────────

/**
 * Convert a completed TgSessionData into a Quotation record
 * and save it via createQuotationSheet().
 *
 * Returns the saved Quote No.
 */
export async function saveQuotationFromSession(
  sessionData: TgSessionData
): Promise<string> {
  const quoteNo = await getNextQuoteNo();
  const today = sessionData.quoteDate || new Date().toISOString().split('T')[0];
  
  let validity = sessionData.validityDate;
  if (!validity) {
    const vDate = new Date();
    vDate.setDate(vDate.getDate() + 30);
    validity = vDate.toISOString().split('T')[0];
  }

  const items = sessionData.items ?? [];

  // Calculate totals — mirrors QuotationCreator.tsx logic
  const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const vat = sessionData.taxType === 'NON-VAT' ? 0 : subTotal * 0.1;
  const grandTotal = subTotal + vat;

  // Build line items in the exact shape ItemsJSON expects
  const itemsForJSON = items.map((item, idx) => ({
    id: `tg-item-${idx + 1}`,
    no: idx + 1,
    itemCode: item.itemCode,
    modelName: item.modelName,
    description: item.description,
    qty: item.qty,
    unitPrice: item.unitPrice,
    amount: item.amount,
    commission: 0,
  }));

  const quotationPayload: Quotation & { ItemsJSON: string; updated_at: string } = {
    'Quote No': quoteNo,
    'File': '',
    'Quote Date': today,
    'Validity Date': validity,
    'Company Name': sessionData.companyName ?? '',
    'Company Address': sessionData.companyAddress ?? '',
    'Contact Name': sessionData.contactName ?? '',
    'Contact Number': sessionData.contactNumber ?? '',
    'Contact Email': '',
    'Amount': String(grandTotal),
    'CM': '0',
    'Status': 'Open',
    'Reason': '',
    'Payment Term': sessionData.paymentTerm ?? '',
    'Stock Status': '',
    'Created By': sessionData.createdBy ?? 'Telegram Bot',
    'Currency': sessionData.currency ?? 'USD',
    'Prepared By': sessionData.createdBy ?? 'Telegram Bot',
    'Prepared By Position': '',
    'Approved By': '',
    'Approved By Position': '',
    'Remark': 'Created via Telegram Bot',
    'Terms and Conditions': '',
    'Tax Type': sessionData.taxType ?? 'VAT',
    'ItemsJSON': JSON.stringify(itemsForJSON),
    'updated_at': new Date().toISOString(),
  };

  // isB2B = false — Telegram bot creates standard (B2C) quotations
  await createQuotationSheet(quoteNo, quotationPayload, false);

  return quoteNo;
}

// ── Telegram API helper ───────────────────────────────────────

/**
 * Send a message to a Telegram chat.
 * parse_mode = Markdown so *bold* and `code` work in bot replies.
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  parseMode: 'Markdown' | 'HTML' | 'none' = 'Markdown',
  replyMarkup?: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('[sendTelegramMessage] Missing TELEGRAM_BOT_TOKEN');

  const body: Record<string, any> = { chat_id: chatId, text };
  if (parseMode !== 'none') body.parse_mode = parseMode;
  if (replyMarkup) body.reply_markup = JSON.parse(replyMarkup);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[sendTelegramMessage] Telegram API error: ${err}`);
  }
}

/**
 * Generate a PDF buffer for a quotation session.
 */
export async function generateQuotationPDF(
  sessionData: TgSessionData,
  quoteNo: string
): Promise<Buffer> {
  const items = sessionData.items ?? [];
  const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const vat = sessionData.taxType === 'NON-VAT' ? 0 : subTotal * 0.1;
  const grandTotal = subTotal + vat;

  const opts: PdfTemplateOptions = {
    type: 'Quotation',
    headerData: {
      'Quotation ID': quoteNo,
      'Quote Date': new Date().toISOString().split('T')[0],
      'Validity Date': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      'Company Name': sessionData.companyName ?? '',
      'Company Address': sessionData.companyAddress ?? '',
      'Contact Person': sessionData.contactName ?? '',
      'Contact Tel': sessionData.contactNumber ?? '',
      'Payment Term': sessionData.paymentTerm ?? '',
      'Prepared By': sessionData.createdBy ?? 'Telegram Bot',
      'Prepared By Position': '',
      'Currency': sessionData.currency ?? 'USD',
      'Stock Status': 'Available',
    },
    items: items.map((item, idx) => ({
      no: idx + 1,
      itemCode: item.itemCode,
      modelName: item.modelName,
      description: item.description,
      qty: item.qty,
      unitPrice: item.unitPrice,
      amount: item.amount,
    })),
    totals: {
      subTotal,
      vat,
      grandTotal,
    },
    currency: sessionData.currency ?? 'USD',
  };

  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) throw new Error('[generateQuotationPDF] Missing BROWSERLESS_TOKEN');

  const html = buildHtml(opts);
  const BROWSERLESS_ENDPOINT = process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io';

  const res = await fetch(`${BROWSERLESS_ENDPOINT}/pdf?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html,
      options: {
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '11mm', bottom: '14mm', left: '11mm' },
      },
      gotoOptions: { waitUntil: 'load', timeout: 15000 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[generateQuotationPDF] Browserless error: ${err}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Send a PDF document to a Telegram chat.
 */
export async function sendTelegramDocument(
  chatId: number,
  pdfBuffer: Buffer,
  filename: string,
  caption?: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('[sendTelegramDocument] Missing TELEGRAM_BOT_TOKEN');

  const formData = new FormData();
  formData.append('chat_id', String(chatId));
  
  // Create a Blob from the buffer for the FormData. 
  // We use Uint8Array to ensure compatibility with Blob.
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
  formData.append('document', blob, filename);
  
  if (caption) {
    formData.append('caption', caption);
    formData.append('parse_mode', 'Markdown');
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[sendTelegramDocument] Telegram API error: ${err}`);
  }
}

/**
 * Format a pricelist search result into a compact Telegram reply.
 * e.g. "HP-X360  |  HP EliteBook x360  |  $1,200"
 */
export function formatPricelistResults(items: PricelistItem[]) {
  if (items.length === 0) return { text: '❌ No items found.', keyboard: null };

  let text = `🔍 *Search Results (${items.length}):*\n\n`;
  const keyboard = {
    inline_keyboard: items.map(item => {
      const desc = item.Description ? `\n_${item.Description.slice(0, 60)}..._` : '';
      text += `📦 *${item.Code}*\n${item.Model}${desc}\n💰 Price: $${item['End User Price']}\n\n`;
      
      return [{
        text: `➕ Add ${item.Code} ($${item['End User Price']})`,
        callback_data: `ADD:${item.Code}`
      }];
    })
  };

  text += `_Click a button to add with Qty 1, or type \`CODE qty\`_`;
  return { text, keyboard };
}
