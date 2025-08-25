import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { RoomVideo } from '@/types';
import { LogOut, Users } from 'lucide-react';

export default function Room() {
  const [isLoading, setIsLoading] = useState(true);
  const [roomVideos, setRoomVideos] = useState<RoomVideo[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(1);
  
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
  
  const { roomId } = useParams<{ roomId: string }>();

  // Redirect if not logged in
  useEffect(() => {
    if (!auth.loading && !user) {
      navigate('/auth', { replace: true });
      return;
    }
  }, [auth.loading, user, navigate]);

  // Load room videos
  const loadRoomVideos = async () => {
    if (!roomId) return;
    try {
      const videos = await supabaseApi.getRoomVideos(roomId);
      setRoomVideos(videos);
    } catch (error) {
      console.error('Failed to load room videos:', error);
    }
  };

  // Handle video switch
  const handleVideoSwitch = async (index: number) => {
    if (!roomId) return;
    try {
      await supabaseApi.switchToVideo(roomId, index);
      setCurrentVideoIndex(index);
    } catch (error: any) {
      toast({
        title: "Failed to switch video",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Initialize room data and real-time subscriptions
  useEffect(() => {
    if (!user || !roomId) return;

    const initializeRoom = async () => {
      try {
        setIsLoading(true);
        
        // Load room, room state, members, and videos
        const [roomData, roomState, members] = await Promise.all([
          supabaseApi.getRoomWithMembers(roomId),
          supabaseApi.getRoomState(roomId),
          supabaseApi.getRoomMembers(roomId)
        ]);
        
        if (!roomData) {
          toast({
            title: "Room not found",
            description: "The room you're looking for doesn't exist",
            variant: "destructive"
          });
          navigate('/rooms');
          return;
        }
        
        setRoom(roomData);
        
        // Set initial state
        if (roomState) {
          setVideoState({
            videoUrl: roomState.video_url || undefined,
            videoFilename: roomState.video_filename || undefined,
            paused: roomState.paused,
            position: roomState.position,
            playbackRate: roomState.playback_rate,
            hostId: roomState.host_user_id || undefined,
            lastUpdated: roomState.lastUpdated
          });
          
          setHostState({
            isHost: roomState.host_user_id === user.id,
            canBecomeHost: !roomState.host_user_id
          });
          
          setCurrentVideoIndex(roomState.current_video_index || 1);
        }
        
        setMembers(members);
        await loadRoomVideos();
        setConnected(true);
        
        // Setup real-time subscriptions
        const roomStateChannel = supabaseApi.subscribeToRoomState(roomId, (newState) => {
          setVideoState({
            videoUrl: newState.video_url || undefined,
            videoFilename: newState.video_filename || undefined,
            paused: newState.paused,
            position: newState.position,
            playbackRate: newState.playback_rate,
            hostId: newState.host_user_id || undefined,
            lastUpdated: newState.lastUpdated
          });
          
          setHostState({
            isHost: newState.host_user_id === user.id,
            canBecomeHost: !newState.host_user_id
          });
          
          setCurrentVideoIndex(newState.current_video_index || 1);
        });
        
        const membersChannel = supabaseApi.subscribeToRoomMembers(roomId, (newMembers) => {
          setMembers(newMembers);
        });
        
        // Cleanup function
        return () => {
          roomStateChannel?.unsubscribe();
          membersChannel?.unsubscribe();
        };
        
      } catch (error: any) {
        console.error('Room initialization error:', error);
        toast({
          title: "Failed to load room",
          description: error.message || "Please try again",
          variant: "destructive"
        });
        navigate('/rooms');
      } finally {
        setIsLoading(false);
      }
    };

    initializeRoom();
  }, [user, roomId, navigate, toast, setRoom, setVideoState, setHostState, setMembers, setConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // Handle leaving room
  const handleLeaveRoom = async () => {
    if (!roomId) return;
    
    try {
      await supabaseApi.leaveRoom(roomId);
      navigate('/rooms');
    } catch (error: any) {
      toast({
        title: "Failed to leave room",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  };

  if (auth.loading || isLoading) {
    return <LoadingScreen message="Loading room..." />;
  }

  if (!user) {
    return <LoadingScreen message="Authenticating..." />;
  }

  if (!room) {
    return <LoadingScreen message="Room not found..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">{room.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {room.currentMembers} members
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                connectionState.connected ? 'bg-green-500' : 'bg-red-500'
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
            <VideoUpload 
              roomId={roomId!}
              onVideoUploaded={loadRoomVideos}
              videos={roomVideos}
              onVideoSwitch={handleVideoSwitch}
              currentIndex={currentVideoIndex}
            />
          </div>
        </div>
      </div>
    </div>
  );
}