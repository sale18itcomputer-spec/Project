-- Migration: AI assistant per-user memory + skills
-- Backs the agent's remember / list_memories / forget / save_skill / list_skills
-- tools. Scoped to the staff member's UserID (text, matches users.UserID).

CREATE TABLE IF NOT EXISTS public.ai_memory (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_memory_user_idx ON public.ai_memory (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_skills (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL,
  name       text NOT NULL,
  prompt     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- Match the rest of this project: tables are accessed via the service role /
-- anon key with public RLS. Enable RLS and allow public (consistent with the
-- existing schema convention noted in lib/supabase.ts).
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_memory_public ON public.ai_memory;
CREATE POLICY ai_memory_public ON public.ai_memory FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS ai_skills_public ON public.ai_skills;
CREATE POLICY ai_skills_public ON public.ai_skills FOR ALL TO public USING (true) WITH CHECK (true);
