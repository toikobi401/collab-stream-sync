-- Create users profile table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rooms table
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 5,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create room members table
CREATE TABLE public.room_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Create room state table for video sync
CREATE TABLE public.room_state (
  room_id UUID NOT NULL PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  video_url TEXT,
  paused BOOLEAN NOT NULL DEFAULT true,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  playback_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create host lock table to enforce single host
CREATE TABLE public.host_lock (
  room_id UUID NOT NULL PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_lock ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for rooms
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (enabled = true);
CREATE POLICY "Only authenticated users can create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for room members
CREATE POLICY "Users can view room members" ON public.room_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.room_members rm2 
    WHERE rm2.room_id = room_members.room_id AND rm2.user_id = auth.uid()
  )
);
CREATE POLICY "Users can join rooms" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave rooms" ON public.room_members FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for room state
CREATE POLICY "Room members can view room state" ON public.room_state FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.room_members rm 
    WHERE rm.room_id = room_state.room_id AND rm.user_id = auth.uid()
  )
);
CREATE POLICY "Host can update room state" ON public.room_state FOR UPDATE USING (auth.uid() = host_user_id);
CREATE POLICY "Anyone can insert room state" ON public.room_state FOR INSERT WITH CHECK (true);

-- RLS Policies for host lock
CREATE POLICY "Room members can view host lock" ON public.host_lock FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.room_members rm 
    WHERE rm.room_id = host_lock.room_id AND rm.user_id = auth.uid()
  )
);
CREATE POLICY "Users can claim host" ON public.host_lock FOR INSERT WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "Host can update host lock" ON public.host_lock FOR UPDATE USING (auth.uid() = host_user_id);
CREATE POLICY "Host can delete host lock" ON public.host_lock FOR DELETE USING (auth.uid() = host_user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_room_state_updated_at
  BEFORE UPDATE ON public.room_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default room
INSERT INTO public.rooms (id, name, capacity) 
VALUES ('00000000-0000-0000-0000-000000000001', 'room-1', 5);

-- Create room state for default room
INSERT INTO public.room_state (room_id) 
VALUES ('00000000-0000-0000-0000-000000000001');

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nickname)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nickname', 'User'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to check room capacity
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
$$ LANGUAGE plpgsql;

-- Create trigger to enforce room capacity
CREATE TRIGGER enforce_room_capacity
  BEFORE INSERT ON public.room_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_room_capacity();

-- Create function to handle host management
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to transfer host
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
$$ LANGUAGE plpgsql SECURITY DEFINER;