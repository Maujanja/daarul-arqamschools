
-- Drop existing restrictive policies for subjects
DROP POLICY IF EXISTS "Authenticated users can view subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;

-- Create permissive policies for subjects
CREATE POLICY "Authenticated users can view subjects"
ON public.subjects
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage subjects"
ON public.subjects
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Drop existing restrictive policies for teachers
DROP POLICY IF EXISTS "Teachers can view all teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can view their own record" ON public.teachers;
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;

-- Create permissive policies for teachers
CREATE POLICY "Admins can manage teachers"
ON public.teachers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can view all teachers"
ON public.teachers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can view their own record"
ON public.teachers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
