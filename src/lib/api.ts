import { AuthResponse, RoomJoinResponse } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const token = localStorage.getItem('auth-token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data.code || 'UNKNOWN_ERROR', data.message || 'An error occurred');
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
  }
}

export const api = {
  // Authentication
  login: async (nickname: string): Promise<AuthResponse> => {
    const response = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    });
    
    // Store token
    localStorage.setItem('auth-token', response.token);
    
    return response;
  },

  // Rooms
  joinRoom: async (roomId: string): Promise<RoomJoinResponse> => {
    return request<RoomJoinResponse>('/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ roomId }),
    });
  },

  leaveRoom: async (roomId: string): Promise<void> => {
    return request<void>('/rooms/leave', {
      method: 'POST',
      body: JSON.stringify({ roomId }),
    });
  },

  getRoomState: async (roomId: string) => {
    return request(`/rooms/${roomId}/state`);
  },

  // Host actions
  claimHost: async (roomId: string): Promise<void> => {
    return request<void>(`/rooms/${roomId}/host/claim`, {
      method: 'POST',
    });
  },

  transferHost: async (roomId: string, toUserId: string): Promise<void> => {
    return request<void>(`/rooms/${roomId}/host/transfer`, {
      method: 'POST',
      body: JSON.stringify({ toUserId }),
    });
  },

  // Video
  loadVideo: async (roomId: string, videoUrl: string): Promise<void> => {
    return request<void>(`/rooms/${roomId}/load`, {
      method: 'POST',
      body: JSON.stringify({ videoUrl }),
    });
  },
};

// Export the error class for handling
export { ApiError };