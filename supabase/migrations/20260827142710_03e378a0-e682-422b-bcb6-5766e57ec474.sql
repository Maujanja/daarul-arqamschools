CREATE TABLE public.marks_entry_windows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class text NOT NULL,
  term text NOT NULL,
  academic_year text NOT NULL,
  is_open boolean NOT NULL DEFAULT false,
  opened_by text,
  opened_at timestamp with time zone,
  closed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marks_entry_windows_unique UNIQUE (class, term, academic_year)
);

GRANT ALL ON public.marks_entry_windows TO service_role;
ALTER TABLE public.marks_entry_windows ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_marks_entry_windows_updated_at
BEFORE UPDATE ON public.marks_entry_windows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.parent_login_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid,
  parent_name text,
  student_id uuid,
  student_name text NOT NULL,
  class text NOT NULL,
  stream text,
  roll_number text,
  month_key text NOT NULL,
  logged_in_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.parent_login_events TO service_role;
ALTER TABLE public.parent_login_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_parent_login_events_month ON public.parent_login_events (month_key);
CREATE INDEX idx_parent_login_events_class ON public.parent_login_events (class);
CREATE INDEX idx_parent_login_events_student ON public.parent_login_events (student_id);