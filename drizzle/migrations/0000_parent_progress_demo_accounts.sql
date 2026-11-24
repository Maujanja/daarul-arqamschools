CREATE TABLE public.parent_progress_demo_accounts (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  academic_year text NOT NULL,
  marks jsonb NOT NULL,
  releases jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.parent_progress_demo_accounts TO service_role;
REVOKE ALL ON public.parent_progress_demo_accounts FROM anon, authenticated;
ALTER TABLE public.parent_progress_demo_accounts ENABLE ROW LEVEL SECURITY;