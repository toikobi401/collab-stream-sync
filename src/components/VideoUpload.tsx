import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Link } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { useHostState } from '@/store';
import { supabaseApi } from '@/lib/supabase-api';

interface VideoUploadProps {
  roomId: string;
  onVideoUploaded: () => void;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({ 
  roomId, 
  onVideoUploaded
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hostState = useHostState();
  const { toast } = useToast();

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !hostState.isHost) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileArray = Array.from(files);
      
      if (fileArray.length > 5) {
        toast({
          title: "Too many files",
          description: "Maximum 5 videos allowed per room",
          variant: "destructive"
        });
        return;
      }

      // Check total file size
      const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0);
      const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
      
      if (totalSize > maxSize) {
        toast({
          title: "Files too large",
          description: "Total file size exceeds 10GB limit",
          variant: "destructive"
        });
        return;
      }

      let uploadResults: { url: string; videoId: string }[] = [];
      
      if (fileArray.length === 1) {
        // Single file upload
        const result = await supabaseApi.uploadVideo(roomId, fileArray[0]);
        uploadResults = [result];
        setUploadProgress(50);
      } else {
        // Multiple file upload
        uploadResults = await supabaseApi.uploadMultipleVideos(roomId, fileArray);
        setUploadProgress(50);
      }

      // Extract video duration for each uploaded video with sequential processing
      for (let i = 0; i < uploadResults.length; i++) {
        const result = uploadResults[i];
        console.log(`Processing video ${i + 1}/${uploadResults.length}:`, result.videoId);
        
        // Add delay between extractions to prevent conflicts
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        await extractVideoDuration(result.url, result.videoId);
      }
      
      setUploadProgress(100);

      toast({
        title: "Upload successful", 
        description: `${fileArray.length} video(s) uploaded successfully. Extracting video duration...`,
      });
      
      // Call onVideoUploaded to refresh the playlist immediately
      onVideoUploaded();
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Show duration extraction completion
      setTimeout(() => {
        toast({
          title: "Processing complete",
          description: "Video duration extraction completed",
        });
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload video(s)",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const extractVideoDuration = async (videoUrl: string, videoId: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      console.log('Starting duration extraction for video:', videoId, videoUrl);
      
      // Create a new video element for each extraction to avoid conflicts
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.muted = true; // Required for autoplay policies
      
      let timeoutId: NodeJS.Timeout;
      let isResolved = false;
      
      const cleanup = () => {
        if (isResolved) return;
        isResolved = true;
        
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
        video.removeEventListener('canplaythrough', handleCanPlay);
        video.src = '';
        video.load();
        
        if (timeoutId) clearTimeout(timeoutId);
        resolve();
      };
      
      const handleLoadedMetadata = async () => {
        console.log('Video metadata loaded for:', videoId, 'Duration:', video.duration);
        
        try {
          if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
            console.log('Updating video duration in database:', video.duration);
            await supabaseApi.updateVideoDuration(videoId, video.duration);
            console.log('Duration updated successfully for video:', videoId);
          } else {
            console.warn('Invalid duration for video:', videoId, video.duration);
          }
        } catch (error) {
          console.error('Failed to update video duration for video:', videoId, error);
        } finally {
          cleanup();
        }
      };

      const handleCanPlay = async () => {
        console.log('Video can play for:', videoId, 'Duration:', video.duration);
        if (!isResolved && video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
          handleLoadedMetadata();
        }
      };

      const handleError = (event: Event) => {
        console.error('Video loading error for:', videoId, event);
        cleanup();
      };

      // Set timeout to prevent hanging
      timeoutId = setTimeout(() => {
        console.warn('Duration extraction timeout for video:', videoId);
        cleanup();
      }, 10000); // 10 second timeout

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleError);
      video.addEventListener('canplaythrough', handleCanPlay);
      
      // Add delay before setting src to ensure video is ready
      setTimeout(() => {
        if (!isResolved) {
          console.log('Setting video source:', videoUrl);
          video.src = videoUrl;
        }
      }, 100);
    });
  };

  const handleUrlLoad = async () => {
    if (!urlInput.trim() || !hostState.isHost) return;

    setIsUploading(true);
    try {
      await supabaseApi.loadVideoFromUrl(roomId, urlInput.trim());
      toast({
        title: "Video loaded",
        description: "Video URL loaded successfully",
      });
      setUrlInput('');
      onVideoUploaded();
    } catch (error: any) {
      toast({
        title: "Failed to load video",
        description: error.message || "Invalid video URL",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (!hostState.isHost) {
    return (
      <Card className="gradient-card border-card-border">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Only the host can upload videos
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="gradient-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload Videos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
        {/* File Upload */}
        <div className="space-y-4">
          <div>
            <Input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={isUploading}
              className="hidden"
              id="video-upload"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Video Files
            </Button>
          </div>

          {/* URL Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Or paste video URL..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={isUploading}
            />
            <Button 
              onClick={handleUrlLoad}
              disabled={isUploading || !urlInput.trim()}
              variant="outline"
            >
              <Link className="h-4 w-4" />
            </Button>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-sm text-muted-foreground text-center">
                {uploadProgress === 0 ? 'Starting upload...' : 'Uploading video...'}
              </p>
            </div>
          )}
        </div>

        {/* Upload Guidelines */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Maximum 5 videos per room</p>
          <p>• Total size limit: 10GB</p>
          <p>• Supported formats: MP4, WebM, OGG, HLS</p>
        </div>
      </CardContent>
    </Card>
    </>
  );
};