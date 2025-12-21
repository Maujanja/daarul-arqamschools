
-- Drop existing policies for subjects
DROP POLICY IF EXISTS "Authenticated users can view subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;

-- Create public read policy for subjects (app uses custom auth)
CREATE POLICY "Anyone can view subjects"
ON public.subjects
FOR SELECT
USING (true);

CREATE POLICY "Anyone can manage subjects"
ON public.subjects
FOR ALL
USING (true);

-- Drop existing policies for teachers
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can view all teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can view their own record" ON public.teachers;

-- Create public access policies for teachers (app uses custom auth)
CREATE POLICY "Anyone can view teachers"
ON public.teachers
FOR SELECT
USING (true);

CREATE POLICY "Anyone can manage teachers"
ON public.teachers
FOR ALL
USING (true);

-- Drop existing policies for students
DROP POLICY IF EXISTS "Admins and teachers can view all students" ON public.students;
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Parents can view their own children" ON public.students;

-- Create public access policies for students
CREATE POLICY "Anyone can view students"
ON public.students
FOR SELECT
USING (true);

CREATE POLICY "Anyone can manage students"
ON public.students
FOR ALL
USING (true);

-- Drop existing policies for marks
DROP POLICY IF EXISTS "Admins can manage all marks" ON public.marks;
DROP POLICY IF EXISTS "Teachers can manage marks for their classes" ON public.marks;
DROP POLICY IF EXISTS "Parents can view their children marks" ON public.marks;

-- Create public access policies for marks
CREATE POLICY "Anyone can view marks"
ON public.marks
FOR SELECT
USING (true);

CREATE POLICY "Anyone can manage marks"
ON public.marks
FOR ALL
USING (true);

-- Drop existing policies for feedback
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Teachers can view feedback" ON public.feedback;
DROP POLICY IF EXISTS "Parents can manage their own feedback" ON public.feedback;

-- Create public access policies for feedback
CREATE POLICY "Anyone can view feedback"
ON public.feedback
FOR SELECT
USING (true);

CREATE POLICY "Anyone can manage feedback"
ON public.feedback
FOR ALL
USING (true);

-- Drop existing policies for parents
DROP POLICY IF EXISTS "Admins can manage parents" ON public.parents;
DROP POLICY IF EXISTS "Parents can view their own record" ON public.parents;

-- Create public access policies for parents
CREATE POLICY "Anyone can view parents"
ON public.parents
FOR SELECT
USING (true);

CREATE POLICY "Anyone can manage parents"
ON public.parents
FOR ALL
USING (true);
