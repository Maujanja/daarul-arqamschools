
-- Create table to track historical debts from previous academic years
CREATE TABLE public.student_debt_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  term TEXT NOT NULL,
  original_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC NOT NULL DEFAULT 0,
  is_cleared BOOLEAN NOT NULL DEFAULT false,
  cleared_by TEXT,
  cleared_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_debt_history ENABLE ROW LEVEL SECURITY;

-- Create policies for viewing and managing debt history
CREATE POLICY "Anyone can view student_debt_history" 
ON public.student_debt_history 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage student_debt_history" 
ON public.student_debt_history 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_student_debt_history_updated_at
BEFORE UPDATE ON public.student_debt_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_student_debt_history_student ON public.student_debt_history(student_id);
CREATE INDEX idx_student_debt_history_year ON public.student_debt_history(academic_year);
CREATE INDEX idx_student_debt_history_cleared ON public.student_debt_history(is_cleared);
