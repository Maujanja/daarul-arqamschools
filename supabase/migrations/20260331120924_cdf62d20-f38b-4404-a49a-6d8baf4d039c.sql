
CREATE TABLE public.family_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.family_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL DEFAULT '2025-2026',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, academic_year)
);

CREATE TABLE public.family_group_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_group_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct SELECT on family_groups" ON public.family_groups FOR SELECT TO public USING (false);
CREATE POLICY "No direct INSERT on family_groups" ON public.family_groups FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "No direct UPDATE on family_groups" ON public.family_groups FOR UPDATE TO public USING (false);
CREATE POLICY "No direct DELETE on family_groups" ON public.family_groups FOR DELETE TO public USING (false);

CREATE POLICY "No direct SELECT on family_group_members" ON public.family_group_members FOR SELECT TO public USING (false);
CREATE POLICY "No direct INSERT on family_group_members" ON public.family_group_members FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "No direct UPDATE on family_group_members" ON public.family_group_members FOR UPDATE TO public USING (false);
CREATE POLICY "No direct DELETE on family_group_members" ON public.family_group_members FOR DELETE TO public USING (false);

CREATE POLICY "No direct SELECT on family_group_installments" ON public.family_group_installments FOR SELECT TO public USING (false);
CREATE POLICY "No direct INSERT on family_group_installments" ON public.family_group_installments FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "No direct UPDATE on family_group_installments" ON public.family_group_installments FOR UPDATE TO public USING (false);
CREATE POLICY "No direct DELETE on family_group_installments" ON public.family_group_installments FOR DELETE TO public USING (false);
