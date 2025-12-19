-- Add RLS policy for admin_credentials (only allow read for authentication)
CREATE POLICY "Allow read for authentication" 
ON public.admin_credentials 
FOR SELECT 
USING (true);