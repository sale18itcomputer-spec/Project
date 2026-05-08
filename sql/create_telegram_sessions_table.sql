-- ============================================================
-- Telegram Bot Session Table
-- ============================================================
-- Stores per-user conversation state for the quotation bot.
-- Each row = one active Telegram chat session.
-- Rows are cleaned up automatically after 24 hours of inactivity
-- via the updated_at index (you can add a pg_cron job later).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tg_sessions (
  chat_id       bigint PRIMARY KEY,             -- Telegram chat ID (unique per user/group)
  state         text NOT NULL DEFAULT 'IDLE',   -- Current step in the conversation flow
  data          jsonb NOT NULL DEFAULT '{}',    -- Accumulated quote data (company, items, etc.)
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  updated_at    timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for cleanup queries (e.g. delete sessions older than 24h)
CREATE INDEX IF NOT EXISTS tg_sessions_updated_at_idx
  ON public.tg_sessions (updated_at);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.tg_sessions_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sessions_updated_at_trigger ON public.tg_sessions;
CREATE TRIGGER tg_sessions_updated_at_trigger
  BEFORE UPDATE ON public.tg_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_sessions_set_updated_at();

-- RLS: disabled for server-side bot use (webhook runs with service role key)
-- If you ever expose this table to anon/client, enable RLS and add policies.
ALTER TABLE public.tg_sessions DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Valid states (for reference — enforced in application code):
--
--   IDLE                -> no active session
--   AWAITING_COMPANY    -> bot asked "Enter company name:"
--   AWAITING_CONTACT    -> bot asked "Select contact:"
--   COLLECTING_ITEMS    -> user is adding line items (code + qty)
--   AWAITING_CONFIRM    -> bot showed summary, waiting for /confirm or /cancel
--
-- data jsonb shape:
-- {
--   "companyName": "ABC Corp",
--   "contactName": "John Doe",
--   "contactNumber": "012 345 678",
--   "companyAddress": "Phnom Penh",
--   "paymentTerm": "Net 30",
--   "currency": "USD",
--   "taxType": "VAT",
--   "createdBy": "telegram:123456789",
--   "items": [
--     { "itemCode": "HP-X360", "modelName": "HP EliteBook x360", "qty": 2, "unitPrice": 1200, "amount": 2400 }
--   ]
-- }
-- ============================================================
