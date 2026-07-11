/**
 * POST /api/ai-chat/agent
 * ─────────────────────────────────────────────────────────────
 * Agentic chat turn. The model calls tools by emitting <invoke> XML blocks
 * (parsed here), which works on ANY model and THROUGH the authed server.js
 * gateway. READ tools run live in a loop; WRITE tools are never executed here —
 * the route returns a proposal the staff must confirm, which then runs via
 * /api/ai-chat/agent/execute with a permission check.
 *
 * Response shapes:
 *   { ok, type:'message', reply, activity }
 *   { ok, type:'confirm', proposal, assistantText, activity }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getServiceClient } from '@/lib/agentServer';
import { chat as gatewayChat, getProxyConfig, type ChatMessage } from '@/lib/aiProxy';
import { AGENT_TOOLS, getTool, type ToolContext, type AgentTool } from '@/lib/agentTools';
import { parseInvokes, stripInvokes, buildToolInstructions, type ParsedInvoke } from '@/lib/agentXml';
import { recallMemories } from '@/lib/agentMemory';
import { mcpConfigured, inferMcpKind } from '@/lib/agentMcp';

/** Effective kind of an invoke — mcp_call defers to its target tool's kind. */
function effectiveKind(inv: ParsedInvoke): 'read' | 'write' | 'auto' {
  const t = getTool(inv.name);
  if (!t) return 'read';
  if (inv.name === 'mcp_call') return inferMcpKind(String(inv.args?.tool ?? ''));
  return t.kind;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_STEPS = 6;

const rl = new Map<string, { count: number; resetAt: number }>();
function allow(key: string): boolean {
  const now = Date.now();
  const e = rl.get(key);
  if (!e || now > e.resetAt) { rl.set(key, { count: 1, resetAt: now + 60_000 }); return true; }
  if (e.count >= 20) return false;
  e.count++; return true;
}

function baseSystemPrompt(userName: string, memory: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `You are the AI assistant inside LPT System, the business management app for Limperial Technology (an IT company in Cambodia).`,
    `You are helping a staff member${userName ? ` named ${userName}` : ''}. Today is ${today}.`,
    ``,
    `If the user's message contains "Attached data" blocks, that data is already provided — answer directly from it and do NOT call a tool to re-fetch it. When several items are attached, address every one of them.`,
    `Otherwise, use a search/get tool to look up REAL live data before answering questions about specific records — never invent data.`,
    `To create or edit something, call the matching write tool with complete arguments. Do NOT claim it is done — the staff will see a confirmation card and the change only applies after they approve it.`,
    `Present results in clean prose or Markdown tables for staff — never mention internal field names like ItemsJSON or raw record ids.`,
    `You can format richly: Markdown tables, fenced code, task lists ("- [ ]"), and callouts ("> [!NOTE]", "> [!TIP]", "> [!WARNING]"). To draw a chart, output a fenced code block tagged "chart" containing JSON like {"type":"bar"|"line"|"pie","title":"…","data":[{"label":"Q-95","value":621.5}, …]}. Use a chart when comparing numbers is clearer visually.`,
    memory ? `\nWhat you remember about this user:\n${memory}` : ``,
    ``,
    `Be concise and practical. Reply in the same language the staff writes in (English or Khmer).`,
  ].join('\n');
}

export async function POST(req: NextRequest) {
  const session = req.cookies.get('limperial_legacy_session')?.value;
  const user = await getSessionUser(req);
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!allow(session)) {
    return NextResponse.json({ ok: false, error: 'Too many requests — slow down a moment.' }, { status: 429 });
  }
  if (!getProxyConfig()) {
    return NextResponse.json(
      { ok: false, error: 'AI proxy not configured (set AI_PROXY_URL / AI_PROXY_KEY in .env.local).' },
      { status: 503 },
    );
  }

  let body: { model?: string; messages?: { role: string; content: string }[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const model = (body.model || '').trim();
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  if (!model) return NextResponse.json({ ok: false, error: 'model is required' }, { status: 400 });
  if (!incoming.length) return NextResponse.json({ ok: false, error: 'messages is required' }, { status: 400 });

  const userId = (user as any).UserID as string;
  const memory = await recallMemories(userId).catch(() => '');
  // Advertise MCP meta-tools only when the MCP server is configured.
  const toolList: AgentTool[] = Object.values(AGENT_TOOLS).filter(
    t => (t.name === 'mcp_call' || t.name === 'mcp_list_tools') ? mcpConfigured() : true,
  );
  const system =
    baseSystemPrompt((user as any).Name || '', memory) +
    '\n\n' + buildToolInstructions(toolList);

  const msgs: ChatMessage[] = [{ role: 'system', content: system }];
  for (const m of incoming.slice(-30)) {
    if ((m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
      msgs.push({ role: m.role, content: m.content.slice(0, 12_000) });
    }
  }

  const ctx: ToolContext = { supabase: getServiceClient(), userId, userName: (user as any).Name };
  const activity: { name: string; args: Record<string, any> }[] = [];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const text = await gatewayChat(model, msgs);
      const invokes = parseInvokes(text);

      if (invokes.length === 0) {
        return NextResponse.json({ ok: true, type: 'message', reply: text.trim(), activity });
      }

      // A write anywhere in the turn → stop and ask the staff to confirm.
      const writeInvoke = invokes.find(i => effectiveKind(i) === 'write');
      if (writeInvoke) {
        const tool = getTool(writeInvoke.name)!;
        const args = writeInvoke.args ?? {};
        return NextResponse.json({
          ok: true,
          type: 'confirm',
          assistantText: stripInvokes(text),
          activity,
          proposal: {
            tool: tool.name,
            module: tool.module,
            action: tool.action,
            args,
            summary: tool.summarize ? tool.summarize(args) : `Run ${tool.name}`,
          },
        });
      }

      // Execute the read tools and feed results back as a user turn.
      msgs.push({ role: 'assistant', content: text });
      const resultBlocks: string[] = [];
      for (const inv of invokes) {
        const tool = getTool(inv.name);
        let result: any;
        if (!tool) {
          result = { error: `Unknown tool: ${inv.name}` };
        } else {
          try { result = await tool.run(inv.args ?? {}, ctx); activity.push({ name: tool.name, args: inv.args ?? {} }); }
          catch (e: any) { result = { error: e?.message || 'tool failed' }; }
        }
        resultBlocks.push(`<result name="${inv.name}">${JSON.stringify(result ?? null).slice(0, 8_000)}</result>`);
      }
      msgs.push({
        role: 'user',
        content: `Tool results:\n${resultBlocks.join('\n')}\n\nUse these to answer in plain text, or call another tool.`,
      });
    }

    // Out of steps — ask for a plain summary.
    const final = await gatewayChat(model, [...msgs, {
      role: 'user',
      content: 'Summarise what you found for me now in plain text, without calling any more tools.',
    }]);
    return NextResponse.json({ ok: true, type: 'message', reply: stripInvokes(final), activity });
  } catch (err: any) {
    console.error('[ai-chat/agent]', err?.message || err);
    return NextResponse.json({ ok: false, error: err?.message || 'Agent request failed' }, { status: 502 });
  }
}
