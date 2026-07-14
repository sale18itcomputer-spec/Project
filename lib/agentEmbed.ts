/**
 * Text embeddings for RAG. Two paths, picked by which env is set:
 *   • AI_OLLAMA_URL set  → embed directly against Ollama (LAN app, fastest).
 *   • else, gateway set  → embed via the authed gateway's /embed route
 *                          (Vercel / off-LAN — keeps Ollama private, reuses the
 *                          same x-api-key + tunnel as chat).
 *
 * Pull the model once on the server: ollama pull nomic-embed-text  (768-dim)
 * The gateway needs a small /embed route that proxies to Ollama's /api/embed
 * (see docs/ai-chat-setup.md).
 */
import { getProxyConfig } from './aiProxy';

const TIMEOUT = 60_000;

function ollamaBase(): string {
  return (process.env.AI_OLLAMA_URL || '').replace(/\/+$/, '');
}
export function embedModel(): string {
  return process.env.AI_EMBED_MODEL || 'nomic-embed-text';
}
export function embedConfigured(): boolean {
  return !!ollamaBase() || !!getProxyConfig();
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function embedDirect(base: string, inputs: string[]): Promise<number[][]> {
  const model = embedModel();
  const post = (path: string, body: unknown) =>
    timedFetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  let res = await post('/api/embed', { model, input: inputs });
  if (res.ok) {
    const data: any = await res.json();
    if (Array.isArray(data?.embeddings)) return data.embeddings;
  } else if (res.status === 404 || res.status === 400) {
    const out: number[][] = [];
    for (const input of inputs) {
      const r = await post('/api/embeddings', { model, prompt: input });
      if (!r.ok) throw await embedError(r, model);
      const d: any = await r.json();
      if (!Array.isArray(d?.embedding)) throw new Error('Unexpected embedding response');
      out.push(d.embedding);
    }
    return out;
  }
  if (!res.ok) throw await embedError(res, model);
  throw new Error('Unexpected embedding response');
}

async function embedViaGateway(cfg: { url: string; key: string }, inputs: string[]): Promise<number[][]> {
  const model = embedModel();
  const res = await timedFetch(`${cfg.url}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.key, Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('The gateway has no /embed route yet — add it to server.js (see docs/ai-chat-setup.md).');
    throw await embedError(res, model);
  }
  const data: any = await res.json();
  if (Array.isArray(data?.embeddings)) return data.embeddings;
  if (Array.isArray(data?.embedding)) return [data.embedding];
  throw new Error('Unexpected embedding response from gateway');
}

/** Embed a batch of strings → one vector each. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const inputs = texts.map(t => (t || '').slice(0, 8_000));
  const base = ollamaBase();
  if (base) return embedDirect(base, inputs);
  const cfg = getProxyConfig();
  if (cfg) return embedViaGateway(cfg, inputs);
  throw new Error('Embeddings not configured (set AI_OLLAMA_URL on the LAN, or AI_PROXY_URL for the gateway path)');
}

export async function embedText(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}

async function embedError(res: Response, model: string): Promise<Error> {
  let detail = '';
  try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
  if (/not found|no such model|pull/i.test(detail)) {
    return new Error(`Embedding model "${model}" is not installed. Run: ollama pull ${model}`);
  }
  return new Error(`Embedding failed (${res.status})${detail ? `: ${detail}` : ''}`);
}
