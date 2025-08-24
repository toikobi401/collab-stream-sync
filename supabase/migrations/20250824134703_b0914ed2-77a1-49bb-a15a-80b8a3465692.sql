-- Enable RLS on security_config table and set appropriate policies
ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read security config
CREATE POLICY "Authenticated users can view security config" 
ON public.security_config 
FOR SELECT 
TO authenticated
USING (true);

-- Only allow admins to modify security config (using has_role function)
CREATE POLICY "Admins can manage security config" 
ON public.security_config 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));