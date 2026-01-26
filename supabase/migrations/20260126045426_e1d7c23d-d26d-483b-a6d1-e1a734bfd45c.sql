-- Fix remaining RLS policies for other tables
-- These tables need more restrictive policies

-- Students table - allow read only, restrict write
DROP POLICY IF EXISTS "Anyone can view students" ON public.students;
DROP POLICY IF EXISTS "Anyone can manage students" ON public.students;

CREATE POLICY "Allow read students"
  ON public.students FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on students"
  ON public.students FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on students"
  ON public.students FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on students"
  ON public.students FOR DELETE
  USING (false);

-- Marks table - allow read only
DROP POLICY IF EXISTS "Anyone can view marks" ON public.marks;
DROP POLICY IF EXISTS "Anyone can manage marks" ON public.marks;

CREATE POLICY "Allow read marks"
  ON public.marks FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on marks"
  ON public.marks FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on marks"
  ON public.marks FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on marks"
  ON public.marks FOR DELETE
  USING (false);

-- Fee payments - allow read only
DROP POLICY IF EXISTS "Anyone can view fee_payments" ON public.fee_payments;
DROP POLICY IF EXISTS "Anyone can manage fee_payments" ON public.fee_payments;

CREATE POLICY "Allow read fee_payments"
  ON public.fee_payments FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on fee_payments"
  ON public.fee_payments FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on fee_payments"
  ON public.fee_payments FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on fee_payments"
  ON public.fee_payments FOR DELETE
  USING (false);

-- Fee structure - allow read only
DROP POLICY IF EXISTS "Anyone can view fee_structure" ON public.fee_structure;
DROP POLICY IF EXISTS "Anyone can manage fee_structure" ON public.fee_structure;

CREATE POLICY "Allow read fee_structure"
  ON public.fee_structure FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on fee_structure"
  ON public.fee_structure FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on fee_structure"
  ON public.fee_structure FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on fee_structure"
  ON public.fee_structure FOR DELETE
  USING (false);

-- Student debt history - allow read only
DROP POLICY IF EXISTS "Anyone can view student_debt_history" ON public.student_debt_history;
DROP POLICY IF EXISTS "Anyone can manage student_debt_history" ON public.student_debt_history;

CREATE POLICY "Allow read student_debt_history"
  ON public.student_debt_history FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on student_debt_history"
  ON public.student_debt_history FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on student_debt_history"
  ON public.student_debt_history FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on student_debt_history"
  ON public.student_debt_history FOR DELETE
  USING (false);

-- Feedback - allow read only
DROP POLICY IF EXISTS "Anyone can view feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can manage feedback" ON public.feedback;

CREATE POLICY "Allow read feedback"
  ON public.feedback FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on feedback"
  ON public.feedback FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on feedback"
  ON public.feedback FOR DELETE
  USING (false);

-- Parents - allow read only
DROP POLICY IF EXISTS "Anyone can view parents" ON public.parents;
DROP POLICY IF EXISTS "Anyone can manage parents" ON public.parents;

CREATE POLICY "Allow read parents"
  ON public.parents FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on parents"
  ON public.parents FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on parents"
  ON public.parents FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on parents"
  ON public.parents FOR DELETE
  USING (false);

-- Teacher assignments - allow read only
DROP POLICY IF EXISTS "Anyone can view teacher_assignments" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Anyone can manage teacher_assignments" ON public.teacher_assignments;

CREATE POLICY "Allow read teacher_assignments"
  ON public.teacher_assignments FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on teacher_assignments"
  ON public.teacher_assignments FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on teacher_assignments"
  ON public.teacher_assignments FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on teacher_assignments"
  ON public.teacher_assignments FOR DELETE
  USING (false);

-- Teacher class students - allow read only
DROP POLICY IF EXISTS "Anyone can view teacher_class_students" ON public.teacher_class_students;
DROP POLICY IF EXISTS "Anyone can manage teacher_class_students" ON public.teacher_class_students;

CREATE POLICY "Allow read teacher_class_students"
  ON public.teacher_class_students FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on teacher_class_students"
  ON public.teacher_class_students FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on teacher_class_students"
  ON public.teacher_class_students FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on teacher_class_students"
  ON public.teacher_class_students FOR DELETE
  USING (false);

-- Subjects - allow read only
DROP POLICY IF EXISTS "Anyone can view subjects" ON public.subjects;
DROP POLICY IF EXISTS "Anyone can manage subjects" ON public.subjects;

CREATE POLICY "Allow read subjects"
  ON public.subjects FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on subjects"
  ON public.subjects FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on subjects"
  ON public.subjects FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on subjects"
  ON public.subjects FOR DELETE
  USING (false);

-- Academic years - allow read only
DROP POLICY IF EXISTS "Anyone can view academic_years" ON public.academic_years;
DROP POLICY IF EXISTS "Anyone can manage academic_years" ON public.academic_years;

CREATE POLICY "Allow read academic_years"
  ON public.academic_years FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on academic_years"
  ON public.academic_years FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on academic_years"
  ON public.academic_years FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on academic_years"
  ON public.academic_years FOR DELETE
  USING (false);

-- Announcements - allow read only
DROP POLICY IF EXISTS "Anyone can view active announcements" ON public.announcements;
DROP POLICY IF EXISTS "Anyone can manage announcements" ON public.announcements;

CREATE POLICY "Allow read announcements"
  ON public.announcements FOR SELECT
  USING (true);

CREATE POLICY "No direct INSERT on announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct UPDATE on announcements"
  ON public.announcements FOR UPDATE
  USING (false);

CREATE POLICY "No direct DELETE on announcements"
  ON public.announcements FOR DELETE
  USING (false);