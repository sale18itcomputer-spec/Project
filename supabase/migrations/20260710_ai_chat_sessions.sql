-- Migration: saved AI chat sessions (conversation history).
-- Powers the full-page assistant's sidebar. Messages are stored as a JSONB
-- array on the session for simple load/save. Scoped to users.UserID.

CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL,
  title      text NOT NULL DEFAULT 'New chat',
  model      text,
  agent      boolean NOT NULL DEFAULT false,
  messages   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_idx
  ON public.ai_chat_sessions (user_id, updated_at DESC);

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_chat_sessions_public ON public.ai_chat_sessions;
CREATE POLICY ai_chat_sessions_public ON public.ai_chat_sessions FOR ALL TO public USING (true) WITH CHECK (true);
