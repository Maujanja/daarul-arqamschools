
CREATE TABLE public.marks_unlock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  teacher_name text NOT NULL,
  class text NOT NULL,
  subject_id uuid NOT NULL,
  subject_name text NOT NULL,
  term text NOT NULL,
  academic_year text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marks_unlock_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct SELECT on marks_unlock_requests" ON public.marks_unlock_requests FOR SELECT USING (false);
CREATE POLICY "No direct INSERT on marks_unlock_requests" ON public.marks_unlock_requests FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct UPDATE on marks_unlock_requests" ON public.marks_unlock_requests FOR UPDATE USING (false);
CREATE POLICY "No direct DELETE on marks_unlock_requests" ON public.marks_unlock_requests FOR DELETE USING (false);
