-- Create academic_years table to manage academic years dynamically
CREATE TABLE public.academic_years (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    year_name text NOT NULL UNIQUE,
    is_current boolean NOT NULL DEFAULT false,
    start_date date,
    end_date date,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

-- Create policies for viewing and managing
CREATE POLICY "Anyone can view academic_years" 
ON public.academic_years 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage academic_years" 
ON public.academic_years 
FOR ALL 
USING (true);

-- Insert existing academic years
INSERT INTO public.academic_years (year_name, is_current) VALUES
('2024-2025', true),
('2023-2024', false),
('2022-2023', false);