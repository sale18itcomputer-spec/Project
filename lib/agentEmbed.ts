/**
 * Text embeddings via Ollama (server-side, LAN).
 * ─────────────────────────────────────────────────────────────
 * Uses the AI_EMBED_MODEL model on AI_OLLAMA_URL. Pull it once on the server:
 *   ollama pull nomic-embed-text     (768-dim vectors)
 *
 * Supports both Ollama endpoints: /api/embed (newer, batched) and
 * /api/embeddings (older, single). Throws a clear message if the model isn't
 * installed so RAG upload/search can surface "run ollama pull …".
 */
const TIMEOUT = 60_000;

function base(): string {
  return (process.env.AI_OLLAMA_URL || '').replace(/\/+$/, '');
}
export function embedModel(): string {
  return process.env.AI_EMBED_MODEL || 'nomic-embed-text';
}
export function embedConfigured(): boolean {
  return !!base();
}

async function post(path: string, body: unknown): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(`${base()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/** Embed a batch of strings → one vector each. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!base()) throw new Error('Embeddings not configured (AI_OLLAMA_URL is empty)');
  const model = embedModel();
  const inputs = texts.map(t => (t || '').slice(0, 8_000));

  // Newer batched endpoint first.
  let res = await post('/api/embed', { model, input: inputs });
  if (res.ok) {
    const data: any = await res.json();
    if (Array.isArray(data?.embeddings)) return data.embeddings;
  } else if (res.status === 404 || res.status === 400) {
    // Fall back to the single-input endpoint (older Ollama).
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
