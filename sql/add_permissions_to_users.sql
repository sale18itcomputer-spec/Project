-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add `permissions` JSONB column to the Users table
-- Run once in Supabase SQL Editor (or via supabase db push).
--
-- A NULL value means "use the role preset" — no custom overrides for that user.
-- A non-null value is a UserPermissions JSON snapshot that fully describes the
-- user's module access and data-visibility flags.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "permissions" JSONB DEFAULT NULL;

-- Optional: add a comment for clarity in Supabase Studio
COMMENT ON COLUMN public.users."permissions" IS
  'Custom per-user permission overrides. NULL = use role preset defined in code.
   Structure: { modules: Record<string, ModulePermissions>, dataVisibility?: DataVisibility }';
