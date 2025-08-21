import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@/types';

export type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

class WebSocketManager {
  private socket: SocketType | null = null;
  private connectionAttempts = 0;
  private maxRetries = 5;
  private retryDelay = 1000;
  private isManualDisconnect = false;

  connect(token: string): SocketType {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.isManualDisconnect = false;
    
    this.socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:8080', {
      auth: { token },
      transports: ['websocket'],
      upgrade: false,
      rememberUpgrade: false,
    });

    this.setupEventHandlers();
    return this.socket;
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    this.socket?.disconnect();
    this.socket = null;
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connectionAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      
      if (!this.isManualDisconnect && this.connectionAttempts < this.maxRetries) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.connectionAttempts++;
      
      if (this.connectionAttempts < this.maxRetries) {
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    setTimeout(() => {
      if (!this.isManualDisconnect && this.socket && !this.socket.connected) {
        console.log(`Attempting to reconnect... (${this.connectionAttempts}/${this.maxRetries})`);
        this.socket.connect();
      }
    }, this.retryDelay * Math.pow(2, this.connectionAttempts));
  }

  getSocket(): SocketType | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Ping for RTT measurement
  ping(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const startTime = Date.now();
      
      const timeout = setTimeout(() => {
        reject(new Error('Ping timeout'));
      }, 5000);

      this.socket.emit('ws:ping', { clientSentAt: startTime });
      
      this.socket.once('ws:pong', ({ serverNow }) => {
        clearTimeout(timeout);
        const rtt = Date.now() - startTime;
        resolve(rtt);
      });
    });
  }
}

export const wsManager = new WebSocketManager();