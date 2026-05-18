/**
 * telegramSession.ts
 * ─────────────────────────────────────────────────────────────
 * State machine for the Telegram quotation bot.
 * Handles reading, updating, and clearing sessions from
 * the `tg_sessions` Supabase table using the service-role key
 * (so it bypasses RLS — server-side only, never import on client).
 * ─────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────

export type TgState =
  | 'IDLE'
  | 'AWAITING_TAX_TYPE'
  | 'AWAITING_COMPANY'
  | 'AWAITING_CONTACT'
  | 'REVIEWING_CUSTOMER'
  | 'EDITING_FIELD'
  | 'EDITING_ITEM_VALUE'
  | 'COLLECTING_ITEMS'
  | 'AWAITING_CONFIRM';

export interface TgLineItem {
  itemCode: string;
  modelName: string;
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface TgSessionData {
  companyName?: string;
  contactName?: string;
  contactNumber?: string;
  companyAddress?: string;
  paymentTerm?: string;
  currency?: 'USD' | 'KHR';
  taxType?: 'VAT' | 'NON-VAT';
  createdBy?: string;       // e.g. "telegram:123456789"
  items?: TgLineItem[];
  quoteDate?: string;       // YYYY-MM-DD
  validityDate?: string;    // YYYY-MM-DD
  editingField?: 'companyAddress' | 'paymentTerm' | 'contactName' | 'contactNumber' | 'quoteDate' | 'validityDate';
  editingItemIdx?: number;
  editingItemValueType?: 'qty' | 'price';
  // Candidate lists stored in session so callback_data can use short numeric indices
  companyCandidates?: string[];
  contactCandidates?: { name: string; position?: string; phone?: string }[];
}

export interface TgSession {
  chat_id: number;
  state: TgState;
  data: TgSessionData;
  updated_at: string;
}

// ── Supabase service-role client (server-side only) ──────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('[telegramSession] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ── Session CRUD ─────────────────────────────────────────────

/**
 * Fetch the current session for a chat_id.
 * Returns null if no session exists (= IDLE).
 */
export async function getSession(chatId: number): Promise<TgSession | null> {
  const supabase = getServiceClient();
  let data = null;
  let error = null;

  // Retry up to 3 times with a small delay
  for (let i = 0; i < 3; i++) {
    const result = await supabase
      .from('tg_sessions')
      .select('*')
      .eq('chat_id', chatId)
      .maybeSingle();
    
    data = result.data;
    error = result.error;

    if (data || error) break;
    await new Promise(r => setTimeout(r, 200)); // wait 200ms
  }

  if (error) {
    console.error(`[getSession] Supabase error for ${chatId}:`, error);
    throw new Error(`[getSession] ${error.message}`);
  }
  
  if (!data) {
    // No session is normal for new users — debug level only
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[getSession] No session for chatId: ${chatId} (IDLE state)`);
    }
  }
  
  return data as TgSession | null;
}

/**
 * Create or fully replace a session.
 */
export async function setSession(
  chatId: number,
  state: TgState,
  data: TgSessionData
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('tg_sessions')
    .upsert({ chat_id: chatId, state, data }, { onConflict: 'chat_id' });

  if (error) throw new Error(`[setSession] ${error.message}`);
}

/**
 * Advance state and merge new data into the existing session.
 * If no session exists yet, creates one.
 */
export async function advanceSession(
  chatId: number,
  newState: TgState,
  patch: Partial<TgSessionData> = {}
): Promise<void> {
  const existing = await getSession(chatId);
  const merged: TgSessionData = { ...(existing?.data ?? {}), ...patch };
  await setSession(chatId, newState, merged);
}

/**
 * Convenience to create a new session.
 */
export async function createSession(chatId: number, session: { state: TgState, data: TgSessionData }): Promise<void> {
  await setSession(chatId, session.state, session.data);
}

/**
 * Convenience to update ONLY data without changing state.
 */
export async function updateSessionData(chatId: number, patch: Partial<TgSessionData>): Promise<void> {
  const existing = await getSession(chatId);
  if (!existing) return;
  await setSession(chatId, existing.state, { ...existing.data, ...patch });
}

/**
 * Append a line item to the current session's items array.
 */
export async function addItemToSession(
  chatId: number,
  item: TgLineItem
): Promise<void> {
  const existing = await getSession(chatId);
  if (!existing) throw new Error('[addItemToSession] No active session');

  const items = [...(existing.data.items ?? []), item];
  await setSession(chatId, existing.state, { ...existing.data, items });
}

/**
 * Delete the session row — called after /confirm or /cancel.
 */
export async function clearSession(chatId: number): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('tg_sessions')
    .delete()
    .eq('chat_id', chatId);

  if (error) throw new Error(`[clearSession] ${error.message}`);
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Format a session's items into a readable Telegram summary.
 * Uses monospace-friendly formatting (no markdown tables).
 */
export function formatSessionSummary(session: TgSession): string {
  const { data } = session;
  const items = data.items ?? [];
  const symbol = data.currency === 'KHR' ? '៛' : '$';

  const subTotal = items.reduce((s, i) => s + i.amount, 0);
  const vat = data.taxType === 'NON-VAT' ? 0 : subTotal * 0.1;
  const grandTotal = subTotal + vat;

  const itemLines = items.map((item, idx) =>
    `  ${idx + 1}. ${item.modelName || item.itemCode}\n` +
    `     ${item.qty} × ${symbol}${item.unitPrice.toLocaleString()} = ${symbol}${item.amount.toLocaleString()}`
  ).join('\n');

  return [
    `📋 *Quotation Summary*`,
    ``,
    `🏢 ${data.companyName ?? '—'}`,
    `👤 ${data.contactName ?? '—'}  ${data.contactNumber ?? ''}`,
    ``,
    `*Items:*`,
    itemLines || '  (none)',
    ``,
    `Sub-total:  ${symbol}${subTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    data.taxType !== 'NON-VAT'
      ? `VAT (10%):  ${symbol}${vat.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      : `Tax:        NON-VAT`,
    `*Total:     ${symbol}${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}*`,
    ``,
    `Send /confirm to save  |  /cancel to discard`,
  ].join('\n');
}

/**
 * Fuzzy-match a user's text against a list of company names.
 * Returns up to 5 closest matches (case-insensitive substring).
 */
export function matchCompanies(input: string, companies: string[]): string[] {
  const q = input.toLowerCase().trim();
  return companies
    .filter(name => name.toLowerCase().includes(q))
    .slice(0, 5);
}

/**
 * Parse an item line like "HP-X360 2" or "HP-X360 x2" into { code, qty }.
 * Returns null if the format is unrecognised.
 */
export function parseItemInput(text: string): { code: string; qty: number } | null {
  // Accept: "CODE 2", "CODE x2", "CODE X 2", "CODE*2"
  const match = text.trim().match(/^(\S+)\s*[xX\*]?\s*(\d+)$/);
  if (!match) return null;
  const qty = parseInt(match[2], 10);
  if (isNaN(qty) || qty <= 0) return null;
  return { code: match[1].toUpperCase(), qty };
}
