-- Fix function search path security issue
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Create trigger to cleanup room data when room is deleted
CREATE TRIGGER cleanup_room_on_delete
  BEFORE DELETE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_room_data();