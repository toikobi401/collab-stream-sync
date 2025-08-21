import { supabase } from '@/integrations/supabase/client';
import { Room, RoomState, RoomMember, Profile } from '@/types';

export class SupabaseError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SupabaseError';
  }
}

export const supabaseApi = {
  // Authentication
  signUp: async (email: string, password: string, nickname: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { nickname }
      }
    });
    
    if (error) throw new SupabaseError(error.name || 'SIGNUP_ERROR', error.message);
    return data;
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw new SupabaseError(error.name || 'SIGNIN_ERROR', error.message);
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new SupabaseError(error.name || 'SIGNOUT_ERROR', error.message);
  },

  // Profile
  getProfile: async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) throw new SupabaseError('PROFILE_ERROR', error.message);
    return data;
  },

  updateProfile: async (userId: string, updates: Partial<Profile>) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw new SupabaseError('PROFILE_UPDATE_ERROR', error.message);
    return data;
  },

  // Rooms
  getRoom: async (roomId: string): Promise<Room | null> => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .eq('enabled', true)
      .maybeSingle();
    
    if (error) throw new SupabaseError('ROOM_ERROR', error.message);
    return data;
  },

  getRooms: async (): Promise<Room[]> => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('enabled', true)
      .order('created_at');
    
    if (error) throw new SupabaseError('ROOMS_ERROR', error.message);
    return (data || []).map(room => ({ ...room, members: [], currentMembers: 0 }));
  },

  // Room Members
  joinRoom: async (roomId: string): Promise<void> => {
    const { error } = await supabase
      .from('room_members')
      .insert({
        room_id: roomId,
        user_id: (await supabase.auth.getUser()).data.user?.id
      });
    
    if (error) {
      if (error.message.includes('Room is full')) {
        throw new SupabaseError('ROOM_FULL', 'Room is full. Maximum capacity reached.');
      }
      throw new SupabaseError('JOIN_ERROR', error.message);
    }
  },

  leaveRoom: async (roomId: string): Promise<void> => {
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id);
    
    if (error) throw new SupabaseError('LEAVE_ERROR', error.message);
  },

  getRoomMembers: async (roomId: string): Promise<RoomMember[]> => {
    const { data, error } = await supabase
      .from('room_members')
      .select(`
        *,
        profiles (
          id,
          user_id,
          nickname,
          created_at,
          updated_at
        )
      `)
      .eq('room_id', roomId)
      .order('joined_at');
    
    if (error) throw new SupabaseError('MEMBERS_ERROR', error.message);
    return data || [];
  },

  // Room State
  getRoomState: async (roomId: string): Promise<RoomState | null> => {
    const { data, error } = await supabase
      .from('room_state')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();
    
    if (error) throw new SupabaseError('ROOM_STATE_ERROR', error.message);
    return data;
  },

  updateRoomState: async (roomId: string, updates: Partial<RoomState>): Promise<RoomState> => {
    const { data, error } = await supabase
      .from('room_state')
      .update(updates)
      .eq('room_id', roomId)
      .select()
      .single();
    
    if (error) throw new SupabaseError('UPDATE_STATE_ERROR', error.message);
    return data;
  },

  // Host Management
  claimHost: async (roomId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('claim_host', {
      room_id_param: roomId
    });
    
    if (error) throw new SupabaseError('CLAIM_HOST_ERROR', error.message);
    return data;
  },

  transferHost: async (roomId: string, newHostId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('transfer_host', {
      room_id_param: roomId,
      new_host_id: newHostId
    });
    
    if (error) throw new SupabaseError('TRANSFER_HOST_ERROR', error.message);
    return data;
  },

  // Real-time subscriptions
  subscribeToRoomState: (roomId: string, callback: (state: RoomState) => void) => {
    return supabase
      .channel(`room_state_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_state',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as RoomState);
          }
        }
      )
      .subscribe();
  },

  subscribeToRoomMembers: (roomId: string, callback: (members: RoomMember[]) => void) => {
    return supabase
      .channel(`room_members_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`
        },
        async () => {
          // Refetch members when changes occur
          const members = await supabaseApi.getRoomMembers(roomId);
          callback(members);
        }
      )
      .subscribe();
  }
};