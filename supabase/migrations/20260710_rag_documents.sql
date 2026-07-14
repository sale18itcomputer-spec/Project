-- Migration: RAG document store for the AI agent (pgvector).
-- Staff upload documents → chunks are embedded (Ollama nomic-embed-text, 768-dim)
-- → the rag_search tool retrieves the closest chunks for grounded answers.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.rag_documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  source     text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rag_chunks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id     uuid NOT NULL REFERENCES public.rag_documents(id) ON DELETE CASCADE,
  content    text NOT NULL,
  embedding  vector(768),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rag_chunks_doc_idx ON public.rag_chunks (doc_id);
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
  ON public.rag_chunks USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_rag_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 6
)
RETURNS TABLE (id uuid, doc_id uuid, content text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT c.id, c.doc_id, c.content, 1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.rag_chunks c
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rag_documents_public ON public.rag_documents;
CREATE POLICY rag_documents_public ON public.rag_documents FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS rag_chunks_public ON public.rag_chunks;
CREATE POLICY rag_chunks_public ON public.rag_chunks FOR ALL TO public USING (true) WITH CHECK (true);
