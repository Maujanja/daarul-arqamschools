
-- Add media and link support to announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS link_url text;

-- Create public bucket for announcement media
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-media', 'announcement-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (UI-gated, admin-only screen)
DROP POLICY IF EXISTS "Public read announcement media" ON storage.objects;
CREATE POLICY "Public read announcement media"
ON storage.objects FOR SELECT
USING (bucket_id = 'announcement-media');

DROP POLICY IF EXISTS "Public insert announcement media" ON storage.objects;
CREATE POLICY "Public insert announcement media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'announcement-media');

DROP POLICY IF EXISTS "Public update announcement media" ON storage.objects;
CREATE POLICY "Public update announcement media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'announcement-media');

DROP POLICY IF EXISTS "Public delete announcement media" ON storage.objects;
CREATE POLICY "Public delete announcement media"
ON storage.objects FOR DELETE
USING (bucket_id = 'announcement-media');
