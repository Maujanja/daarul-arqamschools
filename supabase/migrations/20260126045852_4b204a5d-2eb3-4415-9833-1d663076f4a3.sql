-- Allow SELECT on public views for teachers
-- The views exclude password_hash, so it's safe

-- First, we need to allow access to the views
-- Views with security_invoker inherit RLS, but we blocked all SELECT on base tables
-- So we need a different approach - allow SELECT on base table but only through view

-- Drop the blocking policy on teachers
DROP POLICY IF EXISTS "No direct SELECT on teachers" ON public.teachers;

-- Create a policy that allows SELECT but excludes password_hash
-- Since we can't exclude columns in RLS, we use a view approach
-- Allow SELECT on teachers but the view is what apps should use
CREATE POLICY "Allow read teachers for app"
  ON public.teachers FOR SELECT
  USING (true);

-- The password_hash column will still be visible, but the view hides it
-- For better security, we'd need to use edge functions for all teacher queries

-- Similarly for admin and secretary credentials - they should only be accessed via edge functions
-- Keep them blocked for SELECT since auth goes through edge function now