
-- Drop blocking policies
DROP POLICY IF EXISTS "No direct DELETE on announcements" ON public.announcements;
DROP POLICY IF EXISTS "No direct INSERT on announcements" ON public.announcements;
DROP POLICY IF EXISTS "No direct UPDATE on announcements" ON public.announcements;

-- Allow admins to insert announcements
CREATE POLICY "Admins can insert announcements"
ON public.announcements FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update announcements
CREATE POLICY "Admins can update announcements"
ON public.announcements FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete announcements
CREATE POLICY "Admins can delete announcements"
ON public.announcements FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
