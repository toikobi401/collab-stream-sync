import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useStore, useVideoState, useHostState, useConnectionState, useProfile } from '@/store';
import { supabaseApi } from '@/lib/supabase-api';
import { Play, Pause, RotateCcw, Volume2, SkipForward, SkipBack, Wifi, WifiOff, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface PlayerRef {
  seekTo: (seconds: number, type?: 'seconds' | 'fraction') => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface ReactPlayerRef {
  seekTo: (seconds: number, type?: 'seconds' | 'fraction') => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export function VideoPlayer() {
  const playerRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isSeeking, setIsSeeking] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [isUpdatingState, setIsUpdatingState] = useState(false);
  const [lastStateUpdate, setLastStateUpdate] = useState(0);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  
  // Subtitle states
  const [subtitleTracks, setSubtitleTracks] = useState<TextTrack[]>([]);
  const [activeSubtitleTrack, setActiveSubtitleTrack] = useState<number>(-1);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  
  // Fullscreen states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState(true);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const videoState = useVideoState();
  const hostState = useHostState();
  const connectionState = useConnectionState();
  const profile = useProfile();
  const room = useStore(state => state.room);
  const { toast } = useToast();
  
  const updateVideoTime = useStore(state => state.updateVideoTime);
  const updateDrift = useStore(state => state.updateDrift);
  const setConnectionState = useStore(state => state.setConnectionState);
  const setVideoState = useStore(state => state.setVideoState);

  // Calculate server time sync with RTT measurement
  const syncServerTime = useCallback(async () => {
    const startTime = Date.now();
    
    // Simulate network RTT by measuring database response time
    try {
      if (room) {
        const beforePing = performance.now();
        await supabaseApi.getRoomState(room.id);
        const afterPing = performance.now();
        const rtt = afterPing - beforePing;
        
        setConnectionState({ 
          rtt: Math.round(rtt), 
          offset: 0, // Local time reference
          lastSync: Date.now() 
        });
      }
    } catch (error) {
      // Fallback to basic sync
      setConnectionState({ 
        rtt: 50, // Default assumed RTT
        offset: 0,
        lastSync: Date.now() 
      });
    }
  }, [setConnectionState, room]);

  // Sync time periodically - more frequent for better accuracy
  useEffect(() => {
    syncServerTime();
    const interval = setInterval(syncServerTime, 15000); // Sync every 15 seconds
    return () => clearInterval(interval);
  }, [syncServerTime]);

  // Calculate drift and apply smart correction
  const calculateDrift = useCallback(() => {
    if (!playerRef.current || hostState.isHost || isSeeking) return;
    
    const actualPosition = playerRef.current.currentTime;
    const expectedPosition = videoState.position;
    const drift = Math.abs(expectedPosition - actualPosition) * 1000; // ms
    
    updateDrift(drift);
    
    // Smart drift correction with different thresholds
    if (drift > 5000) {
      // Large drift - immediate hard sync
      console.log('Large drift detected, hard sync:', drift + 'ms');
      playerRef.current.currentTime = expectedPosition;
      setLocalTime(expectedPosition);
    } else if (drift > 2000) {
      // Medium drift - gradual correction
      console.log('Medium drift detected, gradual sync:', drift + 'ms');
      const correctionAmount = (expectedPosition - actualPosition) * 0.1; // 10% correction
      const targetTime = actualPosition + correctionAmount;
      playerRef.current.currentTime = targetTime;
      setLocalTime(targetTime);
    } else if (drift > 1000) {
      // Small drift - playback rate adjustment
      console.log('Small drift detected, rate adjustment:', drift + 'ms');
      const speedAdjustment = expectedPosition > actualPosition ? 1.05 : 0.95;
      playerRef.current.playbackRate = speedAdjustment;
      
      // Reset to normal speed after correction
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.playbackRate = videoState.playbackRate || 1.0;
        }
      }, 2000);
    }
  }, [videoState.position, hostState.isHost, isSeeking, updateDrift, videoState.playbackRate]);

  // Monitor drift every 2 seconds for more responsive correction
  useEffect(() => {
    const interval = setInterval(calculateDrift, 2000);
    return () => clearInterval(interval);
  }, [calculateDrift]);

  // Enhanced progress tracking with network compensation
  const handleProgress = useCallback(() => {
    if (!isSeeking && playerRef.current) {
      const currentTime = playerRef.current.currentTime;
      setLocalTime(currentTime);
      updateVideoTime(currentTime);
      
      // Host broadcasts position updates with adaptive frequency
      if (hostState.isHost && room) {
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncTime;
        
        // Adaptive sync frequency based on video state
        let syncInterval = 3000; // Default 3 seconds
        
        if (!videoState.paused) {
          syncInterval = 2000; // More frequent when playing
        }
        
        if (timeSinceLastSync > syncInterval) {
          // Compensate for network delay
          const networkDelay = connectionState.rtt / 2; // Half RTT for one-way delay
          const compensatedPosition = currentTime + (networkDelay / 1000);
          
          supabaseApi.updateRoomState(room.id, {
            position: compensatedPosition,
            updated_at: new Date().toISOString()
          }).catch(console.error);
          
          setLastSyncTime(now);
          console.log('Position synced:', {
            rawPosition: currentTime,
            compensatedPosition,
            networkDelay,
            rtt: connectionState.rtt
          });
        }
      }
    }
  }, [isSeeking, updateVideoTime, hostState.isHost, room, lastSyncTime, connectionState.rtt, videoState.paused]);

  // Listen to video progress
  useEffect(() => {
    const video = playerRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      handleProgress();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [handleProgress]);

  // Host controls
  const handlePlayPause = async () => {
    if (!hostState.isHost || !room || isUpdatingState) return;
    
    const now = Date.now();
    if (now - lastStateUpdate < 1000) return; // Debounce 1 second
    
    setIsUpdatingState(true);
    setLastStateUpdate(now);
    
    try {
      const currentPos = playerRef.current ? 
        playerRef.current.currentTime : localTime;
      
      const newPausedState = !videoState.paused;
      
      console.log('Play/pause clicked:', {
        currentPaused: videoState.paused,
        newPaused: newPausedState,
        currentPos,
        isHost: hostState.isHost
      });
      
      // Optimistic update - cập nhật local state ngay lập tức
      setVideoState({
        paused: newPausedState,
        position: currentPos,
        lastUpdated: now
      });
      
      // Apply change immediately to video player
      if (playerRef.current) {
        if (newPausedState) {
          playerRef.current.pause();
        } else {
          playerRef.current.play().catch(console.error);
        }
      }
      
      const updateData = {
        paused: newPausedState,
        position: currentPos
      };
      
      console.log('Updating room state with:', updateData);
      
      const result = await supabaseApi.updateRoomState(room.id, updateData);
      
      console.log('Update result:', result);
    } catch (error: any) {
      console.error('Play/pause error:', error);
      // Revert optimistic update on error
      setVideoState({
        paused: videoState.paused,
        position: videoState.position,
        lastUpdated: videoState.lastUpdated
      });
      toast({
        title: "Control error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setTimeout(() => {
        setIsUpdatingState(false);
      }, 500);
    }
  };

  // Enhanced seek with full state synchronization
  const handleSeek = async (newTime: number) => {
    if (!hostState.isHost || !room || isUpdatingState) return;
    
    setIsSeeking(true);
    setLocalTime(newTime);
    
    // Set video time directly with smooth transition
    if (playerRef.current) {
      playerRef.current.currentTime = newTime;
    }
    
    setIsUpdatingState(true);
    
    try {
      // Compensate for network delay when seeking
      const networkDelay = connectionState.rtt / 2;
      const compensatedTime = newTime + (networkDelay / 1000);
      const serverTime = Date.now() + serverTimeOffset;
      
      console.log('🎯 Seek operation (HOST):', {
        requestedTime: newTime,
        compensatedTime,
        networkDelay,
        rtt: connectionState.rtt,
        isHost: hostState.isHost,
        currentPaused: videoState.paused,
        serverTime
      });
      
      // Full state broadcast including current play/pause state
      const updateData = {
        position: compensatedTime,
        paused: videoState.paused, // Keep current play/pause state
        playback_rate: videoState.playbackRate || 1.0,
        updated_at: new Date(serverTime).toISOString()
      };
      
      const result = await supabaseApi.updateRoomState(room.id, updateData);
      
      console.log('🚀 Seek broadcast result:', result);
      
      // Update local store immediately for responsiveness
      setVideoState({
        position: compensatedTime
      });
      
      toast({
        title: "Video seeked", 
        description: `Jumped to ${formatTime(newTime)}`,
      });
      
    } catch (error: any) {
      console.error('❌ Seek error:', error);
      toast({
        title: "Seek error", 
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setTimeout(() => {
        setIsSeeking(false);
        setIsUpdatingState(false);
      }, 300); // Shorter debounce for better responsiveness
    }
  };

  const handleSkip = async (seconds: number) => {
    if (!hostState.isHost || !playerRef.current || !room) return;
    
    const currentTime = playerRef.current.currentTime;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    await handleSeek(newTime);
  };

  // Handle playback rate change with full sync
  const handlePlaybackRateChange = async (newRate: number) => {
    if (!hostState.isHost || !room || isUpdatingState) return;
    
    setIsUpdatingState(true);
    
    try {
      const currentPos = playerRef.current ? 
        playerRef.current.currentTime : localTime;
      
      console.log('Playback rate change:', {
        oldRate: videoState.playbackRate,
        newRate: newRate,
        currentPos,
        isHost: hostState.isHost
      });
      
      // Update both rate and position for precise sync
      const updateData = {
        playback_rate: newRate,
        position: currentPos,
        updated_at: new Date().toISOString()
      };
      
      console.log('Updating room state with rate:', updateData);
      
      const result = await supabaseApi.updateRoomState(room.id, updateData);
      
      console.log('Playback rate update result:', result);
      
      // Apply rate change locally immediately for smooth UX
      if (playerRef.current) {
        playerRef.current.playbackRate = newRate;
      }
      
      toast({
        title: "Speed changed",
        description: `Playback speed set to ${newRate}x`,
      });
      
    } catch (error: any) {
      console.error('Playback rate change error:', error);
      toast({
        title: "Speed change error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setTimeout(() => {
        setIsUpdatingState(false);
      }, 500);
    }
  };

  // Enhanced sync with time-based compensation
  const handleSyncNow = async () => {
    if (!playerRef.current || !room) return;
    
    try {
      // Lấy position hiện tại của người ấn sync
      const currentPosition = playerRef.current.currentTime;
      
      console.log('🔄 Sync requested by user:', {
        currentPosition,
        isHost: hostState.isHost,
        room: room.id
      });
      
      // Gửi position hiện tại của người này lên server để tất cả user khác sync theo
      const updateData = {
        position: currentPosition,
        // Giữ nguyên trạng thái play/pause hiện tại
        paused: videoState.paused
      };
      
      const result = await supabaseApi.updateRoomState(room.id, updateData);
      
      console.log('✅ Sync update sent:', result);
      
      const displayName = profile?.nickname || 'You';
      
      toast({
        title: "Sync sent",
        description: `${displayName} synchronized all users to ${formatTime(currentPosition)}`,
      });
      
    } catch (error: any) {
      console.error('❌ Sync error:', error);
      toast({
        title: "Sync failed",
        description: error.message || "Failed to synchronize with other users",
        variant: "destructive"
      });
    }
  };

  // Fullscreen functions (tương tự YouTube)
  const enterFullscreen = async () => {
    if (!videoContainerRef.current) return;
    
    try {
      if (videoContainerRef.current.requestFullscreen) {
        await videoContainerRef.current.requestFullscreen();
      } else if ((videoContainerRef.current as any).webkitRequestFullscreen) {
        await (videoContainerRef.current as any).webkitRequestFullscreen();
      } else if ((videoContainerRef.current as any).msRequestFullscreen) {
        await (videoContainerRef.current as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      toast({
        title: "Fullscreen error",
        description: "Failed to enter fullscreen mode",
        variant: "destructive"
      });
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      setIsFullscreen(false);
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
      toast({
        title: "Fullscreen error", 
        description: "Failed to exit fullscreen mode",
        variant: "destructive"
      });
    }
  };

  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  // Auto-hide controls functions (tương tự YouTube)
  const resetHideControlsTimer = useCallback(() => {
    // Clear existing timeout
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }

    // Show controls
    setShowFullscreenControls(true);

    // Only set hide timer in fullscreen mode
    if (isFullscreen) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowFullscreenControls(false);
      }, 5000); // 5 giây
    }
  }, [isFullscreen]);

  const handleUserActivity = useCallback(() => {
    if (isFullscreen) {
      resetHideControlsTimer();
    }
  }, [isFullscreen, resetHideControlsTimer]);

  // Reset timer when entering fullscreen
  useEffect(() => {
    if (isFullscreen) {
      setShowFullscreenControls(true);
      resetHideControlsTimer();
    } else {
      // Clear timer when exiting fullscreen
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
        hideControlsTimeoutRef.current = null;
      }
      setShowFullscreenControls(true);
    }
  }, [isFullscreen, resetHideControlsTimer]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    const handleKeyPress = (event: KeyboardEvent) => {
      // Toggle fullscreen với phím F (như YouTube)
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleFullscreen();
      }
      // ESC để thoát fullscreen
      if (event.key === 'Escape' && isFullscreen) {
        exitFullscreen();
      }
      
      // Reset timer khi có hoạt động
      handleUserActivity();
    };

    // User activity events để reset timer
    const userActivityEvents = ['mousemove', 'mousedown', 'click', 'scroll', 'touchstart'];
    
    userActivityEvents.forEach(eventType => {
      document.addEventListener(eventType, handleUserActivity);
    });

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyPress);

    return () => {
      userActivityEvents.forEach(eventType => {
        document.removeEventListener(eventType, handleUserActivity);
      });
      
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isFullscreen, handleUserActivity]);

  // Enhanced video state sync with predictive positioning
  useEffect(() => {
    if (!playerRef.current || !videoState.videoUrl) return;
    
    const now = Date.now();
    
    // Giảm debounce time để responsive hơn
    if (now - lastStateUpdate < 100) return;
    
    // Sync playing state FIRST và quan trọng nhất
    const shouldPlay = !videoState.paused;
    const isCurrentlyPaused = playerRef.current.paused;
    
    console.log('Syncing video state:', {
      shouldPlay,
      currentPaused: videoState.paused,
      playerPaused: isCurrentlyPaused,
      position: videoState.position,
      isHost: hostState.isHost,
      lastUpdated: videoState.lastUpdated
    });
    
    // Control video playback - ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT
    if (shouldPlay && isCurrentlyPaused) {
      console.log('▶️ Starting video playback');
      playerRef.current.play().catch((error) => {
        console.error('Play error:', error);
      });
    } else if (!shouldPlay && !isCurrentlyPaused) {
      console.log('⏸️ Pausing video playback');
      playerRef.current.pause();
    }
    
    // Set volume and playback rate with logging
    playerRef.current.volume = volume;
    
    // Sync playback rate when it changes
    const currentRate = playerRef.current.playbackRate;
    const targetRate = videoState.playbackRate || 1.0;
    if (Math.abs(currentRate - targetRate) > 0.01) {
      console.log('🎛️ Syncing playback rate:', {
        currentRate,
        targetRate,
        isHost: hostState.isHost
      });
      playerRef.current.playbackRate = targetRate;
    }
    
    // Enhanced position sync for non-hosts with seeking detection
    if (!isSeeking && !hostState.isHost && videoState.position !== undefined) {
      const actualPosition = playerRef.current.currentTime;
      
      // Calculate expected position with time compensation
      const serverUpdateTime = new Date(videoState.lastUpdated || 0).getTime();
      const timeSinceUpdate = (now - serverUpdateTime) / 1000;
      
      let expectedPosition = videoState.position;
      
      // Predict current position if video is playing
      if (!videoState.paused && timeSinceUpdate > 0 && timeSinceUpdate < 10) {
        const playbackRate = videoState.playbackRate || 1.0;
        expectedPosition += timeSinceUpdate * playbackRate;
        
        // Add network delay compensation
        const networkDelay = connectionState.rtt / 2000;
        expectedPosition += networkDelay;
      }
      
      const timeDiff = Math.abs(actualPosition - expectedPosition);
      
      // Detect if this is a seeking operation (large sudden jump)
      const isLikelySeek = timeDiff > 3 || 
                          (timeSinceUpdate < 1 && timeDiff > 0.5) ||
                          (videoState.lastUpdated && videoState.lastUpdated > lastStateUpdate);
      
      console.log('📊 Member sync analysis:', {
        actualPosition: actualPosition.toFixed(2),
        expectedPosition: expectedPosition.toFixed(2),
        timeDiff: timeDiff.toFixed(2),
        timeSinceUpdate: timeSinceUpdate.toFixed(2),
        isLikelySeek,
        paused: videoState.paused,
        lastUpdate: videoState.lastUpdated
      });
      
      // Apply different sync strategies based on difference and type
      if (isLikelySeek) {
        // Seeking detected - immediate sync with smooth transition
        console.log('🎯 Seeking detected, immediate sync:', {
          from: actualPosition.toFixed(2),
          to: expectedPosition.toFixed(2),
          diff: timeDiff.toFixed(2)
        });
        playerRef.current.currentTime = expectedPosition;
        setLocalTime(expectedPosition);
        
        // Brief pause for smooth seeking experience
        if (!videoState.paused) {
          const wasPaused = playerRef.current.paused;
          playerRef.current.pause();
          setTimeout(() => {
            if (playerRef.current && !wasPaused && !videoState.paused) {
              playerRef.current.play();
            }
          }, 100);
        }
        
      } else if (timeDiff > 5) {
        // Large difference - immediate sync
        console.log('⚡ Large difference, immediate sync:', timeDiff.toFixed(2));
        playerRef.current.currentTime = expectedPosition;
        setLocalTime(expectedPosition);
      } else if (timeDiff > 1) {
        // Medium difference - smooth sync
        console.log('🔄 Medium difference, smooth sync:', timeDiff.toFixed(2));
        const smoothTarget = actualPosition + (expectedPosition - actualPosition) * 0.3;
        playerRef.current.currentTime = smoothTarget;
        setLocalTime(smoothTarget);
      }
      // Small differences (< 1 second) are handled by drift correction
    }
    
    // Update last state update timestamp
    if (videoState.lastUpdated && videoState.lastUpdated !== lastStateUpdate) {
      setLastStateUpdate(videoState.lastUpdated);
    }
  }, [videoState.paused, videoState.position, videoState.videoUrl, videoState.playbackRate, videoState.lastUpdated, localTime, isSeeking, hostState.isHost, lastStateUpdate, volume, connectionState.rtt]);

  // Force duration load when video URL changes
  useEffect(() => {
    if (!videoState.videoUrl) {
      setDuration(0);
      setLocalTime(0);
      return;
    }

    console.log('Video URL changed, attempting to load duration:', videoState.videoUrl);
    
    // Try to get duration from player after a short delay
    const timeoutId = setTimeout(() => {
      if (playerRef.current && playerRef.current.duration) {
        const videoDuration = playerRef.current.duration;
        if (videoDuration && videoDuration > 0) {
          console.log('Duration loaded from player:', videoDuration);
          setDuration(videoDuration);
        } else {
          console.log('Duration not available yet, will try again on metadata load');
        }
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [videoState.videoUrl]);

  // Auto-recovery mechanism for connection issues
  useEffect(() => {
    const checkConnection = () => {
      const timeSinceLastSync = Date.now() - connectionState.lastSync;
      
      // If no sync for more than 30 seconds, attempt recovery
      if (timeSinceLastSync > 30000) {
        console.log('Connection appears stale, attempting recovery...');
        syncServerTime();
        
        // Force a sync if not host
        if (!hostState.isHost) {
          handleSyncNow();
        }
      }
    };
    
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [connectionState.lastSync, hostState.isHost, syncServerTime]);

  // Cleanup timeout khi component unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  // Debug logging - Enhanced
  console.log('VideoPlayer state:', {
    videoUrl: videoState.videoUrl,
    videoFilename: videoState.videoFilename,
    paused: videoState.paused,
    position: videoState.position,
    isHost: hostState.isHost,
    room: room?.id,
    duration: duration,
    localTime: localTime,
    hasPlayerRef: !!playerRef.current
  });

  // Track videoState changes with detailed logging
  useEffect(() => {
    console.log('VideoPlayer videoState changed:', {
      paused: videoState.paused,
      position: videoState.position,
      playbackRate: videoState.playbackRate,
      videoUrl: videoState.videoUrl,
      timestamp: Date.now(),
      isHost: hostState.isHost
    });
  }, [videoState.paused, videoState.position, videoState.playbackRate, videoState.videoUrl, hostState.isHost]);

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
        <div 
          ref={videoContainerRef}
          className={cn(
            "relative aspect-video bg-black",
            isFullscreen && "fixed inset-0 z-50 bg-black aspect-auto flex items-center justify-center",
            isFullscreen && !showFullscreenControls && "cursor-none"
          )}
          onMouseMove={isFullscreen ? handleUserActivity : undefined}
          onClick={isFullscreen ? handleUserActivity : undefined}
        >
          {isVideoLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center space-y-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-muted-foreground">Loading video...</p>
              </div>
            </div>
          )}
          
          <video 
            ref={playerRef}
            src={videoState.videoUrl}
            width="100%"
            height="100%"
            playsInline
            onLoadStart={() => {
              console.log('Video loading started:', videoState.videoUrl);
              setIsVideoLoading(true);
            }}
            onLoadedMetadata={() => {
              console.log('Video metadata loaded');
              setIsVideoLoading(false);
              if (playerRef.current && playerRef.current.duration) {
                const videoDuration = playerRef.current.duration;
                console.log('Duration from metadata:', videoDuration);
                setDuration(videoDuration);
              }
            }}
            onLoadedData={() => {
              console.log('Video data loaded');
              setIsVideoLoading(false);
              if (playerRef.current && videoState.position !== undefined) {
                playerRef.current.currentTime = videoState.position;
                setLocalTime(videoState.position);
              }
            }}
            onCanPlay={() => {
              console.log('Video can start playing');
              setIsVideoLoading(false);
              if (playerRef.current && playerRef.current.duration) {
                const videoDuration = playerRef.current.duration;
                console.log('Duration from canplay:', videoDuration);
                setDuration(videoDuration);
              }
            }}
            onError={(error) => {
              console.error('Video player error:', error);
              setIsVideoLoading(false);
              toast({
                title: "Video playback error",
                description: "Failed to load video. Please try again.",
                variant: "destructive"
              });
            }}
            onPlay={() => {
              console.log('Video onPlay event triggered, current paused state:', videoState.paused);
            }}
            onPause={() => {
              console.log('Video onPause event triggered, current paused state:', videoState.paused);
            }}
            className={cn(
              "w-full h-full bg-black",
              isFullscreen && "max-w-full max-h-full object-contain"
            )}
          />
          
          {/* Sync Status Overlay */}
          <div className="absolute top-4 right-4 flex gap-2">
            {/* Connection Status */}
            <Badge 
              variant="outline" 
              className={cn(
                "bg-black/50 backdrop-blur-sm",
                connectionState.rtt > 200 ? "border-destructive/50 text-destructive" : 
                connectionState.rtt > 100 ? "border-warning/50 text-warning" : 
                "border-success/50 text-success"
              )}
            >
              {connectionState.rtt > 200 ? <WifiOff className="w-3 h-3 mr-1" /> : <Wifi className="w-3 h-3 mr-1" />}
              {connectionState.rtt}ms
            </Badge>
            
            {/* Drift Status */}
            <Badge 
              variant="secondary" 
              className={cn(
                "bg-black/50 backdrop-blur-sm",
                (connectionState.drift || 0) > 2000 ? "border-destructive/50 text-destructive" : 
                (connectionState.drift || 0) > 500 ? "border-warning/50 text-warning" : 
                "border-success/50 text-success"
              )}
            >
              {(connectionState.drift || 0).toFixed(0)}ms drift
            </Badge>
            
            {/* Host Badge */}
            {hostState.isHost && (
              <Badge variant="default" className="bg-primary/80 backdrop-blur-sm">
                HOST
              </Badge>
            )}
            
            {/* Playback Rate Badge */}
            {videoState.playbackRate && videoState.playbackRate !== 1 && (
              <Badge variant="secondary" className="bg-black/50 backdrop-blur-sm border-accent/50">
                {videoState.playbackRate}x speed
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

          {/* Fullscreen Controls Overlay (tương tự YouTube) */}
          {isFullscreen && (
            <div 
              className={cn(
                "absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/60 via-transparent to-black/60 transition-opacity duration-300",
                showFullscreenControls ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              onMouseMove={handleUserActivity}
              onClick={handleUserActivity}
            >
              {/* Top Controls */}
              <div className="flex justify-between items-start">
                <div className="flex gap-2">
                  {videoState.videoFilename && (
                    <Badge variant="outline" className="bg-black/70 backdrop-blur-sm text-white border-white/20">
                      {videoState.videoFilename}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exitFullscreen}
                  className="text-white hover:bg-white/20"
                >
                  <Minimize className="w-5 h-5" />
                </Button>
              </div>

              {/* Bottom Controls */}
              <div className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <Slider
                    value={[localTime]}
                    max={duration}
                    step={0.1}
                    onValueChange={([value]) => {
                      if (hostState.isHost) {
                        setLocalTime(value);
                        setIsSeeking(true);
                        if (playerRef.current) {
                          playerRef.current.currentTime = value;
                        }
                      }
                    }}
                    onValueCommit={([value]) => {
                      if (hostState.isHost) {
                        handleSeek(value);
                      }
                    }}
                    disabled={!hostState.isHost || isUpdatingState}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between text-sm text-white font-mono">
                    <span>{formatTime(localTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Play/Pause */}
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={handlePlayPause}
                      disabled={!hostState.isHost || isUpdatingState}
                      className="text-white hover:bg-white/20"
                    >
                      {isUpdatingState ? (
                        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : videoState.paused ? (
                        <Play className="w-6 h-6" />
                      ) : (
                        <Pause className="w-6 h-6" />
                      )}
                    </Button>

                    {/* Skip buttons */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSkip(-10)}
                      disabled={!hostState.isHost}
                      className="text-white hover:bg-white/20"
                    >
                      <SkipBack className="w-4 h-4 mr-1" />
                      10s
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSkip(10)}
                      disabled={!hostState.isHost}
                      className="text-white hover:bg-white/20"
                    >
                      <SkipForward className="w-4 h-4 mr-1" />
                      10s
                    </Button>

                    {/* Volume */}
                    <div className="flex items-center gap-2 text-white">
                      <Volume2 className="w-4 h-4" />
                      <Slider
                        value={[volume]}
                        max={1}
                        step={0.01}
                        onValueChange={([value]) => setVolume(value)}
                        className="w-20"
                      />
                      <span className="text-xs w-8">{Math.round(volume * 100)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Sync button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSyncNow}
                      disabled={hostState.isHost}
                      className="text-white hover:bg-white/20"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Sync
                    </Button>

                    {/* Status badges */}
                    <Badge 
                      variant="outline" 
                      className="bg-black/70 text-white border-white/20"
                    >
                      {connectionState.rtt}ms
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Controls (ẩn khi fullscreen) */}
      {!isFullscreen && (
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
                  console.log('🎛️ Slider dragging (HOST):', {
                    newTime: value.toFixed(2),
                    currentTime: localTime.toFixed(2),
                    duration: duration.toFixed(2)
                  });
                  
                  setLocalTime(value);
                  setIsSeeking(true); // Mark as seeking during drag
                  
                  // Apply seek locally immediately for smooth UX
                  if (playerRef.current) {
                    playerRef.current.currentTime = value;
                  }
                }
              }}
              onValueCommit={([value]) => {
                if (hostState.isHost) {
                  console.log('🎯 Slider commit (HOST) - Broadcasting seek:', {
                    seekTime: value.toFixed(2),
                    wasLocalTime: localTime.toFixed(2)
                  });
                  handleSeek(value);
                }
              }}
              disabled={!hostState.isHost || isUpdatingState}
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
                disabled={!hostState.isHost || isUpdatingState}
              >
                {isUpdatingState ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : videoState.paused ? (
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

            {/* Fullscreen Control */}
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen (f)" : "Enter fullscreen (f)"}
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </Button>
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
                  onClick={() => handlePlaybackRateChange(rate)}
                  disabled={isUpdatingState}
                >
                  {rate}x
                </Button>
              ))}
            </div>
          )}
          
          {/* Sync Information Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/50">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Drift</div>
              <div className={cn(
                "text-sm font-mono font-medium",
                (connectionState.drift || 0) > 2000 ? "text-destructive" : 
                (connectionState.drift || 0) > 500 ? "text-warning" : 
                "text-success"
              )}>
                {(connectionState.drift || 0).toFixed(0)}ms
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Network RTT</div>
              <div className={cn(
                "text-sm font-mono font-medium",
                connectionState.rtt > 200 ? "text-destructive" : 
                connectionState.rtt > 100 ? "text-warning" : 
                "text-success"
              )}>
                {connectionState.rtt}ms
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Last Sync</div>
              <div className="text-sm font-mono font-medium text-muted-foreground">
                {Math.round((Date.now() - connectionState.lastSync) / 1000)}s ago
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}