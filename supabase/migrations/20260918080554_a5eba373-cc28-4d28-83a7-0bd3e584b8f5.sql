-- Dormitories
CREATE TABLE public.dormitories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gender text NOT NULL DEFAULT 'male',
  capacity integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dormitories_name_key UNIQUE (name),
  CONSTRAINT dormitories_gender_check CHECK (gender IN ('male','female')),
  CONSTRAINT dormitories_capacity_check CHECK (capacity >= 0 AND capacity <= 500)
);
GRANT ALL ON public.dormitories TO service_role;
ALTER TABLE public.dormitories ENABLE ROW LEVEL SECURITY;

-- Beds
CREATE TABLE public.dorm_beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dormitory_id uuid NOT NULL REFERENCES public.dormitories(id) ON DELETE CASCADE,
  bed_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dorm_beds_unique UNIQUE (dormitory_id, bed_number)
);
GRANT ALL ON public.dorm_beds TO service_role;
ALTER TABLE public.dorm_beds ENABLE ROW LEVEL SECURITY;
CREATE INDEX dorm_beds_dormitory_idx ON public.dorm_beds(dormitory_id);

-- Assignments
CREATE TABLE public.dorm_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  dormitory_id uuid NOT NULL REFERENCES public.dormitories(id) ON DELETE CASCADE,
  bed_id uuid NOT NULL REFERENCES public.dorm_beds(id) ON DELETE CASCADE,
  academic_year text NOT NULL DEFAULT '2025-2026',
  assigned_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dorm_assignments_bed_unique UNIQUE (bed_id, academic_year),
  CONSTRAINT dorm_assignments_student_unique UNIQUE (student_id, academic_year)
);
GRANT ALL ON public.dorm_assignments TO service_role;
ALTER TABLE public.dorm_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX dorm_assignments_student_idx ON public.dorm_assignments(student_id);
CREATE INDEX dorm_assignments_dorm_idx ON public.dorm_assignments(dormitory_id);

-- Keep bed list in sync with capacity
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER dormitories_sync_beds
AFTER INSERT OR UPDATE OF capacity ON public.dormitories
FOR EACH ROW EXECUTE FUNCTION public.sync_dorm_beds();

CREATE TRIGGER dormitories_updated_at
BEFORE UPDATE ON public.dormitories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER dorm_assignments_updated_at
BEFORE UPDATE ON public.dorm_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validate assignment: bed belongs to dormitory, gender matches, student is boarding
CREATE OR REPLACE FUNCTION public.validate_dorm_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bed_dorm uuid;
  dorm_gender text;
  stud_gender text;
BEGIN
  SELECT dormitory_id INTO bed_dorm FROM public.dorm_beds WHERE id = NEW.bed_id;
  IF bed_dorm IS NULL OR bed_dorm <> NEW.dormitory_id THEN
    RAISE EXCEPTION 'Selected bed does not belong to the selected dormitory';
  END IF;

  SELECT gender INTO dorm_gender FROM public.dormitories WHERE id = NEW.dormitory_id;
  SELECT lower(coalesce(gender, '')) INTO stud_gender FROM public.students WHERE id = NEW.student_id;

  IF stud_gender IN ('male','female') AND dorm_gender IS NOT NULL AND stud_gender <> dorm_gender THEN
    RAISE EXCEPTION 'This dormitory is for % students only', dorm_gender;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER dorm_assignments_validate
BEFORE INSERT OR UPDATE ON public.dorm_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_dorm_assignment();