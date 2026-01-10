-- Create the app_settings table to store global configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read settings
CREATE POLICY "Allow authenticated read access"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

-- Policy to allow authenticated users to insert/update settings
-- (Adjust restrictions based on your needs, e.g., only admins)
CREATE POLICY "Allow authenticated upsert access"
ON public.app_settings
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant access to public (if necessary, or kept to authenticated only)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE app_settings_key_seq TO authenticated; -- If sequence exists (not here since key is text)
