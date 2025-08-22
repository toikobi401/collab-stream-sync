-- Fix storage policies (remove existing conflicting ones first)
DROP POLICY IF EXISTS "Room members can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Room hosts can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Room hosts can update videos" ON storage.objects;
DROP POLICY IF EXISTS "Room hosts can delete videos" ON storage.objects;

-- Create storage bucket for room videos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('room-videos', 'room-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Security definer function to check if user is room member
CREATE OR REPLACE FUNCTION public.is_room_member(room_id_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_members rm 
    WHERE rm.user_id = auth.uid() 
    AND rm.room_id::text = room_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Security definer function to check if user is room host
CREATE OR REPLACE FUNCTION public.is_room_host(room_id_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_state rs 
    WHERE rs.host_user_id = auth.uid() 
    AND rs.room_id::text = room_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Storage policies using security definer functions
CREATE POLICY "Room members can view room videos" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'room-videos' AND 
  public.is_room_member((storage.foldername(name))[1])
);

CREATE POLICY "Room hosts can upload room videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'room-videos' AND 
  public.is_room_host((storage.foldername(name))[1])
);

CREATE POLICY "Room hosts can update room videos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'room-videos' AND 
  public.is_room_host((storage.foldername(name))[1])
);

CREATE POLICY "Room hosts can delete room videos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'room-videos' AND 
  public.is_room_host((storage.foldername(name))[1])
);