
-- Add secretary_credentials table
CREATE TABLE public.secretary_credentials (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    username text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.secretary_credentials ENABLE ROW LEVEL SECURITY;

-- Allow read for authentication
CREATE POLICY "Allow read for secretary authentication" 
ON public.secretary_credentials 
FOR SELECT 
USING (true);

-- Create fee_payments table
CREATE TABLE public.fee_payments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount numeric(12, 2) NOT NULL,
    payment_date date NOT NULL DEFAULT CURRENT_DATE,
    payment_method text DEFAULT 'Cash',
    receipt_number text,
    academic_year text NOT NULL,
    term text NOT NULL,
    recorded_by text,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for fee_payments
CREATE POLICY "Anyone can view fee_payments" 
ON public.fee_payments 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage fee_payments" 
ON public.fee_payments 
FOR ALL 
USING (true);

-- Create fee_structure table for expected fees
CREATE TABLE public.fee_structure (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    class text NOT NULL,
    academic_year text NOT NULL,
    term text NOT NULL,
    tuition_fee numeric(12, 2) NOT NULL DEFAULT 0,
    boarding_fee numeric(12, 2) DEFAULT 0,
    other_fees numeric(12, 2) DEFAULT 0,
    total_fee numeric(12, 2) NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(class, academic_year, term)
);

-- Enable RLS
ALTER TABLE public.fee_structure ENABLE ROW LEVEL SECURITY;

-- RLS policies for fee_structure
CREATE POLICY "Anyone can view fee_structure" 
ON public.fee_structure 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage fee_structure" 
ON public.fee_structure 
FOR ALL 
USING (true);

-- Insert default secretary
INSERT INTO public.secretary_credentials (username, password_hash, full_name) 
VALUES ('secretary', 'sec123', 'Katibu wa Shule');

-- Insert sample fee structure for all classes
INSERT INTO public.fee_structure (class, academic_year, term, tuition_fee, boarding_fee, total_fee)
VALUES 
    ('Form 1', '2024-2025', 'Term 1', 500000, 300000, 800000),
    ('Form 2', '2024-2025', 'Term 1', 500000, 300000, 800000),
    ('Form 3', '2024-2025', 'Term 1', 550000, 300000, 850000),
    ('Form 4', '2024-2025', 'Term 1', 600000, 300000, 900000);
