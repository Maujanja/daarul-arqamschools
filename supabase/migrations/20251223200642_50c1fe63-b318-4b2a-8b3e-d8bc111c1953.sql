-- Create announcements table for school news/announcements
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'Admin',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active announcements" 
ON public.announcements 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage announcements" 
ON public.announcements 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();