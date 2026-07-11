/**
 * POST /api/ai-chat/roundtable — one model "turn" in a multi-model session.
 * ─────────────────────────────────────────────────────────────
 * Stateless per turn: the client drives the order (who speaks next) and passes
 * the transcript so far; this builds the right persona/system prompt for the
 * turn kind and returns that model's message. Runs plain text through the
 * authed gateway (no tools), so it works on every model.
 *
 * Body: { model, kind, topic, side?, transcript?: [{speaker,content}], participants?: string[] }
 *   kind: 'discuss' | 'debate' | 'draft' | 'aggregate' | 'summarize' | 'judge'
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/agentServer';
import { chat as gatewayChat, getProxyConfig, type ChatMessage } from '@/lib/aiProxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const rl = new Map<string, { count: number; resetAt: number }>();
function allow(key: string): boolean {
  const now = Date.now();
  const e = rl.get(key);
  if (!e || now > e.resetAt) { rl.set(key, { count: 1, resetAt: now + 60_000 }); return true; }
  if (e.count >= 60) return false;
  e.count++; return true;
}

type Turn = { speaker: string; content: string };

function transcriptText(t: Turn[]): string {
  return (t || []).map(x => `[${x.speaker}]: ${x.content}`).join('\n\n');
}

function buildMessages(p: {
  kind: string; model: string; topic: string; side?: string; transcript?: Turn[]; participants?: string[];
}): ChatMessage[] {
  const { kind, model, topic } = p;
  const tt = transcriptText(p.transcript ?? []);
  const others = (p.participants ?? []).filter(m => m !== model).join(', ');

  switch (kind) {
    case 'discuss':
      return [
        { role: 'system', content: `You are the AI model "${model}" in a roundtable discussion${others ? ` with ${others}` : ''}. The user's topic: "${topic}". Add your perspective in 2–4 sentences — build on strong points, respectfully challenge weak ones, stay concrete, and don't repeat what's already been said. Speak in first person; do not prefix your name.` },
        { role: 'user', content: tt ? `Discussion so far:\n${tt}\n\nYour turn.` : `Start the discussion.` },
      ];
    case 'debate':
      return [
        { role: 'system', content: `You are "${model}", arguing the ${p.side === 'against' ? 'AGAINST (con)' : 'FOR (pro)'} side of: "${topic}". Make your strongest case in 2–4 sentences and directly rebut the opponent's latest point. Stay firmly in character; don't concede.` },
        { role: 'user', content: tt ? `Debate so far:\n${tt}\n\nYour rebuttal.` : `Open the debate with your position.` },
      ];
    case 'draft':
      return [
        { role: 'system', content: `You are the AI model "${model}". Answer the user's question directly, correctly, and concisely. This is your independent answer.` },
        { role: 'user', content: topic },
      ];
    case 'aggregate':
      return [
        { role: 'system', content: `You are "${model}", the panel aggregator. Several models answered the question independently. Merge their best, correct points into one clear final answer. Call out any disagreement briefly.` },
        { role: 'user', content: `Question: ${topic}\n\nIndependent answers:\n${tt}\n\nWrite the final combined answer.` },
      ];
    case 'summarize':
      return [
        { role: 'system', content: `You are "${model}". Summarize the roundtable's key conclusions and any consensus or open disagreement, concisely (a short paragraph or a few bullets).` },
        { role: 'user', content: `Discussion:\n${tt}` },
      ];
    case 'judge':
      return [
        { role: 'system', content: `You are "${model}", an impartial judge. Read the debate and decide which side argued more convincingly and why, in 2–3 sentences. End with a line exactly "Verdict: FOR" or "Verdict: AGAINST".` },
        { role: 'user', content: `Debate:\n${tt}` },
      ];
    default:
      return [{ role: 'user', content: topic }];
  }
}

export async function POST(req: NextRequest) {
  const session = req.cookies.get('limperial_legacy_session')?.value;
  const user = await getSessionUser(req);
  if (!session || !user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!allow(session)) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  if (!getProxyConfig()) return NextResponse.json({ ok: false, error: 'AI proxy not configured.' }, { status: 503 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const model = (body.model || '').trim();
  const kind = (body.kind || 'discuss').trim();
  const topic = (body.topic || '').toString().slice(0, 4_000);
  if (!model) return NextResponse.json({ ok: false, error: 'model is required' }, { status: 400 });
  if (!topic) return NextResponse.json({ ok: false, error: 'topic is required' }, { status: 400 });

  const transcript: Turn[] = Array.isArray(body.transcript)
    ? body.transcript.slice(-30).map((t: any) => ({ speaker: String(t?.speaker ?? ''), content: String(t?.content ?? '').slice(0, 4_000) }))
    : [];

  try {
    const messages = buildMessages({ kind, model, topic, side: body.side, transcript, participants: body.participants });
    const content = await gatewayChat(model, messages);
    return NextResponse.json({ ok: true, content });
  } catch (err: any) {
    console.error('[ai-chat/roundtable]', err?.message || err);
    return NextResponse.json({ ok: false, error: err?.message || 'Turn failed' }, { status: 502 });
  }
}
