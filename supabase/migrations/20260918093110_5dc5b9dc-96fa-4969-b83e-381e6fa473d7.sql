CREATE OR REPLACE FUNCTION public.recalc_dorm_rooms(_dormitory_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer;
BEGIN
  SELECT count(*) INTO total FROM public.dorm_beds WHERE dormitory_id = _dormitory_id;
  IF total = 0 THEN RETURN; END IF;

  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY bed_number) AS rn
    FROM public.dorm_beds
    WHERE dormitory_id = _dormitory_id
  )
  UPDATE public.dorm_beds b
  SET room_number = LEAST(11, ((o.rn - 1) / 8) + 1)
  FROM ordered o
  WHERE b.id = o.id;
END;
$$;