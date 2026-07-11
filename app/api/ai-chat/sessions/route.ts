/**
 * /api/ai-chat/sessions — saved conversation history for the full-page assistant.
 *   GET            → list the user's sessions (no messages)
 *   GET ?id=<uuid> → load one session with its messages
 *   POST           → upsert { id?, title?, model?, agent?, messages } → { id, title }
 *   PATCH          → { id, title } rename
 *   DELETE ?id=    → remove a session
 *
 * Auth: dashboard session cookie. Scoped to the staff member's UserID.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getServiceClient } from '@/lib/agentServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function deriveTitle(messages: any[]): string {
  const firstUser = (messages || []).find(m => m?.role === 'user' && typeof m?.content === 'string');
  const t = (firstUser?.content || '').trim().replace(/\s+/g, ' ');
  return t ? t.slice(0, 60) : 'New chat';
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const uid = (user as any).UserID as string;
  const sb = getServiceClient();
  const id = req.nextUrl.searchParams.get('id');

  try {
    if (id) {
      const { data, error } = await sb.from('ai_chat_sessions')
        .select('*').eq('id', id).eq('user_id', uid).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ok: true, session: data });
    }
    const { data, error } = await sb.from('ai_chat_sessions')
      .select('id, title, model, agent, updated_at')
      .eq('user_id', uid).order('updated_at', { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, sessions: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const uid = (user as any).UserID as string;
  const sb = getServiceClient();

  let body: { id?: string; title?: string; model?: string; agent?: boolean; messages?: any[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-400) : [];
  const title = (body.title && body.title.trim()) || deriveTitle(messages);
  const now = new Date().toISOString();

  try {
    if (body.id) {
      const { data, error } = await sb.from('ai_chat_sessions')
        .update({ title, model: body.model ?? null, agent: !!body.agent, messages, updated_at: now })
        .eq('id', body.id).eq('user_id', uid).select('id, title').maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return NextResponse.json({ ok: true, id: data.id, title: data.title });
      // fall through to insert if the id didn't belong to this user
    }
    const { data, error } = await sb.from('ai_chat_sessions')
      .insert({ user_id: uid, title, model: body.model ?? null, agent: !!body.agent, messages, created_at: now, updated_at: now })
      .select('id, title').single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, id: data.id, title: data.title });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Save failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const uid = (user as any).UserID as string;
  let body: { id?: string; title?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.id || !body.title?.trim()) return NextResponse.json({ ok: false, error: 'id and title required' }, { status: 400 });
  try {
    const { error } = await getServiceClient().from('ai_chat_sessions')
      .update({ title: body.title.trim().slice(0, 80), updated_at: new Date().toISOString() })
      .eq('id', body.id).eq('user_id', uid);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Rename failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const uid = (user as any).UserID as string;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  try {
    const { error } = await getServiceClient().from('ai_chat_sessions').delete().eq('id', id).eq('user_id', uid);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Delete failed' }, { status: 500 });
  }
}
