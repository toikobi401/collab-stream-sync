-- Add RLS policy to allow host to delete rooms
CREATE POLICY "Host can delete room" 
ON public.rooms 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.room_state rs 
    WHERE rs.room_id = rooms.id 
    AND rs.host_user_id = auth.uid()
  )
);

-- Add function to cleanup room data when room is deleted
CREATE OR REPLACE FUNCTION public.cleanup_room_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete room videos (storage files should be handled separately)
  DELETE FROM public.room_videos WHERE room_id = OLD.id;
  
  -- Delete room members
  DELETE FROM public.room_members WHERE room_id = OLD.id;
  
  -- Delete room state
  DELETE FROM public.room_state WHERE room_id = OLD.id;
  
  -- Delete host lock
  DELETE FROM public.host_lock WHERE room_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;