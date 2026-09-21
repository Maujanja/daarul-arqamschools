ALTER TABLE public.marks_entry_windows ADD COLUMN exam_date date;

UPDATE public.marks_entry_windows AS w
SET exam_date = historical.first_entry_date
FROM (
  SELECT class, term, academic_year, MIN(created_at)::date AS first_entry_date
  FROM public.marks
  GROUP BY class, term, academic_year
) AS historical
WHERE w.class = historical.class
  AND w.term = historical.term
  AND w.academic_year = historical.academic_year
  AND w.exam_date IS NULL;

INSERT INTO public.marks_entry_windows (
  class,
  term,
  academic_year,
  is_open,
  exam_date,
  notes
)
SELECT
  historical.class,
  historical.term,
  historical.academic_year,
  false,
  historical.first_entry_date,
  'Historical Series date inferred from the earliest recorded mark.'
FROM (
  SELECT class, term, academic_year, MIN(created_at)::date AS first_entry_date
  FROM public.marks
  GROUP BY class, term, academic_year
) AS historical
WHERE NOT EXISTS (
  SELECT 1
  FROM public.marks_entry_windows AS w
  WHERE w.class = historical.class
    AND w.term = historical.term
    AND w.academic_year = historical.academic_year
);