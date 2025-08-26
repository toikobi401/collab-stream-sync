import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useHostState, useRoom, useVideoState } from '@/store';
import { useToast } from '@/components/ui/use-toast';
import { supabaseApi } from '@/lib/supabase-api';
import { RoomVideo } from '@/types';
import { Play, Trash2, FileVideo, Clock } from 'lucide-react';

interface VideoPlaylistProps {
  videos: RoomVideo[];
  currentVideoIndex: number;
  onVideoSwitch: (index: number) => void;
  onVideoDelete: (videoId: string) => void;
}

export function VideoPlaylist({ videos, currentVideoIndex, onVideoSwitch, onVideoDelete }: VideoPlaylistProps) {
  const [isLoading, setIsLoading] = useState(false);
  const hostState = useHostState();
  const room = useRoom();
  const videoState = useVideoState();
  const { toast } = useToast();

  const handleSelectVideo = async (index: number) => {
    if (!hostState.isHost || !room) return;
    
    setIsLoading(true);
    try {
      await onVideoSwitch(index);
      toast({
        title: "Video selected",
        description: `Now playing video ${index}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to switch video",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (videos.length === 0) {
    return (
      <Card className="gradient-card border-card-border">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted/20 flex items-center justify-center">
              <FileVideo className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium">No videos uploaded</p>
              <p className="text-sm text-muted-foreground">
                {hostState.isHost ? 'Upload videos to create your playlist' : 'Waiting for host to upload videos'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gradient-card border-card-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileVideo className="w-5 h-5 text-primary" />
          Video Playlist ({videos.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!videoState.videoUrl && (
          <div className="p-3 rounded-lg bg-info/10 border border-info/20">
            <p className="text-sm text-info font-medium">
              {hostState.isHost ? 'Select a video to start playing' : 'Waiting for host to select a video'}
            </p>
          </div>
        )}
        
        {videos.map((video, index) => {
          const videoIndex = index + 1;
          const isCurrentVideo = currentVideoIndex === videoIndex;
          const isActiveVideo = videoState.videoUrl === video.video_url;
          
          return (
            <div 
              key={video.id}
              className={`p-3 rounded-lg border transition-colors ${
                isActiveVideo 
                  ? 'bg-primary/10 border-primary/50' 
                  : 'bg-card/50 border-card-border hover:bg-card/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-muted-foreground">#{videoIndex}</span>
                    {isActiveVideo && (
                      <Badge variant="default" className="text-xs">
                        Currently Playing
                      </Badge>
                    )}
                  </div>
                  
                  <h4 className="font-medium text-sm truncate mb-1" title={video.video_filename}>
                    {video.video_filename}
                  </h4>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatFileSize(video.file_size)}</span>
                    {video.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(video.duration)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {hostState.isHost && (
                    <>
                      <Button
                        variant={isActiveVideo ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSelectVideo(videoIndex)}
                        disabled={isLoading || isActiveVideo}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        {isActiveVideo ? 'Playing' : 'Play'}
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Video</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{video.video_filename}"? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => onVideoDelete(video.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}