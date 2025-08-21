export interface User {
  id: string;
  nickname: string;
  joinedAt: Date;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  members: User[];
  currentMembers: number;
}

export interface VideoState {
  videoUrl: string | null;
  paused: boolean;
  position: number; // seconds
  playbackRate: number;
  hostId: string | null;
  lastUpdate: number; // timestamp
}

export interface SyncEvent {
  type: 'play' | 'pause' | 'seek' | 'rate' | 'load' | 'timesync';
  data?: any;
  serverSentAt: number;
  hostId: string;
}

export interface ConnectionState {
  connected: boolean;
  rtt: number; // round trip time in ms
  offset: number; // client-server time offset in ms
  drift: number; // current drift in ms
  lastSync: number;
}

export interface HostState {
  isHost: boolean;
  canBecomeHost: boolean;
  hostTransferInProgress: boolean;
}

export interface AppState {
  user: User | null;
  room: Room | null;
  videoState: VideoState;
  connectionState: ConnectionState;
  hostState: HostState;
  members: User[];
  error: string | null;
}

// WebSocket Events - Client to Server
export interface ClientToServerEvents {
  'ws:join': (data: { roomId: string }) => void;
  'ws:leave': (data: { roomId: string }) => void;
  'ws:play': (data: { atHostTime: number }) => void;
  'ws:pause': (data: { atHostTime: number }) => void;
  'ws:seek': (data: { toSeconds: number; atHostTime: number }) => void;
  'ws:rate': (data: { playbackRate: number; atHostTime: number }) => void;
  'ws:load': (data: { videoUrl: string }) => void;
  'ws:ping': (data: { clientSentAt: number }) => void;
}

// WebSocket Events - Server to Client
export interface ServerToClientEvents {
  'ws:snapshot': (data: VideoState & { serverSentAt: number }) => void;
  'ws:video-play': (data: { startAtServerTime: number; position: number }) => void;
  'ws:video-pause': (data: { position: number; serverSentAt: number }) => void;
  'ws:video-seek': (data: { toSeconds: number; serverSentAt: number }) => void;
  'ws:video-rate': (data: { playbackRate: number; serverSentAt: number }) => void;
  'ws:video-load': (data: { videoUrl: string; serverSentAt: number }) => void;
  'ws:timesync': (data: VideoState & { serverSentAt: number }) => void;
  'ws:pong': (data: { serverNow: number }) => void;
  'ws:hostChanged': (data: { hostId: string | null }) => void;
  'ws:roomMembers': (data: { members: User[] }) => void;
  'ws:error': (data: { code: string; message: string }) => void;
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

export interface ApiError {
  code: string;
  message: string;
  status: number;
}