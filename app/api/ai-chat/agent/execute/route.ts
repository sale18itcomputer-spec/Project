/**
 * POST /api/ai-chat/agent/execute
 * ─────────────────────────────────────────────────────────────
 * Runs a write action the staff explicitly confirmed from the chat. This is
 * the ONLY place agent writes actually happen, and every call is gated by the
 * signed-in staff member's permissions (resolved from the session cookie).
 *
 * Body: { tool, args } — a write tool name + arguments from the proposal card.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getServiceClient } from '@/lib/agentServer';
import { getTool, type ToolContext } from '@/lib/agentTools';
import { resolvePermissions, checkPermission } from '@/utils/permissions';
import type { PermissionAction } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const rl = new Map<string, { count: number; resetAt: number }>();
function allow(key: string): boolean {
  const now = Date.now();
  const e = rl.get(key);
  if (!e || now > e.resetAt) { rl.set(key, { count: 1, resetAt: now + 60_000 }); return true; }
  if (e.count >= 30) return false;
  e.count++; return true;
}

export async function POST(req: NextRequest) {
  const session = req.cookies.get('limperial_legacy_session')?.value;
  const user = await getSessionUser(req);
  if (!session || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!allow(session)) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }

  let body: { tool?: string; args?: Record<string, any> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const tool = getTool((body.tool || '').trim());
  if (!tool || tool.kind !== 'write') {
    return NextResponse.json({ ok: false, error: 'Unknown or non-executable action' }, { status: 400 });
  }

  // Permission gate — the agent can never exceed what this staff member may do.
  const perms = resolvePermissions(user);
  if (tool.module && tool.action && !checkPermission(perms, tool.module, tool.action as PermissionAction)) {
    return NextResponse.json(
      { ok: false, error: `You don't have permission to ${tool.action} ${tool.module.replace('_', ' ')}.` },
      { status: 403 },
    );
  }
  // MCP tools run with the MCP server's admin key — restrict writes to elevated roles.
  if (tool.mcp && !['Admin', 'Manager'].includes(String((user as any).Role))) {
    return NextResponse.json(
      { ok: false, error: 'Only Admin or Manager can run MCP write actions.' },
      { status: 403 },
    );
  }

  try {
    const ctx: ToolContext = { supabase: getServiceClient(), userId: (user as any).UserID, userName: (user as any).Name };
    const result = await tool.run(body.args ?? {}, ctx);
    return NextResponse.json({ ok: true, result, message: `Done — ${tool.summarize ? tool.summarize(body.args ?? {}) : tool.name}.` });
  } catch (err: any) {
    console.error('[ai-chat/agent/execute]', err?.message || err);
    return NextResponse.json({ ok: false, error: err?.message || 'Action failed' }, { status: 500 });
  }
}
