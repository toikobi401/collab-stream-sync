import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useStore, useVideoState, useHostState, useConnectionState } from '@/store';
import { supabaseApi } from '@/lib/supabase-api';
import { Play, Pause, RotateCcw, Volume2, SkipForward, SkipBack } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface PlayerRef {
  seekTo: (seconds: number, type?: 'seconds' | 'fraction') => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export function VideoPlayer() {
  const playerRef = useRef<PlayerRef>(null);
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isSeeking, setIsSeeking] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  
  const videoState = useVideoState();
  const hostState = useHostState();
  const connectionState = useConnectionState();
  const room = useStore(state => state.room);
  const { toast } = useToast();
  
  const updateVideoTime = useStore(state => state.updateVideoTime);
  const updateDrift = useStore(state => state.updateDrift);
  const setConnectionState = useStore(state => state.setConnectionState);

  // Calculate server time sync
  const syncServerTime = useCallback(async () => {
    // Use local time since external API is not accessible in sandbox
    const currentTime = Date.now();
    setServerTimeOffset(0); // No offset needed for local time
    setConnectionState({ 
      rtt: 0, 
      offset: 0,
      lastSync: currentTime 
    });
  }, [setConnectionState]);

  // Sync time periodically
  useEffect(() => {
    syncServerTime();
    const interval = setInterval(syncServerTime, 30000); // Sync every 30 seconds
    return () => clearInterval(interval);
  }, [syncServerTime]);

  // Calculate simple drift between local and server video position
  const calculateDrift = useCallback(() => {
    if (!playerRef.current?.getCurrentTime) return;
    
    const actualPosition = playerRef.current.getCurrentTime();
    const expectedPosition = videoState.position;
    const drift = Math.abs(expectedPosition - actualPosition) * 1000; // ms
    
    updateDrift(drift);
    
    // Auto-sync if drift is too high
    if (drift > 2000 && !hostState.isHost && !isSeeking && playerRef.current.seekTo) {
      playerRef.current.seekTo(expectedPosition, 'seconds');
      setLocalTime(expectedPosition);
    }
  }, [videoState.position, hostState.isHost, isSeeking, updateDrift]);

  // Monitor drift every 3 seconds
  useEffect(() => {
    const interval = setInterval(calculateDrift, 3000);
    return () => clearInterval(interval);
  }, [calculateDrift]);

  // Update local time and sync
  const handleProgress = useCallback((state: { playedSeconds: number }) => {
    if (!isSeeking) {
      setLocalTime(state.playedSeconds);
      updateVideoTime(state.playedSeconds);
      
      // Host broadcasts position updates every 5 seconds
      if (hostState.isHost && room && Date.now() - lastSyncTime > 5000) {
        supabaseApi.updateRoomState(room.id, {
          position: state.playedSeconds
        }).catch(console.error);
        setLastSyncTime(Date.now());
      }
    }
  }, [isSeeking, updateVideoTime, hostState.isHost, room, lastSyncTime, serverTimeOffset]);

  // Host controls
  const handlePlayPause = async () => {
    if (!hostState.isHost || !room) return;
    
    try {
      const currentPos = playerRef.current?.getCurrentTime ? 
        playerRef.current.getCurrentTime() : localTime;
      
      console.log('Play/pause clicked:', {
        currentPaused: videoState.paused,
        newPaused: !videoState.paused,
        currentPos,
        isHost: hostState.isHost
      });
      
      await supabaseApi.updateRoomState(room.id, {
        paused: !videoState.paused,
        position: currentPos
      });
    } catch (error: any) {
      console.error('Play/pause error:', error);
      toast({
        title: "Control error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSeek = async (newTime: number) => {
    if (!hostState.isHost || !room) return;
    
    setIsSeeking(true);
    setLocalTime(newTime);
    
    try {
      await supabaseApi.updateRoomState(room.id, {
        position: newTime
      });
    } catch (error: any) {
      toast({
        title: "Seek error", 
        description: error.message,
        variant: "destructive"
      });
    }
    
    setTimeout(() => setIsSeeking(false), 100);
  };

  const handleSkip = async (seconds: number) => {
    if (!hostState.isHost || !playerRef.current?.getCurrentTime || !room) return;
    
    const currentTime = playerRef.current.getCurrentTime();
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    await handleSeek(newTime);
  };

  const handleSyncNow = () => {
    if (playerRef.current && videoState.position !== undefined) {
      // Use current server position without time calculation
      const expectedPosition = videoState.position;
      
      if (playerRef.current.seekTo) {
        playerRef.current.seekTo(expectedPosition, 'seconds');
        setLocalTime(expectedPosition);
        updateVideoTime(expectedPosition);
        
        toast({
          title: "Synced",
          description: "Video synchronized with server"
        });
      }
    }
  };

  // Sync video state when it changes
  useEffect(() => {
    if (playerRef.current && !isSeeking && !hostState.isHost && playerRef.current.seekTo) {
      const timeDiff = Math.abs(localTime - videoState.position);
      if (timeDiff > 1) {
        playerRef.current.seekTo(videoState.position, 'seconds');
        setLocalTime(videoState.position);
      }
    }
  }, [videoState.position, localTime, isSeeking, hostState.isHost]);

  // Debug logging
  console.log('VideoPlayer state:', {
    videoUrl: videoState.videoUrl,
    videoFilename: videoState.videoFilename,
    paused: videoState.paused,
    position: videoState.position,
    isHost: hostState.isHost,
    room: room?.id
  });

  if (!videoState.videoUrl) {
    return (
      <Card className="gradient-card border-card-border">
        <CardContent className="flex items-center justify-center py-32">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted/20 flex items-center justify-center">
              <Play className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium">No video selected</p>
              <p className="text-sm text-muted-foreground">
                {hostState.isHost ? 'Upload videos and select one from the playlist to start watching' : 'Waiting for host to select a video from the playlist'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video Player */}
      <Card className="gradient-card border-card-border overflow-hidden">
        <div className="relative aspect-video bg-black">
          {React.createElement(ReactPlayer as any, {
            ref: playerRef,
            url: videoState.videoUrl,
            width: "100%",
            height: "100%",
            playing: !videoState.paused,
            volume: volume,
            playbackRate: videoState.playbackRate || 1.0,
            onProgress: handleProgress,
            onDuration: setDuration,
            onReady: () => {
              if (playerRef.current && videoState.position !== undefined && playerRef.current.seekTo) {
                playerRef.current.seekTo(videoState.position, 'seconds');
                setLocalTime(videoState.position);
              }
            },
            onPause: () => {
              if (hostState.isHost && room) {
                const currentPos = playerRef.current?.getCurrentTime ? 
                  playerRef.current.getCurrentTime() : localTime;
                supabaseApi.updateRoomState(room.id, {
                  paused: true,
                  position: currentPos
                }).catch(console.error);
              }
            },
            onPlay: () => {
              if (hostState.isHost && room) {
                const currentPos = playerRef.current?.getCurrentTime ? 
                  playerRef.current.getCurrentTime() : localTime;
                supabaseApi.updateRoomState(room.id, {
                  paused: false,
                  position: currentPos
                }).catch(console.error);
              }
            }
          })}
          
          {/* Sync Status Overlay */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Badge 
              variant="secondary" 
              className={cn(
                "bg-black/50 backdrop-blur-sm",
                (connectionState.drift || 0) > 2000 ? "border-destructive/50" : 
                (connectionState.drift || 0) > 500 ? "border-warning/50" : 
                "border-success/50"
              )}
            >
              {(connectionState.drift || 0).toFixed(0)}ms drift
            </Badge>
            
            {connectionState.rtt > 0 && (
              <Badge variant="outline" className="bg-black/50 backdrop-blur-sm">
                {connectionState.rtt}ms RTT
              </Badge>
            )}
            
            {hostState.isHost && (
              <Badge variant="default" className="bg-primary/80 backdrop-blur-sm">
                HOST
              </Badge>
            )}
          </div>
          
          {/* Video filename overlay */}
          {videoState.videoFilename && (
            <div className="absolute bottom-4 left-4">
              <Badge variant="outline" className="bg-black/50 backdrop-blur-sm">
                {videoState.videoFilename}
              </Badge>
            </div>
          )}
        </div>
      </Card>

      {/* Controls */}
      <Card className="gradient-card border-card-border">
        <CardContent className="space-y-4 pt-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground font-mono">
              <span>{formatTime(localTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <Slider
              value={[localTime]}
              max={duration}
              step={0.1}
              onValueChange={([value]) => {
                if (hostState.isHost) {
                  setLocalTime(value);
                  handleSeek(value);
                }
              }}
              disabled={!hostState.isHost}
              className="w-full"
            />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Skip backwards */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSkip(-10)}
                disabled={!hostState.isHost}
              >
                <SkipBack className="w-4 h-4" />
                10s
              </Button>
              
              {/* Play/Pause */}
              <Button
                variant={hostState.isHost ? "default" : "outline"}
                size="sm"
                onClick={handlePlayPause}
                disabled={!hostState.isHost}
              >
                {videoState.paused ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
              </Button>
              
              {/* Skip forwards */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSkip(10)}
                disabled={!hostState.isHost}
              >
                <SkipForward className="w-4 h-4" />
                10s
              </Button>
              
              {/* Sync button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncNow}
                disabled={hostState.isHost}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Sync
              </Button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[volume]}
                max={1}
                step={0.01}
                onValueChange={([value]) => setVolume(value)}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground w-8">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
          
          {/* Playback Rate Control (Host only) */}
          {hostState.isHost && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Speed:</span>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <Button
                  key={rate}
                  variant={videoState.playbackRate === rate ? "default" : "outline"}
                  size="sm"
                  onClick={async () => {
                    if (room) {
                      await supabaseApi.updateRoomState(room.id, {
                        playback_rate: rate
                      });
                    }
                  }}
                >
                  {rate}x
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}