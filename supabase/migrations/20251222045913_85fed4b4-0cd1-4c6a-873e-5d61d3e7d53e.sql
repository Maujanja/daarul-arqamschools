-- Add recipient_type to feedback table to support sending to teacher or secretary
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS recipient_type text NOT NULL DEFAULT 'teacher';

-- Add index for better query performance  
CREATE INDEX IF NOT EXISTS idx_feedback_recipient_type ON public.feedback(recipient_type);