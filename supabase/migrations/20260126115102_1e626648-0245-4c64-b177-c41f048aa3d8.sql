-- Add avatar_url column to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create storage bucket for student avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-avatars', 'student-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload student avatars
CREATE POLICY "Allow authenticated uploads to student-avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-avatars');

-- Allow public read access to student avatars
CREATE POLICY "Allow public read access to student-avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'student-avatars');

-- Allow authenticated users to update student avatars
CREATE POLICY "Allow authenticated updates to student-avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'student-avatars');

-- Allow authenticated users to delete student avatars
CREATE POLICY "Allow authenticated deletes to student-avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'student-avatars');