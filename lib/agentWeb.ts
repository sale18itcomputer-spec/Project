/**
 * Web tools for the agent: search + fetch.
 * ─────────────────────────────────────────────────────────────
 * webSearch  — SearXNG JSON if SEARXNG_URL is set (like Odysseus), else a
 *              no-key DuckDuckGo HTML fallback. Returns top results.
 * webFetch   — fetch a page and return readable text, with an SSRF guard that
 *              blocks localhost / private-network / non-http(s) targets so the
 *              model can't be tricked into hitting internal services.
 */

const FETCH_TIMEOUT = 20_000;
const MAX_TEXT = 8_000;

async function timed(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (LPT-Assistant)', ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

// ── SSRF guard ──────────────────────────────────────────────────────────────
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, '');
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;                 // loopback / private / this-host
    if (a === 192 && b === 168) return true;                            // private
    if (a === 169 && b === 254) return true;                            // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;                   // private
    if (a >= 224) return true;                                          // multicast/reserved
  }
  return false;
}

function assertSafeUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs are allowed');
  if (isBlockedHost(u.hostname)) throw new Error('That address is not allowed');
  return u;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchResult { title: string; url: string; snippet: string; }

export async function webSearch(query: string, limit = 6): Promise<SearchResult[]> {
  const q = (query || '').trim();
  if (!q) return [];

  // Preferred: self-hosted SearXNG JSON API.
  const searx = (process.env.SEARXNG_URL || '').replace(/\/+$/, '');
  if (searx) {
    const res = await timed(`${searx}/search?q=${encodeURIComponent(q)}&format=json`);
    if (res.ok) {
      const data: any = await res.json();
      return (data?.results ?? []).slice(0, limit).map((r: any) => ({
        title: r.title ?? '', url: r.url ?? '', snippet: r.content ?? '',
      }));
    }
  }

  // Fallback: DuckDuckGo HTML (no key). Parse result anchors + snippets.
  const res = await timed(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const html = await res.text();
  const out: SearchResult[] = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    let url = m[1];
    const dd = url.match(/uddg=([^&]+)/);           // DDG wraps target in a redirect param
    if (dd) { try { url = decodeURIComponent(dd[1]); } catch { /* keep */ } }
    out.push({ title: htmlToText(m[2]).slice(0, 200), url, snippet: '' });
    if (out.length >= limit) break;
  }
  return out;
}

export async function webFetch(url: string): Promise<{ url: string; title: string; text: string }> {
  const u = assertSafeUrl(url);
  const res = await timed(u.toString());
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const ct = res.headers.get('content-type') || '';
  const body = await res.text();
  if (/json/.test(ct)) return { url: u.toString(), title: '', text: body.slice(0, MAX_TEXT) };
  const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  return { url: u.toString(), title, text: htmlToText(body).slice(0, MAX_TEXT) };
}
