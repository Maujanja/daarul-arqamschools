-- Remove the foreign key constraint on feedback.parent_id to allow parents who login via student
-- to send feedback even if they don't have a separate parent record
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_parent_id_fkey;

-- Re-add it without the constraint so any UUID can be used
-- The parent_id will either be a real parent id or the student id (acting as parent identifier)