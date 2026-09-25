ALTER TABLE public.dormitories
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS bed_type text NOT NULL DEFAULT 'double',
  ADD COLUMN IF NOT EXISTS beds_per_room integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS partitions_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.dormitories DROP CONSTRAINT IF EXISTS dormitories_capacity_check;
ALTER TABLE public.dormitories ADD CONSTRAINT dormitories_capacity_check CHECK (capacity >= 0 AND capacity <= 2000);
ALTER TABLE public.dormitories ADD CONSTRAINT dormitories_bed_type_check CHECK (bed_type IN ('double','single'));
ALTER TABLE public.dormitories ADD CONSTRAINT dormitories_bpr_check CHECK (beds_per_room >= 1 AND beds_per_room <= 50);

ALTER TABLE public.dorm_beds
  ADD COLUMN IF NOT EXISTS bunk_number integer,
  ADD COLUMN IF NOT EXISTS bed_position text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS partition text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available';
ALTER TABLE public.dorm_beds ADD CONSTRAINT dorm_beds_position_check CHECK (bed_position IN ('upper','lower','single'));
ALTER TABLE public.dorm_beds ADD CONSTRAINT dorm_beds_status_check CHECK (status IN ('available','reserved','maintenance','out_of_service'));

ALTER TABLE public.dorm_assignments ADD COLUMN IF NOT EXISTS allocated_at date NOT NULL DEFAULT current_date;

-- Capacity always derived from structure
CREATE OR REPLACE FUNCTION public.dormitory_calc_capacity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.capacity := NEW.room_count * NEW.beds_per_room * (CASE WHEN NEW.bed_type = 'double' THEN 2 ELSE 1 END);
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := upper(left(regexp_replace(NEW.name, '[^A-Za-z]', '', 'g'), 3));
  END IF;
  NEW.code := upper(btrim(NEW.code));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS dormitories_calc_capacity ON public.dormitories;
CREATE TRIGGER dormitories_calc_capacity BEFORE INSERT OR UPDATE ON public.dormitories
FOR EACH ROW EXECUTE FUNCTION public.dormitory_calc_capacity();

-- Regenerate bed spaces: room -> bunk -> position, keeping bed_number order (existing allocations stay in order)
CREATE OR REPLACE FUNCTION public.sync_dorm_beds()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  per_bunk integer := CASE WHEN NEW.bed_type = 'double' THEN 2 ELSE 1 END;
  total integer := NEW.room_count * NEW.beds_per_room * per_bunk;
BEGIN
  UPDATE public.dorm_beds SET bed_code = NULL WHERE dormitory_id = NEW.id;

  INSERT INTO public.dorm_beds (dormitory_id, bed_number)
  SELECT NEW.id, gs FROM generate_series(1, total) gs
  ON CONFLICT (dormitory_id, bed_number) DO NOTHING;

  DELETE FROM public.dorm_beds b
  WHERE b.dormitory_id = NEW.id AND b.bed_number > total
    AND NOT EXISTS (SELECT 1 FROM public.dorm_assignments a WHERE a.bed_id = b.id);

  WITH calc AS (
    SELECT id, bed_number,
      ((bed_number - 1) / (NEW.beds_per_room * per_bunk)) + 1 AS rm,
      (((bed_number - 1) % (NEW.beds_per_room * per_bunk)) / per_bunk) + 1 AS bk,
      CASE WHEN per_bunk = 1 THEN 'single'
           WHEN (bed_number - 1) % 2 = 0 THEN 'upper' ELSE 'lower' END AS pos
    FROM public.dorm_beds WHERE dormitory_id = NEW.id
  )
  UPDATE public.dorm_beds b SET
    room_number = c.rm,
    bunk_number = c.bk,
    bed_position = c.pos,
    bed_code = NEW.code || '-R' || lpad(c.rm::text, 2, '0') || '-B' || lpad(c.bk::text, 2, '0')
               || CASE c.pos WHEN 'upper' THEN '-U' WHEN 'lower' THEN '-L' ELSE '' END
  FROM calc c WHERE b.id = c.id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.student_section(_class text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _class ILIKE 'senior%' OR _class ILIKE 'form%' THEN 'secondary'
              WHEN _class ILIKE 'primary%' THEN 'primary'
              ELSE 'nursery' END
$$;

CREATE OR REPLACE FUNCTION public.validate_dorm_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bed_dorm uuid; bed_status text;
  d record; s record; stud_gender text;
BEGIN
  SELECT dormitory_id, status INTO bed_dorm, bed_status FROM public.dorm_beds WHERE id = NEW.bed_id;
  IF bed_dorm IS NULL OR bed_dorm <> NEW.dormitory_id THEN
    RAISE EXCEPTION 'Selected bed does not belong to the selected dormitory';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.bed_id IS DISTINCT FROM OLD.bed_id THEN
    IF bed_status IN ('maintenance','out_of_service') THEN
      RAISE EXCEPTION 'This bed is under maintenance or out of service';
    END IF;
  END IF;
  SELECT gender, section, is_active INTO d FROM public.dormitories WHERE id = NEW.dormitory_id;
  IF NOT d.is_active THEN RAISE EXCEPTION 'This dormitory is inactive'; END IF;
  SELECT gender, class, boarding_type INTO s FROM public.students WHERE id = NEW.student_id;
  stud_gender := lower(coalesce(s.gender, ''));
  IF stud_gender IN ('male','female') AND stud_gender <> d.gender THEN
    RAISE EXCEPTION 'This dormitory is for % students only', CASE WHEN d.gender='male' THEN 'boys' ELSE 'girls' END;
  END IF;
  IF s.class IS NOT NULL AND public.student_section(s.class) <> d.section THEN
    RAISE EXCEPTION 'This dormitory is for % section students only', d.section;
  END IF;
  IF lower(coalesce(s.boarding_type,'')) = 'day' THEN
    RAISE EXCEPTION 'Only boarding students can be allocated a bed';
  END IF;
  RETURN NEW;
END; $$;

-- History
CREATE TABLE public.dorm_allocation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  academic_year text NOT NULL,
  action text NOT NULL,
  from_dormitory text, from_room integer, from_bed text,
  to_dormitory text, to_room integer, to_bed text,
  reason text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dorm_allocation_history TO service_role;
ALTER TABLE public.dorm_allocation_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX dorm_history_student_idx ON public.dorm_allocation_history(student_id);

CREATE OR REPLACE FUNCTION public.log_dorm_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fd text; fr integer; fb text; td text; tr integer; tb text;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT d.name INTO fd FROM dormitories d WHERE d.id = OLD.dormitory_id;
    SELECT room_number, coalesce(bed_code, 'Bed '||bed_number) INTO fr, fb FROM dorm_beds WHERE id = OLD.bed_id;
  END IF;
  IF TG_OP IN ('UPDATE','INSERT') THEN
    SELECT d.name INTO td FROM dormitories d WHERE d.id = NEW.dormitory_id;
    SELECT room_number, coalesce(bed_code, 'Bed '||bed_number) INTO tr, tb FROM dorm_beds WHERE id = NEW.bed_id;
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO dorm_allocation_history(student_id, academic_year, action, to_dormitory, to_room, to_bed, reason, performed_by)
    VALUES (NEW.student_id, NEW.academic_year, 'allocated', td, tr, tb, NEW.notes, NEW.assigned_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.bed_id IS DISTINCT FROM OLD.bed_id THEN
      INSERT INTO dorm_allocation_history(student_id, academic_year, action, from_dormitory, from_room, from_bed, to_dormitory, to_room, to_bed, reason, performed_by)
      VALUES (NEW.student_id, NEW.academic_year, 'transferred', fd, fr, fb, td, tr, tb, NEW.notes, NEW.assigned_by);
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO dorm_allocation_history(student_id, academic_year, action, from_dormitory, from_room, from_bed, performed_by)
    VALUES (OLD.student_id, OLD.academic_year, 'removed', fd, fr, fb, OLD.assigned_by);
    RETURN OLD;
  END IF;
END; $$;
CREATE TRIGGER dorm_assignments_log AFTER INSERT OR UPDATE OR DELETE ON public.dorm_assignments
FOR EACH ROW EXECUTE FUNCTION public.log_dorm_assignment();

-- Waiting list
CREATE TABLE public.dorm_waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  priority integer NOT NULL DEFAULT 3,
  reason text,
  status text NOT NULL DEFAULT 'waiting',
  added_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dorm_waiting_status_check CHECK (status IN ('waiting','allocated','cancelled')),
  CONSTRAINT dorm_waiting_priority_check CHECK (priority BETWEEN 1 AND 5)
);
GRANT ALL ON public.dorm_waiting_list TO service_role;
ALTER TABLE public.dorm_waiting_list ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX dorm_waiting_unique ON public.dorm_waiting_list(student_id, academic_year) WHERE status = 'waiting';
CREATE TRIGGER dorm_waiting_updated_at BEFORE UPDATE ON public.dorm_waiting_list
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();