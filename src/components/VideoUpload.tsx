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

      if (fileArray.length === 1) {
        // Single file upload
        await supabaseApi.uploadVideo(roomId, fileArray[0]);
        setUploadProgress(100);
      } else {
        // Multiple file upload
        await supabaseApi.uploadMultipleVideos(roomId, fileArray);
        setUploadProgress(100);
      }

      toast({
        title: "Upload successful",
        description: `${fileArray.length} video(s) uploaded successfully`,
      });
      
      onVideoUploaded();
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
  );
};