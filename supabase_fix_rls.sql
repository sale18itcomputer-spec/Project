-- Drop valid existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.app_settings;
DROP POLICY IF EXISTS "Allow authenticated upsert access" ON public.app_settings;
DROP POLICY IF EXISTS "Allow full access to app_settings" ON public.app_settings;

-- Create a permissive policy for ALL roles (anon and authenticated)
-- This ensures that even if you are not fully logged in, you can save the layout.
CREATE POLICY "Allow full access to app_settings"
ON public.app_settings
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Grant permissions to anon and authenticated roles explicitly
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
