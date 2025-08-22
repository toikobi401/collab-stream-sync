import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabaseApi } from '@/lib/supabase-api';
import { useRoom, useHostState } from '@/store';
import { Upload, Link, Film, AlertCircle } from 'lucide-react';

export const VideoUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const room = useRoom();
  const hostState = useHostState();
  const { toast } = useToast();

  if (!room || !hostState.isHost) {
    return null;
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const videoUrl = await supabaseApi.uploadVideo(room.id, file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      toast({
        title: "Video uploaded!",
        description: `${file.name} is now ready for streaming`,
      });

      // Reset after a short delay
      setTimeout(() => {
        setUploadProgress(0);
        setUploading(false);
      }, 1000);

    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload video');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUrlLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;

    setLoadingUrl(true);
    setError(null);

    try {
      await supabaseApi.loadVideoFromUrl(room.id, videoUrl.trim());
      
      toast({
        title: "Video loaded!",
        description: "Video URL has been set for the room",
      });

      setVideoUrl('');
    } catch (error: any) {
      console.error('URL load error:', error);
      setError(error.message || 'Failed to load video URL');
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          Video Management
        </CardTitle>
        <CardDescription>
          Upload a video file or load from URL (Host only)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* File Upload */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Video File
          </h4>
          
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              uploading ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {uploading ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Uploading video...
                </div>
                <Progress value={uploadProgress} className="w-full" />
                <div className="text-xs text-muted-foreground">
                  {uploadProgress}% complete
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Drop video file here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports MP4 and HLS (.m3u8) files up to 200MB
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select File
                </Button>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,.m3u8"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* URL Input */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Link className="h-4 w-4" />
            Load from URL
          </h4>
          
          <form onSubmit={handleUrlLoad} className="space-y-3">
            <Input
              type="url"
              placeholder="https://example.com/video.mp4"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              disabled={loadingUrl}
            />
            <Button 
              type="submit" 
              className="w-full"
              disabled={loadingUrl || !videoUrl.trim()}
            >
              {loadingUrl ? "Loading..." : "Load Video URL"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};