-- Enable INSERT and UPDATE for secretary_credentials so admin can manage them
CREATE POLICY "Allow admin insert secretary" 
ON public.secretary_credentials 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow admin update secretary" 
ON public.secretary_credentials 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow admin delete secretary" 
ON public.secretary_credentials 
FOR DELETE 
USING (true);