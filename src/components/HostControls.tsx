import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useStore, useHostState, useRoom, useMembers } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api';
import { wsManager } from '@/lib/websocket';
import { Crown, Upload, UserCheck, AlertCircle } from 'lucide-react';

export function HostControls() {
  const [videoUrl, setVideoUrl] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const hostState = useHostState();
  const room = useRoom();
  const members = useMembers();
  const setHostState = useStore(state => state.setHostState);
  const { toast } = useToast();

  const handleClaimHost = async () => {
    if (!room) return;
    
    setIsLoading(true);
    try {
      await api.claimHost(room.id);
      setHostState({ isHost: true, canBecomeHost: false });
      
      toast({
        title: "Host claimed",
        description: "You are now the host",
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Cannot claim host",
          description: error.message,
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferHost = async () => {
    if (!room || !transferTarget) return;
    
    setIsLoading(true);
    try {
      await api.transferHost(room.id, transferTarget);
      setHostState({ isHost: false, canBecomeHost: true });
      setTransferTarget('');
      
      toast({
        title: "Host transferred",
        description: "Host privileges have been transferred",
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Transfer failed",
          description: error.message,
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadVideo = async () => {
    if (!room || !videoUrl.trim()) return;
    
    // Basic URL validation
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(videoUrl.trim())) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid HTTP/HTTPS URL",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const socket = wsManager.getSocket();
      if (socket) {
        socket.emit('ws:load', { videoUrl: videoUrl.trim() });
        setVideoUrl('');
        
        toast({
          title: "Video loaded",
          description: "Video has been loaded for all viewers",
        });
      }
    } catch (error) {
      toast({
        title: "Load failed",
        description: "Failed to load video",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const otherMembers = members.filter(member => member.id !== useStore.getState().user?.id);

  return (
    <Card className="gradient-card border-card-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-accent" />
          Host Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Host Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Current Status</span>
          {hostState.isHost ? (
            <Badge variant="host">You are Host</Badge>
          ) : (
            <Badge variant="outline">Viewer</Badge>
          )}
        </div>

        {/* Become Host */}
        {!hostState.isHost && hostState.canBecomeHost && (
          <div className="space-y-2">
            <Button 
              onClick={handleClaimHost}
              disabled={isLoading}
              className="w-full"
              variant="host"
            >
              <Crown className="w-4 h-4 mr-2" />
              Become Host
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Take control of the video playback
            </p>
          </div>
        )}

        {/* Host-only controls */}
        {hostState.isHost && (
          <>
            {/* Load Video */}
            <div className="space-y-3">
              <Label htmlFor="video-url">Load Video URL</Label>
              <div className="flex gap-2">
                <Input
                  id="video-url"
                  type="url"
                  placeholder="https://example.com/video.mp4"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  disabled={isLoading}
                  className="bg-input/50 border-card-border"
                />
                <Button 
                  onClick={handleLoadVideo}
                  disabled={isLoading || !videoUrl.trim()}
                  size="sm"
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Supports MP4, HLS, YouTube, and other formats
              </p>
            </div>

            {/* Transfer Host */}
            {otherMembers.length > 0 && (
              <div className="space-y-3">
                <Label>Transfer Host</Label>
                <div className="flex gap-2">
                  <Select value={transferTarget} onValueChange={setTransferTarget}>
                    <SelectTrigger className="bg-input/50 border-card-border">
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.nickname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleTransferHost}
                    disabled={isLoading || !transferTarget}
                    variant="outline"
                    size="sm"
                  >
                    <UserCheck className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Warning for non-hosts */}
        {!hostState.isHost && !hostState.canBecomeHost && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-warning">Host already active</p>
              <p className="text-xs text-muted-foreground">
                Another user is currently hosting. You can only control playback when transferred host privileges.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}