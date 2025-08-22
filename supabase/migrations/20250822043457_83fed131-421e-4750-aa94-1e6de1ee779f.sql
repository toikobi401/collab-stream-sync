-- Add room creation limits and file storage support
CREATE TABLE IF NOT EXISTS public.storage_buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert video storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('room-videos', 'room-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Add room limits table to track active rooms
CREATE TABLE IF NOT EXISTS public.room_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_rooms INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default room limit
INSERT INTO public.room_limits (max_rooms) 
VALUES (3)
ON CONFLICT DO NOTHING;

-- Add creator tracking to rooms
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- Add file info to room state
ALTER TABLE public.room_state 
ADD COLUMN IF NOT EXISTS video_filename TEXT,
ADD COLUMN IF NOT EXISTS video_type TEXT DEFAULT 'url';

-- Function to check room limits
CREATE OR REPLACE FUNCTION public.check_room_limit()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for room limit checking
DROP TRIGGER IF EXISTS check_room_limit_trigger ON public.rooms;
CREATE TRIGGER check_room_limit_trigger
  BEFORE INSERT ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.check_room_limit();

-- Storage policies for video uploads
CREATE POLICY "Room members can view videos" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'room-videos' AND 
  EXISTS (
    SELECT 1 FROM public.room_members rm 
    WHERE rm.user_id = auth.uid() 
    AND (storage.foldername(name))[1] = rm.room_id::text
  )
);

CREATE POLICY "Room hosts can upload videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'room-videos' AND 
  EXISTS (
    SELECT 1 FROM public.room_state rs 
    WHERE rs.host_user_id = auth.uid() 
    AND (storage.foldername(name))[1] = rs.room_id::text
  )
);

CREATE POLICY "Room hosts can update videos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'room-videos' AND 
  EXISTS (
    SELECT 1 FROM public.room_state rs 
    WHERE rs.host_user_id = auth.uid() 
    AND (storage.foldername(name))[1] = rs.room_id::text
  )
);

CREATE POLICY "Room hosts can delete videos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'room-videos' AND 
  EXISTS (
    SELECT 1 FROM public.room_state rs 
    WHERE rs.host_user_id = auth.uid() 
    AND (storage.foldername(name))[1] = rs.room_id::text
  )
);