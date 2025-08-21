import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/ui/loading';
import { VideoPlayer } from '@/components/VideoPlayer';
import { HostControls } from '@/components/HostControls';
import { RoomInfo } from '@/components/RoomInfo';
import { useStore, useUser, useRoom, useConnectionState } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { wsManager } from '@/lib/websocket';
import { api, ApiError } from '@/lib/api';
import { LogOut, Users } from 'lucide-react';

export default function Room() {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  
  const user = useUser();
  const room = useRoom();
  const connectionState = useConnectionState();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const {
    setRoom,
    setMembers,
    setVideoState,
    setConnectionState,
    setHostState,
    setConnected,
    updateRTT,
    updateOffset,
    reset
  } = useStore();

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
  }, [user, navigate]);

  // Initialize WebSocket and join room
  useEffect(() => {
    if (!user) return;

    const connectAndJoin = async () => {
      try {
        setIsConnecting(true);
        
        // Get auth token
        const token = localStorage.getItem('auth-token');
        if (!token) {
          toast({
            title: "Authentication error",
            description: "Please log in again",
            variant: "destructive"
          });
          navigate('/', { replace: true });
          return;
        }

        // Connect WebSocket
        const socket = wsManager.connect(token);
        
        // Wait for connection
        await new Promise<void>((resolve, reject) => {
          socket.on('connect', () => resolve());
          socket.on('connect_error', (error: any) => reject(error));
          setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });

        setConnected(true);
        
        // Join default room
        setIsJoining(true);
        const roomResponse = await api.joinRoom('room-1');
        setRoom(roomResponse.room);
        
        // Emit WebSocket join
        socket.emit('ws:join', { roomId: 'room-1' });
        
        // Setup WebSocket event handlers
        setupSocketHandlers(socket);
        
        // Start RTT measurement
        startRTTMeasurement(socket);
        
        toast({
          title: "Joined room",
          description: `Welcome to ${roomResponse.room.name}`,
        });
        
      } catch (error) {
        console.error('Connection error:', error);
        
        if (error instanceof ApiError) {
          if (error.status === 409) {
            toast({
              title: "Room is full",
              description: "The room has reached maximum capacity (5/5)",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Failed to join room",
              description: error.message,
              variant: "destructive"
            });
          }
        } else {
          toast({
            title: "Connection failed", 
            description: "Unable to connect to the server",
            variant: "destructive"
          });
        }
        
        navigate('/', { replace: true });
      } finally {
        setIsConnecting(false);
        setIsJoining(false);
      }
    };

    connectAndJoin();

    // Cleanup on unmount
    return () => {
      wsManager.disconnect();
      reset();
    };
  }, [user]);

  const setupSocketHandlers = (socket: any) => {
    // Room events
    socket.on('ws:roomMembers', ({ members }: any) => {
      setMembers(members);
    });

    socket.on('ws:hostChanged', ({ hostId }: any) => {
      setHostState({ 
        isHost: user?.id === hostId,
        canBecomeHost: hostId === null 
      });
      setVideoState({ hostId });
    });

    // Video sync events
    socket.on('ws:snapshot', (data: any) => {
      const { serverSentAt, ...videoData } = data;
      setVideoState(videoData);
    });

    socket.on('ws:timesync', (data: any) => {
      const { serverSentAt, ...videoData } = data;
      setVideoState(videoData);
      setConnectionState({ lastSync: Date.now() });
    });

    // Ping/Pong for RTT
    socket.on('ws:pong', ({ serverNow }: any) => {
      const clientNow = Date.now();
      const rtt = clientNow - (serverNow - connectionState.offset);
      updateRTT(rtt);
      
      // Update offset estimation
      const newOffset = serverNow - clientNow + rtt / 2;
      updateOffset(newOffset);
    });

    // Error handling
    socket.on('ws:error', ({ code, message }: any) => {
      toast({
        title: "Server error",
        description: message,
        variant: "destructive"
      });
    });

    // Connection status
    socket.on('disconnect', () => {
      setConnected(false);
      toast({
        title: "Disconnected",
        description: "Lost connection to server",
        variant: "destructive"
      });
    });

    socket.on('connect', () => {
      setConnected(true);
    });
  };

  const startRTTMeasurement = (socket: any) => {
    const measureRTT = async () => {
      try {
        const rtt = await wsManager.ping();
        updateRTT(rtt);
      } catch (error) {
        console.error('RTT measurement failed:', error);
      }
    };

    // Initial measurement
    measureRTT();
    
    // Periodic measurements every 30 seconds
    const interval = setInterval(measureRTT, 30000);
    
    return () => clearInterval(interval);
  };

  const handleLeaveRoom = async () => {
    try {
      if (room) {
        await api.leaveRoom(room.id);
      }
      
      toast({
        title: "Left room",
        description: "You have left the room",
      });
      
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Leave room error:', error);
      navigate('/', { replace: true });
    }
  };

  if (!user) {
    return <LoadingScreen message="Loading..." />;
  }

  if (isConnecting || isJoining) {
    return (
      <LoadingScreen 
        message={isConnecting ? "Connecting..." : "Joining room..."} 
      />
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gradient-primary">
              CollabStream Sync
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{room?.name || 'Room'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${
                connectionState.connected ? 'bg-success animate-pulse' : 'bg-destructive'
              }`} />
              {connectionState.connected ? 'Connected' : 'Disconnected'}
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLeaveRoom}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Leave
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video Player - Main area */}
          <div className="lg:col-span-3">
            <VideoPlayer />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <RoomInfo />
            <HostControls />
          </div>
        </div>
      </div>
    </div>
  );
}