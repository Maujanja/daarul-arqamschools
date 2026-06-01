ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS parent_name text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'internal';

CREATE UNIQUE INDEX IF NOT EXISTS students_external_id_unique
  ON public.students(external_id)
  WHERE external_id IS NOT NULL;