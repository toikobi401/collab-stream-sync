-- Create playlist videos table for room video management
CREATE TABLE IF NOT EXISTS public.room_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  video_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  duration NUMERIC,
  video_order INTEGER NOT NULL DEFAULT 1,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(room_id, video_order)
);

-- Enable RLS on room_videos
ALTER TABLE public.room_videos ENABLE ROW LEVEL SECURITY;

-- RLS policies for room_videos
CREATE POLICY "Room members can view room videos" 
ON public.room_videos 
FOR SELECT 
USING (
  room_id IN (
    SELECT room_id FROM public.get_user_room_membership(auth.uid())
  )
);

CREATE POLICY "Room members can upload videos" 
ON public.room_videos 
FOR INSERT 
WITH CHECK (
  auth.uid() = uploaded_by AND
  room_id IN (
    SELECT room_id FROM public.get_user_room_membership(auth.uid())
  )
);

CREATE POLICY "Video uploaders can update their videos" 
ON public.room_videos 
FOR UPDATE 
USING (auth.uid() = uploaded_by);

CREATE POLICY "Video uploaders can delete their videos" 
ON public.room_videos 
FOR DELETE 
USING (auth.uid() = uploaded_by);

-- Add current video index to room_state
ALTER TABLE public.room_state 
ADD COLUMN IF NOT EXISTS current_video_index INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS playlist_mode BOOLEAN DEFAULT false;

-- Update room_state RLS policy to allow room members to update playlist controls
DROP POLICY IF EXISTS "Host can update room state" ON public.room_state;

CREATE POLICY "Room members can update room state" 
ON public.room_state 
FOR UPDATE 
USING (
  room_id IN (
    SELECT room_id FROM public.get_user_room_membership(auth.uid())
  )
);

-- Function to validate total file size per room (10GB limit)
CREATE OR REPLACE FUNCTION public.check_room_storage_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_size BIGINT;
  max_size BIGINT := 10737418240; -- 10GB in bytes
  video_count INTEGER;
BEGIN
  -- Get current total size and count for the room
  SELECT COALESCE(SUM(file_size), 0), COUNT(*) 
  INTO total_size, video_count
  FROM public.room_videos 
  WHERE room_id = NEW.room_id;
  
  -- Check video count limit (5 videos max)
  IF video_count >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 videos allowed per room';
  END IF;
  
  -- Check total size limit
  IF (total_size + NEW.file_size) > max_size THEN
    RAISE EXCEPTION 'Total video size would exceed 10GB limit for this room';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for storage validation
CREATE TRIGGER check_room_storage_before_insert
  BEFORE INSERT ON public.room_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.check_room_storage_limit();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_room_videos_room_id ON public.room_videos(room_id);
CREATE INDEX IF NOT EXISTS idx_room_videos_order ON public.room_videos(room_id, video_order);