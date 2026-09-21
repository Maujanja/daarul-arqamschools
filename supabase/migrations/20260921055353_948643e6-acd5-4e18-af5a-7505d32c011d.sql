ALTER TABLE public.dormitories
  ADD COLUMN IF NOT EXISTS section text,
  ADD COLUMN IF NOT EXISTS room_count integer;

UPDATE public.dormitories SET section = 'primary' WHERE section IS NULL;
UPDATE public.dormitories SET room_count = 11 WHERE room_count IS NULL;

ALTER TABLE public.dormitories
  ALTER COLUMN section SET DEFAULT 'primary',
  ALTER COLUMN section SET NOT NULL,
  ALTER COLUMN room_count SET DEFAULT 11,
  ALTER COLUMN room_count SET NOT NULL;

ALTER TABLE public.dormitories
  ADD CONSTRAINT dormitories_section_check CHECK (section IN ('nursery', 'primary', 'secondary')),
  ADD CONSTRAINT dormitories_room_count_check CHECK (room_count >= 1 AND room_count <= 100);

CREATE OR REPLACE FUNCTION public.recalc_dorm_rooms(_dormitory_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer;
  rooms integer;
  per_room integer;
BEGIN
  SELECT count(*) INTO total FROM public.dorm_beds WHERE dormitory_id = _dormitory_id;
  IF total = 0 THEN RETURN; END IF;

  SELECT GREATEST(1, room_count) INTO rooms FROM public.dormitories WHERE id = _dormitory_id;
  IF rooms IS NULL THEN rooms := 11; END IF;
  IF rooms > total THEN rooms := total; END IF;
  per_room := CEIL(total::numeric / rooms);

  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY bed_number) AS rn
    FROM public.dorm_beds
    WHERE dormitory_id = _dormitory_id
  )
  UPDATE public.dorm_beds b
  SET room_number = LEAST(rooms, ((o.rn - 1) / per_room) + 1)
  FROM ordered o
  WHERE b.id = o.id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_dorm_rooms(uuid) FROM anon, authenticated;

-- Recalculate existing dormitories with their stored room counts
SELECT public.recalc_dorm_rooms(id) FROM public.dormitories;