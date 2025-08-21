import { create } from 'zustand';
import { AuthState, User, Room, VideoState, ConnectionState, HostState, RoomMember, Profile } from '@/types';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface AppStore {
  // Auth
  auth: AuthState;
  setAuth: (auth: Partial<AuthState>) => void;
  
  // Room
  room: Room | null;
  members: RoomMember[];
  setRoom: (room: Room | null) => void;
  setMembers: (members: RoomMember[]) => void;
  
  // Video State
  videoState: VideoState;
  setVideoState: (state: Partial<VideoState>) => void;
  
  // Connection
  connectionState: ConnectionState;
  setConnectionState: (state: Partial<ConnectionState>) => void;
  setConnected: (connected: boolean) => void;
  updateRTT: (rtt: number) => void;
  updateOffset: (offset: number) => void;
  
  // Host
  hostState: HostState;
  setHostState: (state: Partial<HostState>) => void;
  
  // Actions
  reset: () => void;
}

export const useStore = create<AppStore>((set, get) => ({
  // Auth
  auth: {
    user: null,
    session: null,
    profile: null,
    loading: true,
  },
  setAuth: (auth) => set((prev) => ({
    auth: { ...prev.auth, ...auth }
  })),
  
  // Room
  room: null,
  members: [],
  setRoom: (room) => set({ room }),
  setMembers: (members) => set({ members }),
  
  // Video State
  videoState: {
    paused: true,
    position: 0,
    playbackRate: 1.0,
  },
  setVideoState: (state) => set((prev) => ({
    videoState: { ...prev.videoState, ...state }
  })),
  
  // Connection
  connectionState: {
    connected: false,
    rtt: 0,
    offset: 0,
    lastSync: 0,
  },
  setConnectionState: (state) => set((prev) => ({
    connectionState: { ...prev.connectionState, ...state }
  })),
  setConnected: (connected) => set((prev) => ({
    connectionState: { ...prev.connectionState, connected }
  })),
  updateRTT: (rtt) => set((prev) => ({
    connectionState: { ...prev.connectionState, rtt }
  })),
  updateOffset: (offset) => set((prev) => ({
    connectionState: { ...prev.connectionState, offset }
  })),
  
  // Host
  hostState: {
    isHost: false,
    canBecomeHost: true,
  },
  setHostState: (state) => set((prev) => ({
    hostState: { ...prev.hostState, ...state }
  })),
  
  // Actions
  reset: () => set({
    room: null,
    members: [],
    videoState: {
      paused: true,
      position: 0,
      playbackRate: 1.0,
    },
    connectionState: {
      connected: false,
      rtt: 0,
      offset: 0,
      lastSync: 0,
    },
    hostState: {
      isHost: false,
      canBecomeHost: true,
    },
  }),
}));

// Helper hooks
export const useAuth = () => useStore((state) => state.auth);
export const useUser = () => useStore((state) => state.auth.user);
export const useProfile = () => useStore((state) => state.auth.profile);
export const useRoom = () => useStore((state) => state.room);
export const useMembers = () => useStore((state) => state.members);
export const useVideoState = () => useStore((state) => state.videoState);
export const useConnectionState = () => useStore((state) => state.connectionState);
export const useHostState = () => useStore((state) => state.hostState);