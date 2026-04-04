
-- Create a function to normalize marks and teacher_class_students streams
-- This updates stream values to match the student's actual stream
CREATE OR REPLACE FUNCTION public.normalize_marks_streams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Fix marks: set stream to match the student's actual stream
  UPDATE marks m
  SET stream = s.stream
  FROM students s
  WHERE m.student_id = s.id
    AND COALESCE(m.stream, '') != COALESCE(s.stream, '');

  -- Fix teacher_class_students: set stream to match the student's actual stream
  UPDATE teacher_class_students tcs
  SET stream = s.stream
  FROM students s
  WHERE tcs.student_id = s.id
    AND COALESCE(tcs.stream, '') != COALESCE(s.stream, '');
END;
$$;

-- Run the cleanup now
SELECT public.normalize_marks_streams();
