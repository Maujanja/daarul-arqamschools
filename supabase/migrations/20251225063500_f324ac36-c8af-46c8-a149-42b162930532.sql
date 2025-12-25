-- Create table for teacher's selected students per class/subject
CREATE TABLE public.teacher_class_students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class text NOT NULL,
    subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    academic_year text NOT NULL DEFAULT '2024-2025',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(teacher_id, student_id, class, subject_id, academic_year)
);

-- Enable RLS
ALTER TABLE public.teacher_class_students ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view
CREATE POLICY "Anyone can view teacher_class_students" 
ON public.teacher_class_students 
FOR SELECT 
USING (true);

-- Allow anyone to manage
CREATE POLICY "Anyone can manage teacher_class_students" 
ON public.teacher_class_students 
FOR ALL 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_teacher_class_students_teacher ON public.teacher_class_students(teacher_id);
CREATE INDEX idx_teacher_class_students_class ON public.teacher_class_students(class, subject_id);