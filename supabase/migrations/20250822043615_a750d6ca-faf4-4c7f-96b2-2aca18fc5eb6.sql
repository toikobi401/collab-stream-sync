-- Fix security issues: Add search_path and enable RLS on new tables

-- Fix function search paths
CREATE OR REPLACE FUNCTION public.is_room_member(room_id_param TEXT)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_members rm 
    WHERE rm.user_id = auth.uid() 
    AND rm.room_id::text = room_id_param
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_room_host(room_id_param TEXT)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_state rs 
    WHERE rs.host_user_id = auth.uid() 
    AND rs.room_id::text = room_id_param
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_room_limit()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get current room count
  SELECT COUNT(*) INTO current_count 
  FROM public.rooms 
  WHERE enabled = true;
  
  -- Get max allowed rooms
  SELECT max_rooms INTO max_allowed 
  FROM public.room_limits 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Maximum number of rooms (%) reached', max_allowed;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Enable RLS on new tables
ALTER TABLE public.room_limits ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for room_limits
CREATE POLICY "Anyone can view room limits" 
ON public.room_limits 
FOR SELECT 
USING (true);

CREATE POLICY "Only authenticated users can update room limits" 
ON public.room_limits 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Drop the temporary storage_buckets table (not needed as storage.buckets already exists)
DROP TABLE IF EXISTS public.storage_buckets;