/**
 * GET /api/ai-chat/models
 * ─────────────────────────────────────────────────────────────
 * Returns the list of models installed on the self-hosted Ollama proxy, so
 * the chat widget's dropdown always reflects exactly what has been
 * `ollama pull`-ed — no hardcoded list to maintain.
 *
 * Auth: dashboard session cookie. The x-api-key stays server-side (see lib/aiProxy).
 */
import { NextRequest, NextResponse } from 'next/server';
import { listModels, getProxyConfig } from '@/lib/aiProxy';
import { listToolCapableModels, agentConfigured } from '@/lib/agentServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = req.cookies.get('limperial_legacy_session')?.value;
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!getProxyConfig()) {
    return NextResponse.json(
      { ok: false, error: 'AI proxy not configured. Set AI_PROXY_URL and AI_PROXY_KEY in .env.local.' },
      { status: 503 },
    );
  }

  try {
    // Model list (for the dropdown) comes from the authed gateway; the subset
    // that supports agent tool-calling comes from Ollama's capabilities.
    const [models, toolModels] = await Promise.all([
      listModels(),
      agentConfigured() ? listToolCapableModels() : Promise.resolve([]),
    ]);
    // Agent runs via XML tool-calling through the authed gateway, so it works on
    // ANY model whenever the proxy is configured. `toolModels` (native tool
    // support) is just a "works best" hint for the dropdown.
    return NextResponse.json({ ok: true, models, toolModels, agentEnabled: !!getProxyConfig() });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to reach AI proxy' },
      { status: 502 },
    );
  }
}
