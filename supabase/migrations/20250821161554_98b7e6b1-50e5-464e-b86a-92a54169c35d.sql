-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nickname)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nickname', 'User'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  room_capacity INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count 
  FROM public.room_members 
  WHERE room_id = NEW.room_id;
  
  SELECT capacity INTO room_capacity 
  FROM public.rooms 
  WHERE id = NEW.room_id;
  
  IF current_count >= room_capacity THEN
    RAISE EXCEPTION 'Room is full (%). Maximum capacity is %', current_count, room_capacity;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.claim_host(room_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_host UUID;
BEGIN
  -- Check if there's already a host
  SELECT host_user_id INTO current_host 
  FROM public.room_state 
  WHERE room_id = room_id_param;
  
  IF current_host IS NOT NULL THEN
    RETURN FALSE; -- Host already exists
  END IF;
  
  -- Claim host
  INSERT INTO public.host_lock (room_id, host_user_id) 
  VALUES (room_id_param, auth.uid())
  ON CONFLICT (room_id) DO NOTHING;
  
  UPDATE public.room_state 
  SET host_user_id = auth.uid() 
  WHERE room_id = room_id_param;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.transfer_host(room_id_param UUID, new_host_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_host UUID;
BEGIN
  -- Check if caller is current host
  SELECT host_user_id INTO current_host 
  FROM public.room_state 
  WHERE room_id = room_id_param;
  
  IF current_host != auth.uid() THEN
    RETURN FALSE; -- Not current host
  END IF;
  
  -- Transfer host
  UPDATE public.host_lock 
  SET host_user_id = new_host_id 
  WHERE room_id = room_id_param;
  
  UPDATE public.room_state 
  SET host_user_id = new_host_id 
  WHERE room_id = room_id_param;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable realtime for room sync
ALTER TABLE public.room_state REPLICA IDENTITY FULL;
ALTER TABLE public.room_members REPLICA IDENTITY FULL;
ALTER TABLE public.host_lock REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.host_lock;