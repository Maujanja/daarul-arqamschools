-- Create secure views for authentication tables that hide password hashes
-- These views will be used for public queries, base tables will be restricted

-- View for admin credentials (hides password)
CREATE OR REPLACE VIEW public.admin_credentials_public
WITH (security_invoker=on) AS
  SELECT id, username, created_at
  FROM public.admin_credentials;

-- View for secretary credentials (hides password)  
CREATE OR REPLACE VIEW public.secretary_credentials_public
WITH (security_invoker=on) AS
  SELECT id, username, full_name, created_at
  FROM public.secretary_credentials;

-- View for teachers (hides password)
CREATE OR REPLACE VIEW public.teachers_public
WITH (security_invoker=on) AS
  SELECT id, user_id, full_name, email, subjects, classes, created_at, updated_at
  FROM public.teachers;

-- Update RLS policies on admin_credentials - only allow service role to read password
DROP POLICY IF EXISTS "Allow read for authentication" ON public.admin_credentials;
CREATE POLICY "No direct SELECT on admin_credentials"
  ON public.admin_credentials FOR SELECT
  USING (false);

-- Update RLS policies on secretary_credentials
DROP POLICY IF EXISTS "Allow read for secretary authentication" ON public.secretary_credentials;
DROP POLICY IF EXISTS "Allow admin insert secretary" ON public.secretary_credentials;
DROP POLICY IF EXISTS "Allow admin update secretary" ON public.secretary_credentials;
DROP POLICY IF EXISTS "Allow admin delete secretary" ON public.secretary_credentials;

CREATE POLICY "No direct SELECT on secretary_credentials"
  ON public.secretary_credentials FOR SELECT
  USING (false);

CREATE POLICY "No direct INSERT on secretary_credentials"
  ON public.secretary_credentials FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on secretary_credentials"
  ON public.secretary_credentials FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on secretary_credentials"
  ON public.secretary_credentials FOR DELETE
  USING (false);

-- Update RLS policies on teachers - block password_hash access from client
DROP POLICY IF EXISTS "Anyone can view teachers" ON public.teachers;
DROP POLICY IF EXISTS "Anyone can manage teachers" ON public.teachers;

CREATE POLICY "No direct SELECT on teachers"
  ON public.teachers FOR SELECT
  USING (false);

CREATE POLICY "No direct INSERT on teachers"
  ON public.teachers FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on teachers"
  ON public.teachers FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on teachers"
  ON public.teachers FOR DELETE
  USING (false);

-- Grant access to public views
GRANT SELECT ON public.admin_credentials_public TO anon, authenticated;
GRANT SELECT ON public.secretary_credentials_public TO anon, authenticated;
GRANT SELECT ON public.teachers_public TO anon, authenticated;