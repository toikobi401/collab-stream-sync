import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/ui/loading';
import { VideoPlayer } from '@/components/VideoPlayer';
import { HostControls } from '@/components/HostControls';
import { RoomInfo } from '@/components/RoomInfo';
import { VideoUpload } from '@/components/VideoUpload';
import { useStore, useUser, useRoom, useConnectionState, useProfile } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabaseApi } from '@/lib/supabase-api';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Users } from 'lucide-react';

export default function Room() {
  const [isLoading, setIsLoading] = useState(true);
  
  const auth = useAuth();
  const user = useUser();
  const profile = useProfile();
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
    reset
  } = useStore();

  // Redirect if not logged in
  useEffect(() => {
    if (!auth.loading && !user) {
      navigate('/auth', { replace: true });
      return;
    }
  }, [auth.loading, user, navigate]);

  // Initialize room data and real-time subscriptions
  useEffect(() => {
    if (!user || !room) return;

    const initializeRoom = async () => {
      try {
        setIsLoading(true);
        
        // Load room state and members
        const [roomState, members] = await Promise.all([
          supabaseApi.getRoomState(room.id),
          supabaseApi.getRoomMembers(room.id)
        ]);
        
        // Set initial state
        if (roomState) {
          setVideoState({
            videoUrl: roomState.video_url || undefined,
            paused: roomState.paused,
            position: roomState.position,
            playbackRate: roomState.playback_rate,
            hostId: roomState.host_user_id || undefined
          });
          
          setHostState({
            isHost: roomState.host_user_id === user.id,
            canBecomeHost: !roomState.host_user_id
          });
        }
        
        setMembers(members);
        setConnected(true);
        
        // Setup real-time subscriptions
        const roomStateChannel = supabaseApi.subscribeToRoomState(room.id, (newState) => {
          setVideoState({
            videoUrl: newState.video_url || undefined,
            paused: newState.paused,
            position: newState.position,
            playbackRate: newState.playback_rate,
            hostId: newState.host_user_id || undefined
          });
          
          setHostState({
            isHost: newState.host_user_id === user.id,
            canBecomeHost: !newState.host_user_id
          });
        });
        
        const membersChannel = supabaseApi.subscribeToRoomMembers(room.id, (newMembers) => {
          setMembers(newMembers);
        });
        
        toast({
          title: "Connected to room",
          description: `Welcome to ${room.name}`,
        });
        
        // Cleanup subscriptions
        return () => {
          supabase.removeChannel(roomStateChannel);
          supabase.removeChannel(membersChannel);
        };
        
      } catch (error) {
        console.error('Room initialization error:', error);
        toast({
          title: "Failed to load room",
          description: "Unable to connect to the room",
          variant: "destructive"
        });
        navigate('/join', { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    const cleanup = initializeRoom();
    
    return () => {
      cleanup?.then(cleanupFn => cleanupFn?.());
      reset();
    };
  }, [user, room]);


  const handleLeaveRoom = async () => {
    try {
      if (room) {
        await supabaseApi.leaveRoom(room.id);
      }
      
      toast({
        title: "Left room",
        description: "You have left the room",
      });
      
      navigate('/join', { replace: true });
    } catch (error) {
      console.error('Leave room error:', error);
      navigate('/join', { replace: true });
    }
  };

  if (!user || auth.loading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (isLoading) {
    return <LoadingScreen message="Loading room..." />;
  }

  if (!room) {
    return <LoadingScreen message="Room not found, redirecting..." />;
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
            <VideoUpload />
          </div>
        </div>
      </div>
    </div>
  );
}