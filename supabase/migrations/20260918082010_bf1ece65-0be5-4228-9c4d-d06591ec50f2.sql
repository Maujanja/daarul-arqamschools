ALTER TABLE public.dorm_beds
  ADD COLUMN IF NOT EXISTS room_number integer,
  ADD COLUMN IF NOT EXISTS bed_code text;

CREATE UNIQUE INDEX IF NOT EXISTS dorm_beds_code_unique
  ON public.dorm_beds (dormitory_id, bed_code)
  WHERE bed_code IS NOT NULL;