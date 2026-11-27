ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS target_class text,
  ADD COLUMN IF NOT EXISTS media_name text;

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_target_class_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_target_class_check CHECK (
    target_class IS NULL OR target_class IN (
      'Baby Class', 'Kindergarten I', 'Kindergarten II',
      'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7',
      'Senior 1', 'Senior 2', 'Senior 3', 'Senior 4'
    )
  );

DROP POLICY IF EXISTS "Allow read announcements" ON public.announcements;