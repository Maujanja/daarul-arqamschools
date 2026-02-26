
-- Add stream column to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS stream text DEFAULT NULL;

-- Add stream column to teacher_assignments table
ALTER TABLE public.teacher_assignments ADD COLUMN IF NOT EXISTS stream text DEFAULT NULL;

-- Add stream column to teacher_class_students table
ALTER TABLE public.teacher_class_students ADD COLUMN IF NOT EXISTS stream text DEFAULT NULL;

-- Add stream column to marks table
ALTER TABLE public.marks ADD COLUMN IF NOT EXISTS stream text DEFAULT NULL;

-- Add stream column to marks_unlock_requests table
ALTER TABLE public.marks_unlock_requests ADD COLUMN IF NOT EXISTS stream text DEFAULT NULL;
