/**
 * /api/ai-chat/rag  — manage the AI knowledge base (RAG documents).
 *   GET    → list documents
 *   POST   → { title, text, source? } ingest a document (chunk + embed + store)
 *   DELETE → ?id=<uuid> remove a document and its chunks
 *
 * Auth: dashboard session cookie. Embeddings run on Ollama (AI_OLLAMA_URL).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/agentServer';
import { ingestDocument, listDocuments, deleteDocument } from '@/lib/agentRag';
import { embedConfigured } from '@/lib/agentEmbed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, documents: await listDocuments() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to list' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!embedConfigured()) {
    return NextResponse.json({ ok: false, error: 'Embeddings not configured (set AI_OLLAMA_URL).' }, { status: 503 });
  }

  let body: { title?: string; text?: string; source?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const title = (body.title || '').trim();
  const text = body.text || '';
  if (!title) return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 });
  if (!text.trim()) return NextResponse.json({ ok: false, error: 'text is required' }, { status: 400 });
  if (text.length > 400_000) return NextResponse.json({ ok: false, error: 'Document too large (max ~400k chars)' }, { status: 413 });

  try {
    const result = await ingestDocument({ title, text, source: body.source, createdBy: (user as any).Name });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Ingest failed' }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 });
  try {
    await deleteDocument(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Delete failed' }, { status: 500 });
  }
}
