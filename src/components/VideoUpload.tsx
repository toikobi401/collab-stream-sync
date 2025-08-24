import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Link, Trash2, Play } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { supabaseApi } from '@/lib/supabase-api';
import { RoomVideo } from '@/types';

interface VideoUploadProps {
  roomId: string;
  onVideoUploaded: () => void;
  videos: RoomVideo[];
  onVideoSwitch: (index: number) => void;
  currentIndex?: number;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({ 
  roomId, 
  onVideoUploaded, 
  videos, 
  onVideoSwitch,
  currentIndex = 1 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const remainingSlots = 5 - videos.length;
    
    if (fileArray.length > remainingSlots) {
      toast({
        title: "Too many files",
        description: `Can only upload ${remainingSlots} more video(s). Maximum 5 videos per room.`,
        variant: "destructive"
      });
      return;
    }

    // Check total size
    const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0);
    const currentTotalSize = videos.reduce((sum, video) => sum + video.file_size, 0);
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
    
    if (currentTotalSize + totalSize > maxSize) {
      toast({
        title: "File size limit exceeded",
        description: "Total video size would exceed 10GB limit for this room",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      if (fileArray.length === 1) {
        await supabaseApi.uploadVideo(roomId, fileArray[0]);
      } else {
        await supabaseApi.uploadMultipleVideos(roomId, fileArray);
      }
      
      toast({
        title: "Upload successful",
        description: `${fileArray.length} video(s) uploaded successfully`,
      });
      onVideoUploaded();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload video",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUrlLoad = async () => {
    if (!urlInput.trim()) return;

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
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      await supabaseApi.deleteRoomVideo(videoId);
      toast({
        title: "Video deleted",
        description: "Video removed from playlist",
      });
      onVideoUploaded();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete video",
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const totalSize = videos.reduce((sum, video) => sum + video.file_size, 0);
  const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
  const usagePercentage = (totalSize / maxSize) * 100;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Video Playlist ({videos.length}/5)
        </CardTitle>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Storage Used</span>
            <span>{formatFileSize(totalSize)} / 10GB</span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Section */}
        <div className="space-y-4">
          <div>
            <Input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={isUploading || videos.length >= 5}
              className="hidden"
              id="video-upload"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || videos.length >= 5}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {videos.length >= 5 ? 'Maximum Videos Reached' : 'Upload Video(s)'}
            </Button>
          </div>

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
            >
              <Link className="h-4 w-4" />
            </Button>
          </div>

          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-sm text-muted-foreground text-center">
                Uploading video...
              </p>
            </div>
          )}
        </div>

        {/* Playlist */}
        {videos.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Playlist</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {videos.map((video, index) => (
                <div 
                  key={video.id} 
                  className={`flex items-center gap-2 p-2 rounded border ${
                    currentIndex === index + 1 ? 'bg-primary/10 border-primary' : ''
                  }`}
                >
                  <Button
                    size="sm"
                    variant={currentIndex === index + 1 ? "default" : "outline"}
                    onClick={() => onVideoSwitch(index + 1)}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{video.video_filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(video.file_size)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteVideo(video.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};