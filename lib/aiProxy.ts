/**
 * Server-side helper for the self-hosted Ollama proxy (server.js).
 * ─────────────────────────────────────────────────────────────
 * The staff chat widget never talks to the proxy directly — it calls the
 * same-origin /api/ai-chat routes, which use these helpers. That keeps the
 * x-api-key on the server (out of the browser).
 *
 * Verified live contract of the LAN proxy at server.js:
 *   • GET  /models  →  { models: [{ name, size }] }        (x-api-key required)
 *   • POST /chat    →  Ollama chat, streamed as NDJSON      (one JSON per line,
 *                        chunks carry message.content, last line is done:true)
 *
 * We also fall back to Ollama-native (/api/tags, /api/chat) and OpenAI-shaped
 * (/v1/models, /v1/chat/completions) paths so this keeps working if server.js
 * is later swapped for a different gateway.
 *
 * Config (server-only env, set in .env.local):
 *   AI_PROXY_URL — base URL, e.g. http://192.168.10.131:3000 (LAN) or a tunnel
 *   AI_PROXY_KEY — value sent as the `x-api-key` header
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function getProxyConfig(): { url: string; key: string } | null {
  const url = (process.env.AI_PROXY_URL || '').replace(/\/+$/, '');
  const key = process.env.AI_PROXY_KEY || '';
  if (!url || url.includes('your-tunnel-url')) return null;
  return { url, key };
}

function authHeaders(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': key,
    // Some gateways expect a Bearer token instead — send both; harmless if ignored.
    Authorization: `Bearer ${key}`,
  };
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

/** List installed model names. Tries /models, then /api/tags, then /v1/models. */
export async function listModels(): Promise<string[]> {
  const cfg = getProxyConfig();
  if (!cfg) throw new Error('AI proxy not configured (set AI_PROXY_URL / AI_PROXY_KEY)');
  const headers = authHeaders(cfg.key);
  let lastStatus = 0;

  for (const path of ['/models', '/api/tags', '/v1/models']) {
    try {
      const res = await timedFetch(`${cfg.url}${path}`, { method: 'GET', headers });
      if (!res.ok) { lastStatus = res.status; continue; }
      const data: any = await res.json();
      const raw = data?.models ?? data?.data ?? [];
      const names = raw
        .map((m: any) => (typeof m === 'string' ? m : m?.name || m?.model || m?.id))
        .filter(Boolean);
      if (names.length) return dedupe(names);
    } catch { /* try next path */ }
  }
  throw new Error(lastStatus ? `Proxy returned ${lastStatus} listing models` : 'Could not reach the AI server');
}

/** Send a chat turn. Tries /chat, then /api/chat, then /v1/chat/completions. */
export async function chat(model: string, messages: ChatMessage[]): Promise<string> {
  const cfg = getProxyConfig();
  if (!cfg) throw new Error('AI proxy not configured (set AI_PROXY_URL / AI_PROXY_KEY)');
  const headers = authHeaders(cfg.key);
  const body = JSON.stringify({ model, messages, stream: false });
  let lastErr = '';

  for (const path of ['/chat', '/api/chat', '/v1/chat/completions']) {
    let res: Response;
    try {
      res = await timedFetch(`${cfg.url}${path}`, { method: 'POST', headers, body });
    } catch (e) {
      lastErr = (e as Error).message; // network/abort — try next path
      continue;
    }
    if (res.status === 404) { lastErr = `404 at ${path}`; continue; } // wrong shape — try next
    if (!res.ok) throw new Error(await describeError(res));

    const text = await res.text();
    const content = parseChatReply(text);
    if (content !== null) return content;
    lastErr = `Unexpected response shape at ${path}`;
  }
  throw new Error(lastErr || 'AI proxy request failed');
}

/**
 * Extract the assistant text from any of the shapes the proxy can return:
 *   • a single Ollama object   { message: { content } }
 *   • NDJSON stream            many lines, each { message: { content } }, concatenated
 *   • OpenAI completion        { choices: [{ message: { content } }] }
 *   • OpenAI SSE-ish deltas    many lines of { choices: [{ delta: { content } }] }
 * Returns null if nothing parseable was found.
 */
function parseChatReply(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return '';

  // Fast path: one JSON object.
  try {
    const obj = JSON.parse(trimmed);
    const single = pluckContent(obj);
    if (single !== null) return single;
  } catch { /* not a single object — treat as NDJSON below */ }

  // NDJSON / streamed: concatenate content across all lines.
  let out = '';
  let found = false;
  for (const line of trimmed.split(/\r?\n/)) {
    const l = line.trim().replace(/^data:\s*/, ''); // tolerate SSE "data:" prefix
    if (!l || l === '[DONE]') continue;
    try {
      const o = JSON.parse(l);
      const piece =
        o?.message?.content ??
        o?.choices?.[0]?.delta?.content ??
        o?.choices?.[0]?.message?.content ??
        (typeof o?.response === 'string' ? o.response : undefined);
      if (typeof piece === 'string') { out += piece; found = true; }
    } catch { /* skip non-JSON line */ }
  }
  return found ? out : null;
}

function pluckContent(o: any): string | null {
  const c =
    o?.message?.content ??
    o?.choices?.[0]?.message?.content ??
    (typeof o?.response === 'string' ? o.response : undefined);
  return typeof c === 'string' ? c : null;
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

async function describeError(res: Response): Promise<string> {
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 300);
  } catch { /* ignore */ }
  return `Proxy error ${res.status}${detail ? `: ${detail}` : ''}`;
}
