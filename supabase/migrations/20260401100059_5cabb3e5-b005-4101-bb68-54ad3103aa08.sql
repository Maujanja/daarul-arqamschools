CREATE TABLE IF NOT EXISTS public.result_release_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  term TEXT NOT NULL,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  approved_by_admin BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMP WITH TIME ZONE NULL,
  approved_by UUID NULL,
  notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT result_release_statuses_unique_scope UNIQUE (class_name, academic_year, term)
);

ALTER TABLE public.result_release_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all result release statuses"
ON public.result_release_statuses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create result release statuses"
ON public.result_release_statuses
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update result release statuses"
ON public.result_release_statuses
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete result release statuses"
ON public.result_release_statuses
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_result_release_statuses_scope
ON public.result_release_statuses (academic_year, class_name, term);

CREATE TRIGGER update_result_release_statuses_updated_at
BEFORE UPDATE ON public.result_release_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();