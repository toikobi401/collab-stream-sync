-- Fix infinite recursion in RLS policies by using security definer functions
-- and establish proper foreign key relationships

-- Create security definer functions to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_user_room_membership(_user_id UUID)
RETURNS TABLE(room_id UUID)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rm.room_id
  FROM public.room_members rm
  WHERE rm.user_id = _user_id;
$$;

-- Add foreign key constraint between room_members and profiles
ALTER TABLE public.room_members 
ADD CONSTRAINT fk_room_members_profiles 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Add foreign key constraint between room_members and rooms
ALTER TABLE public.room_members 
ADD CONSTRAINT fk_room_members_rooms 
FOREIGN KEY (room_id) REFERENCES public.rooms(id) 
ON DELETE CASCADE;

-- Drop and recreate the problematic RLS policy to avoid infinite recursion
DROP POLICY IF EXISTS "Users can view room members" ON public.room_members;

-- Create new policy that doesn't cause infinite recursion
CREATE POLICY "Users can view room members" 
ON public.room_members 
FOR SELECT 
USING (
  room_id IN (
    SELECT room_id FROM public.get_user_room_membership(auth.uid())
  )
);

-- Fix room_state RLS policy to avoid infinite recursion as well
DROP POLICY IF EXISTS "Room members can view room state" ON public.room_state;

CREATE POLICY "Room members can view room state" 
ON public.room_state 
FOR SELECT 
USING (
  room_id IN (
    SELECT room_id FROM public.get_user_room_membership(auth.uid())
  )
);

-- Fix host_lock RLS policy 
DROP POLICY IF EXISTS "Room members can view host lock" ON public.host_lock;

CREATE POLICY "Room members can view host lock" 
ON public.host_lock 
FOR SELECT 
USING (
  room_id IN (
    SELECT room_id FROM public.get_user_room_membership(auth.uid())
  )
);