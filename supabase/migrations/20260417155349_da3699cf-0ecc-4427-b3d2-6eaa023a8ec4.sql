DO $$
BEGIN
  -- Step 1: Merge conflicts (keep higher mark)
  UPDATE public.marks m_canon
  SET total = GREATEST(m_canon.total, m_dup.total),
      exam = GREATEST(m_canon.exam, m_dup.exam),
      updated_at = now()
  FROM public.marks m_dup
  WHERE m_canon.subject_id = '6f839dbe-5bb4-486e-bf2a-a68df64966bf'
    AND m_dup.subject_id = 'bf3903ca-30ac-4536-baa4-9597b8768be9'
    AND m_canon.student_id = m_dup.student_id
    AND m_canon.term = m_dup.term
    AND m_canon.academic_year = m_dup.academic_year
    AND m_canon.class = 'Senior 2';

  -- Step 2: Move marks from duplicate to canonical (where canonical doesn't exist)
  UPDATE public.marks
  SET subject_id = '6f839dbe-5bb4-486e-bf2a-a68df64966bf', updated_at = now()
  WHERE subject_id = 'bf3903ca-30ac-4536-baa4-9597b8768be9'
    AND class = 'Senior 2'
    AND NOT EXISTS (
      SELECT 1 FROM public.marks m2
      WHERE m2.subject_id = '6f839dbe-5bb4-486e-bf2a-a68df64966bf'
        AND m2.student_id = public.marks.student_id
        AND m2.term = public.marks.term
        AND m2.academic_year = public.marks.academic_year
        AND m2.class = public.marks.class
    );

  -- Step 3: Delete remaining duplicates from SEC-022
  DELETE FROM public.marks WHERE subject_id = 'bf3903ca-30ac-4536-baa4-9597b8768be9' AND class = 'Senior 2';

  -- Step 4: Also clean teacher_class_students duplicates
  DELETE FROM public.teacher_class_students WHERE subject_id = 'bf3903ca-30ac-4536-baa4-9597b8768be9' AND class = 'Senior 2';
  DELETE FROM public.teacher_assignments WHERE subject_id = 'bf3903ca-30ac-4536-baa4-9597b8768be9' AND class = 'Senior 2';
END $$;