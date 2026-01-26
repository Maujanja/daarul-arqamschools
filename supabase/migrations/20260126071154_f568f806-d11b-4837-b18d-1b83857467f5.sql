-- Drop existing permissive SELECT policies and create restrictive ones
-- These tables should NOT be publicly readable - they contain sensitive data

-- STUDENTS table - contains personal information
DROP POLICY IF EXISTS "Allow read students" ON public.students;
CREATE POLICY "No direct SELECT on students" 
  ON public.students FOR SELECT 
  USING (false);

-- TEACHERS table - contains password hashes
DROP POLICY IF EXISTS "Allow read teachers for app" ON public.teachers;
CREATE POLICY "No direct SELECT on teachers" 
  ON public.teachers FOR SELECT 
  USING (false);

-- PARENTS table - contains contact information
DROP POLICY IF EXISTS "Allow read parents" ON public.parents;
CREATE POLICY "No direct SELECT on parents" 
  ON public.parents FOR SELECT 
  USING (false);

-- MARKS table - contains academic records
DROP POLICY IF EXISTS "Allow read marks" ON public.marks;
CREATE POLICY "No direct SELECT on marks" 
  ON public.marks FOR SELECT 
  USING (false);

-- FEE_PAYMENTS table - contains financial records
DROP POLICY IF EXISTS "Allow read fee_payments" ON public.fee_payments;
CREATE POLICY "No direct SELECT on fee_payments" 
  ON public.fee_payments FOR SELECT 
  USING (false);

-- FEEDBACK table - contains private communications
DROP POLICY IF EXISTS "Allow read feedback" ON public.feedback;
CREATE POLICY "No direct SELECT on feedback" 
  ON public.feedback FOR SELECT 
  USING (false);

-- STUDENT_DEBT_HISTORY table - contains financial records
DROP POLICY IF EXISTS "Allow read student_debt_history" ON public.student_debt_history;
CREATE POLICY "No direct SELECT on student_debt_history" 
  ON public.student_debt_history FOR SELECT 
  USING (false);

-- TEACHER_CLASS_STUDENTS table - contains assignment data
DROP POLICY IF EXISTS "Allow read teacher_class_students" ON public.teacher_class_students;
CREATE POLICY "No direct SELECT on teacher_class_students" 
  ON public.teacher_class_students FOR SELECT 
  USING (false);

-- TEACHER_ASSIGNMENTS table - contains assignment data
DROP POLICY IF EXISTS "Allow read teacher_assignments" ON public.teacher_assignments;
CREATE POLICY "No direct SELECT on teacher_assignments" 
  ON public.teacher_assignments FOR SELECT 
  USING (false);