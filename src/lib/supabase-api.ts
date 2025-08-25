import { supabase } from '@/integrations/supabase/client';
import { Room, RoomState, RoomMember, Profile } from '@/types';

export class SupabaseError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SupabaseError';
  }
}

export const supabaseApi = {
  // Traditional authentication
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
    if (!data) return null;
    return { ...data, members: [], currentMembers: 0 };
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
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new SupabaseError('AUTH_ERROR', 'User not authenticated');

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();

    // If already a member, return successfully
    if (existingMember) return;

    const { error } = await supabase
      .from('room_members')
      .insert({
        room_id: roomId,
        user_id: userId
      });
    
    if (error) {
      // Handle duplicate key constraint (in case of race condition)
      if (error.code === '23505') return;
      
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
    // Type assertion needed due to Supabase join query complexity
    return (data || []) as unknown as RoomMember[];
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
  },

  // Room Management
  createRoom: async (name: string): Promise<Room> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new SupabaseError('AUTH_ERROR', 'Not authenticated');

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        name,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('Maximum number of rooms')) {
        throw new SupabaseError('ROOM_LIMIT', 'Maximum number of rooms (3) reached');
      }
      throw new SupabaseError('CREATE_ROOM_ERROR', error.message);
    }

    // Create initial room state
    await supabase
      .from('room_state')
      .insert({
        room_id: data.id,
        paused: true,
        position: 0,
        playback_rate: 1.0
      });

    return { ...data, members: [], currentMembers: 0 };
  },

  getRoomWithMembers: async (roomId: string): Promise<Room | null> => {
    const [room, members] = await Promise.all([
      supabaseApi.getRoom(roomId),
      supabaseApi.getRoomMembers(roomId)
    ]);

    if (!room) return null;

    return {
      ...room,
      members: members.map(m => ({
        id: m.user_id,
        nickname: m.profiles?.nickname || 'Unknown',
        joinedAt: new Date(m.joined_at)
      })),
      currentMembers: members.length
    };
  },

  // File Upload
  // Video Management
  uploadVideo: async (roomId: string, file: File): Promise<string> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new SupabaseError('AUTH_ERROR', 'Not authenticated');

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'application/x-mpegURL'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|ogg|m3u8)$/)) {
      throw new SupabaseError('FILE_TYPE_ERROR', 'Only video files (MP4, WebM, OGG, HLS) are allowed');
    }

    // Upload to storage
    const fileName = `${roomId}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('room-videos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw new SupabaseError('UPLOAD_ERROR', error.message);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('room-videos')
      .getPublicUrl(fileName);

    const videoUrl = urlData.publicUrl;

    // Get current video count for order
    const { data: existingVideos } = await supabase
      .from('room_videos')
      .select('video_order')
      .eq('room_id', roomId)
      .order('video_order', { ascending: false })
      .limit(1);
    
    const nextOrder = existingVideos && existingVideos.length > 0 
      ? existingVideos[0].video_order + 1 
      : 1;
    
    // Add video to room_videos table
    const { error: dbError } = await supabase
      .from('room_videos')
      .insert({
        room_id: roomId,
        video_url: videoUrl,
        video_filename: file.name,
        file_size: file.size,
        video_order: nextOrder,
        uploaded_by: user.id
      });
    
    if (dbError) throw new SupabaseError('DB_ERROR', dbError.message);

    // Update room state to use first video if this is the first upload
    if (nextOrder === 1) {
      const { error: stateError } = await supabase
        .from('room_state')
        .update({
          video_url: videoUrl,
          video_filename: file.name,
          video_type: 'upload',
          playlist_mode: true,
          current_video_index: 1,
          paused: true,
          position: 0
        })
        .eq('room_id', roomId);
      
      if (stateError) throw new SupabaseError('UPDATE_STATE_ERROR', stateError.message);
    }

    return videoUrl;
  },

  uploadMultipleVideos: async (roomId: string, files: File[]): Promise<string[]> => {
    if (files.length > 5) {
      throw new SupabaseError('TOO_MANY_FILES', 'Maximum 5 videos allowed per room');
    }
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
    
    if (totalSize > maxSize) {
      throw new SupabaseError('FILE_TOO_LARGE', 'Total file size exceeds 10GB limit');
    }
    
    const uploadPromises = files.map(async (file) => {
      return await supabaseApi.uploadVideo(roomId, file);
    });
    return Promise.all(uploadPromises);
  },

  getRoomVideos: async (roomId: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('room_videos')
      .select('*')
      .eq('room_id', roomId)
      .order('video_order');
    
    if (error) throw new SupabaseError('FETCH_ERROR', error.message);
    return data || [];
  },

  deleteRoomVideo: async (videoId: string): Promise<void> => {
    // Get video info first
    const { data: video, error: fetchError } = await supabase
      .from('room_videos')
      .select('video_url, room_id')
      .eq('id', videoId)
      .single();
    
    if (fetchError) throw new SupabaseError('FETCH_ERROR', fetchError.message);
    
    // Delete from storage
    const fileName = video.video_url.split('/').pop();
    if (fileName) {
      await supabase.storage
        .from('room-videos')
        .remove([fileName]);
    }
    
    // Delete from database
    const { error: deleteError } = await supabase
      .from('room_videos')
      .delete()
      .eq('id', videoId);
    
    if (deleteError) throw new SupabaseError('DELETE_ERROR', deleteError.message);
  },

  switchToVideo: async (roomId: string, videoIndex: number): Promise<void> => {
    const { data: videos } = await supabase
      .from('room_videos')
      .select('*')
      .eq('room_id', roomId)
      .order('video_order');
    
    if (!videos || videos.length === 0) {
      throw new SupabaseError('NO_VIDEOS', 'No videos found in this room');
    }
    
    const video = videos[videoIndex - 1];
    if (!video) {
      throw new SupabaseError('INVALID_INDEX', 'Video index out of range');
    }
    
    const { data, error } = await supabase
      .from('room_state')
      .update({
        video_url: video.video_url,
        video_filename: video.video_filename,
        current_video_index: videoIndex,
        position: 0,
        paused: true
      })
      .eq('room_id', roomId)
      .select()
      .single();
    
    if (error) throw new SupabaseError('UPDATE_STATE_ERROR', error.message);
  },

  loadVideoFromUrl: async (roomId: string, url: string): Promise<void> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new SupabaseError('AUTH_ERROR', 'Not authenticated');

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      throw new SupabaseError('INVALID_URL', 'Invalid URL format');
    }

    // Update room state with new video URL
    const { error } = await supabase
      .from('room_state')
      .update({
        video_url: url,
        video_filename: null,
        video_type: 'url',
        playlist_mode: false,
        paused: true,
        position: 0
      })
      .eq('room_id', roomId);
    
    if (error) throw new SupabaseError('UPDATE_STATE_ERROR', error.message);
  }
};