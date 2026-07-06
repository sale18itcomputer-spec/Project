-- Migration: Add "Telegram Chat ID" column to users
-- Lets each user store their personal Telegram chat ID so the system bot
-- can send them documents (invoices, quotations) and notifications.
-- Users can get their ID by messaging @userinfobot on Telegram.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "Telegram Chat ID" text;
