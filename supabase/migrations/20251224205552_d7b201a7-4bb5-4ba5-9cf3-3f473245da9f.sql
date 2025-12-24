-- Add boarding type column to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS boarding_type text DEFAULT 'day';

-- Create teacher_assignments table for granular class-subject assignments
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class text NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  academic_year text NOT NULL DEFAULT '2024-2025',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, class, subject_id, academic_year)
);

-- Enable RLS on teacher_assignments
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for teacher_assignments
CREATE POLICY "Anyone can view teacher_assignments" ON public.teacher_assignments FOR SELECT USING (true);
CREATE POLICY "Anyone can manage teacher_assignments" ON public.teacher_assignments FOR ALL USING (true);

-- Drop the existing unique constraint on fee_structure to allow boarding_type differentiation
ALTER TABLE public.fee_structure DROP CONSTRAINT IF EXISTS fee_structure_class_academic_year_term_key;

-- Add boarding_type to fee_structure to differentiate fees
ALTER TABLE public.fee_structure ADD COLUMN IF NOT EXISTS boarding_type text DEFAULT 'day';

-- Create new unique constraint including boarding_type
ALTER TABLE public.fee_structure ADD CONSTRAINT fee_structure_class_term_year_boarding_key 
  UNIQUE (class, term, academic_year, boarding_type);