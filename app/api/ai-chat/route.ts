/**
 * POST /api/ai-chat
 * ─────────────────────────────────────────────────────────────
 * Relays a staff chat turn to the self-hosted Ollama proxy and returns the
 * assistant reply. The client sends { model, messages } and gets { reply }.
 *
 * Auth: dashboard session cookie (same check as the other internal routes).
 * The x-api-key never leaves the server — see lib/aiProxy.
 *
 * Body (application/json):
 *   model    — model id to run (e.g. "llama3.2")
 *   messages — full turn history: [{ role: 'user'|'assistant'|'system', content }]
 */
import { NextRequest, NextResponse } from 'next/server';
import { chat, getProxyConfig, type ChatMessage } from '@/lib/aiProxy';
import { stripThinking } from '@/lib/agentXml';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Per-session rate limiter (mirrors /api/telegram/send-document) ──────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
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

const VALID_ROLES = new Set(['system', 'user', 'assistant']);

export async function POST(req: NextRequest) {
  const session = req.cookies.get('limperial_legacy_session')?.value;
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!checkRateLimit(session)) {
    return NextResponse.json({ ok: false, error: 'Too many requests — slow down a moment.' }, { status: 429 });
  }
  if (!getProxyConfig()) {
    return NextResponse.json(
      { ok: false, error: 'AI proxy not configured. Set AI_PROXY_URL and AI_PROXY_KEY in .env.local.' },
      { status: 503 },
    );
  }

  let body: { model?: string; messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const model = (body.model || '').trim();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!model) {
    return NextResponse.json({ ok: false, error: 'model is required' }, { status: 400 });
  }
  if (messages.length === 0) {
    return NextResponse.json({ ok: false, error: 'messages is required' }, { status: 400 });
  }

  // Sanitise + cap history so a runaway client can't blow up the proxy.
  const clean: ChatMessage[] = messages
    .filter(m => m && VALID_ROLES.has(m.role) && typeof m.content === 'string')
    .slice(-40)
    .map(m => ({ role: m.role, content: m.content.slice(0, 12_000) }));

  if (clean.length === 0) {
    return NextResponse.json({ ok: false, error: 'No valid messages' }, { status: 400 });
  }

  try {
    const reply = stripThinking(await chat(model, clean));
    return NextResponse.json({ ok: true, reply });
  } catch (err: any) {
    console.error('[ai-chat]', err?.message || err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'AI proxy request failed' },
      { status: 502 },
    );
  }
}
