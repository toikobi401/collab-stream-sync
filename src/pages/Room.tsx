import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/ui/loading';
import { VideoPlayer } from '@/components/VideoPlayer';
import { VideoPlaylist } from '@/components/VideoPlaylist';
import { HostControls } from '@/components/HostControls';
import { RoomInfo } from '@/components/RoomInfo';
import { VideoUpload } from '@/components/VideoUpload';
import { useStore, useUser, useRoom, useConnectionState, useProfile, useVideoState, useHostState } from '@/store';
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
  const videoState = useVideoState();
  const hostState = useHostState();
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
      
      // Auto-select first video if no video is currently selected and user is host
      if (videos.length > 0 && !videoState.videoUrl && hostState.isHost) {
        console.log('Auto-selecting first video for host');
        setTimeout(async () => {
          try {
            await handleVideoSwitch(1);
          } catch (error) {
            console.error('Failed to auto-select first video:', error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to load room videos:', error);
    }
  };

  // Handle video switch
  const handleVideoSwitch = async (index: number) => {
    if (!roomId) return;
    try {
      // Load current room videos to get the selected video details
      const videos = await supabaseApi.getRoomVideos(roomId);
      const selectedVideo = videos[index - 1]; // Convert to 0-based index
      
      if (!selectedVideo) {
        throw new Error('Video not found in playlist');
      }
      
      console.log('Switching to video:', {
        index,
        video: selectedVideo
      });
      
      // Update room state with the selected video information
      await supabaseApi.updateRoomState(roomId, {
        video_url: selectedVideo.video_url,
        video_filename: selectedVideo.video_filename,
        current_video_index: index,
        position: 0,
        paused: true
      });
      
      setCurrentVideoIndex(index);
      
      toast({
        title: "Video selected",
        description: `Now playing: ${selectedVideo.video_filename}`,
      });
    } catch (error: any) {
      console.error('Video switch error:', error);
      toast({
        title: "Failed to switch video",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Handle video delete
  const handleVideoDelete = async (videoId: string) => {
    try {
      await supabaseApi.deleteRoomVideo(videoId);
      await loadRoomVideos();
      toast({
        title: "Video deleted",
        description: "Video has been removed from the playlist",
      });
    } catch (error: any) {
      toast({
        title: "Failed to delete video",
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
            lastUpdated: new Date(roomState.updated_at).getTime()
          });
          
          setHostState({
            isHost: roomState.host_user_id === user.id,
            canBecomeHost: !roomState.host_user_id
          });
          
          setCurrentVideoIndex(roomState.current_video_index || 1);
        }
        
        setMembers(members);
        
        // Load room videos after setting up initial state
        await loadRoomVideos();
        
        setConnected(true);
        
        // Setup real-time subscriptions
        const roomStateChannel = supabaseApi.subscribeToRoomState(roomId, (newState) => {
          console.log('Real-time room state update received:', newState);
          
          setVideoState({
            videoUrl: newState.video_url || undefined,
            videoFilename: newState.video_filename || undefined,
            paused: newState.paused,
            position: newState.position,
            playbackRate: newState.playback_rate,
            hostId: newState.host_user_id || undefined,
            lastUpdated: new Date(newState.updated_at).getTime()
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
        
        // Subscribe to room videos changes
        const videosChannel = supabase
          .channel(`room-videos-${roomId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'room_videos',
              filter: `room_id=eq.${roomId}`
            },
            (payload) => {
              console.log('Room videos changed:', payload);
              // Reload videos when there are changes
              loadRoomVideos();
            }
          )
          .subscribe();
        
        // Cleanup function
        return () => {
          roomStateChannel?.unsubscribe();
          membersChannel?.unsubscribe();
          videosChannel?.unsubscribe();
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
            />
            <VideoPlaylist 
              videos={roomVideos}
              currentVideoIndex={currentVideoIndex}
              onVideoSwitch={handleVideoSwitch}
              onVideoDelete={handleVideoDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
}