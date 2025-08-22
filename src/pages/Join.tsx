import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store';
import { supabaseApi } from '@/lib/supabase-api';
import { Users, Video, Zap } from 'lucide-react';
import heroImage from '@/assets/hero-streaming.jpg';
import logoImage from '@/assets/logo-sync.jpg';

export default function Join() {
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [roomCount, setRoomCount] = useState('0/5');
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const auth = useAuth();
  const { setRoom } = useStore();

  // Redirect if already authenticated
  useEffect(() => {
    if (!auth.loading && auth.user) {
      navigate('/room', { replace: true });
    }
  }, [auth.loading, auth.user, navigate]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nickname.trim()) {
      toast({
        title: "Nickname required",
        description: "Please enter a nickname to join",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { user, session } = await supabaseApi.signUp(
        `${nickname.trim()}@temp.com`, 
        'temppassword', 
        nickname.trim()
      );
      
      if (user) {
        // Set the default room
        setRoom({
          id: '00000000-0000-0000-0000-000000000001',
          name: 'room-1',
          capacity: 5,
          members: [],
          currentMembers: 0,
          enabled: true
        });
        
        toast({
          title: "Welcome!",
          description: `Logged in as ${nickname.trim()}`,
        });
        
        navigate('/room');
      }
    } catch (error: any) {
      console.error('Join error:', error);
      
      toast({
        title: "Join failed",
        description: error.message || "Unable to join the room. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Hero Background */}
      <div className="absolute inset-0">
        <img 
          src={heroImage}
          alt="Streaming background"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 gradient-bg opacity-90" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Logo & Title */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src={logoImage}
                alt="CollabStream Sync"
                className="w-16 h-16 rounded-xl shadow-primary glow-primary"
              />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gradient-primary">
                CollabStream Sync
              </h1>
              <p className="text-muted-foreground mt-2">
                Watch videos together in perfect sync
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto gradient-primary rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Up to 5 viewers</p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto gradient-accent rounded-xl flex items-center justify-center">
                <Video className="w-6 h-6 text-accent-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Real-time sync</p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto gradient-card rounded-xl flex items-center justify-center border border-card-border">
                <Zap className="w-6 h-6 text-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Low latency</p>
            </div>
          </div>

          {/* Join Form */}
          <Card className="gradient-card border-card-border shadow-primary">
            <CardHeader className="text-center">
              <CardTitle>Join Room</CardTitle>
              <CardDescription>
                Enter your nickname to start watching together
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="Enter your nickname..."
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    disabled={isLoading}
                    className="bg-input/50 border-card-border focus:border-primary/50"
                    maxLength={32}
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || !nickname.trim()}
                  variant="default"
                >
                  {isLoading ? (
                    <>
                      <Loading size="sm" className="mr-2" />
                      Joining...
                    </>
                  ) : (
                    'Join Room'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Room Status */}
          <Card className="gradient-card border-card-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Default Room</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-sm font-mono">{roomCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}