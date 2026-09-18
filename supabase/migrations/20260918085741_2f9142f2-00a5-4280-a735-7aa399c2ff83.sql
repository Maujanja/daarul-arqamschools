DO $$
DECLARE
  up RECORD;
  lo_id uuid;
  pref text;
  startno int;
  r RECORD;
  n int;
  newbed uuid;
BEGIN
  FOR up IN SELECT id, name, gender FROM public.dormitories WHERE name ILIKE 'UPPER%' LOOP
    SELECT id INTO lo_id FROM public.dormitories
      WHERE gender = up.gender AND name ILIKE 'LOWER%' LIMIT 1;
    IF lo_id IS NULL THEN CONTINUE; END IF;

    SELECT COALESCE(MAX(bed_number),0) INTO startno FROM public.dorm_beds WHERE dormitory_id = lo_id;

    SELECT regexp_replace(bed_code, '[0-9]+$', '') INTO pref FROM public.dorm_beds
      WHERE dormitory_id = lo_id AND bed_code IS NOT NULL ORDER BY bed_number DESC LIMIT 1;
    IF pref IS NULL THEN
      pref := CASE WHEN up.gender = 'male' THEN 'DAS/PR/BOYS/' ELSE 'DAS/PR/GIRLS/' END;
    END IF;

    n := startno;
    -- grow capacity so trigger creates the beds
    UPDATE public.dormitories
      SET capacity = startno + (SELECT COUNT(*) FROM public.dorm_assignments WHERE dormitory_id = up.id)
      WHERE id = lo_id;

    FOR r IN
      SELECT a.id AS aid, b.room_number
      FROM public.dorm_assignments a
      JOIN public.dorm_beds b ON b.id = a.bed_id
      WHERE a.dormitory_id = up.id
      ORDER BY b.bed_number
    LOOP
      n := n + 1;
      SELECT id INTO newbed FROM public.dorm_beds WHERE dormitory_id = lo_id AND bed_number = n;
      IF newbed IS NULL THEN
        INSERT INTO public.dorm_beds (dormitory_id, bed_number) VALUES (lo_id, n) RETURNING id INTO newbed;
      END IF;
      UPDATE public.dorm_beds
        SET room_number = ((n - 1) / 8) + 1,
            bed_code = pref || lpad(n::text, 3, '0')
        WHERE id = newbed;
      UPDATE public.dorm_assignments SET dormitory_id = lo_id, bed_id = newbed WHERE id = r.aid;
    END LOOP;
  END LOOP;

  DELETE FROM public.dorm_beds WHERE dormitory_id IN (SELECT id FROM public.dormitories WHERE name ILIKE 'UPPER%');
  DELETE FROM public.dormitories WHERE name ILIKE 'UPPER%';
END $$;