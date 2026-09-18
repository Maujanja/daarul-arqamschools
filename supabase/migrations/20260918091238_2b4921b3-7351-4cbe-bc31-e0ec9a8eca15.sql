CREATE OR REPLACE FUNCTION public.recalc_dorm_rooms(_dormitory_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer;
  per_room integer;
BEGIN
  SELECT count(*) INTO total FROM public.dorm_beds WHERE dormitory_id = _dormitory_id;
  IF total = 0 THEN RETURN; END IF;

  per_room := GREATEST(1, CEIL(total::numeric / 11)::integer);

  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY bed_number) AS rn
    FROM public.dorm_beds
    WHERE dormitory_id = _dormitory_id
  )
  UPDATE public.dorm_beds b
  SET room_number = LEAST(11, ((o.rn - 1) / per_room) + 1)
  FROM ordered o
  WHERE b.id = o.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_dorm_beds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.dorm_beds (dormitory_id, bed_number)
  SELECT NEW.id, gs
  FROM generate_series(1, NEW.capacity) AS gs
  ON CONFLICT (dormitory_id, bed_number) DO NOTHING;

  DELETE FROM public.dorm_beds b
  WHERE b.dormitory_id = NEW.id
    AND b.bed_number > NEW.capacity
    AND NOT EXISTS (SELECT 1 FROM public.dorm_assignments a WHERE a.bed_id = b.id);

  PERFORM public.recalc_dorm_rooms(NEW.id);

  RETURN NEW;
END;
$$;

DO $$
DECLARE d record;
BEGIN
  FOR d IN SELECT id FROM public.dormitories LOOP
    PERFORM public.recalc_dorm_rooms(d.id);
  END LOOP;
END $$;