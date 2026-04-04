
-- Trigger function: auto-correct stream on marks insert/update
CREATE OR REPLACE FUNCTION public.enforce_student_stream_on_marks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actual_stream text;
  actual_class text;
BEGIN
  SELECT s.stream, s.class INTO actual_stream, actual_class
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF FOUND THEN
    NEW.stream := actual_stream;
    NEW.class := actual_class;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger function: auto-correct stream on teacher_class_students insert/update
CREATE OR REPLACE FUNCTION public.enforce_student_stream_on_tcs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actual_stream text;
  actual_class text;
BEGIN
  SELECT s.stream, s.class INTO actual_stream, actual_class
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF FOUND THEN
    NEW.stream := actual_stream;
    NEW.class := actual_class;
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trg_enforce_stream_marks
  BEFORE INSERT OR UPDATE ON public.marks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_student_stream_on_marks();

CREATE TRIGGER trg_enforce_stream_tcs
  BEFORE INSERT OR UPDATE ON public.teacher_class_students
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_student_stream_on_tcs();
