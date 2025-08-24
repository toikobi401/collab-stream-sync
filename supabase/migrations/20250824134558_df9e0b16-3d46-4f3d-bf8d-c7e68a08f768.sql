-- Security improvements - Configure auth settings

-- Note: These are database-level improvements. 
-- OTP and password protection settings need to be configured in Supabase dashboard

-- Create a simple security info table to document required manual steps
CREATE TABLE IF NOT EXISTS public.security_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_name TEXT NOT NULL,
  required_action TEXT NOT NULL,
  dashboard_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert documentation for manual security steps
INSERT INTO public.security_config (setting_name, required_action, dashboard_location) 
VALUES 
  ('OTP Expiry', 'Set OTP expiry to recommended threshold (15 minutes or less)', 'Authentication > Settings'),
  ('Leaked Password Protection', 'Enable leaked password protection', 'Authentication > Settings > Password Security')
ON CONFLICT DO NOTHING;