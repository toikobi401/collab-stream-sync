import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, User, Room, VideoState, ConnectionState, HostState } from '@/types';

interface AppStore extends AppState {
  // Actions
  setUser: (user: User | null) => void;
  setRoom: (room: Room | null) => void;
  setVideoState: (state: Partial<VideoState>) => void;
  setConnectionState: (state: Partial<ConnectionState>) => void;
  setHostState: (state: Partial<HostState>) => void;
  setMembers: (members: User[]) => void;
  setError: (error: string | null) => void;
  
  // Video actions
  updateVideoTime: (position: number) => void;
  updatePlaybackRate: (rate: number) => void;
  togglePause: () => void;
  
  // Host actions
  setIsHost: (isHost: boolean) => void;
  setCanBecomeHost: (canBecomeHost: boolean) => void;
  
  // Connection actions
  updateRTT: (rtt: number) => void;
  updateOffset: (offset: number) => void;
  updateDrift: (drift: number) => void;
  setConnected: (connected: boolean) => void;
  
  // Reset
  reset: () => void;
}

const initialState: AppState = {
  user: null,
  room: null,
  videoState: {
    videoUrl: null,
    paused: true,
    position: 0,
    playbackRate: 1.0,
    hostId: null,
    lastUpdate: Date.now(),
  },
  connectionState: {
    connected: false,
    rtt: 0,
    offset: 0,
    drift: 0,
    lastSync: 0,
  },
  hostState: {
    isHost: false,
    canBecomeHost: true,
    hostTransferInProgress: false,
  },
  members: [],
  error: null,
};

export const useStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Basic setters
      setUser: (user) => set({ user }),
      setRoom: (room) => set({ room }),
      setVideoState: (state) =>
        set((prev) => ({
          videoState: { ...prev.videoState, ...state, lastUpdate: Date.now() },
        })),
      setConnectionState: (state) =>
        set((prev) => ({
          connectionState: { ...prev.connectionState, ...state },
        })),
      setHostState: (state) =>
        set((prev) => ({
          hostState: { ...prev.hostState, ...state },
        })),
      setMembers: (members) => set({ members }),
      setError: (error) => set({ error }),

      // Video actions
      updateVideoTime: (position) =>
        set((prev) => ({
          videoState: { ...prev.videoState, position, lastUpdate: Date.now() },
        })),
      updatePlaybackRate: (playbackRate) =>
        set((prev) => ({
          videoState: { ...prev.videoState, playbackRate, lastUpdate: Date.now() },
        })),
      togglePause: () =>
        set((prev) => ({
          videoState: { 
            ...prev.videoState, 
            paused: !prev.videoState.paused,
            lastUpdate: Date.now() 
          },
        })),

      // Host actions
      setIsHost: (isHost) =>
        set((prev) => ({
          hostState: { ...prev.hostState, isHost },
        })),
      setCanBecomeHost: (canBecomeHost) =>
        set((prev) => ({
          hostState: { ...prev.hostState, canBecomeHost },
        })),

      // Connection actions
      updateRTT: (rtt) =>
        set((prev) => ({
          connectionState: { ...prev.connectionState, rtt },
        })),
      updateOffset: (offset) =>
        set((prev) => ({
          connectionState: { ...prev.connectionState, offset },
        })),
      updateDrift: (drift) =>
        set((prev) => ({
          connectionState: { ...prev.connectionState, drift },
        })),
      setConnected: (connected) =>
        set((prev) => ({
          connectionState: { ...prev.connectionState, connected },
        })),

      // Reset all state
      reset: () => set(initialState),
    }),
    {
      name: 'collab-stream-store',
    }
  )
);

// Selectors for performance
export const useUser = () => useStore((state) => state.user);
export const useRoom = () => useStore((state) => state.room);
export const useVideoState = () => useStore((state) => state.videoState);
export const useConnectionState = () => useStore((state) => state.connectionState);
export const useHostState = () => useStore((state) => state.hostState);
export const useMembers = () => useStore((state) => state.members);
export const useError = () => useStore((state) => state.error);