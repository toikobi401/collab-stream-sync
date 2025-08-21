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
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  profiles?: Profile;
}

export interface RoomState {
  room_id: string;
  video_url?: string;
  paused: boolean;
  position: number;
  playback_rate: number;
  host_user_id?: string;
  updated_at: string;
}

export interface VideoState {
  videoUrl?: string | null;
  paused: boolean;
  position: number;
  playbackRate: number;
  hostId?: string | null;
  lastUpdate?: number;
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