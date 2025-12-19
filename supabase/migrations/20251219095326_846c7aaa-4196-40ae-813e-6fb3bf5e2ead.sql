-- Add password column to teachers table for custom login
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS password_hash text;

-- Create admin credentials table for hardcoded admin login
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on admin_credentials
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

-- Insert default admin credential (DAARUL / admin123)
INSERT INTO public.admin_credentials (username, password_hash) 
VALUES ('DAARUL', 'admin123')
ON CONFLICT (username) DO NOTHING;