-- Add custom_fee column to students table for individual discounts
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS custom_fee numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS discount_notes text DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.students.custom_fee IS 'Custom fee amount for this student (overrides fee structure). Set by Secretary for discounted students.';
COMMENT ON COLUMN public.students.discount_notes IS 'Notes explaining the discount/custom fee for this student.';