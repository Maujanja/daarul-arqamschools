
-- Fee installments for class-level (4 installments per class per year)
CREATE TABLE public.fee_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  boarding_type TEXT NOT NULL DEFAULT 'day',
  installment_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(class, academic_year, boarding_type, installment_number)
);

-- Student custom installments for special case students
CREATE TABLE public.student_custom_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  installment_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, academic_year, installment_number)
);

-- RLS policies - block direct access, use edge functions
ALTER TABLE public.fee_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_custom_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct SELECT on fee_installments" ON public.fee_installments FOR SELECT TO public USING (false);
CREATE POLICY "No direct INSERT on fee_installments" ON public.fee_installments FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "No direct UPDATE on fee_installments" ON public.fee_installments FOR UPDATE TO public USING (false);
CREATE POLICY "No direct DELETE on fee_installments" ON public.fee_installments FOR DELETE TO public USING (false);

CREATE POLICY "No direct SELECT on student_custom_installments" ON public.student_custom_installments FOR SELECT TO public USING (false);
CREATE POLICY "No direct INSERT on student_custom_installments" ON public.student_custom_installments FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "No direct UPDATE on student_custom_installments" ON public.student_custom_installments FOR UPDATE TO public USING (false);
CREATE POLICY "No direct DELETE on student_custom_installments" ON public.student_custom_installments FOR DELETE TO public USING (false);
