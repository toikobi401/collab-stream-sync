import { User as SupabaseUser, Session } from '@supabase/supabase-js';

export interface User {
  id: string;
  nickname: string;
  joinedAt?: Date;
}

export interface Profile {
  id: string;
  user_id: string;
  nickname: string;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  members: User[];
  currentMembers: number;
  enabled?: boolean;
  created_at?: string;
  created_by?: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  profiles?: Profile;
  nickname?: string; // For backwards compatibility
}

export interface RoomState {
  room_id: string;
  video_url?: string;
  video_filename?: string;
  video_type?: string;
  paused: boolean;
  position: number;
  playback_rate: number;
  host_user_id?: string;
  updated_at: string;
  current_video_index?: number;
  playlist_mode?: boolean;
  lastUpdated?: number;
}

export interface RoomVideo {
  id: string;
  room_id: string;
  video_url: string;
  video_filename: string;
  file_size: number;
  duration?: number;
  video_order: number;
  uploaded_by: string;
  uploaded_at: string;
}

export interface VideoState {
  videoUrl?: string | null;
  videoFilename?: string | null;
  paused: boolean;
  position: number;
  playbackRate: number;
  hostId?: string | null;
  lastUpdated?: number;
}

export interface ConnectionState {
  connected: boolean;
  rtt: number;
  offset: number;
  drift?: number;
  lastSync: number;
}

export interface HostState {
  isHost: boolean;
  canBecomeHost: boolean;
  hostTransferInProgress?: boolean;
}

export interface AuthState {
  user: SupabaseUser | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
}

export interface AppState {
  auth: AuthState;
  user: User | null;
  room: Room | null;
  videoState: VideoState;
  connectionState: ConnectionState;
  hostState: HostState;
  members: RoomMember[];
  error: string | null;
}

// API Response Types
export interface AuthResponse {
  token: string;
  user: User;
}

export interface RoomJoinResponse {
  room: Room;
  you: User;
}