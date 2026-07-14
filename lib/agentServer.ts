/**
 * Server-only helpers for AI agent mode.
 * ─────────────────────────────────────────────────────────────
 * Agent mode needs tool-calling. The server.js gateway (AI_PROXY_URL) strips
 * the `tools` field, so the agent talks to Ollama's native API directly via
 * AI_OLLAMA_URL (LAN, server-side only — never exposed to the browser).
 *
 * Also resolves the signed-in staff member from the session cookie so writes
 * can be gated by that person's permissions, and gives a service-role Supabase
 * client for the tool handlers.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { User } from '../types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

let _client: SupabaseClient | null = null;
export function getServiceClient(): SupabaseClient {
  if (!_client) _client = createClient(SUPABASE_URL, SERVICE_KEY);
  return _client;
}

/** Resolve the staff member behind the request from the legacy session cookie. */
export async function getSessionUser(req: NextRequest): Promise<User | null> {
  const userId = req.cookies.get('limperial_legacy_session')?.value;
  if (!userId) return null;
  try {
    const { data, error } = await getServiceClient()
      .from('users')
      .select('*')
      .eq('UserID', userId)
      .single();
    if (error || !data) return null;
    return data as User;
  } catch {
    return null;
  }
}

// ── Ollama native tool-calling ────────────────────────────────────────────────

export interface OllamaToolCall {
  function: { name: string; arguments: Record<string, any> };
}
export interface OllamaMessage {
  role: string;
  content: string;
  tool_calls?: OllamaToolCall[];
}

export function agentConfigured(): boolean {
  return !!(process.env.AI_OLLAMA_URL || '').trim();
}

function ollamaBase(): string {
  return (process.env.AI_OLLAMA_URL || '').replace(/\/+$/, '');
}

const TIMEOUT_MS = 180_000;

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * One turn of Ollama /api/chat with tools (stream:false → single JSON).
 * Returns the assistant message, which may carry tool_calls.
 */
export async function ollamaChat(
  model: string,
  messages: any[],
  tools: any[],
): Promise<OllamaMessage> {
  const base = ollamaBase();
  if (!base) throw new Error('Agent not configured (AI_OLLAMA_URL is empty)');
  const res = await timedFetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, tools, stream: false }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
    throw new Error(`Ollama error ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  const data: any = await res.json();
  const msg = data?.message ?? {};
  return {
    role: msg.role ?? 'assistant',
    content: typeof msg.content === 'string' ? msg.content : '',
    tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : undefined,
  };
}

/** Names of installed models that advertise the `tools` capability. */
export async function listToolCapableModels(): Promise<string[]> {
  const base = ollamaBase();
  if (!base) return [];
  try {
    const res = await timedFetch(`${base}/api/tags`, { method: 'GET' });
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data?.models ?? [])
      .filter((m: any) => Array.isArray(m?.capabilities) && m.capabilities.includes('tools'))
      .map((m: any) => m?.name)
      .filter(Boolean);
  } catch {
    return [];
  }
}
