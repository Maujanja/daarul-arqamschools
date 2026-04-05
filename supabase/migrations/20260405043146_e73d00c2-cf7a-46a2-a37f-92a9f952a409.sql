
-- Fix trigger: only enforce stream, NOT class
CREATE OR REPLACE FUNCTION public.enforce_student_stream_on_marks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actual_stream text;
BEGIN
  SELECT s.stream INTO actual_stream
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF FOUND THEN
    NEW.stream := actual_stream;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix trigger for teacher_class_students: only enforce stream, NOT class
CREATE OR REPLACE FUNCTION public.enforce_student_stream_on_tcs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actual_stream text;
BEGIN
  SELECT s.stream INTO actual_stream
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF FOUND THEN
    NEW.stream := actual_stream;
  END IF;

  RETURN NEW;
END;
$$;

-- Also update normalize function to only fix stream, never class
CREATE OR REPLACE FUNCTION public.normalize_marks_streams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE marks m
  SET stream = s.stream
  FROM students s
  WHERE m.student_id = s.id
    AND COALESCE(m.stream, '') != COALESCE(s.stream, '');

  UPDATE teacher_class_students tcs
  SET stream = s.stream
  FROM students s
  WHERE tcs.student_id = s.id
    AND COALESCE(tcs.stream, '') != COALESCE(s.stream, '');
END;
$$;
