-- Add academic year, visibility type and expiry date to announcements
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS academic_year text DEFAULT '2025-2026',
ADD COLUMN IF NOT EXISTS visibility_type text DEFAULT 'yearly',
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Create function to calculate expiry date based on visibility type
CREATE OR REPLACE FUNCTION public.calculate_announcement_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.visibility_type = 'weekly' THEN
        NEW.expires_at = NEW.created_at + INTERVAL '7 days';
    ELSIF NEW.visibility_type = 'monthly' THEN
        NEW.expires_at = NEW.created_at + INTERVAL '30 days';
    ELSIF NEW.visibility_type = 'yearly' THEN
        NEW.expires_at = NEW.created_at + INTERVAL '365 days';
    ELSE
        NEW.expires_at = NULL; -- No expiry
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic expiry calculation
DROP TRIGGER IF EXISTS set_announcement_expiry ON public.announcements;
CREATE TRIGGER set_announcement_expiry
    BEFORE INSERT OR UPDATE OF visibility_type ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_announcement_expiry();

-- Update existing announcements to have yearly visibility and set expiry
UPDATE public.announcements 
SET visibility_type = 'yearly', 
    expires_at = created_at + INTERVAL '365 days'
WHERE expires_at IS NULL;