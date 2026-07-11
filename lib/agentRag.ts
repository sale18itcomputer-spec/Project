/**
 * RAG: ingest documents and retrieve relevant chunks.
 * ─────────────────────────────────────────────────────────────
 * ingestDocument — chunk text, embed each chunk (Ollama), store in rag_chunks.
 * ragSearch      — embed the query, return the closest chunks via the
 *                  match_rag_chunks() SQL function (pgvector cosine).
 */
import { getServiceClient } from './agentServer';
import { embedTexts, embedText } from './agentEmbed';

const CHUNK_SIZE = 900;   // ~chars per chunk
const CHUNK_OVERLAP = 150;

/** Split text into overlapping chunks on paragraph/sentence-ish boundaries. */
export function chunkText(text: string): string[] {
  const clean = (text || '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      // Prefer to break on a paragraph or sentence boundary near the end.
      const window = clean.slice(i, end);
      const br = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n'));
      if (br > CHUNK_SIZE * 0.5) end = i + br + 1;
    }
    const piece = clean.slice(i, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    i = end - CHUNK_OVERLAP;
    if (i < 0) i = 0;
  }
  return chunks;
}

export interface IngestResult { docId: string; title: string; chunks: number; }

export async function ingestDocument(opts: {
  title: string; text: string; source?: string; createdBy?: string;
}): Promise<IngestResult> {
  const title = (opts.title || '').trim() || 'Untitled';
  const chunks = chunkText(opts.text);
  if (chunks.length === 0) throw new Error('Document is empty');

  const embeddings = await embedTexts(chunks); // throws a clear message if model missing
  const sb = getServiceClient();

  const { data: doc, error: docErr } = await sb
    .from('rag_documents')
    .insert({ title, source: opts.source ?? null, created_by: opts.createdBy ?? null })
    .select('id')
    .single();
  if (docErr) throw new Error(docErr.message);

  const rows = chunks.map((content, i) => ({ doc_id: doc.id, content, embedding: embeddings[i] }));
  const { error: chunkErr } = await sb.from('rag_chunks').insert(rows);
  if (chunkErr) {
    // Roll back the document header so we don't leave an empty doc behind.
    await sb.from('rag_documents').delete().eq('id', doc.id);
    throw new Error(chunkErr.message);
  }
  return { docId: doc.id, title, chunks: chunks.length };
}

export interface RagHit { content: string; similarity: number; title?: string; }

export async function ragSearch(query: string, k = 6): Promise<RagHit[]> {
  const q = (query || '').trim();
  if (!q) return [];
  const embedding = await embedText(q);
  const sb = getServiceClient();
  const { data, error } = await sb.rpc('match_rag_chunks', { query_embedding: embedding, match_count: k });
  if (error) throw new Error(error.message);

  const hits = (data ?? []) as { doc_id: string; content: string; similarity: number }[];
  // Attach document titles.
  const ids = Array.from(new Set(hits.map(h => h.doc_id)));
  const titles: Record<string, string> = {};
  if (ids.length) {
    const { data: docs } = await sb.from('rag_documents').select('id, title').in('id', ids);
    for (const d of docs ?? []) titles[(d as any).id] = (d as any).title;
  }
  return hits.map(h => ({ content: h.content, similarity: Math.round(h.similarity * 1000) / 1000, title: titles[h.doc_id] }));
}

export async function listDocuments(): Promise<any[]> {
  const { data, error } = await getServiceClient()
    .from('rag_documents')
    .select('id, title, source, created_by, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await getServiceClient().from('rag_documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
