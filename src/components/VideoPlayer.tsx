import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useStore, useVideoState, useHostState, useConnectionState } from '@/store';
import { wsManager } from '@/lib/websocket';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  
  const videoState = useVideoState();
  const hostState = useHostState();
  const connectionState = useConnectionState();
  const updateVideoTime = useStore(state => state.updateVideoTime);
  const updateDrift = useStore(state => state.updateDrift);

  // Calculate server time based on offset
  const getServerTime = useCallback(() => {
    return Date.now() + connectionState.offset;
  }, [connectionState.offset]);

  // Handle video events from server
  useEffect(() => {
    const socket = wsManager.getSocket();
    if (!socket) return;

    const handleVideoPlay = ({ startAtServerTime, position }: any) => {
      const serverNow = getServerTime();
      const delay = Math.max(0, startAtServerTime - serverNow);
      
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.seekTo(position, 'seconds');
          setLocalTime(position);
          updateVideoTime(position);
        }
      }, delay);
    };

    const handleVideoPause = ({ position }: any) => {
      if (playerRef.current) {
        playerRef.current.seekTo(position, 'seconds');
        setLocalTime(position);
        updateVideoTime(position);
      }
    };

    const handleVideoSeek = ({ toSeconds }: any) => {
      if (playerRef.current) {
        playerRef.current.seekTo(toSeconds, 'seconds');
        setLocalTime(toSeconds);
        updateVideoTime(toSeconds);
      }
    };

    const handleVideoRate = ({ playbackRate }: any) => {
      // React Player doesn't support dynamic playback rate easily
      // This would need custom implementation or different player
      console.log('Playback rate change:', playbackRate);
    };

    const handleVideoLoad = ({ videoUrl }: any) => {
      // Video URL is updated through store, player will reload
      setLocalTime(0);
      updateVideoTime(0);
    };

    const handleTimeSync = (data: any) => {
      const { position, paused, serverSentAt } = data;
      const serverNow = getServerTime();
      const timeSinceSync = (serverNow - serverSentAt) / 1000;
      const expectedPosition = paused ? position : position + timeSinceSync;
      
      const drift = Math.abs(localTime - expectedPosition) * 1000; // ms
      updateDrift(drift);
      
      // Hard seek if drift > 400ms
      if (drift > 400 && playerRef.current && !isSeeking) {
        playerRef.current.seekTo(expectedPosition, 'seconds');
        setLocalTime(expectedPosition);
        updateVideoTime(expectedPosition);
        setLastSyncTime(Date.now());
      }
    };

    socket.on('ws:video-play', handleVideoPlay);
    socket.on('ws:video-pause', handleVideoPause);
    socket.on('ws:video-seek', handleVideoSeek);
    socket.on('ws:video-rate', handleVideoRate);
    socket.on('ws:video-load', handleVideoLoad);
    socket.on('ws:timesync', handleTimeSync);

    return () => {
      socket.off('ws:video-play', handleVideoPlay);
      socket.off('ws:video-pause', handleVideoPause);
      socket.off('ws:video-seek', handleVideoSeek);
      socket.off('ws:video-rate', handleVideoRate);
      socket.off('ws:video-load', handleVideoLoad);
      socket.off('ws:timesync', handleTimeSync);
    };
  }, [getServerTime, localTime, isSeeking, updateVideoTime, updateDrift]);

  // Update local time
  const handleProgress = useCallback((state: { playedSeconds: number }) => {
    if (!isSeeking) {
      setLocalTime(state.playedSeconds);
    }
  }, [isSeeking]);

  // Host controls
  const handlePlayPause = () => {
    if (!hostState.isHost) return;
    
    const socket = wsManager.getSocket();
    if (!socket) return;

    const serverTime = getServerTime();
    
    if (videoState.paused) {
      socket.emit('ws:play', { atHostTime: serverTime });
    } else {
      socket.emit('ws:pause', { atHostTime: serverTime });
    }
  };

  const handleSeek = (newTime: number) => {
    if (!hostState.isHost) return;
    
    const socket = wsManager.getSocket();
    if (!socket) return;

    setIsSeeking(true);
    const serverTime = getServerTime();
    
    socket.emit('ws:seek', { 
      toSeconds: newTime, 
      atHostTime: serverTime 
    });
    
    setTimeout(() => setIsSeeking(false), 100);
  };

  const handleSyncNow = () => {
    const socket = wsManager.getSocket();
    if (!socket) return;

    // Request immediate time sync
    socket.emit('ws:ping', { clientSentAt: Date.now() });
  };

  if (!videoState.videoUrl) {
    return (
      <Card className="gradient-card border-card-border">
        <CardContent className="flex items-center justify-center py-32">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted/20 flex items-center justify-center">
              <Play className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium">No video loaded</p>
              <p className="text-sm text-muted-foreground">
                {hostState.isHost ? 'Load a video to start watching' : 'Waiting for host to load a video'}
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
            onProgress: handleProgress,
            onDuration: setDuration,
            onReady: () => {
              if (playerRef.current) {
                playerRef.current.seekTo(videoState.position, 'seconds');
                setLocalTime(videoState.position);
              }
            }
          })}
          
          {/* Sync Status Overlay */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Badge 
              variant="secondary" 
              className={cn(
                "bg-black/50 backdrop-blur-sm",
                connectionState.drift > 400 ? "border-destructive/50" : 
                connectionState.drift > 100 ? "border-warning/50" : 
                "border-success/50"
              )}
            >
              {connectionState.drift.toFixed(0)}ms drift
            </Badge>
            
            {hostState.isHost && (
              <Badge variant="host" className="bg-black/50 backdrop-blur-sm">
                HOST
              </Badge>
            )}
          </div>
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
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncNow}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Sync Now
              </Button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[volume]}
                max={1}
                step={0.01}
                onValueChange={([value]) => setVolume(value)}
                className="w-20"
              />
            </div>
          </div>
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